// Advanced Tiered Hybrid Cache: Canonical Exact Match + N-gram Semantic Similarity
const crypto = require('crypto');

function extractShingles(text) {
  if (!text || typeof text !== 'string') return new Set();
  // Normalize accents and support international Unicode characters (Latin, CJK, Cyrillic, Arabic, etc.)
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const shingles = new Set();
  if (!normalized) return shingles;

  // Word unigrams
  const words = normalized.split(' ');
  for (const w of words) {
    if (w.length > 0) shingles.add(`w:${w}`);
  }

  // Character 2-grams and 3-grams with full Unicode code point support
  const chars = Array.from(normalized);
  for (let i = 0; i <= chars.length - 2; i++) {
    shingles.add(`c2:${chars[i]}${chars[i + 1]}`);
  }
  for (let i = 0; i <= chars.length - 3; i++) {
    shingles.add(`c3:${chars[i]}${chars[i + 1]}${chars[i + 2]}`);
  }

  return shingles;
}

function calculateJaccardSimilarity(shinglesA, shinglesB) {
  if (!shinglesA || !shinglesB || shinglesA.size === 0 || shinglesB.size === 0) return 0;
  let intersection = 0;
  for (const s of shinglesA) {
    if (shinglesB.has(s)) {
      intersection++;
    }
  }
  const union = shinglesA.size + shinglesB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

class ResponseCache {
  constructor(options = {}) {
    this.maxEntries = options.maxEntries || 1000;
    this.defaultTTL = (options.ttlSeconds || 300) * 1000;
    this.semanticEnabled = options.semanticEnabled ?? (process.env.SEMANTIC_CACHE_ENABLED !== 'false');
    this.semanticThreshold = options.semanticThreshold ?? parseFloat(process.env.SEMANTIC_CACHE_THRESHOLD || '0.80');

    this.map = new Map();
    this.semanticEntries = []; // Circular array of { key, model, shingles, expiresAt }
    this.stats = {
      hits: 0,
      misses: 0,
      exactHits: 0,
      semanticHits: 0,
      evictions: 0
    };
  }

  generateKey(model, messages, options = {}) {
    const canonicalMessages = Array.isArray(messages)
      ? messages.map((m) => ({
          role: String(m.role || '').toLowerCase().trim(),
          content: typeof m.content === 'string' ? m.content.trim() : m.content
        }))
      : messages;

    const payload = JSON.stringify({
      model,
      messages: canonicalMessages,
      temperature: options.temperature ?? 1,
      max_tokens: options.max_tokens ?? null,
      top_p: options.top_p ?? 1,
      tools: options.tools || null
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  extractPromptText(messages) {
    if (!Array.isArray(messages)) return '';
    return messages
      .filter((m) => m && m.role === 'user' && typeof m.content === 'string')
      .map((m) => m.content)
      .join(' ');
  }

  get(key) {
    const result = this.getWithMeta(key);
    return result ? result.value : null;
  }

  getWithMeta(key, promptText = '', options = {}) {
    // 1. Tier 1: Canonical Exact Match
    const entry = this.map.get(key);
    if (entry) {
      if (Date.now() > entry.expiresAt) {
        this.map.delete(key);
        this.stats.misses++;
        return null;
      }

      // Refresh LRU position
      this.map.delete(key);
      this.map.set(key, entry);
      this.stats.hits++;
      this.stats.exactHits++;
      return {
        value: entry.value,
        type: 'EXACT',
        similarity: 1.0
      };
    }

    // 2. Tier 2: Semantic Similarity Match
    if (this.semanticEnabled && promptText && (options.temperature === 0 || options.allowSemanticCache)) {
      const model = options.model;
      const queryShingles = extractShingles(promptText);
      const now = Date.now();

      let bestMatch = null;
      let highestSimilarity = 0;
      let bestCached = null;

      for (let i = this.semanticEntries.length - 1; i >= 0; i--) {
        const item = this.semanticEntries[i];
        if (now > item.expiresAt) {
          this.semanticEntries.splice(i, 1);
          continue;
        }

        // Validate that the entry is still alive in the map (prevent shadow eviction false-misses)
        const cached = this.map.get(item.key);
        if (!cached || now > cached.expiresAt) {
          this.semanticEntries.splice(i, 1);
          continue;
        }

        if (model && item.model !== model) continue;

        const sim = calculateJaccardSimilarity(queryShingles, item.shingles);
        if (sim >= this.semanticThreshold && sim > highestSimilarity) {
          highestSimilarity = sim;
          bestMatch = item;
          bestCached = cached;
        }
      }

      if (bestMatch && bestCached) {
        this.stats.hits++;
        this.stats.semanticHits++;
        return {
          value: bestCached.value,
          type: 'SEMANTIC',
          similarity: parseFloat(highestSimilarity.toFixed(4))
        };
      }
    }

    this.stats.misses++;
    return null;
  }

  set(key, value, ttlMs, promptText = '', model = null) {
    if (this.map.has(key)) {
      this.map.delete(key);
      // Clean up previous semantic entry for this key to prevent duplicate indexing
      for (let i = this.semanticEntries.length - 1; i >= 0; i--) {
        if (this.semanticEntries[i].key === key) {
          this.semanticEntries.splice(i, 1);
        }
      }
    } else if (this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
      this.stats.evictions++;
      // Clean up evicted key from semantic entries
      for (let i = this.semanticEntries.length - 1; i >= 0; i--) {
        if (this.semanticEntries[i].key === oldestKey) {
          this.semanticEntries.splice(i, 1);
        }
      }
    }

    const expiresAt = Date.now() + (ttlMs || this.defaultTTL);
    this.map.set(key, { value, expiresAt });

    // Index into semantic entries if prompt text provided
    if (this.semanticEnabled && promptText && typeof promptText === 'string') {
      const shingles = extractShingles(promptText);
      if (shingles.size > 0) {
        this.semanticEntries.push({ key, model, shingles, expiresAt });
        if (this.semanticEntries.length > this.maxEntries) {
          this.semanticEntries.shift();
        }
      }
    }
  }

  clear() {
    this.map.clear();
    this.semanticEntries = [];
    this.stats = {
      hits: 0,
      misses: 0,
      exactHits: 0,
      semanticHits: 0,
      evictions: 0
    };
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    return {
      size: this.map.size,
      maxEntries: this.maxEntries,
      hits: this.stats.hits,
      misses: this.stats.misses,
      exactHits: this.stats.exactHits,
      semanticHits: this.stats.semanticHits,
      semanticEnabled: this.semanticEnabled,
      hitRate: parseFloat(hitRate.toFixed(2)),
      evictions: this.stats.evictions
    };
  }
}

module.exports = ResponseCache;
