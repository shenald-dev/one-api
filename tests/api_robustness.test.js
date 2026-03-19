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
  assert.strictEqual(res.body.error, 'Missing model or messages');
});
