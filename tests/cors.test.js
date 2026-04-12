const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

test('CORS defaults to * when ALLOWED_ORIGINS is unset', async () => {
  delete process.env.ALLOWED_ORIGINS;
  delete require.cache[require.resolve('../src/index.js')];
  const { app } = require('../src/index.js');

  const res = await request(app).options('/health').set('Origin', 'http://random.com');
  assert.strictEqual(res.headers['access-control-allow-origin'], '*');
});

test('CORS respects ALLOWED_ORIGINS list', async () => {
  process.env.ALLOWED_ORIGINS = 'http://allowed1.com, http://allowed2.com';
  delete require.cache[require.resolve('../src/index.js')];
  const { app } = require('../src/index.js');

  const res1 = await request(app).options('/health').set('Origin', 'http://allowed1.com');
  assert.strictEqual(res1.headers['access-control-allow-origin'], 'http://allowed1.com');

  const res2 = await request(app).options('/health').set('Origin', 'http://allowed2.com');
  assert.strictEqual(res2.headers['access-control-allow-origin'], 'http://allowed2.com');

  const res3 = await request(app).options('/health').set('Origin', 'http://notallowed.com');
  assert.strictEqual(res3.headers['access-control-allow-origin'], undefined);
});

test('CORS handles * in ALLOWED_ORIGINS', async () => {
  process.env.ALLOWED_ORIGINS = 'http://allowed.com, *';
  delete require.cache[require.resolve('../src/index.js')];
  const { app } = require('../src/index.js');

  const res = await request(app).options('/health').set('Origin', 'http://anything.com');
  assert.strictEqual(res.headers['access-control-allow-origin'], '*');
});
