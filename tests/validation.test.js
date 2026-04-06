const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app, isValidModel, isValidMessage } = require('../src/index.js');

test('isValidModel returns true for valid model', () => {
  assert.strictEqual(isValidModel('gpt-4'), true);
});

test('isValidModel returns false for invalid model', () => {
  assert.strictEqual(isValidModel(''), false);
  assert.strictEqual(isValidModel(null), false);
  assert.strictEqual(isValidModel(123), false);
});

test('isValidMessage returns true for valid message', () => {
  assert.strictEqual(isValidMessage({ role: 'user', content: 'hello' }), true);
});

test('isValidMessage returns false for invalid message', () => {
  assert.strictEqual(isValidMessage({ role: 'user' }), false);
  assert.strictEqual(isValidMessage({ content: 'hello' }), false);
  assert.strictEqual(isValidMessage(null), false);
  assert.strictEqual(isValidMessage([]), false);
});

test('POST /v1/chat/completions fails with too many messages', async () => {
  const messages = Array(1001).fill({ role: 'user', content: 'test' });
  const res = await request(app)
    .post('/v1/chat/completions')
    .send({
      model: 'gpt-4',
      messages
    });

  assert.strictEqual(res.status, 413);
  assert.strictEqual(res.body.error, 'Too many messages');
});
