// In-Memory LRU Cache with TTL support for completion responses
const crypto = require('crypto');

class ResponseCache {
  constructor(options = {}) {
    this.maxEntries = options.maxEntries || 1000;
    this.defaultTTL = (options.ttlSeconds || 300) * 1000;
    this.map = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  generateKey(model, messages, options = {}) {
    const payload = JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 1,
      max_tokens: options.max_tokens ?? null,
      top_p: options.top_p ?? 1
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      this.stats.misses++;
      return null;
    }

    // Refresh LRU position
    this.map.delete(key);
    this.map.set(key, entry);
    this.stats.hits++;
    return entry.value;
  }

  set(key, value, ttlMs) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
      this.stats.evictions++;
    }

    const expiresAt = Date.now() + (ttlMs || this.defaultTTL);
    this.map.set(key, { value, expiresAt });
  }

  clear() {
    this.map.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    return {
      size: this.map.size,
      maxEntries: this.maxEntries,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: parseFloat(hitRate.toFixed(2)),
      evictions: this.stats.evictions
    };
  }
}

module.exports = ResponseCache;
