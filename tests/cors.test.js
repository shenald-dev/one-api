const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

test('getCorsOrigin parsing logic', () => {
  const { getCorsOrigin } = require('../src/index.js');
  assert.strictEqual(getCorsOrigin(''), '*');
  assert.strictEqual(getCorsOrigin('*'), '*');
  assert.strictEqual(getCorsOrigin('https://test.com, *'), '*');
  assert.deepStrictEqual(getCorsOrigin('https://test.com, https://test2.com'), ['https://test.com', 'https://test2.com']);
  assert.deepStrictEqual(getCorsOrigin('https://test.com ,  https://test2.com '), ['https://test.com', 'https://test2.com']);
});

test('Express app sets correct CORS header based on ALLOWED_ORIGINS', async () => {
  // Test empty / wildcard default
  delete process.env.ALLOWED_ORIGINS;
  delete require.cache[require.resolve('../src/index.js')];
  let { app } = require('../src/index.js');

  let res = await request(app).options('/health').set('Origin', 'https://evil.com');
  assert.strictEqual(res.headers['access-control-allow-origin'], '*');

  // Test restricted origins
  process.env.ALLOWED_ORIGINS = 'https://trusted.com';
  delete require.cache[require.resolve('../src/index.js')];
  ({ app } = require('../src/index.js'));

  res = await request(app).options('/health').set('Origin', 'https://trusted.com');
  assert.strictEqual(res.headers['access-control-allow-origin'], 'https://trusted.com');

  res = await request(app).options('/health').set('Origin', 'https://evil.com');
  assert.strictEqual(res.headers['access-control-allow-origin'], undefined);
});
