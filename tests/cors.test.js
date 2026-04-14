const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

test('CORS allows all origins by default', async () => {
  const indexPath = require.resolve('../src/index.js');
  delete process.env.ALLOWED_ORIGINS;
  delete require.cache[indexPath];
  const { app } = require('../src/index.js');

  const res = await request(app).get('/health').set('Origin', 'http://foo.com');
  assert.strictEqual(res.headers['access-control-allow-origin'], '*');
});

test('CORS restricts origins based on ALLOWED_ORIGINS', async () => {
  const indexPath = require.resolve('../src/index.js');
  process.env.ALLOWED_ORIGINS = 'http://foo.com, http://bar.com';
  delete require.cache[indexPath];
  const { app } = require('../src/index.js');

  let res = await request(app).get('/health').set('Origin', 'http://foo.com');
  assert.strictEqual(res.headers['access-control-allow-origin'], 'http://foo.com');

  res = await request(app).get('/health').set('Origin', 'http://baz.com');
  assert.strictEqual(res.headers['access-control-allow-origin'], undefined);
});

test('CORS allows all when ALLOWED_ORIGINS includes wildcard', async () => {
  const indexPath = require.resolve('../src/index.js');
  process.env.ALLOWED_ORIGINS = '*, http://foo.com';
  delete require.cache[indexPath];
  const { app } = require('../src/index.js');

  const res = await request(app).get('/health').set('Origin', 'http://baz.com');
  assert.strictEqual(res.headers['access-control-allow-origin'], '*');
});
