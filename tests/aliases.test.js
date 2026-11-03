const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const aliasRegistry = require('../src/engine/aliases');
const { app } = require('../src/index');

test('Aliases: resolves built-in virtual aliases', () => {
  assert.strictEqual(aliasRegistry.resolve('fast'), 'gpt-4o-mini');
  assert.strictEqual(aliasRegistry.resolve('smart'), 'claude-3-5-sonnet-20241022');
  assert.strictEqual(aliasRegistry.resolve('reasoning'), 'deepseek-reasoner');
  assert.strictEqual(aliasRegistry.resolve('code'), 'claude-3-5-sonnet-20241022');
  assert.strictEqual(aliasRegistry.resolve('vision'), 'gpt-4o');

  // Unknown model returns verbatim
  assert.strictEqual(aliasRegistry.resolve('custom-fine-tune-v1'), 'custom-fine-tune-v1');
});

test('Aliases: registers dynamic custom aliases', () => {
  aliasRegistry.register('my-agent-model', 'claude-3-5-haiku-20241022', 'Specialized Haiku alias');
  assert.strictEqual(aliasRegistry.isAlias('my-agent-model'), true);
  assert.strictEqual(aliasRegistry.resolve('my-agent-model'), 'claude-3-5-haiku-20241022');
});

test('Aliases: POST /v1/chat/completions resolves virtual alias and serves request', async () => {
  const res = await request(app)
    .post('/v1/chat/completions')
    .send({
      model: 'fast',
      messages: [{ role: 'user', content: 'Ping' }]
    });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.headers['x-served-by-model'], 'gpt-4o-mini');
  assert.strictEqual(res.body.model, 'fast'); // preserves client requested model
  assert.ok(res.body.choices[0].message.content);
});
