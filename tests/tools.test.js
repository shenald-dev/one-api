const test = require('node:test');
const assert = require('node:assert');
const {
  hasTools,
  toAnthropicTools,
  toAnthropicToolChoice,
  extractAnthropicToolCalls,
  toGeminiTools,
  extractGeminiToolCalls
} = require('../src/engine/tools');
const AnthropicProvider = require('../src/providers/anthropic');
const GeminiProvider = require('../src/providers/gemini');

test('Tools: hasTools identifies tool arrays accurately', () => {
  assert.strictEqual(hasTools(null), false);
  assert.strictEqual(hasTools([]), false);
  assert.strictEqual(hasTools([{ type: 'function', function: { name: 'get_weather' } }]), true);
});

test('Tools: toAnthropicTools converts OpenAI tools to Anthropic format', () => {
  const openAITools = [
    {
      type: 'function',
      function: {
        name: 'get_stock_price',
        description: 'Retrieves stock price',
        parameters: {
          type: 'object',
          properties: {
            ticker: { type: 'string' }
          },
          required: ['ticker']
        }
      }
    }
  ];

  const anthropicTools = toAnthropicTools(openAITools);
  assert.strictEqual(anthropicTools.length, 1);
  assert.strictEqual(anthropicTools[0].name, 'get_stock_price');
  assert.strictEqual(anthropicTools[0].description, 'Retrieves stock price');
  assert.deepStrictEqual(anthropicTools[0].input_schema, openAITools[0].function.parameters);

  assert.deepStrictEqual(toAnthropicToolChoice('auto'), { type: 'auto' });
  assert.deepStrictEqual(toAnthropicToolChoice('required'), { type: 'any' });
  assert.deepStrictEqual(toAnthropicToolChoice({ type: 'function', function: { name: 'get_stock_price' } }), {
    type: 'tool',
    name: 'get_stock_price'
  });
});

test('Tools: extractAnthropicToolCalls parses tool_use blocks', () => {
  const content = [
    { type: 'text', text: 'Let me fetch that for you.' },
    {
      type: 'tool_use',
      id: 'toolu_01A',
      name: 'get_stock_price',
      input: { ticker: 'AAPL' }
    }
  ];

  const calls = extractAnthropicToolCalls(content);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].id, 'toolu_01A');
  assert.strictEqual(calls[0].type, 'function');
  assert.strictEqual(calls[0].function.name, 'get_stock_price');
  assert.strictEqual(calls[0].function.arguments, JSON.stringify({ ticker: 'AAPL' }));
});

test('Tools: toGeminiTools converts OpenAI tools to functionDeclarations', () => {
  const openAITools = [
    {
      type: 'function',
      function: {
        name: 'calculate_tax',
        description: 'Calculates tax amount',
        parameters: {
          type: 'object',
          properties: {
            amount: { type: 'number' }
          }
        }
      }
    }
  ];

  const geminiTools = toGeminiTools(openAITools);
  assert.strictEqual(geminiTools.length, 1);
  assert.strictEqual(geminiTools[0].functionDeclarations.length, 1);
  assert.strictEqual(geminiTools[0].functionDeclarations[0].name, 'calculate_tax');
});

test('Tools: extractGeminiToolCalls extracts functionCall parts', () => {
  const parts = [
    { text: 'Calculating...' },
    {
      functionCall: {
        name: 'calculate_tax',
        args: { amount: 100 }
      }
    }
  ];

  const calls = extractGeminiToolCalls(parts);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].function.name, 'calculate_tax');
  assert.strictEqual(calls[0].function.arguments, JSON.stringify({ amount: 100 }));
});

test('Tools: AnthropicProvider message transformer handles tool role & assistant tool_calls', () => {
  const provider = new AnthropicProvider();
  const messages = [
    { role: 'user', content: 'What is the price of GOOG?' },
    {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'get_price', arguments: '{"ticker":"GOOG"}' }
        }
      ]
    },
    {
      role: 'tool',
      tool_call_id: 'call_1',
      content: '{"price": 180.50}'
    }
  ];

  const { anthropicMessages } = provider.transformMessages(messages);
  assert.strictEqual(anthropicMessages.length, 3);
  assert.strictEqual(anthropicMessages[0].role, 'user');
  assert.strictEqual(anthropicMessages[1].role, 'assistant');
  assert.strictEqual(anthropicMessages[1].content[0].type, 'tool_use');
  assert.strictEqual(anthropicMessages[1].content[0].name, 'get_price');
  assert.strictEqual(anthropicMessages[2].role, 'user');
  assert.strictEqual(anthropicMessages[2].content[0].type, 'tool_result');
  assert.strictEqual(anthropicMessages[2].content[0].tool_use_id, 'call_1');
});

test('Tools: GeminiProvider message transformer handles tool role & assistant tool_calls', () => {
  const provider = new GeminiProvider();
  const messages = [
    { role: 'user', content: 'Convert currency' },
    {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call_2',
          type: 'function',
          function: { name: 'convert', arguments: '{"usd":50}' }
        }
      ]
    },
    {
      role: 'tool',
      name: 'convert',
      content: '{"eur":46}'
    }
  ];

  const { contents } = provider.transformMessages(messages);
  assert.strictEqual(contents.length, 3);
  assert.strictEqual(contents[0].role, 'user');
  assert.strictEqual(contents[1].role, 'model');
  assert.strictEqual(contents[1].parts[0].functionCall.name, 'convert');
  assert.strictEqual(contents[2].role, 'function');
  assert.strictEqual(contents[2].parts[0].functionResponse.name, 'convert');
});
