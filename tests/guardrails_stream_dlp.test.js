const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../src/index.js');
const guardrails = require('../src/engine/guardrails.js');
const { mcpServer } = require('../src/mcp/server.js');
const registry = require('../src/providers');

test('Guardrails & DLP: oneapi_evaluate_guardrails respects action: detect_only', async () => {
  const secretKey = 'sk-proj-abcdef1234567890abcdef1234567890abcdef1234567890';
  const text = `Please inspect this secret: ${secretKey}`;

  // 1. detect_only: returns violations, but leaves redacted_text identical to original text
  const detectOnlyRes = await mcpServer.handleMessage({
    jsonrpc: '2.0',
    id: 101,
    method: 'tools/call',
    params: {
      name: 'oneapi_evaluate_guardrails',
      arguments: {
        text,
        action: 'detect_only'
      }
    }
  });

  assert.strictEqual(detectOnlyRes.result.isError, false);
  const detectData = JSON.parse(detectOnlyRes.result.content[0].text);
  assert.strictEqual(detectData.clean, false);
  assert.ok(detectData.violations.includes('OPENAI_KEY'));
  assert.strictEqual(detectData.redacted_text, text, 'Text should not be redacted when action=detect_only');

  // 2. redact: returns violations and replaces secret with placeholder
  const redactRes = await mcpServer.handleMessage({
    jsonrpc: '2.0',
    id: 102,
    method: 'tools/call',
    params: {
      name: 'oneapi_evaluate_guardrails',
      arguments: {
        text,
        action: 'redact'
      }
    }
  });

  const redactData = JSON.parse(redactRes.result.content[0].text);
  assert.strictEqual(redactData.clean, false);
  assert.ok(redactData.violations.includes('OPENAI_KEY'));
  assert.ok(redactData.redacted_text.includes('[REDACTED_OPENAI_KEY]'));
  assert.ok(!redactData.redacted_text.includes(secretKey));
});

test('Guardrails & DLP: Non-streaming completion redacts model-regurgitated secrets', async () => {
  guardrails.enabled = true;
  guardrails.action = 'redact';

  // Temporarily stub fallbackProvider.complete to simulate upstream model returning a secret
  const origComplete = registry.fallbackProvider.complete;
  registry.fallbackProvider.complete = async () => ({
    id: 'mock-secret',
    model: 'gpt-4o',
    choices: [
      {
        message: {
          role: 'assistant',
          content: 'Here is your token: ghp_1234567890abcdefghijklmnopqrstuvwxyz1234'
        }
      }
    ],
    usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 }
  });

  try {
    const res = await request(app)
      .post('/v1/chat/completions')
      .send({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Give me a github token' }]
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['x-guardrails-violated'], 'true');
    const content = res.body.choices[0].message.content;
    assert.ok(content.includes('[REDACTED_GITHUB_TOKEN]'), 'Leaked token must be redacted');
    assert.ok(!content.includes('ghp_1234567890'));
  } finally {
    registry.fallbackProvider.complete = origComplete;
    guardrails.enabled = false;
  }
});

test('Guardrails & DLP: Streaming SSE chunks are sanitized on the fly', async () => {
  guardrails.enabled = true;
  guardrails.action = 'redact';

  // Stub stream to emit a chunk containing an Anthropic API key
  const origStream = registry.fallbackProvider.stream;
  registry.fallbackProvider.stream = async (params, onChunk) => {
    const secretKey = 'sk-ant-api03-1234567890abcdef1234567890abcdef12345678';
    onChunk(`data: {"id":"1","choices":[{"delta":{"content":"API: ${secretKey}"}}]}\n\n`);
  };

  try {
    const res = await request(app)
      .post('/v1/chat/completions')
      .send({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Stream test' }],
        stream: true
      });

    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('[REDACTED_ANTHROPIC_KEY]'), 'Streaming chunk must have secret redacted');
    assert.ok(!res.text.includes('sk-ant-api03'));
  } finally {
    registry.fallbackProvider.stream = origStream;
    guardrails.enabled = false;
  }
});
