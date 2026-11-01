// OpenAI and OpenAI-Compatible Provider Adapter (OpenAI, DeepSeek, Groq, Mistral, Together)
const BaseProvider = require('./base');

class OpenAIProvider extends BaseProvider {
  constructor(name = 'openai', config = {}) {
    super(name, config);
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async complete(params) {
    const { model, messages, temperature, max_tokens, top_p, stream, ...rest } = params;
    const url = `${this.baseUrl}/chat/completions`;

    const body = {
      model,
      messages,
      ...(temperature !== undefined && { temperature }),
      ...(max_tokens !== undefined && { max_tokens }),
      ...(top_p !== undefined && { top_p }),
      ...rest
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      let errJson;
      try { errJson = JSON.parse(errText); } catch (_) {}
      const msg = errJson?.error?.message || errText || `Upstream ${this.name} error (${response.status})`;
      const error = new Error(msg);
      error.status = response.status;
      throw error;
    }

    return await response.json();
  }

  async stream(params, onChunk, signal) {
    const { model, messages, temperature, max_tokens, top_p, ...rest } = params;
    const url = `${this.baseUrl}/chat/completions`;

    const body = {
      model,
      messages,
      stream: true,
      ...(temperature !== undefined && { temperature }),
      ...(max_tokens !== undefined && { max_tokens }),
      ...(top_p !== undefined && { top_p }),
      ...rest
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      const error = new Error(`Upstream ${this.name} stream error: ${errText}`);
      error.status = response.status;
      throw error;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep last incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('data: ')) {
          if (trimmed === 'data: [DONE]') {
            return;
          }
          onChunk(`${trimmed}\n\n`);
        }
      }
    }
  }
}

module.exports = OpenAIProvider;
