// one-api
const { performance } = require('perf_hooks');

function heavyComputation(iterations) {
  let sum = 0;
  for (let i = 0; i < iterations; i++) {
    sum += Math.sqrt(i) * Math.sin(i * 0.01);
  }
  return sum;
}

async function main() {
  const iterations = 100000;
  const runs = 10;
  const times = [];

  console.log('Running ' + runs + ' iterations...');
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    const result = heavyComputation(iterations);
    const end = performance.now();
    times.push(end - start);
    if (i % 2 === 0) process.stdout.write('.');
  }
  console.log('\n');

  const avg = times.reduce((a,b) => a+b) / times.length;
  console.log('Average: ' + avg.toFixed(2) + 'ms');
  console.log('Throughput: ' + (1000/avg).toFixed(2) + ' ops/sec');
  return { avg, throughput: 1000/avg };
}

if (require.main === module) {
  main().then(r => { console.log('Results:', r); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { main };
