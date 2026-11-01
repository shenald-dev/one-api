const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../src/index.js');

test('GET /v1/models returns unified list of models', async () => {
  const res = await request(app).get('/v1/models');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.object, 'list');
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length >= 10);

  const modelIds = res.body.data.map(m => m.id);
  assert.ok(modelIds.includes('gpt-4o'), 'Should include gpt-4o');
  assert.ok(modelIds.includes('claude-3-5-sonnet-20241022'), 'Should include Claude 3.5 Sonnet');
  assert.ok(modelIds.includes('gemini-1.5-pro'), 'Should include Gemini 1.5 Pro');
  assert.ok(modelIds.includes('deepseek-chat'), 'Should include DeepSeek Chat');
});

test('GET /v1/models/:model returns individual model details', async () => {
  const res = await request(app).get('/v1/models/gpt-4o');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.id, 'gpt-4o');
  assert.strictEqual(res.body.owned_by, 'openai');
  assert.strictEqual(res.body.object, 'model');
});

test('GET /v1/models/:model returns 404 for non-existent model', async () => {
  const res = await request(app).get('/v1/models/non-existent-model-xyz');
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.error.code, 'model_not_found');
});
