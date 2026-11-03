// Built-in Zero-Config Local / Fallback Provider (With Mock Tool Execution Support)
const BaseProvider = require('./base');
const { formatOpenAIChunk } = require('../engine/sse');
const { estimateMessagesTokens, estimateTextTokens } = require('../engine/tokenizer');

class MockProvider extends BaseProvider {
  constructor() {
    super('local-mock');
  }

  isConfigured() {
    return true;
  }

  async complete(params) {
    const { model, messages, tools, tool_choice, id = 'mock-' + Date.now() } = params;

    let content = 'This is a mock response from the unified API.';
    let tool_calls = undefined;
    let finish_reason = 'stop';

    // If client required or forced a tool, simulate a mock tool call
    if (Array.isArray(tools) && tools.length > 0 && (tool_choice === 'required' || (typeof tool_choice === 'object' && tool_choice.type === 'function'))) {
      const targetTool = typeof tool_choice === 'object' && tool_choice.function?.name
        ? tools.find((t) => (t.function?.name || t.name) === tool_choice.function.name) || tools[0]
        : tools[0];

      const fn = targetTool.function || targetTool;
      tool_calls = [
        {
          id: `call_${Math.random().toString(36).substring(2, 10)}`,
          type: 'function',
          function: {
            name: fn.name,
            arguments: JSON.stringify({ query: 'sample_mock_arg' })
          }
        }
      ];
      content = null;
      finish_reason = 'tool_calls';
    }

    const promptTokens = estimateMessagesTokens(messages);
    const completionTokens = tool_calls ? 20 : estimateTextTokens(content || '');

    return {
      id: `chatcmpl-${id}`,
      object: 'chat.completion',
      created: Math.trunc(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
            ...(tool_calls && { tool_calls })
          },
          finish_reason
        }
      ],
      usage: {
        prompt_tokens: promptTokens || 10,
        completion_tokens: completionTokens || 10,
        total_tokens: (promptTokens || 10) + (completionTokens || 10)
      }
    };
  }

  async stream(params, onChunk, signal) {
    const { model, messages, id = 'mock-' + Date.now() } = params;
    const content = 'This is a mock response from the unified API.';
    const words = content.split(' ');

    const promptTokens = estimateMessagesTokens(messages);
    const completionTokens = estimateTextTokens(content);

    // Initial role chunk
    onChunk(formatOpenAIChunk(id, model, '', null));

    // Stream words
    for (let i = 0; i < words.length; i++) {
      if (signal && signal.aborted) return;
      const word = (i === 0 ? '' : ' ') + words[i];
      onChunk(formatOpenAIChunk(id, model, word, null));
    }

    // Final finish chunk with usage
    const usage = {
      prompt_tokens: promptTokens || 10,
      completion_tokens: completionTokens || 10,
      total_tokens: (promptTokens || 10) + (completionTokens || 10)
    };
    onChunk(formatOpenAIChunk(id, model, '', 'stop', usage));
  }
}

module.exports = MockProvider;
