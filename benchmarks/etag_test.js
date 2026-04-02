const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

const appWithEtag = express();
appWithEtag.post('/api', (req, res) => {
  res.json({ id: crypto.randomUUID(), time: Date.now(), data: 'x'.repeat(10000) });
});

const appWithoutEtag = express();
appWithoutEtag.set('etag', false);
appWithoutEtag.post('/api', (req, res) => {
  res.json({ id: crypto.randomUUID(), time: Date.now(), data: 'x'.repeat(10000) });
});

async function run() {
  const reqEtag = request(appWithEtag);
  const reqNoEtag = request(appWithoutEtag);

  // Warmup
  for(let i=0; i<100; i++) {
    await reqEtag.post('/api');
    await reqNoEtag.post('/api');
  }

  let start = performance.now();
  for(let i=0; i<1000; i++) {
    await reqEtag.post('/api');
  }
  let end = performance.now();
  console.log('With ETag:', end - start, 'ms');

  start = performance.now();
  for(let i=0; i<1000; i++) {
    await reqNoEtag.post('/api');
  }
  end = performance.now();
  console.log('Without ETag:', end - start, 'ms');
}
run();
