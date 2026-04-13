const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

test('CORS with array', async () => {
  process.env.ALLOWED_ORIGINS = 'http://example.com, https://test.com';
  delete require.cache[require.resolve('../src/index.js')];
  const { app } = require('../src/index.js');

  const res = await request(app)
    .options('/health')
    .set('Origin', 'https://test.com');

  assert.strictEqual(res.headers['access-control-allow-origin'], 'https://test.com');
});

test('CORS with default (*)', async () => {
  delete process.env.ALLOWED_ORIGINS;
  delete require.cache[require.resolve('../src/index.js')];
  const { app } = require('../src/index.js');

  const res = await request(app)
    .options('/health')
    .set('Origin', 'https://any.com');

  assert.strictEqual(res.headers['access-control-allow-origin'], '*');
});
