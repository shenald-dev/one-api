const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../src/index.js');

test('GET /health returns 200', async () => {
  const res = await request(app).get('/health');
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, { status: 'ok' });
  assert.strictEqual(res.headers['x-powered-by'], undefined);
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
  assert.strictEqual(res.body.error, 'Missing or invalid model');
});

test('POST /v1/chat/completions fails when messages is not an array', async () => {
  const res = await request(app)
    .post('/v1/chat/completions')
    .send({
      model: 'gpt-4',
      messages: "Hello!"
    });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Missing or invalid messages');
});

test('POST /v1/chat/completions fails with empty messages array', async () => {
  const res = await request(app)
    .post('/v1/chat/completions')
    .send({
      model: 'gpt-4',
      messages: []
    });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Missing or invalid messages');
});

test('POST /v1/chat/completions fails with malformed message objects', async () => {
  const res = await request(app)
    .post('/v1/chat/completions')
    .send({
      model: 'gpt-4',
      messages: [{ role: 'user' }] // missing content
    });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Malformed message object');
});

test('POST /v1/chat/completions fails with invalid JSON gracefully', async () => {
  const res = await request(app)
    .post('/v1/chat/completions')
    .set('Content-Type', 'application/json')
    .send('{invalid_json');

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Invalid JSON payload');
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

test('POST /v1/chat/completions fails with more than 1000 messages', async () => {
  const res = await request(app)
    .post('/v1/chat/completions')
    .send({
      model: 'gpt-4',
      messages: new Array(1001).fill({ role: 'user', content: 'test' })
    });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Too many messages');
});

test('isValidMessage validation helper', () => {
  const { isValidMessage } = require('../src/index.js');
  assert.strictEqual(isValidMessage({ role: 'user', content: 'hello' }), true);
  assert.strictEqual(isValidMessage(null), false);
  assert.strictEqual(isValidMessage([]), false);
  assert.strictEqual(isValidMessage({ role: 'user' }), false);
});

test('isValidModel validation helper', () => {
  const { isValidModel } = require('../src/index.js');
  assert.strictEqual(isValidModel('gpt-4'), true);
  assert.strictEqual(isValidModel(''), false);
  assert.strictEqual(isValidModel('   '), false);
  assert.strictEqual(isValidModel(null), false);
  assert.strictEqual(isValidModel(123), false);
});

test('isValidMessagesArray validation helper', () => {
  const { isValidMessagesArray } = require('../src/index.js');
  assert.strictEqual(isValidMessagesArray([{ role: 'user', content: 'hello' }]), true);
  assert.strictEqual(isValidMessagesArray([]), false);
  assert.strictEqual(isValidMessagesArray(null), false);
  assert.strictEqual(isValidMessagesArray("not an array"), false);
});

test('404 handler returns proper JSON and does not leak path', async () => {
  const res = await request(app).get('/some-unknown-path');
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.headers['content-type'], 'application/json; charset=utf-8');
  assert.deepStrictEqual(res.body, { error: 'Not found' });
});
