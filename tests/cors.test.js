const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

test('CORS defaults to * when ALLOWED_ORIGINS is unset', async () => {
  delete process.env.ALLOWED_ORIGINS;
  delete require.cache[require.resolve('../src/index.js')];
  const { app } = require('../src/index.js');

  const res = await request(app).get('/health').set('Origin', 'http://example.com');
  assert.strictEqual(res.headers['access-control-allow-origin'], '*');
});

test('CORS uses ALLOWED_ORIGINS when set', async () => {
  process.env.ALLOWED_ORIGINS = 'http://foo.com, http://bar.com, ';
  delete require.cache[require.resolve('../src/index.js')];
  const { app } = require('../src/index.js');

  const res1 = await request(app).get('/health').set('Origin', 'http://foo.com');
  assert.strictEqual(res1.headers['access-control-allow-origin'], 'http://foo.com');

  const res2 = await request(app).get('/health').set('Origin', 'http://bar.com');
  assert.strictEqual(res2.headers['access-control-allow-origin'], 'http://bar.com');

  const res3 = await request(app).get('/health').set('Origin', 'http://baz.com');
  assert.strictEqual(res3.headers['access-control-allow-origin'], undefined);
});

test('CORS handles wildcard in ALLOWED_ORIGINS', async () => {
  process.env.ALLOWED_ORIGINS = 'http://foo.com, *';
  delete require.cache[require.resolve('../src/index.js')];
  const { app } = require('../src/index.js');

  const res = await request(app).get('/health').set('Origin', 'http://baz.com');
  assert.strictEqual(res.headers['access-control-allow-origin'], '*');
});

test('CORS handles empty and whitespace-only ALLOWED_ORIGINS', async () => {
  process.env.ALLOWED_ORIGINS = '   , ,,  ';
  delete require.cache[require.resolve('../src/index.js')];
  const { app } = require('../src/index.js');

  const res = await request(app).get('/health').set('Origin', 'http://foo.com');
  // It should parse to an empty array and therefore allow NO origins (since '*' is not in an empty array)
  // Actually, wait, let's verify what express cors middleware does with an empty array.
  // When origin: [] is passed to cors, it blocks all origins.
  assert.strictEqual(res.headers['access-control-allow-origin'], undefined);
});
