// Universal Embeddings Provider Engine (OpenAI, Gemini & Deterministic Zero-Config Local)
const crypto = require('crypto');
const config = require('../config');
const { estimateTextTokens } = require('../engine/tokenizer');

class EmbeddingsEngine {
  constructor() {
    this.openaiConfig = config.providers.openai;
    this.geminiConfig = config.providers.gemini;
  }

  /**
   * Deterministic local embedding generator (1536-dim vector normalized to length 1)
   */
  generateLocalEmbedding(text, dimensions = 1536) {
    const vector = new Float32Array(dimensions);
    // Use multi-seed crypto hashing for deterministic pseudo-random vector
    for (let i = 0; i < dimensions; i += 8) {
      const hash = crypto.createHash('sha256').update(`${text}:${i}`).digest();
      for (let j = 0; j < 8 && i + j < dimensions; j++) {
        // Map 4 bytes to float between -1 and 1
        const intVal = hash.readInt32LE(j * 4);
        vector[i + j] = intVal / 2147483648.0;
      }
    }

    // L2 Normalize
    let norm = 0;
    for (let i = 0; i < dimensions; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dimensions; i++) {
      vector[i] = Number((vector[i] / norm).toFixed(6));
    }

    return Array.from(vector);
  }

  async createEmbeddings(params) {
    const { model = 'text-embedding-3-small', input, dimensions } = params;

    // Normalize input to array of strings
    const inputs = Array.isArray(input) ? input : [input];
    let totalTokens = 0;
    for (const item of inputs) {
      totalTokens += estimateTextTokens(typeof item === 'string' ? item : JSON.stringify(item));
    }

    // 1. OpenAI Upstream
    if (this.openaiConfig.apiKey && (model.startsWith('text-embedding-') || model.startsWith('openai/'))) {
      const cleanModel = model.replace(/^openai\//, '');
      const url = `${this.openaiConfig.baseUrl}/embeddings`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.openaiConfig.apiKey}`
          },
          body: JSON.stringify({
            model: cleanModel,
            input: inputs,
            ...(dimensions && { dimensions })
          })
        });

        if (response.ok) {
          return await response.json();
        }
      } catch {
        // Fall through to local fallback
      }
    }

    // 2. Google Gemini Upstream
    if (this.geminiConfig.apiKey && (model.startsWith('models/embedding-') || model.includes('gemini') || model.includes('text-embedding-004'))) {
      const targetModel = model.replace(/^(google|gemini)\//, '') || 'text-embedding-004';
      const url = `${this.geminiConfig.baseUrl}/models/${targetModel}:batchEmbedContents?key=${this.geminiConfig.apiKey}`;

      try {
        const requests = inputs.map((text) => ({
          model: `models/${targetModel}`,
          content: { parts: [{ text }] }
        }));

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests })
        });

        if (response.ok) {
          const data = await response.json();
          const embeddings = (data.embeddings || []).map((e, index) => ({
            object: 'embedding',
            index,
            embedding: e.values
          }));

          return {
            object: 'list',
            data: embeddings,
            model,
            usage: {
              prompt_tokens: totalTokens,
              total_tokens: totalTokens
            }
          };
        }
      } catch {
        // Fall through to local fallback
      }
    }

    // 3. Local Deterministic Fallback
    const dim = dimensions || 1536;
    const data = inputs.map((text, index) => ({
      object: 'embedding',
      index,
      embedding: this.generateLocalEmbedding(String(text), dim)
    }));

    return {
      object: 'list',
      data,
      model,
      usage: {
        prompt_tokens: totalTokens,
        total_tokens: totalTokens
      }
    };
  }
}

module.exports = new EmbeddingsEngine();
