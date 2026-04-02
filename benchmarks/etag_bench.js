const express = require('express');
const request = require('supertest');
const { app } = require('../src/index.js');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

async function runBench(etag) {
  const testApp = express();
  if (!etag) testApp.set('etag', false);
  testApp.post('/v1/chat/completions', (req, res) => {
    res.json({
      id: `chatcmpl-${crypto.randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4',
      choices: [{ index: 0, message: { role: 'assistant', content: 'x'.repeat(10000) }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
    });
  });

  const reqObj = request(testApp);

  // Warmup
  for (let i = 0; i < 100; i++) {
    await reqObj.post('/v1/chat/completions').send({ model: 'gpt-4', messages: [{ role: 'user', content: 'test' }] });
  }

  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    await reqObj.post('/v1/chat/completions').send({ model: 'gpt-4', messages: [{ role: 'user', content: 'test' }] });
  }
  const end = performance.now();
  return end - start;
}

async function main() {
  const timeWithEtag = await runBench(true);
  const timeWithoutEtag = await runBench(false);
  console.log(`With ETag: ${timeWithEtag.toFixed(2)}ms`);
  console.log(`Without ETag: ${timeWithoutEtag.toFixed(2)}ms`);
}
main();
