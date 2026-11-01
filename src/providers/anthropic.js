// Anthropic Claude Provider Adapter
const BaseProvider = require('./base');
const { formatOpenAIChunk } = require('../engine/sse');

class AnthropicProvider extends BaseProvider {
  constructor(config = {}) {
    super('anthropic', config);
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
    this.apiVersion = config.apiVersion || '2023-06-01';
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  transformMessages(messages) {
    let systemPrompt = '';
    const anthropicMessages = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        const text = typeof msg.content === 'string'
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.map(p => p.text || '').join('\n')
            : '';
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${text}` : text;
      } else {
        const role = msg.role === 'assistant' ? 'assistant' : 'user';
        let content = msg.content;

        if (Array.isArray(content)) {
          content = content.map(part => {
            if (typeof part === 'string') return { type: 'text', text: part };
            if (part.type === 'text') return { type: 'text', text: part.text || '' };
            if (part.type === 'image_url') {
              const url = part.image_url?.url || '';
              const match = url.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
              if (match) {
                return {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: match[1],
                    data: match[2]
                  }
                };
              }
            }
            return { type: 'text', text: JSON.stringify(part) };
          });
        }

        // Anthropic requires strictly alternating user/assistant roles.
        // Merge consecutive messages with the same role.
        if (anthropicMessages.length > 0 && anthropicMessages[anthropicMessages.length - 1].role === role) {
          const prev = anthropicMessages[anthropicMessages.length - 1];
          if (typeof prev.content === 'string' && typeof content === 'string') {
            prev.content += '\n\n' + content;
          } else {
            const prevParts = Array.isArray(prev.content) ? prev.content : [{ type: 'text', text: prev.content }];
            const currParts = Array.isArray(content) ? content : [{ type: 'text', text: content }];
            prev.content = [...prevParts, ...currParts];
          }
        } else {
          anthropicMessages.push({ role, content });
        }
      }
    }

    return { systemPrompt, anthropicMessages };
  }

  mapStopReason(reason) {
    switch (reason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
      default:
        return 'stop';
    }
  }

  async complete(params) {
    const { model, messages, temperature, max_tokens } = params;
    const { systemPrompt, anthropicMessages } = this.transformMessages(messages);

    const body = {
      model,
      messages: anthropicMessages,
      max_tokens: max_tokens || 4096,
      ...(systemPrompt && { system: systemPrompt }),
      ...(temperature !== undefined && { temperature })
    };

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      let errJson;
      try { errJson = JSON.parse(errText); } catch (_) {}
      const msg = errJson?.error?.message || errText || `Anthropic API error (${response.status})`;
      const error = new Error(msg);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';
    const finishReason = this.mapStopReason(data.stop_reason);

    return {
      id: `chatcmpl-${data.id || Date.now()}`,
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
          finish_reason: finishReason
        }
      ],
      usage: {
        prompt_tokens: data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.output_tokens || 0,
        total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      }
    };
  }

  async stream(params, onChunk, signal) {
    const { model, messages, temperature, max_tokens, id = Date.now() } = params;
    const { systemPrompt, anthropicMessages } = this.transformMessages(messages);

    const body = {
      model,
      messages: anthropicMessages,
      max_tokens: max_tokens || 4096,
      stream: true,
      ...(systemPrompt && { system: systemPrompt }),
      ...(temperature !== undefined && { temperature })
    };

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion
      },
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      const error = new Error(`Anthropic stream error: ${errText}`);
      error.status = response.status;
      throw error;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let promptTokens = 0;
    let completionTokens = 0;

    // Send initial role chunk
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
        if (jsonStr === '[DONE]') continue;

        try {
          const event = JSON.parse(jsonStr);
          if (event.type === 'message_start' && event.message?.usage) {
            promptTokens = event.message.usage.input_tokens || 0;
          } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            onChunk(formatOpenAIChunk(id, model, event.delta.text, null));
          } else if (event.type === 'message_delta') {
            if (event.usage) {
              completionTokens = event.usage.output_tokens || 0;
            }
            const finishReason = this.mapStopReason(event.delta?.stop_reason);
            const usage = {
              prompt_tokens: promptTokens,
              completion_tokens: completionTokens,
              total_tokens: promptTokens + completionTokens
            };
            onChunk(formatOpenAIChunk(id, model, '', finishReason, usage));
          }
        } catch (_) {}
      }
    }
  }
}

module.exports = AnthropicProvider;
