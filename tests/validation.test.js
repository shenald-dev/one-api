const { test } = require('node:test');
const assert = require('node:assert');
const { isValidMessage } = require('../src/index.js');

test('isValidMessage returns true for valid messages', () => {
  assert.strictEqual(isValidMessage({ role: 'user', content: 'hello' }), true);
  assert.strictEqual(isValidMessage({ role: 'assistant', content: '' }), true);
});

test('isValidMessage returns false for invalid messages', () => {
  assert.strictEqual(isValidMessage(null), false);
  assert.strictEqual(isValidMessage(undefined), false);
  assert.strictEqual(isValidMessage('not an object'), false);
  assert.strictEqual(isValidMessage(123), false);
  assert.strictEqual(isValidMessage([]), false);
  assert.strictEqual(isValidMessage([{ role: 'user', content: 'hello' }]), false);

  assert.strictEqual(isValidMessage({ content: 'hello' }), false); // missing role
  assert.strictEqual(isValidMessage({ role: 'user' }), false); // missing content

  assert.strictEqual(isValidMessage({ role: 123, content: 'hello' }), false); // role not a string
  assert.strictEqual(isValidMessage({ role: 'user', content: 123 }), false); // content not a string
});
