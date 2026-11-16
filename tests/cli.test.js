const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const path = require('path');

const CLI_PATH = path.resolve(__dirname, '../bin/cli.js');

test('CLI Binary: bin/cli.js --help prints usage instructions', () => {
  const output = execFileSync(process.execPath, [CLI_PATH, '--help'], { encoding: 'utf-8' });
  assert.ok(output.includes('one-api — Universal Edge LLM Gateway'));
  assert.ok(output.includes('Commands:'));
  assert.ok(output.includes('doctor'));
  assert.ok(output.includes('benchmark'));
});

test('CLI Binary: bin/cli.js -v prints correct version', () => {
  const output = execFileSync(process.execPath, [CLI_PATH, '-v'], { encoding: 'utf-8' });
  assert.ok(output.includes('one-api v3.0.0'));
});

test('CLI Binary: bin/cli.js doctor executes diagnostic runner and succeeds', () => {
  const output = execFileSync(process.execPath, [CLI_PATH, 'doctor'], { encoding: 'utf-8' });
  assert.ok(output.includes('🩺 one-api Gateway Diagnostic & System Doctor'));
  assert.ok(output.includes('Runtime & Operating System:'));
  assert.ok(output.includes('Provider Readiness Matrix:'));
  assert.ok(output.includes('System Doctor completed with 0 fatal errors'));
});
