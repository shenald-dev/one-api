const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

test('CORS defaults to * when ALLOWED_ORIGINS is not set', async () => {
  delete require.cache[require.resolve('../src/index.js')];
  delete process.env.ALLOWED_ORIGINS;
  const { app } = require('../src/index.js');

  const res = await request(app)
    .options('/health')
    .set('Origin', 'http://example.com');

  assert.strictEqual(res.headers['access-control-allow-origin'], '*');
});

test('CORS restricts to specific origins when ALLOWED_ORIGINS is set', async () => {
  delete require.cache[require.resolve('../src/index.js')];
  process.env.ALLOWED_ORIGINS = 'http://foo.com, https://bar.com';
  const { app } = require('../src/index.js');

  const res1 = await request(app)
    .options('/health')
    .set('Origin', 'https://bar.com');

  assert.strictEqual(res1.headers['access-control-allow-origin'], 'https://bar.com');

  const res2 = await request(app)
    .options('/health')
    .set('Origin', 'http://hacker.com');

  assert.strictEqual(res2.headers['access-control-allow-origin'], undefined);
});

test('CORS allows * when ALLOWED_ORIGINS contains *', async () => {
  delete require.cache[require.resolve('../src/index.js')];
  process.env.ALLOWED_ORIGINS = 'http://foo.com, *';
  const { app } = require('../src/index.js');

  const res = await request(app)
    .options('/health')
    .set('Origin', 'http://hacker.com');

  assert.strictEqual(res.headers['access-control-allow-origin'], '*');
});
