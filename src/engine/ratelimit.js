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

    // Filter out timestamps outside the rolling 60-second window
    const windowStart = now - this.windowMs;
    const validTimestamps = timestamps.filter(t => t > windowStart);

    if (validTimestamps.length >= this.rpm) {
      this.clients.set(clientId, validTimestamps);
      return true;
    }

    validTimestamps.push(now);
    this.clients.set(clientId, validTimestamps);
    return false;
  }

  getRemaining(clientId) {
    if (this.rpm <= 0) return Infinity;
    const now = Date.now();
    const timestamps = (this.clients.get(clientId) || []).filter(t => t > now - this.windowMs);
    return Math.max(0, this.rpm - timestamps.length);
  }

  reset() {
    this.clients.clear();
  }
}

module.exports = RateLimiter;
