const { test } = require('node:test');
const assert = require('node:assert');
const AnthropicProvider = require('../src/providers/anthropic.js');
const GeminiProvider = require('../src/providers/gemini.js');
const OllamaProvider = require('../src/providers/ollama.js');
const registry = require('../src/providers/index.js');

test('AnthropicProvider: transforms OpenAI messages correctly', () => {
  const provider = new AnthropicProvider({ apiKey: 'fake-key' });
  const messages = [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Hello' },
    { role: 'user', content: 'Another user message' },
    { role: 'assistant', content: 'Hi there' }
  ];

  const { systemPrompt, anthropicMessages } = provider.transformMessages(messages);
  assert.strictEqual(systemPrompt, 'You are helpful.');
  // Consecutive user messages should be merged into one
  assert.strictEqual(anthropicMessages.length, 2);
  assert.strictEqual(anthropicMessages[0].role, 'user');
  assert.ok(anthropicMessages[0].content.includes('Hello'));
  assert.ok(anthropicMessages[0].content.includes('Another user message'));
  assert.strictEqual(anthropicMessages[1].role, 'assistant');
});

test('GeminiProvider: transforms OpenAI messages to contents/systemInstruction', () => {
  const provider = new GeminiProvider({ apiKey: 'fake-key' });
  const messages = [
    { role: 'system', content: 'System instruction test' },
    { role: 'user', content: 'User prompt' },
    { role: 'assistant', content: 'Model response' }
  ];

  const { systemInstruction, contents } = provider.transformMessages(messages);
  assert.strictEqual(systemInstruction.parts[0].text, 'System instruction test');
  assert.strictEqual(contents.length, 2);
  assert.strictEqual(contents[0].role, 'user');
  assert.strictEqual(contents[0].parts[0].text, 'User prompt');
  assert.strictEqual(contents[1].role, 'model');
  assert.strictEqual(contents[1].parts[0].text, 'Model response');
});

test('OllamaProvider: model cleanup', () => {
  const provider = new OllamaProvider();
  assert.strictEqual(provider.cleanModelName('ollama/llama3'), 'llama3');
  assert.strictEqual(provider.cleanModelName('mistral'), 'mistral');
});

test('ProviderRegistry: routes models intelligently', () => {
  // When no remote keys are configured, fallback provider is returned
  const p1 = registry.resolveProvider('claude-3-5-sonnet-20241022');
  assert.ok(p1, 'Should resolve a provider for Claude');

  const p2 = registry.resolveProvider('gemini-1.5-pro');
  assert.ok(p2, 'Should resolve a provider for Gemini');

  const p3 = registry.resolveProvider('gpt-4o');
  assert.ok(p3, 'Should resolve a provider for GPT-4o');

  const p4 = registry.resolveProvider('ollama/llama3');
  assert.strictEqual(p4.name, 'ollama');
});
