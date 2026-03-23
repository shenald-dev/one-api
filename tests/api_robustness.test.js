const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../src/index.js');

test('POST /v1/chat/completions handles undefined req.body (e.g. non-JSON content-type)', async () => {
  const res = await request(app)
    .post('/v1/chat/completions')
    .set('Content-Type', 'text/plain')
    .send('some text');

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Missing or invalid model or messages');
});

test('POST /v1/chat/completions handles payload too large gracefully', async () => {
  const largeString = 'a'.repeat(11 * 1024 * 1024); // 11mb, which is > 10mb limit
  const res = await request(app)
    .post('/v1/chat/completions')
    .send({
      model: 'gpt-4',
      messages: [{ role: 'user', content: largeString }]
    });

  assert.strictEqual(res.status, 413);
  assert.strictEqual(res.body.error, 'Payload too large');
});
