const crypto = require('crypto');
const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../lib/asyncHandler');
const paymongo = require('../lib/paymongo');
const { computeTotals } = require('../lib/shop');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+?63|0)9\d{9}$/;
const IMAGE_RE = /^data:image\/(png|jpe?g|webp);base64,/;
const MAX_QTY = 20;
const DEFAULT_SIZES = ['S', 'M', 'L', 'XL', '2XL'];

const SETTINGS_SQL = 'SELECT enabled, fee_percent::float AS fee_percent, fulfillment, pickup_info FROM shop_settings WHERE school_id = $1';
const DEFAULT_SETTINGS = { enabled: false, fee_percent: 2, fulfillment: 'pickup', pickup_info: null };
const PRODUCT_COLS = 'id, name, description, image, price, sizes, active, created_at';

const isId = (v) => /^\d+$/.test(String(v));

async function loadSettings(req) {
  const rows = await req.db(SETTINGS_SQL, [req.school.id]);
  return rows[0] || DEFAULT_SETTINGS;
}

function frontendOrigin(req) {
  return process.env.FRONTEND_URL || `${req.protocol}://${req.headers.host}`;
}

// Returns { error } or { value } for the fields present in body (all required when `full`).
function parseProduct(body, full) {
  const out = {};
  if (full || 'name' in body) {
    const name = String(body.name || '').trim();
    if (!name || name.length > 200) return { error: 'Enter a product name' };
    out.name = name;
  }
  if ('description' in body) out.description = String(body.description || '').trim() || null;
  if ('image' in body) {
    if (body.image && !IMAGE_RE.test(body.image)) return { error: 'image must be a png, jpeg or webp data URL' };
    out.image = body.image || null;
  }
  if (full || 'price' in body) {
    if (!Number.isInteger(body.price) || body.price <= 0) return { error: 'price must be a whole number of centavos above zero' };
    out.price = body.price;
  }
  if ('sizes' in body) {
    const sizes = Array.isArray(body.sizes) ? [...new Set(body.sizes.map((s) => String(s).trim()).filter(Boolean))] : [];
    if (sizes.length === 0 || sizes.length > 12) return { error: 'sizes must list 1 to 12 sizes' };
    out.sizes = JSON.stringify(sizes);
  }
  if ('active' in body) {
    if (typeof body.active !== 'boolean') return { error: 'active must be true or false' };
    out.active = body.active;
  }
  return { value: out };
}

router.get('/', asyncHandler(async (req, res) => {
  const products = await req.db(`SELECT ${PRODUCT_COLS} FROM shop_products WHERE active = true ORDER BY created_at, id`);
  res.json({ shop: await loadSettings(req), products });
}));

router.put('/settings', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const b = req.body;
  const next = { ...(await loadSettings(req)) };
  if ('enabled' in b) next.enabled = !!b.enabled;
  if ('pickup_info' in b) next.pickup_info = String(b.pickup_info || '').trim() || null;
  if ('fee_percent' in b) {
    const f = Number(b.fee_percent);
    if (!Number.isFinite(f) || f < 0 || f >= 50) return res.status(400).json({ error: 'fee_percent must be between 0 and 50' });
    next.fee_percent = f;
  }
  if ('fulfillment' in b) {
    if (!['pickup', 'delivery'].includes(b.fulfillment)) return res.status(400).json({ error: 'fulfillment must be pickup or delivery' });
    next.fulfillment = b.fulfillment;
  }
  if (next.enabled) {
    const [{ n }] = await req.db('SELECT count(*)::int AS n FROM shop_products WHERE active = true');
    if (n === 0) return res.status(400).json({ error: 'Add at least one T-shirt before opening the shop' });
  }
  await req.db(
    `INSERT INTO shop_settings (school_id, enabled, fee_percent, fulfillment, pickup_info)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (school_id) DO UPDATE SET enabled=$2, fee_percent=$3, fulfillment=$4, pickup_info=$5`,
    [req.school.id, next.enabled, next.fee_percent, next.fulfillment, next.pickup_info]
  );
  res.json({ shop: await loadSettings(req) });
}));

router.get('/products', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const products = await req.db(`SELECT ${PRODUCT_COLS} FROM shop_products ORDER BY created_at, id`);
  res.json({ products });
}));

