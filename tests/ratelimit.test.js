const test = require('node:test');
const assert = require('node:assert');
const RateLimiter = require('../src/engine/ratelimit.js');

test('RateLimiter: limits requests per minute', () => {
  const limiter = new RateLimiter(3);
  const client = 'client-ip-1';

  assert.strictEqual(limiter.isRateLimited(client), false);
  assert.strictEqual(limiter.isRateLimited(client), false);
  assert.strictEqual(limiter.isRateLimited(client), false);
  assert.strictEqual(limiter.isRateLimited(client), true);
  assert.strictEqual(limiter.getRemaining(client), 0);
});

test('RateLimiter: window sliding logic correctly drops old requests', (t) => {
  const limiter = new RateLimiter(3);
  const client = 'client-ip-2';

  const originalDateNow = Date.now;
  try {
    let mockTime = 1000000;
    Date.now = () => mockTime;

    assert.strictEqual(limiter.isRateLimited(client), false);
    assert.strictEqual(limiter.isRateLimited(client), false);
    assert.strictEqual(limiter.isRateLimited(client), false);
    assert.strictEqual(limiter.isRateLimited(client), true); // Blocked

    // Advance time by 30 seconds
    mockTime += 30 * 1000;
    assert.strictEqual(limiter.isRateLimited(client), true); // Still Blocked

    // Advance time by another 31 seconds (total 61 seconds, window is 60)
    mockTime += 31 * 1000;

    // The previous requests should have fallen out of the 60s window
    assert.strictEqual(limiter.isRateLimited(client), false);
    assert.strictEqual(limiter.getRemaining(client), 2);
  } finally {
    Date.now = originalDateNow;
  }
});

test('RateLimiter: rpm <= 0 disables rate limiting', () => {
  const limiter = new RateLimiter(0);
  const client = 'client-ip-3';

  assert.strictEqual(limiter.isRateLimited(client), false);
  assert.strictEqual(limiter.isRateLimited(client), false);
  assert.strictEqual(limiter.getRemaining(client), Infinity);

  const limiterNegative = new RateLimiter(-1);
  assert.strictEqual(limiterNegative.isRateLimited(client), false);
  assert.strictEqual(limiterNegative.getRemaining(client), Infinity);
});

test('RateLimiter: getRemaining calculates correctly', (t) => {
  const limiter = new RateLimiter(5);
  const client = 'client-ip-4';

  const originalDateNow = Date.now;
  try {
    let mockTime = 1000000;
    Date.now = () => mockTime;

    assert.strictEqual(limiter.getRemaining(client), 5);
    limiter.isRateLimited(client);
    assert.strictEqual(limiter.getRemaining(client), 4);
    limiter.isRateLimited(client);
    assert.strictEqual(limiter.getRemaining(client), 3);

    // Advance time beyond window
    mockTime += 61 * 1000;
    assert.strictEqual(limiter.getRemaining(client), 5);
  } finally {
    Date.now = originalDateNow;
  }
});

test('RateLimiter: resets correctly', () => {
  const limiter = new RateLimiter(2);
  const client = 'client-ip-5';

  limiter.isRateLimited(client);
  limiter.isRateLimited(client);
  assert.strictEqual(limiter.isRateLimited(client), true);

  limiter.reset();
  assert.strictEqual(limiter.isRateLimited(client), false);
});

test('RateLimiter: limits multiple distinct clients independently', () => {
  const limiter = new RateLimiter(2);
  const clientA = 'client-A';
  const clientB = 'client-B';

  assert.strictEqual(limiter.isRateLimited(clientA), false);
  assert.strictEqual(limiter.isRateLimited(clientA), false);
  assert.strictEqual(limiter.isRateLimited(clientA), true); // A is blocked

  assert.strictEqual(limiter.isRateLimited(clientB), false); // B is allowed
  assert.strictEqual(limiter.isRateLimited(clientB), false);
  assert.strictEqual(limiter.isRateLimited(clientB), true);  // B is blocked

  assert.strictEqual(limiter.getRemaining(clientA), 0);
  assert.strictEqual(limiter.getRemaining(clientB), 0);
});
