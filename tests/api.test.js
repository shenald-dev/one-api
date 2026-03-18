const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../src/index.js');

test('GET /health returns 200', async () => {
  const res = await request(app).get('/health');
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, { status: 'ok' });
});

test('POST /v1/chat/completions works with valid data', async () => {
  const res = await request(app)
    .post('/v1/chat/completions')
    .send({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello!' }]
    });

  assert.strictEqual(res.status, 200);
  assert.ok(res.body.id.startsWith('chatcmpl-'));
  assert.ok(res.body.id.length > 20); // chatcmpl- + UUID length (36)
  assert.strictEqual(res.body.object, 'chat.completion');
  assert.strictEqual(res.body.model, 'gpt-4');
  assert.strictEqual(res.body.choices[0].message.content, 'This is a mock response from the unified API.');
});

test('POST /v1/chat/completions fails without model', async () => {
  const res = await request(app)
    .post('/v1/chat/completions')
    .send({
      messages: [{ role: 'user', content: 'Hello!' }]
    });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Missing model or messages');
});

test('POST /v1/chat/completions fails with invalid JSON gracefully', async () => {
  const res = await request(app)
    .post('/v1/chat/completions')
    .set('Content-Type', 'application/json')
    .send('{invalid_json');

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Invalid JSON payload');
});
