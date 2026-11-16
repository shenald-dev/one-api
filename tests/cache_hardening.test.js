const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../src/index.js');
const ResponseCache = require('../src/engine/cache');

test('Cache Hardening: Multi-lingual and Unicode semantic caching', () => {
  const cache = new ResponseCache({ maxEntries: 100, semanticThreshold: 0.80 });

  // 1. CJK Chinese prompt matching
  const cjkBase = '你好世界，请帮我写一段代码';
  const cjkSimilar = '你好世界，请帮我写一段代码！';
  const cjkKey = cache.generateKey('gpt-4o', [{ role: 'user', content: cjkBase }]);
  cache.set(cjkKey, { answer: 'cjk_hit' }, 60000, cjkBase, 'gpt-4o');

  const cjkResult = cache.getWithMeta('unseen_cjk', cjkSimilar, { model: 'gpt-4o', temperature: 0 });
  assert.ok(cjkResult, 'Should match similar Chinese prompt');
  assert.strictEqual(cjkResult.type, 'SEMANTIC');
  assert.strictEqual(cjkResult.value.answer, 'cjk_hit');

  // 2. Accented European characters matching
  const accentBase = '¿Cómo estás amigo?';
  const accentSimilar = 'Como estas amigo';
  const accentKey = cache.generateKey('gpt-4o', [{ role: 'user', content: accentBase }]);
  cache.set(accentKey, { answer: 'accent_hit' }, 60000, accentBase, 'gpt-4o');

  const accentResult = cache.getWithMeta('unseen_accent', accentSimilar, { model: 'gpt-4o', temperature: 0 });
  assert.ok(accentResult, 'Should match accented prompt');
  assert.strictEqual(accentResult.type, 'SEMANTIC');
  assert.strictEqual(accentResult.value.answer, 'accent_hit');

  // 3. Short prompts
  const shortBase = 'hi';
  const shortKey = cache.generateKey('gpt-4o', [{ role: 'user', content: shortBase }]);
  cache.set(shortKey, { answer: 'short_hit' }, 60000, shortBase, 'gpt-4o');
  const shortResult = cache.getWithMeta(shortKey, shortBase, { model: 'gpt-4o', temperature: 0 });
  assert.ok(shortResult);
});

test('Cache Hardening: Shadow eviction does not cause false cache misses', () => {
  const cache = new ResponseCache({ maxEntries: 2, semanticThreshold: 0.80 });

  // Prompt 1 (very similar to query)
  cache.set('key1', { answer: 'one' }, 60000, 'the quick brown fox jumps over the lazy dog today', 'gpt-4o');
  // Prompt 2 (moderately similar to query, above 0.8)
  cache.set('key2', { answer: 'two' }, 60000, 'the quick brown fox jumps over lazy dog now', 'gpt-4o');
  // Prompt 3 evicts key1 from LRU map
  cache.set('key3', { answer: 'three' }, 60000, 'completely unrelated prompt about deep learning models', 'gpt-4o');

  // Query is identical to key1 text. Since key1 was evicted from map, it must fall back to key2 which is still in map.
  const query = 'the quick brown fox jumps over the lazy dog today';
  const res = cache.getWithMeta('unseen_query', query, { model: 'gpt-4o', temperature: 0 });

  assert.ok(res, 'Should not return null when an alive candidate exists in map');
  assert.strictEqual(res.value.answer, 'two');
  assert.strictEqual(res.type, 'SEMANTIC');
});

test('Cache Hardening: Tool call queries do not collide with non-tool queries', () => {
  const cache = new ResponseCache();
  const messages = [{ role: 'user', content: 'What is the weather in Paris?' }];
  const tools = [
    {
      type: 'function',
      function: { name: 'get_weather', parameters: { type: 'object', properties: { location: { type: 'string' } } } }
    }
  ];

  const keyWithoutTools = cache.generateKey('gpt-4o', messages, { temperature: 0 });
  const keyWithTools = cache.generateKey('gpt-4o', messages, { temperature: 0, tools });

  assert.notStrictEqual(keyWithoutTools, keyWithTools, 'Cache keys must differ when tools are provided');
});

test('Cache Hardening: HTTP cache hit sets X-Served-By-Model and X-Token-Cost-USD headers', async () => {
  const config = require('../src/config.js');
  const origCacheEnabled = config.cache.enabled;
  config.cache.enabled = true;

  try {
    const payload = {
      model: 'smart',
      messages: [{ role: 'user', content: 'Explain quantum computing in one sentence ' + Date.now() }]
    };

    // First request (populate cache)
    const res1 = await request(app)
      .post('/v1/chat/completions')
      .send(payload);
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.headers['x-cache'], 'MISS');

    // Second request (exact cache hit)
    const hitRes = await request(app)
      .post('/v1/chat/completions')
      .send(payload);

    assert.strictEqual(hitRes.status, 200);
    assert.strictEqual(hitRes.headers['x-cache'], 'HIT');
    assert.ok(hitRes.headers['x-served-by-model']);
    assert.strictEqual(hitRes.headers['x-token-cost-usd'], '0');
  } finally {
    config.cache.enabled = origCacheEnabled;
  }
});
