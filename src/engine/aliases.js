// Virtual Models and Semantic Model Aliasing Engine

class ModelAliasRegistry {
  constructor(initialAliases = {}) {
    this.aliases = new Map();

    // Default built-in virtual aliases
    const defaults = {
      'fast': { target: 'gpt-4o-mini', description: 'Ultra-low latency, cost-effective model' },
      'smart': { target: 'claude-3-5-sonnet-20241022', description: 'Highest intelligence & complex reasoning' },
      'reasoning': { target: 'deepseek-reasoner', description: 'Specialized deep multi-step thinking' },
      'code': { target: 'claude-3-5-sonnet-20241022', description: 'Optimized for software development & code generation' },
      'vision': { target: 'gpt-4o', description: 'High-fidelity multimodal vision & document understanding' }
    };

    for (const [k, v] of Object.entries(defaults)) {
      this.aliases.set(k.toLowerCase(), v);
    }

    if (initialAliases && typeof initialAliases === 'object') {
      for (const [k, v] of Object.entries(initialAliases)) {
        const target = typeof v === 'string' ? v : v.target;
        const description = typeof v === 'object' ? v.description : `Alias for ${target}`;
        this.aliases.set(k.toLowerCase(), { target, description });
      }
    }
  }

  resolve(modelName) {
    if (!modelName || typeof modelName !== 'string') return modelName;
    const lower = modelName.trim().toLowerCase();
    const entry = this.aliases.get(lower);
    if (entry) {
      return entry.target;
    }
    return modelName;
  }

  isAlias(modelName) {
    if (!modelName || typeof modelName !== 'string') return false;
    return this.aliases.has(modelName.trim().toLowerCase());
  }

  register(alias, target, description = '') {
    this.aliases.set(alias.toLowerCase(), {
      target,
      description: description || `Alias for ${target}`
    });
  }

  getAll() {
    const result = [];
    for (const [alias, data] of this.aliases.entries()) {
      result.push({
        id: alias,
        object: 'model',
        created: 1735689600,
        owned_by: 'one-api:alias',
        target_model: data.target,
        description: data.description,
        is_alias: true
      });
    }
    return result;
  }
}

// Load from environment if provided
let envAliases = {};
try {
  if (process.env.MODEL_ALIASES) {
    envAliases = JSON.parse(process.env.MODEL_ALIASES);
  }
} catch {
  // Ignore invalid JSON in env
}

module.exports = new ModelAliasRegistry(envAliases);
