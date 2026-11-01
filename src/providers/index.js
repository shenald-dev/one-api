// Unified Provider Registry and Intelligent Router
const config = require('../config');
const OpenAIProvider = require('./openai');
const AnthropicProvider = require('./anthropic');
const GeminiProvider = require('./gemini');
const OllamaProvider = require('./ollama');
const MockProvider = require('./mock');

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.fallbackProvider = new MockProvider();
    this.initProviders();
  }

  initProviders() {
    // Standard providers
    this.providers.set('openai', new OpenAIProvider('openai', config.providers.openai));
    this.providers.set('anthropic', new AnthropicProvider(config.providers.anthropic));
    this.providers.set('gemini', new GeminiProvider(config.providers.gemini));
    this.providers.set('ollama', new OllamaProvider(config.providers.ollama));
    this.providers.set('deepseek', new OpenAIProvider('deepseek', config.providers.deepseek));
    this.providers.set('groq', new OpenAIProvider('groq', config.providers.groq));
    this.providers.set('mistral', new OpenAIProvider('mistral', config.providers.mistral));
    this.providers.set('together', new OpenAIProvider('together', config.providers.together));
    this.providers.set('mock', this.fallbackProvider);
  }

  resolveProvider(model) {
    if (!model || typeof model !== 'string') {
      return this.fallbackProvider;
    }

    const lower = model.toLowerCase();

    // Anthropic models
    if (lower.startsWith('claude-') || lower.startsWith('anthropic/')) {
      const p = this.providers.get('anthropic');
      return p.isConfigured() ? p : this.fallbackProvider;
    }

    // Google Gemini models
    if (lower.startsWith('gemini-') || lower.startsWith('google/')) {
      const p = this.providers.get('gemini');
      return p.isConfigured() ? p : this.fallbackProvider;
    }

    // Ollama / local models
    if (lower.startsWith('ollama/')) {
      return this.providers.get('ollama');
    }

    // DeepSeek models
    if (lower.startsWith('deepseek') || lower.startsWith('deepseek/')) {
      const p = this.providers.get('deepseek');
      return p.isConfigured() ? p : (this.providers.get('openai').isConfigured() ? this.providers.get('openai') : this.fallbackProvider);
    }

    // Groq models
    if (lower.startsWith('groq/')) {
      const p = this.providers.get('groq');
      return p.isConfigured() ? p : this.fallbackProvider;
    }

    // Mistral models
    if (lower.startsWith('mistral') || lower.startsWith('mistral/')) {
      const p = this.providers.get('mistral');
      return p.isConfigured() ? p : this.fallbackProvider;
    }

    // OpenAI models (gpt-4, gpt-4o, gpt-3.5-turbo, o1, o3, etc.)
    if (lower.startsWith('gpt-') || lower.startsWith('o1') || lower.startsWith('o3') || lower.startsWith('openai/')) {
      const p = this.providers.get('openai');
      return p.isConfigured() ? p : this.fallbackProvider;
    }

    // Fallback: Check if OpenAI is configured as default gateway upstream
    if (this.providers.get('openai').isConfigured()) {
      return this.providers.get('openai');
    }

    // Default to zero-config smart mock
    return this.fallbackProvider;
  }

  getActiveProviders() {
    const active = [];
    for (const [name, provider] of this.providers.entries()) {
      if (name !== 'mock' && provider.isConfigured()) {
        active.push(name);
      }
    }
    return active;
  }

  getUnifiedModelsList() {
    const now = Math.trunc(Date.now() / 1000);
    return [
      // OpenAI
      { id: 'gpt-4o', object: 'model', created: 1715558400, owned_by: 'openai' },
      { id: 'gpt-4o-mini', object: 'model', created: 1721260800, owned_by: 'openai' },
      { id: 'gpt-4-turbo', object: 'model', created: 1712361600, owned_by: 'openai' },
      { id: 'gpt-4', object: 'model', created: 1687882411, owned_by: 'openai' },
      { id: 'gpt-3.5-turbo', object: 'model', created: 1677610602, owned_by: 'openai' },
      { id: 'o1-preview', object: 'model', created: 1726099200, owned_by: 'openai' },
      { id: 'o1-mini', object: 'model', created: 1726099200, owned_by: 'openai' },

      // Anthropic
      { id: 'claude-3-5-sonnet-20241022', object: 'model', created: 1729555200, owned_by: 'anthropic' },
      { id: 'claude-3-5-haiku-20241022', object: 'model', created: 1729555200, owned_by: 'anthropic' },
      { id: 'claude-3-opus-20240229', object: 'model', created: 1709251200, owned_by: 'anthropic' },
      { id: 'claude-3-sonnet-20240229', object: 'model', created: 1709251200, owned_by: 'anthropic' },
      { id: 'claude-3-haiku-20240307', object: 'model', created: 1709769600, owned_by: 'anthropic' },

      // Google Gemini
      { id: 'gemini-1.5-pro', object: 'model', created: 1713139200, owned_by: 'google' },
      { id: 'gemini-1.5-flash', object: 'model', created: 1715644800, owned_by: 'google' },
      { id: 'gemini-2.0-flash-exp', object: 'model', created: 1734048000, owned_by: 'google' },

      // DeepSeek
      { id: 'deepseek-chat', object: 'model', created: 1714521600, owned_by: 'deepseek' },
      { id: 'deepseek-reasoner', object: 'model', created: 1737331200, owned_by: 'deepseek' },

      // Groq
      { id: 'llama-3.3-70b-versatile', object: 'model', created: 1733443200, owned_by: 'groq' },
      { id: 'llama-3.1-8b-instant', object: 'model', created: 1721692800, owned_by: 'groq' },
      { id: 'mixtral-8x7b-32768', object: 'model', created: 1702252800, owned_by: 'groq' },

      // Mistral
      { id: 'mistral-large-latest', object: 'model', created: 1708905600, owned_by: 'mistralai' },
      { id: 'codestral-latest', object: 'model', created: 1716940800, owned_by: 'mistralai' }
    ];
  }
}

module.exports = new ProviderRegistry();
