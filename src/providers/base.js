// Base Provider Interface

class BaseProvider {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
  }

  isConfigured() {
    return true;
  }

  /**
   * Execute non-streaming completion.
   * @param {Object} params - { model, messages, temperature, max_tokens, etc. }
   * @returns {Promise<Object>} Standard OpenAI chat completion object
   */
  async complete(params) {
    throw new Error(`complete() not implemented by ${this.name}`);
  }

  /**
   * Execute streaming completion via SSE.
   * @param {Object} params - { model, messages, etc. }
   * @param {Function} onChunk - callback(chunkString)
   * @param {AbortSignal} signal - abort signal from client disconnect
   * @returns {Promise<void>}
   */
  async stream(params, onChunk, signal) {
    throw new Error(`stream() not implemented by ${this.name}`);
  }
}

module.exports = BaseProvider;
