// Fast heuristic tokenizer for prompt messages and text completions
// Based on ~4 characters per token average in English & code with whitespace/punctuation weighting

function estimateTextTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  if (text.length === 0) return 0;
  // Estimate based on whitespace, word boundaries, and punctuation
  const words = text.trim().split(/\s+/).length;
  const chars = text.length;
  // Character and word blending
  const estimated = Math.ceil(Math.max(words * 1.3, chars / 3.8));
  return Math.max(1, estimated);
}

function estimateMessageTokens(message) {
  if (!message) return 0;
  let count = 4; // overhead per message (role, markers)
  if (typeof message.content === 'string') {
    count += estimateTextTokens(message.content);
  } else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (typeof part === 'string') {
        count += estimateTextTokens(part);
      } else if (part && typeof part === 'object') {
        if (typeof part.text === 'string') {
          count += estimateTextTokens(part.text);
        } else if (part.type === 'image_url') {
          count += 85; // baseline image token cost
        }
      }
    }
  }
  if (message.name) {
    count += estimateTextTokens(message.name) + 1;
  }
  return count;
}

function estimateMessagesTokens(messages) {
  if (!Array.isArray(messages)) return 0;
  let total = 3; // prime with 3 tokens for assistant response primer
  for (let i = 0; i < messages.length; i++) {
    total += estimateMessageTokens(messages[i]);
  }
  return total;
}

module.exports = {
  estimateTextTokens,
  estimateMessageTokens,
  estimateMessagesTokens
};
