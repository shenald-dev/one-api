// Multi-Key Round-Robin & Load Balancing with Automatic Cooldown

class KeyPool {
  constructor(keysInput = '', cooldownMs = 60000) {
    this.cooldownMs = cooldownMs;
    this.currentIndex = 0;
    this.keys = [];

    this.setKeys(keysInput);
  }

  setKeys(keysInput) {
    let rawKeys = [];
    if (Array.isArray(keysInput)) {
      rawKeys = keysInput;
    } else if (typeof keysInput === 'string') {
      rawKeys = keysInput.split(',').map((k) => k.trim()).filter(Boolean);
    }

    this.keys = rawKeys.map((key) => ({
      key,
      cooldownUntil: 0,
      failureCount: 0,
      successCount: 0
    }));
    this.currentIndex = 0;
  }

  hasKeys() {
    return this.keys.length > 0;
  }

  getKeyCount() {
    const now = Date.now();
    const healthyCount = this.keys.filter((k) => k.cooldownUntil <= now).length;
    return {
      total: this.keys.length,
      healthy: healthyCount,
      inCooldown: this.keys.length - healthyCount
    };
  }

  getNextKey() {
    if (this.keys.length === 0) return '';
    if (this.keys.length === 1) return this.keys[0].key;

    const now = Date.now();
    const len = this.keys.length;

    // First attempt: Find next key that is not in cooldown
    for (let i = 0; i < len; i++) {
      const idx = (this.currentIndex + i) % len;
      const candidate = this.keys[idx];
      if (candidate.cooldownUntil <= now) {
        this.currentIndex = (idx + 1) % len;
        return candidate.key;
      }
    }

    // Fallback if all keys are in cooldown: pick the one expiring soonest
    let bestKey = this.keys[0];
    let minCooldown = bestKey.cooldownUntil;
    for (let i = 1; i < len; i++) {
      if (this.keys[i].cooldownUntil < minCooldown) {
        minCooldown = this.keys[i].cooldownUntil;
        bestKey = this.keys[i];
      }
    }

    return bestKey.key;
  }

  recordFailure(keyString, status = 500) {
    const entry = this.keys.find((k) => k.key === keyString);
    if (!entry) return;

    entry.failureCount++;
    // Place into cooldown on 429 (Rate Limit) or 401 (Quota/Auth)
    if (status === 429 || status === 401 || status === 403) {
      entry.cooldownUntil = Date.now() + this.cooldownMs;
    }
  }

  recordSuccess(keyString) {
    const entry = this.keys.find((k) => k.key === keyString);
    if (!entry) return;

    entry.successCount++;
    entry.failureCount = 0;
    entry.cooldownUntil = 0;
  }
}

module.exports = KeyPool;
