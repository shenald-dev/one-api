const { test } = require('node:test');
const assert = require('node:assert');

test('module loads', async () => {
  const mod = require('../src/index.js');
  assert.ok(mod, 'Module should be defined');

});

test('main function exists', () => {
  const mod = require('../src/index.js');
  assert.ok(typeof mod.main === 'function' || typeof mod.runBenchmark === 'function', 'Should have main/benchmark function');

});
