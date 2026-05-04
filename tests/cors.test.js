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
  assert.strictEqual(res.headers['access-control-max-age'], '86400');
});

test('CORS restricts to specific origins when ALLOWED_ORIGINS is set', async () => {
  delete require.cache[require.resolve('../src/index.js')];
  process.env.ALLOWED_ORIGINS = 'http://foo.com, https://bar.com';
  const { app } = require('../src/index.js');

  const res1 = await request(app)
    .options('/health')
    .set('Origin', 'https://bar.com');

  assert.strictEqual(res1.headers['access-control-allow-origin'], 'https://bar.com');
  assert.strictEqual(res1.headers['access-control-max-age'], '86400');

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
  assert.strictEqual(res.headers['access-control-max-age'], '86400');
});

test('CORS OPTIONS preflight requests do not execute downstream global middlewares like helmet', async () => {
  delete require.cache[require.resolve('../src/index.js')];
  delete process.env.ALLOWED_ORIGINS;
  const { app } = require('../src/index.js');

  // Create a mock route directly after the global middlewares
  // to prove the OPTIONS request was intercepted by cors and didn't fall through
  let hitDownstream = false;
  app.options('/health', (req, res, next) => {
    hitDownstream = true;
    next();
  });

  const res = await request(app)
    .options('/health')
    .set('Origin', 'http://example.com');

  assert.strictEqual(res.status, 204); // CORS returns 204 No Content for successful preflights
  assert.strictEqual(res.headers['access-control-allow-origin'], '*');
  // Confirm that helmet security headers (like strict-transport-security) were NOT injected
  assert.strictEqual(res.headers['strict-transport-security'], undefined);
  // Confirm that we did not hit our downstream OPTIONS handler because cors short-circuited
  assert.strictEqual(hitDownstream, false);
});
