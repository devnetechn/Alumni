const crypto = require('crypto');
const request = require('supertest');
const { computeTotals } = require('../src/lib/shop');
const { app } = require('../src/server');
const { pool, appPool, query } = require('../src/db');
const { resetDb, insertUser, authHeader, getDefaultSchool, hostFor } = require('./helpers');
const paymongo = require('../src/lib/paymongo');

describe('computeTotals', () => {
  test('grosses up so the association nets the subtotal after the fee', () => {
    expect(computeTotals(30000, 1, 2)).toEqual({ subtotal: 30000, fee: 613, total: 30613 });
  });
  test('multiplies by quantity before the fee', () => {
    expect(computeTotals(30000, 3, 2)).toEqual({ subtotal: 90000, fee: 1837, total: 91837 });
  });
  test('zero fee means total equals subtotal', () => {
    expect(computeTotals(30000, 2, 0)).toEqual({ subtotal: 60000, fee: 0, total: 60000 });
  });
});

beforeEach(() => resetDb());
afterEach(() => jest.restoreAllMocks());
afterAll(() => Promise.all([pool.end(), appPool.end()]));

const as = (req, school, user) => {
  const r = req.set('Host', hostFor(school));
  return user ? r.set('Authorization', authHeader(user)) : r;
};

async function openShop({ product = {}, settings = {} } = {}) {
  const school = await getDefaultSchool();
  const admin = await insertUser({ role: 'admin' });
  const p = await as(request(app).post('/api/shop/products'), school, admin)
    .send({ name: 'Batch Tee', price: 30000, sizes: ['S', 'M', 'L'], ...product });
  expect(p.status).toBe(201);
  const s = await as(request(app).put('/api/shop/settings'), school, admin)
    .send({ enabled: true, fee_percent: 2, fulfillment: 'pickup', pickup_info: 'School gate', ...settings });
  expect(s.status).toBe(200);
  return { school, admin, product: p.body.product };
}

const order = (productId, o = {}) => ({ product_id: productId, name: 'Ana Cruz', email: 'ana@test.com', contact: '09171234567', size: 'M', quantity: 2, ...o });

test('GET /api/shop is closed with no products by default', async () => {
  const school = await getDefaultSchool();
  const res = await as(request(app).get('/api/shop'), school);
  expect(res.status).toBe(200);
  expect(res.body.shop.enabled).toBe(false);
  expect(res.body.products).toEqual([]);
});

test('product and settings endpoints require admin and validate input', async () => {
  const school = await getDefaultSchool();
  const alumni = await insertUser();
  expect((await as(request(app).post('/api/shop/products'), school, alumni).send({ name: 'x', price: 100 })).status).toBe(403);
  expect((await as(request(app).put('/api/shop/settings'), school, alumni).send({ enabled: false })).status).toBe(403);
  const admin = await insertUser({ role: 'admin', email: 'a2@test.com' });
  const badProducts = [{ name: '', price: 100 }, { name: 'x', price: 0 }, { name: 'x', price: 1.5 }, { name: 'x', price: 100, sizes: [] }, { name: 'x', price: 100, image: 'javascript:1' }];
  for (const bad of badProducts) {
    expect((await as(request(app).post('/api/shop/products'), school, admin).send(bad)).status).toBe(400);
  }
  for (const bad of [{ fee_percent: 60 }, { fulfillment: 'ship' }]) {
    expect((await as(request(app).put('/api/shop/settings'), school, admin).send(bad)).status).toBe(400);
  }
});

test('the shop cannot open without an active product', async () => {
  const school = await getDefaultSchool();
  const admin = await insertUser({ role: 'admin' });
  const res = await as(request(app).put('/api/shop/settings'), school, admin).send({ enabled: true });
  expect(res.status).toBe(400);
});

test('admin can add, edit, hide and delete a T-shirt; public list shows active ones only', async () => {
  const { school, admin, product } = await openShop();
  const second = await as(request(app).post('/api/shop/products'), school, admin).send({ name: 'Polo', price: 45000 });
  expect(second.status).toBe(201);
  let pub = await as(request(app).get('/api/shop'), school);
  expect(pub.body.products.map((p) => p.name).sort()).toEqual(['Batch Tee', 'Polo']);

  const edited = await as(request(app).patch(`/api/shop/products/${product.id}`), school, admin).send({ price: 35000, active: false });
  expect(edited.status).toBe(200);
  expect(edited.body.product.price).toBe(35000);
  pub = await as(request(app).get('/api/shop'), school);
  expect(pub.body.products.map((p) => p.name)).toEqual(['Polo']);

  const all = await as(request(app).get('/api/shop/products'), school, admin);
  expect(all.body.products).toHaveLength(2);

  const del = await as(request(app).delete(`/api/shop/products/${second.body.product.id}`), school, admin);
  expect(del.status).toBe(200);
  expect((await as(request(app).delete('/api/shop/products/99999'), school, admin)).status).toBe(404);
});

