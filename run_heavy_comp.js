const { performance } = require('perf_hooks');
const { heavyComputation } = require('./src/index.js');
const it = 100000;
const start1 = performance.now();
const res1 = heavyComputation(it);
const end1 = performance.now();
console.log('time1:', end1 - start1);

const start2 = performance.now();
const res2 = heavyComputation(it);
const end2 = performance.now();
console.log('time2:', end2 - start2);
