// In-Memory Sliding Window Rate Limiter

class RateLimiter {
  constructor(requestsPerMinute = 0) {
    this.rpm = requestsPerMinute;
    this.windowMs = 60 * 1000;
    this.clients = new Map();
  }

  isRateLimited(clientId) {
    if (this.rpm <= 0) return false;

    const now = Date.now();
    let timestamps = this.clients.get(clientId);

    if (!timestamps) {
      timestamps = [];
      this.clients.set(clientId, timestamps);
    }

    const windowStart = now - this.windowMs;
    let startIndex = 0;
    while (startIndex < timestamps.length && timestamps[startIndex] <= windowStart) {
      startIndex++;
    }
    if (startIndex > 0) {
      timestamps.splice(0, startIndex);
    }

    if (timestamps.length >= this.rpm) {
      return true;
    }

    timestamps.push(now);
    return false;
  }

  getRemaining(clientId) {
    if (this.rpm <= 0) return Infinity;
    const timestamps = this.clients.get(clientId);
    if (!timestamps) return this.rpm;

    const windowStart = Date.now() - this.windowMs;
    let validCount = 0;
    for (let i = timestamps.length - 1; i >= 0; i--) {
      if (timestamps[i] > windowStart) validCount++;
      else break;
    }

    return Math.max(0, this.rpm - validCount);
  }

  reset() {
    this.clients.clear();
  }
}

module.exports = RateLimiter;
