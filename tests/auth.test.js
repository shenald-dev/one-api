const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const config = require('../src/config.js');
const { app } = require('../src/index.js');
const RateLimiter = require('../src/engine/ratelimit.js');

test('Gateway Auth: enforces ONE_API_KEY when configured', async () => {
  const origKey = config.apiKey;
  config.apiKey = 'test-secret-key-123';

  try {
    // 1. Missing header -> 401
    const res1 = await request(app)
      .post('/v1/chat/completions')
      .send({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hello' }]
      });
    assert.strictEqual(res1.status, 401);
    assert.strictEqual(res1.body.error.code, 'invalid_api_key');

    // 2. Wrong key -> 401
    const res2 = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer wrong-key')
      .send({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hello' }]
      });
    assert.strictEqual(res2.status, 401);

    // 3. Valid key -> 200
    const res3 = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer test-secret-key-123')
      .send({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hello' }]
      });
    assert.strictEqual(res3.status, 200);

    // 4. /health bypasses authentication
    const resHealth = await request(app).get('/health');
    assert.strictEqual(resHealth.status, 200);
  } finally {
    config.apiKey = origKey;
  }
});

test('RateLimiter unit test: limits requests per minute', () => {
  const limiter = new RateLimiter(3);
  const client = 'client-ip-1';

  assert.strictEqual(limiter.isRateLimited(client), false); // 1
  assert.strictEqual(limiter.isRateLimited(client), false); // 2
  assert.strictEqual(limiter.isRateLimited(client), false); // 3
  assert.strictEqual(limiter.isRateLimited(client), true);  // 4th is blocked!
  assert.strictEqual(limiter.getRemaining(client), 0);

  limiter.reset();
  assert.strictEqual(limiter.isRateLimited(client), false);
});
