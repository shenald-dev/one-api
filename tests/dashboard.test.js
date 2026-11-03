const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../src/index');

test('Dashboard: GET /dashboard returns HTML edge gateway dashboard', async () => {
  const res = await request(app).get('/dashboard');
  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.headers['content-type'].includes('text/html'));
  assert.ok(res.text.includes('one-api — Universal Edge LLM Gateway'));
  assert.ok(res.text.includes('Live Gateway Playground'));
  assert.ok(res.text.includes('Unified Models & Virtual Aliases Catalog'));
});

test('Dashboard: GET / negotiates HTML vs JSON depending on Accept header', async () => {
  // Browser HTML request
  const htmlRes = await request(app)
    .get('/')
    .set('Accept', 'text/html,application/xhtml+xml');

  assert.strictEqual(htmlRes.statusCode, 200);
  assert.ok(htmlRes.headers['content-type'].includes('text/html'));

  // API Client JSON request
  const jsonRes = await request(app)
    .get('/')
    .set('Accept', 'application/json');

  assert.strictEqual(jsonRes.statusCode, 200);
  assert.ok(jsonRes.headers['content-type'].includes('application/json'));
  assert.strictEqual(jsonRes.body.gateway, 'one-api');
  assert.strictEqual(jsonRes.body.status, 'online');
});

test('Dashboard: POST /v1/cache/clear empties in-memory cache', async () => {
  const res = await request(app).post('/v1/cache/clear');
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.ok, true);
  assert.strictEqual(res.body.message, 'Response cache cleared');
});
