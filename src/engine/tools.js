// Universal Tool & Function Calling Translator across OpenAI, Anthropic, and Google Gemini schemas

/**
 * Checks if request contains valid OpenAI-format tools
 */
function hasTools(tools) {
  return Array.isArray(tools) && tools.length > 0;
}

/**
 * Converts OpenAI tools schema to Anthropic tools format
 */
function toAnthropicTools(tools) {
  if (!hasTools(tools)) return undefined;

  return tools.map((tool) => {
    const fn = tool.function || tool;
    return {
      name: fn.name,
      description: fn.description || '',
      input_schema: fn.parameters || { type: 'object', properties: {} }
    };
  });
}

/**
 * Converts OpenAI tool_choice parameter to Anthropic tool_choice
 */
function toAnthropicToolChoice(toolChoice) {
  if (!toolChoice) return undefined;
  if (toolChoice === 'auto') return { type: 'auto' };
  if (toolChoice === 'any' || toolChoice === 'required') return { type: 'any' };
  if (typeof toolChoice === 'object' && toolChoice.type === 'function' && toolChoice.function?.name) {
    return { type: 'tool', name: toolChoice.function.name };
  }
  return undefined;
}

/**
 * Extracts tool_calls from Anthropic content blocks
 */
function extractAnthropicToolCalls(contentBlocks) {
  if (!Array.isArray(contentBlocks)) return null;

  const toolCalls = [];
  for (const block of contentBlocks) {
    if (block.type === 'tool_use') {
      let argsStr = '';
      try {
        argsStr = typeof block.input === 'string' ? block.input : JSON.stringify(block.input || {});
      } catch {
        argsStr = '{}';
      }

      toolCalls.push({
        id: block.id,
        type: 'function',
        function: {
          name: block.name,
          arguments: argsStr
        }
      });
    }
  }

  return toolCalls.length > 0 ? toolCalls : null;
}

/**
 * Converts OpenAI tools schema to Google Gemini functionDeclarations format
 */
function toGeminiTools(tools) {
  if (!hasTools(tools)) return undefined;

  const declarations = tools.map((tool) => {
    const fn = tool.function || tool;
    const parameters = fn.parameters ? sanitizeJsonSchemaForGemini(fn.parameters) : { type: 'object', properties: {} };

    return {
      name: fn.name,
      description: fn.description || '',
      parameters
    };
  });

  return [{ functionDeclarations: declarations }];
}

/**
 * Removes schema fields that Gemini API rejects (e.g. $schema, additionalProperties)
 */
function sanitizeJsonSchemaForGemini(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const clone = JSON.parse(JSON.stringify(schema));
  delete clone.$schema;
  delete clone.additionalProperties;
  return clone;
}

/**
 * Extracts tool_calls from Gemini candidate parts
 */
function extractGeminiToolCalls(parts) {
  if (!Array.isArray(parts)) return null;

  const toolCalls = [];
  for (const part of parts) {
    if (part.functionCall) {
      let argsStr = '{}';
      try {
        argsStr = JSON.stringify(part.functionCall.args || {});
      } catch {
        argsStr = '{}';
      }

      toolCalls.push({
        id: `call_${Math.random().toString(36).substring(2, 11)}`,
        type: 'function',
        function: {
          name: part.functionCall.name,
          arguments: argsStr
        }
      });
    }
  }

  return toolCalls.length > 0 ? toolCalls : null;
}

module.exports = {
  hasTools,
  toAnthropicTools,
  toAnthropicToolChoice,
  extractAnthropicToolCalls,
  toGeminiTools,
  extractGeminiToolCalls,
  sanitizeJsonSchemaForGemini
};
