const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { calculateCost, formatCost } = require('../src/engine/cost');
const { app } = require('../src/index');

test('Cost: calculates pricing accurately for major models', () => {
  // Claude 3.5 Sonnet: $3/M prompt, $15/M completion
  const sonnet = calculateCost('claude-3-5-sonnet-20241022', 100_000, 50_000);
  // (0.1 * 3) + (0.05 * 15) = 0.30 + 0.75 = 1.05
  assert.strictEqual(sonnet.totalCost, 1.05);

  // GPT-4o: $2.5/M prompt, $10/M completion
  const gpt = calculateCost('gpt-4o', 200_000, 100_000);
  // (0.2 * 2.5) + (0.1 * 10) = 0.50 + 1.00 = 1.50
  assert.strictEqual(gpt.totalCost, 1.5);

  // Zero tokens
  const zero = calculateCost('gpt-4o', 0, 0);
  assert.strictEqual(zero.totalCost, 0);
  assert.strictEqual(zero.formattedCost, '$0.00');
});

test('Cost: formats dollar amounts cleanly', () => {
  assert.strictEqual(formatCost(0), '$0.00');
  assert.strictEqual(formatCost(0.00045), '$0.00045');
  assert.strictEqual(formatCost(0.0042), '$0.0042');
  assert.strictEqual(formatCost(1.25), '$1.250');
});

test('Cost: POST /v1/chat/completions injects cost and model tracking headers', async () => {
  const res = await request(app)
    .post('/v1/chat/completions')
    .send({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Estimate this cost' }]
    });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.headers['x-served-by-model'], 'gpt-4o');
  assert.ok(res.headers['x-token-cost-usd']);
  assert.ok(parseFloat(res.headers['x-token-cost-usd']) >= 0);
});
