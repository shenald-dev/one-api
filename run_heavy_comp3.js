const { performance } = require('perf_hooks');
const { heavyComputation } = require('./src/index.js');
const { test } = require('node:test');

test('heavyComputation is memoized', () => {
  const it = 100000;
  const start1 = performance.now();
  const res1 = heavyComputation(it);
  const end1 = performance.now();
  const time1 = end1 - start1;

  const start2 = performance.now();
  const res2 = heavyComputation(it);
  const end2 = performance.now();
  const time2 = end2 - start2;
  console.log('time1:', time1, 'time2:', time2);
});
