// Built-in Zero-Config Local / Fallback Provider
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
    const { model, messages, id = 'mock-' + Date.now() } = params;
    const content = 'This is a mock response from the unified API.';
    const promptTokens = estimateMessagesTokens(messages);
    const completionTokens = estimateTextTokens(content);

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
            content
          },
          finish_reason: 'stop'
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
