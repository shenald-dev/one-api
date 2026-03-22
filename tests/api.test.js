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

test('POST /v1/chat/completions returns 413 for payload > 10mb', async () => {
  // Generate a payload larger than 10MB
  const largeString = 'a'.repeat(10 * 1024 * 1024 + 100);
  const res = await request(app)
    .post('/v1/chat/completions')
    .send({
      model: 'gpt-4',
      messages: [{ role: 'user', content: largeString }]
    });

  assert.strictEqual(res.status, 413);
  assert.strictEqual(res.body.error, 'Payload Too Large');
});

test('Generic error handler returns 500 without leaking stack traces', async () => {
  const crypto = require('crypto');
  const originalRandomUUID = crypto.randomUUID;
  const originalConsoleError = console.error;

  // Mock internal failure
  crypto.randomUUID = () => { throw new Error('Mock internal failure'); };

  // Suppress expected console.error from the error handler
  console.error = () => {};

  try {
    const res = await request(app)
      .post('/v1/chat/completions')
      .send({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello!' }]
      });

    assert.strictEqual(res.status, 500);
    assert.deepStrictEqual(res.body, { error: 'Internal server error' });
  } finally {
    // Restore originals
    crypto.randomUUID = originalRandomUUID;
    console.error = originalConsoleError;
  }
});
