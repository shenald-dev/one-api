const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const config = require('../src/config.js');
const ResponseCache = require('../src/engine/cache.js');
const { app } = require('../src/index.js');

test('ResponseCache unit test - get, set, LRU and stats', () => {
  const cache = new ResponseCache({ maxEntries: 3, ttlSeconds: 60 });
  assert.strictEqual(cache.get('k1'), null);

  cache.set('k1', { data: 'one' });
  assert.deepStrictEqual(cache.get('k1'), { data: 'one' });

  cache.set('k2', { data: 'two' });
  cache.set('k3', { data: 'three' });
  assert.strictEqual(cache.map.size, 3);

  // Exceed maxEntries, k1 should be evicted if k2 and k3 are accessed
  cache.get('k2');
  cache.get('k3');
  cache.set('k4', { data: 'four' });

  assert.strictEqual(cache.get('k1'), null, 'Oldest entry k1 should be evicted');
  assert.deepStrictEqual(cache.get('k4'), { data: 'four' });

  const stats = cache.getStats();
  assert.strictEqual(stats.evictions, 1);
  assert.ok(stats.hitRate > 0);
});

test('POST /v1/chat/completions serves cached responses when enabled', async () => {
  const origCacheEnabled = config.cache.enabled;
  config.cache.enabled = true;

  try {
    const payload = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Cached test query ' + Date.now() }]
    };

    // First call: MISS
    const res1 = await request(app)
      .post('/v1/chat/completions')
      .send(payload);

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.headers['x-cache'], 'MISS');

    // Second call with identical payload: HIT
    const res2 = await request(app)
      .post('/v1/chat/completions')
      .send(payload);

    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.headers['x-cache'], 'HIT');
    assert.strictEqual(res1.body.id, res2.body.id, 'Cached response should return identical completion');

    // Third call with X-Cache-Bypass header
    const res3 = await request(app)
      .post('/v1/chat/completions')
      .set('X-Cache-Bypass', 'true')
      .send(payload);

    assert.strictEqual(res3.status, 200);
    assert.strictEqual(res3.headers['x-cache'], undefined);
  } finally {
    config.cache.enabled = origCacheEnabled;
  }
});
