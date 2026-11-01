const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../src/index.js');

test('POST /v1/chat/completions supports streaming SSE', async () => {
  const res = await request(app)
    .post('/v1/chat/completions')
    .send({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Stream test message' }],
      stream: true
    })
    .expect(200);

  assert.strictEqual(res.headers['content-type'], 'text/event-stream; charset=utf-8');
  assert.strictEqual(res.headers['cache-control'], 'no-cache, no-transform');

  const rawText = res.text;
  assert.ok(rawText.includes('data: '), 'Should contain SSE data lines');
  assert.ok(rawText.includes('data: [DONE]'), 'Should terminate with [DONE]');

  // Verify that individual data chunks parse as valid JSON
  const lines = rawText.split('\n');
  let parsedChunksCount = 0;
  let receivedContent = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue;
    const jsonStr = trimmed.slice(6);
    const chunk = JSON.parse(jsonStr);

    assert.strictEqual(chunk.object, 'chat.completion.chunk');
    assert.strictEqual(chunk.model, 'gpt-4o');
    assert.ok(chunk.id.startsWith('chatcmpl-'));

    if (chunk.choices?.[0]?.delta?.content) {
      receivedContent += chunk.choices[0].delta.content;
    }
    parsedChunksCount++;
  }

  assert.ok(parsedChunksCount > 0, 'Should have received multiple chunks');
  assert.ok(receivedContent.length > 0, 'Should have accumulated stream content');
});
