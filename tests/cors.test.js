const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

test('CORS handles ALLOWED_ORIGINS appropriately', async () => {
  // Backup and clear require cache so process.env takes effect on module reload
  const originalEnv = process.env.ALLOWED_ORIGINS;

  process.env.ALLOWED_ORIGINS = 'http://allowed.com, http://another.com';
  delete require.cache[require.resolve('../src/index.js')];
  const { app: restrictedApp } = require('../src/index.js');

  let res = await request(restrictedApp)
    .get('/health')
    .set('Origin', 'http://allowed.com');
  assert.strictEqual(res.headers['access-control-allow-origin'], 'http://allowed.com');

  res = await request(restrictedApp)
    .get('/health')
    .set('Origin', 'http://notallowed.com');
  assert.strictEqual(res.headers['access-control-allow-origin'], undefined);

  // Restore
  process.env.ALLOWED_ORIGINS = originalEnv;
});
