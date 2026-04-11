const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

test('CORS handles ALLOWED_ORIGINS correctly', async () => {
  // Clear require cache to re-evaluate the module with new env vars
  delete require.cache[require.resolve('../src/index.js')];
  process.env.ALLOWED_ORIGINS = 'http://trusted.com, http://also-trusted.com';
  const { app } = require('../src/index.js');

  const res1 = await request(app)
    .options('/health')
    .set('Origin', 'http://trusted.com');
  assert.strictEqual(res1.headers['access-control-allow-origin'], 'http://trusted.com');

  const res2 = await request(app)
    .options('/health')
    .set('Origin', 'http://evil.com');
  assert.strictEqual(res2.headers['access-control-allow-origin'], undefined);
});

test('CORS defaults to wildcard when ALLOWED_ORIGINS is unset', async () => {
  delete require.cache[require.resolve('../src/index.js')];
  delete process.env.ALLOWED_ORIGINS;
  const { app } = require('../src/index.js');

  const res1 = await request(app)
    .options('/health')
    .set('Origin', 'http://trusted.com');
  assert.strictEqual(res1.headers['access-control-allow-origin'], '*');
});

test('CORS handles wildcard in ALLOWED_ORIGINS correctly', async () => {
  delete require.cache[require.resolve('../src/index.js')];
  process.env.ALLOWED_ORIGINS = 'http://trusted.com, *';
  const { app } = require('../src/index.js');

  const res1 = await request(app)
    .options('/health')
    .set('Origin', 'http://trusted.com');
  assert.strictEqual(res1.headers['access-control-allow-origin'], '*');
});
