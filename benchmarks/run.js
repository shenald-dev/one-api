const { performance } = require('perf_hooks');

async function run() {
  const mod = require('../src/index.js');
  const func = mod.main || mod.runBenchmark || mod.runExperiment;

  if (!func) {
    console.error('No benchmark function found');
    process.exit(1);
  }

  await func();
}

run().catch(console.error);
