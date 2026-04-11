const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

test('CORS handles ALLOWED_ORIGINS correctly', async () => {
  process.env.ALLOWED_ORIGINS = 'http://example.com, https://test.com';
  delete require.cache[require.resolve('../src/index.js')];
  const { app } = require('../src/index.js');

  const res = await request(app)
    .options('/health')
    .set('Origin', 'http://example.com');

  assert.strictEqual(res.headers['access-control-allow-origin'], 'http://example.com');

  const res2 = await request(app)
    .options('/health')
    .set('Origin', 'http://not-allowed.com');

  assert.strictEqual(res2.headers['access-control-allow-origin'], undefined);
});

test('CORS defaults to * when ALLOWED_ORIGINS is unset', async () => {
  delete process.env.ALLOWED_ORIGINS;
  delete require.cache[require.resolve('../src/index.js')];
  const { app } = require('../src/index.js');

  const res = await request(app)
    .options('/health')
    .set('Origin', 'http://any.com');

  assert.strictEqual(res.headers['access-control-allow-origin'], '*');
});

test('CORS handles * in ALLOWED_ORIGINS', async () => {
  process.env.ALLOWED_ORIGINS = 'http://example.com, *';
  delete require.cache[require.resolve('../src/index.js')];
  const { app } = require('../src/index.js');

  const res = await request(app)
    .options('/health')
    .set('Origin', 'http://any.com');

  assert.strictEqual(res.headers['access-control-allow-origin'], '*');
});
