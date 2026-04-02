// Mock missing dependencies to allow src/index.js to load in restricted environments
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(name) {
  if (['express', 'cors', 'helmet', 'dotenv', 'compression'].includes(name)) {
    if (name === 'dotenv') return { config: () => {} };
    if (name === 'compression') return () => (req, res, next) => next();
    if (name === 'express') {
      const mockApp = {
        set: () => mockApp,
        use: () => mockApp,
        post: () => mockApp,
        get: () => mockApp,
        listen: (port, cb) => { if (cb) cb(); return mockApp; }
      };
      const expressMock = () => mockApp;
      expressMock.json = () => () => {};
      return expressMock;
    }
    return () => {}; // cors, helmet
  }
  return originalRequire.apply(this, arguments);
};

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

test('main function returns expected performance metrics', async () => {
  const { main } = require('../src/index.js');
  const result = await main();

  assert.strictEqual(typeof result, 'object', 'Result should be an object');
  assert.strictEqual(typeof result.avg, 'number', 'avg should be a number');
  assert.strictEqual(typeof result.throughput, 'number', 'throughput should be a number');
  assert.ok(result.avg >= 0, 'avg should be non-negative');
  assert.ok(result.throughput >= 0, 'throughput should be non-negative');
});
