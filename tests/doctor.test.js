const { test } = require('node:test');
const assert = require('node:assert');
const { runDoctor } = require('../src/cli/doctor.js');

test('System Doctor: runs comprehensive environment and health diagnosis without throwing', async () => {
  // Capture console output
  const origLog = console.log;
  let logBuffer = '';
  console.log = (...args) => {
    logBuffer += args.join(' ') + '\n';
  };

  try {
    const success = await runDoctor();
    assert.strictEqual(success, true);
    assert.ok(logBuffer.includes('Runtime & Operating System'));
    assert.ok(logBuffer.includes('Gateway Configuration'));
    assert.ok(logBuffer.includes('Provider Readiness Matrix'));
    assert.ok(logBuffer.includes('Zero-Config Self-Healing Check'));
  } finally {
    console.log = origLog;
  }
});
