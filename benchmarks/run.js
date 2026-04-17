async function run() {
  const mod = require('../src/index.js');
  const func = mod.main || mod.runBenchmark || mod.runExperiment;

  if (!func) {
    console.error('No benchmark function found');
    process.exit(1);
  }

  // Delegate iteration and performance reporting to the target function
  // to prevent redundant logic and inaccurate timing results.
  await func();
}

run().catch(console.error);
