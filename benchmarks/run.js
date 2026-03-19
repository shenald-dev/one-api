const { performance } = require('perf_hooks');

async function run() {
  const mod = require('../src/index.js');
  const func = mod.main || mod.runBenchmark || mod.runExperiment;

  if (!func) {
    console.error('No benchmark function found');
    process.exit(1);
  }

  const runs = 10;
  const times = [];

  console.log('Benchmark: ' + runs + ' runs\n');
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await func();
    const end = performance.now();
    times.push(end - start);
    console.log('  Run ' + (i+1) + ': ' + (end-start).toFixed(2) + 'ms');
  }

  const avg = times.reduce((a,b)=>a+b)/times.length;
  console.log('\nAverage: ' + avg.toFixed(2) + 'ms');
  console.log('Throughput: ' + (1000/avg).toFixed(2) + ' ops/sec');
}

run().catch(console.error);