router.post('/products', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { error, value } = parseProduct(req.body, true);
  if (error) return res.status(400).json({ error });
  const rows = await req.db(
    `INSERT INTO shop_products (school_id, name, description, image, price, sizes)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING ${PRODUCT_COLS}`,
    [req.school.id, value.name, value.description ?? null, value.image ?? null, value.price, value.sizes ?? JSON.stringify(DEFAULT_SIZES)]
  );
  res.status(201).json({ product: rows[0] });
}));

router.patch('/products/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Product not found' });
  const { error, value } = parseProduct(req.body, false);
  if (error) return res.status(400).json({ error });
  const cols = Object.keys(value);
  if (cols.length === 0) return res.status(400).json({ error: 'Nothing to update' });
  const set = cols.map((c, i) => `${c} = $${i + 1}${c === 'sizes' ? '::jsonb' : ''}`).join(', ');
  const rows = await req.db(
    `UPDATE shop_products SET ${set} WHERE id = $${cols.length + 1} RETURNING ${PRODUCT_COLS}`,
    [...cols.map((c) => value[c]), req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
  res.json({ product: rows[0] });
}));

router.delete('/products/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Product not found' });
  const rows = await req.db('DELETE FROM shop_products WHERE id = $1 RETURNING id', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
  res.json({ ok: true });
}));

router.post('/orders', asyncHandler(async (req, res) => {
  const shop = await loadSettings(req);
  if (!shop.enabled) return res.status(400).json({ error: 'The shop is not available right now' });

  const products = isId(req.body.product_id)
    ? await req.db(`SELECT ${PRODUCT_COLS} FROM shop_products WHERE id = $1 AND active = true`, [req.body.product_id])
    : [];
  const product = products[0];
  if (!product) return res.status(400).json({ error: 'Choose an available T-shirt' });

  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim();
  const contact = String(req.body.contact || '').replace(/[\s-]/g, '');
  const size = String(req.body.size || '');
  const quantity = Number(req.body.quantity);
  const address = String(req.body.address || '').trim();

  if (!name || name.length > 200) return res.status(400).json({ error: 'Enter your name' });
  if (!EMAIL_RE.test(email) || email.length > 200) return res.status(400).json({ error: 'Enter a valid email address' });
  if (!PHONE_RE.test(contact)) return res.status(400).json({ error: 'Enter a valid mobile number' });
  if (!product.sizes.includes(size)) return res.status(400).json({ error: 'Choose an available size' });
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) return res.status(400).json({ error: `Quantity must be 1 to ${MAX_QTY}` });
  if (shop.fulfillment === 'delivery' && (!address || address.length > 500)) return res.status(400).json({ error: 'Enter your delivery address' });

  const { subtotal, fee, total } = computeTotals(product.price, quantity, shop.fee_percent);
  const token = crypto.randomUUID();
  await req.db(
    `INSERT INTO shop_orders (school_id, product_id, product_name, session_token, name, email, contact, size, quantity, address, fulfillment, subtotal, fee, total)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [req.school.id, product.id, product.name, token, name, email, contact, size, quantity, shop.fulfillment === 'delivery' ? address : null, shop.fulfillment, subtotal, fee, total]
  );

  const session = await paymongo.createCheckoutSession({
    lineItems: [{ amount: total, currency: 'PHP', name: `${product.name} (${size}) x${quantity}`, quantity: 1 }],
    paymentMethodTypes: paymongo.paymentMethods(),
    successUrl: `${frontendOrigin(req)}/shop/thanks?order=${token}`,
    cancelUrl: `${frontendOrigin(req)}/shop`,
    metadata: { kind: 'shop', school_id: String(req.school.id), session_token: token },
  });
  res.json({ checkoutUrl: session.checkoutUrl, orderToken: token });
}));

router.get('/orders/:token/status', asyncHandler(async (req, res) => {
  const rows = await req.db('SELECT paid, total, fulfillment FROM shop_orders WHERE session_token = $1', [req.params.token]);
  if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
  res.json(rows[0]);
}));

router.get('/orders', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const orders = await req.db('SELECT id, product_name, name, email, contact, size, quantity, address, fulfillment, subtotal, fee, total, paid, paid_at, fulfilled, created_at FROM shop_orders ORDER BY created_at DESC, id DESC');
  res.json({ orders });
}));

router.patch('/orders/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  if (!isId(req.params.id) || typeof req.body.fulfilled !== 'boolean') return res.status(400).json({ error: 'fulfilled must be true or false' });
  const rows = await req.db('UPDATE shop_orders SET fulfilled = $1 WHERE id = $2 RETURNING id, fulfilled', [req.body.fulfilled, req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
  res.json({ order: rows[0] });
}));

module.exports = router;
