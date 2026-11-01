// Ollama / Local Model Adapter
const BaseProvider = require('./base');
const { formatOpenAIChunk } = require('../engine/sse');

class OllamaProvider extends BaseProvider {
  constructor(config = {}) {
    super('ollama', config);
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
  }

  isConfigured() {
    return true; // Local inference doesn't require cloud API keys
  }

  cleanModelName(model) {
    return model.replace(/^ollama\//i, '');
  }

  async complete(params) {
    const { model, messages, temperature } = params;
    const targetModel = this.cleanModelName(model);

    const body = {
      model: targetModel,
      messages: messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      })),
      stream: false,
      options: {
        ...(temperature !== undefined && { temperature })
      }
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      const error = new Error(`Ollama error (${response.status}): ${errText}`);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.trunc(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: data.message?.content || ''
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: data.prompt_eval_count || 10,
        completion_tokens: data.eval_count || 10,
        total_tokens: (data.prompt_eval_count || 10) + (data.eval_count || 10)
      }
    };
  }

  async stream(params, onChunk, signal) {
    const { model, messages, temperature, id = Date.now() } = params;
    const targetModel = this.cleanModelName(model);

    const body = {
      model: targetModel,
      messages: messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      })),
      stream: true,
      options: {
        ...(temperature !== undefined && { temperature })
      }
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      const error = new Error(`Ollama stream error: ${errText}`);
      error.status = response.status;
      throw error;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    onChunk(formatOpenAIChunk(id, model, '', null));

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const event = JSON.parse(trimmed);
          if (event.message?.content) {
            onChunk(formatOpenAIChunk(id, model, event.message.content, null));
          }
          if (event.done) {
            const usage = {
              prompt_tokens: event.prompt_eval_count || 10,
              completion_tokens: event.eval_count || 10,
              total_tokens: (event.prompt_eval_count || 10) + (event.eval_count || 10)
            };
            onChunk(formatOpenAIChunk(id, model, '', 'stop', usage));
          }
        } catch (_) {}
      }
    }
  }
}

module.exports = OllamaProvider;
