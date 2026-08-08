const crypto = require('crypto');

const API_BASE = 'https://api.paymongo.com/v1';

async function createCheckoutSession({ lineItems, paymentMethodTypes, successUrl, cancelUrl, metadata, referenceNumber }) {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) {
    throw new Error('PAYMONGO_SECRET_KEY is not set');
  }

  const res = await fetch(`${API_BASE}/checkout_sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: lineItems,
          payment_method_types: paymentMethodTypes,
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata,
          reference_number: referenceNumber,
        },
      },
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    const message = body?.errors?.[0]?.detail || 'PayMongo checkout session creation failed';
    throw new Error(message);
  }

  return { id: body.data.id, checkoutUrl: body.data.attributes.checkout_url };
}

function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  const parts = {};
  for (const kv of signatureHeader.split(',')) {
    const [key, value] = kv.split('=');
    if (key && value) parts[key.trim()] = value.trim();
  }
  const { t: timestamp, te, li } = parts;
  if (!timestamp) return false;

  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');

  const matches = (candidate) => {
    if (!candidate) return false;
    const candidateBuf = Buffer.from(candidate, 'hex');
    return candidateBuf.length === expectedBuf.length && crypto.timingSafeEqual(candidateBuf, expectedBuf);
  };

  return matches(te) || matches(li);
}

module.exports = { createCheckoutSession, verifyWebhookSignature };
