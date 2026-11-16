// Unified Benchmark Runner for one-api
async function run() {
  const mod = require('../src/index.js');
  const func = mod.main || mod.runBenchmark || mod.runExperiment;

  if (func) {
    await func();
  }

  const { runBenchmarkSuite } = require('./gateway.bench');
  if (typeof runBenchmarkSuite === 'function') {
    await runBenchmarkSuite();
  }
}

run().catch(console.error);
