const test = require('node:test');
const assert = require('node:assert');
const KeyPool = require('../src/engine/key-pool');

test('KeyPool: round-robin rotates across multiple keys', () => {
  const pool = new KeyPool('sk-alpha, sk-beta, sk-gamma');
  assert.strictEqual(pool.hasKeys(), true);
  assert.strictEqual(pool.getKeyCount().total, 3);
  assert.strictEqual(pool.getKeyCount().healthy, 3);

  assert.strictEqual(pool.getNextKey(), 'sk-alpha');
  assert.strictEqual(pool.getNextKey(), 'sk-beta');
  assert.strictEqual(pool.getNextKey(), 'sk-gamma');
  assert.strictEqual(pool.getNextKey(), 'sk-alpha');
});

test('KeyPool: cooldown skips rate-limited key', () => {
  const pool = new KeyPool(['key-1', 'key-2'], 100);

  // Mark key-1 as rate-limited
  pool.recordFailure('key-1', 429);
  assert.strictEqual(pool.getKeyCount().inCooldown, 1);
  assert.strictEqual(pool.getKeyCount().healthy, 1);

  // Next requests should strictly serve key-2
  assert.strictEqual(pool.getNextKey(), 'key-2');
  assert.strictEqual(pool.getNextKey(), 'key-2');
});

test('KeyPool: single key behavior without rotation overhead', () => {
  const pool = new KeyPool('sk-sole-key');
  assert.strictEqual(pool.getKeyCount().total, 1);
  assert.strictEqual(pool.getNextKey(), 'sk-sole-key');
  assert.strictEqual(pool.getNextKey(), 'sk-sole-key');
});
