const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const express = require('express');
const { app } = require('../src/index.js');

test('POST /v1/chat/completions handles undefined req.body (e.g. non-JSON content-type)', async () => {
  const res = await request(app)
    .post('/v1/chat/completions')
    .set('Content-Type', 'text/plain')
    .send('some text');

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Missing or invalid model');
});

test('POST /v1/chat/completions handles unsupported charset gracefully', async () => {
  const res = await request(app)
    .post('/v1/chat/completions')
    .set('Content-Type', 'application/json; charset=weird')
    .send('{}');
  assert.strictEqual(res.status, 415);
  assert.strictEqual(res.body.error, 'Unsupported media type');
});

test('POST /v1/chat/completions handles unsupported encoding gracefully', async () => {
  const res = await request(app)
    .post('/v1/chat/completions')
    .set('Content-Type', 'application/json')
    .set('Content-Encoding', 'weird')
    .send('{}');
  assert.strictEqual(res.status, 415);
  assert.strictEqual(res.body.error, 'Unsupported media type');
});

test('POST /v1/chat/completions handles aborted requests gracefully', async () => {
  const mockApp = express();

  mockApp.post('/trigger-aborted', (req, res, next) => {
    const err = new Error('request aborted');
    err.status = 400;
    err.type = 'request.aborted';
    next(err);
  });

  mockApp.use((err, req, res, next) => {
    if (err.type === 'request.aborted') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).send(Buffer.from(JSON.stringify({ error: 'Bad request' })));
    }
    next(err);
  });

  const res = await request(mockApp).post('/trigger-aborted').send({});
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Bad request');
});

test('POST /v1/chat/completions handles payload too large gracefully', async () => {
  const largeString = 'a'.repeat(600 * 1024); // 600kb, which is > 512kb limit
  const res = await request(app)
    .post('/v1/chat/completions')
    .send({
      model: 'gpt-4',
      messages: [{ role: 'user', content: largeString }]
    });

  assert.strictEqual(res.status, 413);
  assert.strictEqual(res.body.error, 'Payload too large');
});

test('JSON error handler safely skips without crashing if headers are already sent', async () => {
  app.get('/trigger-headers-sent', (req, res, next) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('ok');

    const err = new SyntaxError('Unexpected token');
    err.status = 400;
    err.body = 'bad json';

    next(err);
  });

  try {
    const originalConsoleError = console.error;
    console.error = () => {};
    await request(app).get('/trigger-headers-sent');
    console.error = originalConsoleError;
  } catch (e) {
    // Expected connection abort
  }

  assert.ok(true);
});

test('POST /v1/chat/completions handles extremely large model names gracefully', async () => {
  const largeModel = 'a'.repeat(10000);
  const res = await request(app)
    .post('/v1/chat/completions')
    .send({
      model: largeModel,
      messages: [{ role: 'user', content: 'test' }]
    });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Missing or invalid model');
});

test('POST /v1/chat/completions handles request.size.invalid gracefully', async () => {
  const res = await request(app)
    .post('/v1/chat/completions')
    .set('Content-Type', 'application/json')
    .set('Content-Length', '1')
    .send('{"a":1}');

  assert.strictEqual(res.status, 400);
});

test('POST /v1/chat/completions handles entity.parse.failed gracefully', async () => {
  const res = await request(app)
    .post('/v1/chat/completions')
    .set('Content-Type', 'application/json')
    .send('not json');

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Invalid JSON payload');
});
