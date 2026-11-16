const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const config = require('../src/config.js');
const ResponseCache = require('../src/engine/cache.js');
const { app } = require('../src/index.js');

test('ResponseCache: Tier 2 semantic fuzzy matching matches near-identical prompts', () => {
  const cache = new ResponseCache({
    maxEntries: 10,
    ttlSeconds: 60,
    semanticEnabled: true,
    semanticThreshold: 0.85
  });

  const prompt1 = 'Can you explain the theory of special relativity in simple terms for beginners?';
  const prompt2 = 'Can you please explain the theory of special relativity in simple terms for beginners?';

  const key1 = 'key_1';
  const val1 = { text: 'Einstein introduced special relativity in 1905.' };

  cache.set(key1, val1, 60000, prompt1, 'gpt-4o');

  // Exact match on key1
  const exact = cache.getWithMeta(key1, prompt1, { model: 'gpt-4o', temperature: 0 });
  assert.strictEqual(exact.type, 'EXACT');
  assert.strictEqual(exact.similarity, 1.0);
  assert.deepStrictEqual(exact.value, val1);

  // Semantic match on different key but near-identical prompt
  const semantic = cache.getWithMeta('key_different', prompt2, { model: 'gpt-4o', temperature: 0 });
  assert.ok(semantic !== null);
  assert.strictEqual(semantic.type, 'SEMANTIC');
  assert.ok(semantic.similarity >= 0.85);
  assert.deepStrictEqual(semantic.value, val1);

  const stats = cache.getStats();
  assert.strictEqual(stats.exactHits, 1);
  assert.strictEqual(stats.semanticHits, 1);
});

test('POST /v1/chat/completions: serves SEMANTIC cache hit when temperature is 0', async () => {
  const origCacheEnabled = config.cache.enabled;
  config.cache.enabled = true;

  try {
    const baseText = 'What are three advantages of renewable energy over fossil fuels? ' + Date.now();
    const slightVariation = 'What are three advantages of renewable energy over fossil fuels?   ' + Date.now();

    // 1. Prime cache with cold request
    const res1 = await request(app)
      .post('/v1/chat/completions')
      .send({
        model: 'gpt-4o',
        temperature: 0,
        messages: [{ role: 'user', content: baseText }]
      });

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.headers['x-cache'], 'MISS');

    // 2. Exact match hit
    const res2 = await request(app)
      .post('/v1/chat/completions')
      .send({
        model: 'gpt-4o',
        temperature: 0,
        messages: [{ role: 'user', content: baseText }]
      });

    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.headers['x-cache'], 'HIT');

    // 3. Near-identical match hit with semantic caching flag
    const res3 = await request(app)
      .post('/v1/chat/completions')
      .set('X-Allow-Semantic-Cache', 'true')
      .send({
        model: 'gpt-4o',
        temperature: 0,
        messages: [{ role: 'user', content: baseText + ' Please be concise.' }]
      });

    assert.strictEqual(res3.status, 200);
    assert.strictEqual(res3.headers['x-cache'], 'HIT');
    assert.strictEqual(res3.headers['x-cache-type'], 'SEMANTIC');
    assert.ok(parseFloat(res3.headers['x-cache-similarity']) > 0.8);
  } finally {
    config.cache.enabled = origCacheEnabled;
  }
});
