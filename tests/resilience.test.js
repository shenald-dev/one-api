const test = require('node:test');
const assert = require('node:assert');
const { CircuitBreaker, retryWithBackoff } = require('../src/engine/resilience');

test('CircuitBreaker: transitions CLOSED -> OPEN -> HALF_OPEN -> CLOSED', () => {
  const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 50 });
  const provider = 'mock-upstream';

  assert.strictEqual(cb.isOpen(provider), false);

  // 1st failure (500)
  cb.recordFailure(provider, { status: 500 });
  assert.strictEqual(cb.isOpen(provider), false);

  // 2nd failure (503)
  cb.recordFailure(provider, { status: 503 });
  assert.strictEqual(cb.isOpen(provider), false);

  // 3rd failure (504) -> Tripped!
  cb.recordFailure(provider, { status: 504 });
  assert.strictEqual(cb.isOpen(provider), true);

  // Non-server error (e.g. 400 Bad Request) does NOT trip breaker
  const clientBreaker = new CircuitBreaker({ failureThreshold: 2 });
  clientBreaker.recordFailure('api', { status: 400 });
  clientBreaker.recordFailure('api', { status: 404 });
  assert.strictEqual(clientBreaker.isOpen('api'), false);
});

test('CircuitBreaker: probe in HALF_OPEN resets upon consecutive successes', async () => {
  const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 30 });
  const p = 'upstream';

  cb.recordFailure(p, { status: 500 });
  cb.recordFailure(p, { status: 500 });
  assert.strictEqual(cb.isOpen(p), true);

  // Wait for reset timeout
  await new Promise((r) => setTimeout(r, 45));

  // Should transition to HALF_OPEN
  assert.strictEqual(cb.isOpen(p), false);

  // Record successes
  cb.recordSuccess(p);
  cb.recordSuccess(p);

  const status = cb.getStatus();
  assert.strictEqual(status[p].state, 'CLOSED');
  assert.strictEqual(status[p].failures, 0);
});

test('retryWithBackoff: retries transient errors and succeeds', async () => {
  let attempts = 0;
  const result = await retryWithBackoff(
    async () => {
      attempts++;
      if (attempts < 2) {
        const err = new Error('Gateway Timeout');
        err.status = 504;
        throw err;
      }
      return 'success_val';
    },
    { maxRetries: 2, baseDelayMs: 10 }
  );

  assert.strictEqual(result, 'success_val');
  assert.strictEqual(attempts, 2);
});

test('retryWithBackoff: does not retry non-retryable 4xx errors', async () => {
  let attempts = 0;
  await assert.rejects(
    async () => {
      await retryWithBackoff(
        async () => {
          attempts++;
          const err = new Error('Unauthorized');
          err.status = 401;
          throw err;
        },
        { maxRetries: 2, baseDelayMs: 10 }
      );
    },
    (err) => {
      assert.strictEqual(err.status, 401);
      assert.strictEqual(attempts, 1); // Only 1 attempt, no retry
      return true;
    }
  );
});
