const { test } = require('node:test');
const assert = require('node:assert');
const {
  estimateTextTokens,
  estimateMessageTokens,
  estimateMessagesTokens
} = require('../src/engine/tokenizer.js');

test('Tokenizer: estimates text and message tokens accurately', () => {
  assert.strictEqual(estimateTextTokens(''), 0);
  assert.strictEqual(estimateTextTokens(null), 0);
  assert.ok(estimateTextTokens('Hello world') >= 2);

  const singleMsg = { role: 'user', content: 'What is the capital of France?' };
  const singleTokens = estimateMessageTokens(singleMsg);
  assert.ok(singleTokens >= 6, 'Message tokens include overhead and content');

  const messages = [
    { role: 'system', content: 'You are an AI assistant.' },
    { role: 'user', content: 'Hello there' }
  ];
  const totalTokens = estimateMessagesTokens(messages);
  assert.ok(totalTokens >= 10, 'Messages tokens should calculate full conversation');
});
