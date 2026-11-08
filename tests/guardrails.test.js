const test = require('node:test');
const assert = require('node:assert');
const guardrails = require('../src/engine/guardrails');

test('Guardrails: redacts leaked API keys and sensitive tokens', () => {
  guardrails.enabled = true;
  guardrails.action = 'redact';

  const leakedMessage = {
    role: 'user',
    content: 'My secret key is sk-proj-abc1234567890abcdef1234567890abcdef1234567890 please help.'
  };

  const { messages, violations } = guardrails.processMessages([leakedMessage]);
  assert.ok(violations.length > 0);
  assert.strictEqual(violations[0], 'OPENAI_KEY');
  assert.ok(!messages[0].content.includes('sk-proj-'));
  assert.ok(messages[0].content.includes('[REDACTED_OPENAI_KEY]'));
});

test('Guardrails: redacts SSN and credit card numbers', () => {
  guardrails.enabled = true;
  guardrails.action = 'redact';

  const ssnMessage = { role: 'user', content: 'Customer SSN: 123-45-6789' };
  const { messages, violations } = guardrails.processMessages([ssnMessage]);

  assert.ok(violations.includes('SSN'));
  assert.ok(messages[0].content.includes('[REDACTED_SSN]'));
});

test('Guardrails: blocks request when action=block', () => {
  guardrails.enabled = true;
  guardrails.action = 'block';

  const leakedMessage = {
    role: 'user',
    content: 'Deploy with key AKIAIOSFODNN7EXAMPLE immediately.'
  };

  assert.throws(
    () => {
      guardrails.processMessages([leakedMessage]);
    },
    (err) => {
      assert.strictEqual(err.status, 400);
      assert.ok(err.message.includes('Guardrails'));
      return true;
    }
  );

  // Reset to default
  guardrails.action = 'redact';
  guardrails.enabled = false;
});

test('Guardrails: scanText detects and redacts standard and project OpenAI API keys', () => {
  guardrails.enabled = true;
  guardrails.action = 'redact';

  const standardKey = 'sk-123456789012345678901234567890123456';
  const resStandard = guardrails.scanText(`Here is standard key: ${standardKey}`);
  assert.ok(resStandard.violations.includes('OPENAI_KEY'));
  assert.ok(!resStandard.text.includes(standardKey));
  assert.strictEqual(resStandard.text, 'Here is standard key: [REDACTED_OPENAI_KEY]');

  const projectKey = 'sk-proj-abc1234567890abcdef1234567890abcdef1234567890';
  const resProject = guardrails.scanText(`Here is project key: ${projectKey}`);
  assert.ok(resProject.violations.includes('OPENAI_KEY'));
  assert.ok(!resProject.text.includes(projectKey));
  assert.strictEqual(resProject.text, 'Here is project key: [REDACTED_OPENAI_KEY]');

  // Reset to default
  guardrails.enabled = false;
});
