// Token Valuation & Financial Cost Accounting

const MODEL_PRICING = {
  // Anthropic
  'claude-3-5-sonnet-20241022': { promptPerMillion: 3.0, completionPerMillion: 15.0 },
  'claude-3-5-haiku-20241022': { promptPerMillion: 0.8, completionPerMillion: 4.0 },
  'claude-3-opus-20240229': { promptPerMillion: 15.0, completionPerMillion: 75.0 },
  'claude-3-sonnet-20240229': { promptPerMillion: 3.0, completionPerMillion: 15.0 },
  'claude-3-haiku-20240307': { promptPerMillion: 0.25, completionPerMillion: 1.25 },

  // OpenAI
  'gpt-4o': { promptPerMillion: 2.5, completionPerMillion: 10.0 },
  'gpt-4o-mini': { promptPerMillion: 0.15, completionPerMillion: 0.6 },
  'gpt-4-turbo': { promptPerMillion: 10.0, completionPerMillion: 30.0 },
  'gpt-4': { promptPerMillion: 30.0, completionPerMillion: 60.0 },
  'gpt-3.5-turbo': { promptPerMillion: 0.5, completionPerMillion: 1.5 },
  'o1-preview': { promptPerMillion: 15.0, completionPerMillion: 60.0 },
  'o1-mini': { promptPerMillion: 3.0, completionPerMillion: 12.0 },

  // Google
  'gemini-1.5-pro': { promptPerMillion: 3.5, completionPerMillion: 10.5 },
  'gemini-1.5-flash': { promptPerMillion: 0.075, completionPerMillion: 0.3 },
  'gemini-2.0-flash-exp': { promptPerMillion: 0.1, completionPerMillion: 0.4 },

  // DeepSeek
  'deepseek-chat': { promptPerMillion: 0.14, completionPerMillion: 0.28 },
  'deepseek-reasoner': { promptPerMillion: 0.55, completionPerMillion: 2.19 },

  // Groq
  'llama-3.3-70b-versatile': { promptPerMillion: 0.59, completionPerMillion: 0.79 },
  'llama-3.1-8b-instant': { promptPerMillion: 0.05, completionPerMillion: 0.08 },

  // Default fallback
  'default': { promptPerMillion: 1.5, completionPerMillion: 4.5 }
};

function getModelPricing(modelName) {
  if (!modelName || typeof modelName !== 'string') return MODEL_PRICING.default;
  const lower = modelName.toLowerCase();

  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (lower === key || lower.includes(key)) {
      return pricing;
    }
  }

  return MODEL_PRICING.default;
}

function calculateCost(model, promptTokens = 0, completionTokens = 0) {
  const pricing = getModelPricing(model);
  const promptCost = (promptTokens / 1_000_000) * pricing.promptPerMillion;
  const completionCost = (completionTokens / 1_000_000) * pricing.completionPerMillion;
  const totalCost = promptCost + completionCost;

  return {
    promptCost: Number(promptCost.toFixed(6)),
    completionCost: Number(completionCost.toFixed(6)),
    totalCost: Number(totalCost.toFixed(6)),
    formattedCost: formatCost(totalCost)
  };
}

function formatCost(amount) {
  if (amount === 0) return '$0.00';
  if (amount < 0.001) return `$${amount.toFixed(5)}`;
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(3)}`;
}

module.exports = {
  MODEL_PRICING,
  getModelPricing,
  calculateCost,
  formatCost
};
