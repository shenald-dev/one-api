// Google Gemini Provider Adapter
const BaseProvider = require('./base');
const { formatOpenAIChunk } = require('../engine/sse');

class GeminiProvider extends BaseProvider {
  constructor(config = {}) {
    super('gemini', config);
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  transformMessages(messages) {
    let systemInstruction = null;
    const contents = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        const text = typeof msg.content === 'string'
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.map(p => p.text || '').join('\n')
            : '';
        systemInstruction = { parts: [{ text }] };
      } else {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        let parts = [];

        if (typeof msg.content === 'string') {
          parts.push({ text: msg.content });
        } else if (Array.isArray(msg.content)) {
          for (const item of msg.content) {
            if (typeof item === 'string') {
              parts.push({ text: item });
            } else if (item && item.type === 'text') {
              parts.push({ text: item.text || '' });
            } else if (item && item.type === 'image_url') {
              const url = item.image_url?.url || '';
              const match = url.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
              if (match) {
                parts.push({
                  inlineData: {
                    mimeType: match[1],
                    data: match[2]
                  }
                });
              }
            }
          }
        }

        if (parts.length > 0) {
          contents.push({ role, parts });
        }
      }
    }

    return { systemInstruction, contents };
  }

  cleanModelName(model) {
    // Remove "gemini/" or "google/" prefix if passed
    return model.replace(/^(gemini|google)\//i, '');
  }

  async complete(params) {
    const { model, messages, temperature, max_tokens, top_p } = params;
    const targetModel = this.cleanModelName(model);
    const { systemInstruction, contents } = this.transformMessages(messages);

    const body = {
      contents,
      ...(systemInstruction && { systemInstruction }),
      generationConfig: {
        ...(temperature !== undefined && { temperature }),
        ...(max_tokens !== undefined && { maxOutputTokens: max_tokens }),
        ...(top_p !== undefined && { topP: top_p })
      }
    };

    const url = `${this.baseUrl}/models/${targetModel}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      let errJson;
      try { errJson = JSON.parse(errText); } catch (_) {}
      const msg = errJson?.error?.message || errText || `Gemini API error (${response.status})`;
      const error = new Error(msg);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const textPart = candidate?.content?.parts?.find(p => p.text);
    const content = textPart?.text || '';

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
            content
          },
          finish_reason: candidate?.finishReason === 'STOP' ? 'stop' : (candidate?.finishReason?.toLowerCase() || 'stop')
        }
      ],
      usage: {
        prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
        completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata?.totalTokenCount || 0
      }
    };
  }

  async stream(params, onChunk, signal) {
    const { model, messages, temperature, max_tokens, top_p, id = Date.now() } = params;
    const targetModel = this.cleanModelName(model);
    const { systemInstruction, contents } = this.transformMessages(messages);

    const body = {
      contents,
      ...(systemInstruction && { systemInstruction }),
      generationConfig: {
        ...(temperature !== undefined && { temperature }),
        ...(max_tokens !== undefined && { maxOutputTokens: max_tokens }),
        ...(top_p !== undefined && { topP: top_p })
      }
    };

    const url = `${this.baseUrl}/models/${targetModel}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      const error = new Error(`Gemini stream error: ${errText}`);
      error.status = response.status;
      throw error;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    onChunk(formatOpenAIChunk(id, model, '', null));

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6);

        try {
          const chunkData = JSON.parse(jsonStr);
          const candidate = chunkData.candidates?.[0];
          const text = candidate?.content?.parts?.[0]?.text;

          if (chunkData.usageMetadata) {
            totalPromptTokens = chunkData.usageMetadata.promptTokenCount || totalPromptTokens;
            totalCompletionTokens = chunkData.usageMetadata.candidatesTokenCount || totalCompletionTokens;
          }

          if (text) {
            onChunk(formatOpenAIChunk(id, model, text, null));
          }

          if (candidate?.finishReason) {
            const usage = {
              prompt_tokens: totalPromptTokens,
              completion_tokens: totalCompletionTokens,
              total_tokens: totalPromptTokens + totalCompletionTokens
            };
            onChunk(formatOpenAIChunk(id, model, '', 'stop', usage));
          }
        } catch (_) {}
      }
    }
  }
}

module.exports = GeminiProvider;