test('POST /api/shop/orders computes totals server-side from the product price', async () => {
  const { school, product } = await openShop();
  jest.spyOn(paymongo, 'createCheckoutSession').mockResolvedValue({ id: 'cs_shop1', checkoutUrl: 'https://checkout.paymongo.com/cs_shop1' });
  const res = await as(request(app).post('/api/shop/orders'), school).send({ ...order(product.id), total: 1, price: 1 });
  expect(res.status).toBe(200);
  expect(res.body.checkoutUrl).toBe('https://checkout.paymongo.com/cs_shop1');
  const args = paymongo.createCheckoutSession.mock.calls[0][0];
  expect(args.lineItems[0].amount).toBe(61225);
  expect(args.metadata.kind).toBe('shop');
  const [row] = await query('SELECT * FROM shop_orders');
  expect([row.subtotal, row.fee, row.total, row.paid, row.product_name]).toEqual([60000, 1225, 61225, false, 'Batch Tee']);
});

test('POST /api/shop/orders rejects bad input and unavailable products', async () => {
  const { school, admin, product } = await openShop();
  const spy = jest.spyOn(paymongo, 'createCheckoutSession').mockResolvedValue({ id: 'x', checkoutUrl: 'u' });
  const bads = [{ size: 'XXXL' }, { quantity: 0 }, { quantity: 21 }, { email: 'nope' }, { contact: '123' }, { name: '' }, { product_id: 99999 }, { product_id: 'abc' }];
  for (const bad of bads) {
    expect((await as(request(app).post('/api/shop/orders'), school).send(order(product.id, bad))).status).toBe(400);
  }
  await as(request(app).patch(`/api/shop/products/${product.id}`), school, admin).send({ active: false });
  expect((await as(request(app).post('/api/shop/orders'), school).send(order(product.id))).status).toBe(400);
  expect(spy).not.toHaveBeenCalled();
});

test('delivery requires an address, pickup does not', async () => {
  const { school, product } = await openShop({ settings: { fulfillment: 'delivery' } });
  jest.spyOn(paymongo, 'createCheckoutSession').mockResolvedValue({ id: 'cs_d', checkoutUrl: 'u' });
  expect((await as(request(app).post('/api/shop/orders'), school).send(order(product.id))).status).toBe(400);
  expect((await as(request(app).post('/api/shop/orders'), school).send(order(product.id, { address: '1 Main St' }))).status).toBe(200);
});

test('orders are refused when the shop is closed', async () => {
  const { school, admin, product } = await openShop();
  await as(request(app).put('/api/shop/settings'), school, admin).send({ enabled: false });
  expect((await as(request(app).post('/api/shop/orders'), school).send(order(product.id))).status).toBe(400);
});

test('webhook marks the order paid, idempotently; status endpoint reflects it', async () => {
  process.env.PAYMONGO_WEBHOOK_SECRET = 'test-webhook-secret';
  const { school, product } = await openShop();
  jest.spyOn(paymongo, 'createCheckoutSession').mockResolvedValue({ id: 'cs_w', checkoutUrl: 'u' });
  const token = (await as(request(app).post('/api/shop/orders'), school).send(order(product.id))).body.orderToken;
  expect((await as(request(app).get(`/api/shop/orders/${token}/status`), school)).body.paid).toBe(false);

  const payload = { data: { id: 'evt_shop1', attributes: { type: 'checkout_session.payment.paid', data: { id: 'cs_w', attributes: { metadata: { kind: 'shop', school_id: String(school.id), session_token: token } } } } } };
  const rawBody = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  const te = crypto.createHmac('sha256', 'test-webhook-secret').update(`${ts}.${rawBody}`).digest('hex');
  for (let i = 0; i < 2; i += 1) {
    const res = await request(app).post('/api/payments/webhook').set('Content-Type', 'application/json').set('Paymongo-Signature', `t=${ts},te=${te},li=x`).send(rawBody);
    expect(res.status).toBe(200);
  }
  expect((await as(request(app).get(`/api/shop/orders/${token}/status`), school)).body.paid).toBe(true);
});

test('admin lists orders and marks one fulfilled; others cannot', async () => {
  const { school, admin, product } = await openShop();
  jest.spyOn(paymongo, 'createCheckoutSession').mockResolvedValue({ id: 'cs_l', checkoutUrl: 'u' });
  await as(request(app).post('/api/shop/orders'), school).send(order(product.id));
  const alumni = await insertUser({ email: 'z@test.com' });
  expect((await as(request(app).get('/api/shop/orders'), school, alumni)).status).toBe(403);
  const list = await as(request(app).get('/api/shop/orders'), school, admin);
  expect(list.body.orders).toHaveLength(1);
  expect(list.body.orders[0].product_name).toBe('Batch Tee');
  const patched = await as(request(app).patch(`/api/shop/orders/${list.body.orders[0].id}`), school, admin).send({ fulfilled: true });
  expect(patched.body.order.fulfilled).toBe(true);
});
