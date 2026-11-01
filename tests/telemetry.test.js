const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../src/index.js');

test('GET /health/detailed returns system metrics and active providers', async () => {
  const res = await request(app).get('/health/detailed');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'ok');
  assert.ok(typeof res.body.uptime_seconds === 'number');
  assert.ok(Array.isArray(res.body.providers.active));
  assert.ok(res.body.memory && typeof res.body.memory.rss === 'number');
});

test('GET /v1/metrics returns gateway request statistics', async () => {
  // Send a request to generate traffic
  await request(app)
    .post('/v1/chat/completions')
    .send({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Generate metrics traffic' }]
    });

  const res = await request(app).get('/v1/metrics');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.gateway, 'one-api');
  assert.ok(res.body.telemetry.requests.total >= 1);
  assert.ok(typeof res.body.telemetry.latency.avg_ms === 'number');
  assert.ok(typeof res.body.telemetry.tokens.total === 'number');
});
