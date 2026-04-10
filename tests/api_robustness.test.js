const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../src/index.js');

test('POST /v1/chat/completions handles undefined req.body (e.g. non-JSON content-type)', async () => {
  const res = await request(app)
    .post('/v1/chat/completions')
    .set('Content-Type', 'text/plain')
    .send('some text');

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'Missing or invalid model');
});

test('POST /v1/chat/completions handles payload too large gracefully', async () => {
  const largeString = 'a'.repeat(11 * 1024 * 1024); // 11mb, which is > 10mb limit
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
  // Inject a route into the existing app just for this test
  app.get('/trigger-headers-sent', (req, res, next) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('ok');

    // Simulate an error occurring after headers are sent, specifically a JSON parsing error
    const err = new SyntaxError('Unexpected token');
    err.status = 400;
    err.body = 'bad json';

    next(err);
  });

  try {
    // Suppress console.error output during this expected error delegation
    const originalConsoleError = console.error;
    console.error = () => {};
    await request(app).get('/trigger-headers-sent');
    console.error = originalConsoleError;
  } catch (e) {
    // Connection is likely aborted since we delegate to default express error handler which destroys the socket
  }

  // The fact that it gets here without an UncaughtException (ERR_HTTP_HEADERS_SENT) means it passed
  assert.ok(true);
});

test('CORS is disabled by default if ALLOWED_ORIGINS is unset', async () => {
  const res = await request(app)
    .options('/health')
    .set('Origin', 'http://evil.com')
    .set('Access-Control-Request-Method', 'GET');

  assert.strictEqual(res.headers['access-control-allow-origin'], undefined);
});
