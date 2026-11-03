// Anthropic Claude Provider Adapter (Multi-Key Pooling & Full Tool Calling Translation)
const BaseProvider = require('./base');
const KeyPool = require('../engine/key-pool');
const { formatOpenAIChunk } = require('../engine/sse');
const {
  hasTools,
  toAnthropicTools,
  toAnthropicToolChoice,
  extractAnthropicToolCalls
} = require('../engine/tools');

class AnthropicProvider extends BaseProvider {
  constructor(config = {}) {
    super('anthropic', config);
    this.keyPool = new KeyPool(config.apiKey || '');
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
    this.apiVersion = config.apiVersion || '2023-06-01';
  }

  isConfigured() {
    return this.keyPool.hasKeys();
  }

  transformMessages(messages) {
    let systemPrompt = '';
    const anthropicMessages = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        const text = typeof msg.content === 'string'
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.map((p) => p.text || '').join('\n')
            : '';
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${text}` : text;
      } else if (msg.role === 'tool') {
        // Translate tool result to Anthropic user tool_result block
        const toolResultBlock = {
          type: 'tool_result',
          tool_use_id: msg.tool_call_id || 'unknown_tool_id',
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '')
        };

        if (anthropicMessages.length > 0 && anthropicMessages[anthropicMessages.length - 1].role === 'user') {
          const prev = anthropicMessages[anthropicMessages.length - 1];
          if (Array.isArray(prev.content)) {
            prev.content.push(toolResultBlock);
          } else {
            prev.content = [{ type: 'text', text: prev.content }, toolResultBlock];
          }
        } else {
          anthropicMessages.push({
            role: 'user',
            content: [toolResultBlock]
          });
        }
      } else {
        const role = msg.role === 'assistant' ? 'assistant' : 'user';
        let content = msg.content;

        // If assistant has tool_calls, construct tool_use blocks
        if (role === 'assistant' && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
          const blocks = [];
          if (content) {
            blocks.push({ type: 'text', text: typeof content === 'string' ? content : JSON.stringify(content) });
          }
          for (const tc of msg.tool_calls) {
            let parsedArgs = {};
            try {
              parsedArgs = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
            } catch {
              parsedArgs = {};
            }
            blocks.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.function.name,
              input: parsedArgs
            });
          }
          content = blocks;
        } else if (Array.isArray(content)) {
          content = content.map((part) => {
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
    const { model, messages, temperature, max_tokens, tools, tool_choice } = params;
    const { systemPrompt, anthropicMessages } = this.transformMessages(messages);

    const body = {
      model,
      messages: anthropicMessages,
      max_tokens: max_tokens || 4096,
      ...(systemPrompt && { system: systemPrompt }),
      ...(temperature !== undefined && { temperature })
    };

    if (hasTools(tools)) {
      body.tools = toAnthropicTools(tools);
      const choice = toAnthropicToolChoice(tool_choice);
      if (choice) body.tool_choice = choice;
    }

    const apiKey = this.keyPool.getNextKey();
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': this.apiVersion
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      this.keyPool.recordFailure(apiKey, response.status);
      const errText = await response.text();
      let errJson;
      try { errJson = JSON.parse(errText); } catch (_) {}
      const msg = errJson?.error?.message || errText || `Anthropic API error (${response.status})`;
      const error = new Error(msg);
      error.status = response.status;
      throw error;
    }

    this.keyPool.recordSuccess(apiKey);
    const data = await response.json();

    // Check for text content and tool calls
    let textContent = '';
    const textPart = data.content?.find((p) => p.type === 'text');
    if (textPart) {
      textContent = textPart.text || '';
    }

    const toolCalls = extractAnthropicToolCalls(data.content);
    const finishReason = toolCalls ? 'tool_calls' : this.mapStopReason(data.stop_reason);

    const message = {
      role: 'assistant',
      content: textContent || (toolCalls ? null : '')
    };

    if (toolCalls) {
      message.tool_calls = toolCalls;
    }

    return {
      id: `chatcmpl-${data.id || Date.now()}`,
      object: 'chat.completion',
      created: Math.trunc(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message,
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
    const { model, messages, temperature, max_tokens, tools, tool_choice, id = Date.now() } = params;
    const { systemPrompt, anthropicMessages } = this.transformMessages(messages);

    const body = {
      model,
      messages: anthropicMessages,
      max_tokens: max_tokens || 4096,
      stream: true,
      ...(systemPrompt && { system: systemPrompt }),
      ...(temperature !== undefined && { temperature })
    };

    if (hasTools(tools)) {
      body.tools = toAnthropicTools(tools);
      const choice = toAnthropicToolChoice(tool_choice);
      if (choice) body.tool_choice = choice;
    }

    const apiKey = this.keyPool.getNextKey();
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': this.apiVersion
      },
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      this.keyPool.recordFailure(apiKey, response.status);
      const errText = await response.text();
      const error = new Error(`Anthropic stream error: ${errText}`);
      error.status = response.status;
      throw error;
    }

    this.keyPool.recordSuccess(apiKey);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let currentToolCall = null;

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
          } else if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
            currentToolCall = {
              id: event.content_block.id,
              name: event.content_block.name
            };
          } else if (event.type === 'content_block_delta') {
            if (event.delta?.type === 'text_delta') {
              onChunk(formatOpenAIChunk(id, model, event.delta.text, null));
            } else if (event.delta?.type === 'input_json_delta' && currentToolCall) {
              const toolChunk = {
                id: `chatcmpl-${id}`,
                object: 'chat.completion.chunk',
                created: Math.trunc(Date.now() / 1000),
                model,
                choices: [
                  {
                    index: 0,
                    delta: {
                      tool_calls: [
                        {
                          index: 0,
                          id: currentToolCall.id,
                          type: 'function',
                          function: {
                            name: currentToolCall.name,
                            arguments: event.delta.partial_json || ''
                          }
                        }
                      ]
                    },
                    finish_reason: null
                  }
                ]
              };
              onChunk(`data: ${JSON.stringify(toolChunk)}\n\n`);
            }
          } else if (event.type === 'message_delta') {
            if (event.usage) {
              completionTokens = event.usage.output_tokens || 0;
            }
            const finishReason = currentToolCall ? 'tool_calls' : this.mapStopReason(event.delta?.stop_reason);
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
