const { test } = require('node:test');
const assert = require('node:assert');

test('module loads', async (t) => {
  const mod = require('../src/index.js');
  assert.ok(mod, 'Module should be defined');
  t.end();
});

test('main function exists', (t) => {
  const mod = require('../src/index.js');
  assert.ok(typeof mod.main === 'function' || typeof mod.runBenchmark === 'function', 'Should have main/benchmark function');
  t.end();
});
