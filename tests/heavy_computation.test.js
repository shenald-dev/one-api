const { test } = require('node:test');
const assert = require('node:assert');
const { performance } = require('perf_hooks');
const { heavyComputation } = require('../src/index.js');

test('heavyComputation returns correct result', () => {
  const result = heavyComputation(100);
  assert.strictEqual(typeof result, 'number');
  assert.ok(!isNaN(result));
});

test('heavyComputation is memoized', () => {
  const it = 100000;

  // First call (cold)
  const start1 = performance.now();
  const res1 = heavyComputation(it);
  const end1 = performance.now();
  const time1 = end1 - start1;

  // Second call (warm)
  const start2 = performance.now();
  const res2 = heavyComputation(it);
  const end2 = performance.now();
  const time2 = end2 - start2;

  assert.strictEqual(res1, res2, 'Results should be identical');
  assert.ok(time2 < time1, `Warm call (${time2.toFixed(4)}ms) should be faster than cold call (${time1.toFixed(4)}ms)`);
  assert.ok(time2 < 1.0, 'Warm call should be near-instant');
});
