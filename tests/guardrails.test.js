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
