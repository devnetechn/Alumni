const crypto = require('crypto');
const { verifyWebhookSignature } = require('../src/lib/paymongo');

function signPayload(rawBody, secret, timestamp) {
  const signedPayload = `${timestamp}.${rawBody}`;
  return crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
}

test('verifyWebhookSignature accepts a correctly signed test-mode payload', () => {
  const secret = 'whsk_test_secret';
  const rawBody = JSON.stringify({ data: { id: 'evt_1' } });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const te = signPayload(rawBody, secret, timestamp);
  const header = `t=${timestamp},te=${te},li=deadbeef`;

  expect(verifyWebhookSignature(rawBody, header, secret)).toBe(true);
});

test('verifyWebhookSignature rejects a payload signed with the wrong secret', () => {
  const rawBody = JSON.stringify({ data: { id: 'evt_1' } });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const te = signPayload(rawBody, 'wrong-secret', timestamp);
  const header = `t=${timestamp},te=${te},li=deadbeef`;

  expect(verifyWebhookSignature(rawBody, header, 'whsk_test_secret')).toBe(false);
});

test('verifyWebhookSignature rejects a tampered body', () => {
  const secret = 'whsk_test_secret';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const te = signPayload(JSON.stringify({ data: { id: 'evt_1' } }), secret, timestamp);
  const header = `t=${timestamp},te=${te},li=deadbeef`;
  const tamperedBody = JSON.stringify({ data: { id: 'evt_2' } });

  expect(verifyWebhookSignature(tamperedBody, header, secret)).toBe(false);
});

test('verifyWebhookSignature rejects a missing header', () => {
  expect(verifyWebhookSignature('{}', undefined, 'whsk_test_secret')).toBe(false);
});
