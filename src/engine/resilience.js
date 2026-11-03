// Resilience Engine: Circuit Breakers, Intelligent Fallbacks & Exponential Backoff Retries

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000;
    this.circuits = new Map();
  }

  getCircuit(providerName) {
    let circuit = this.circuits.get(providerName);
    if (!circuit) {
      circuit = {
        state: 'CLOSED', // 'CLOSED' | 'OPEN' | 'HALF_OPEN'
        failures: 0,
        lastFailureTime: 0,
        successCount: 0
      };
      this.circuits.set(providerName, circuit);
    }
    return circuit;
  }

  isOpen(providerName) {
    const circuit = this.getCircuit(providerName);
    if (circuit.state === 'OPEN') {
      const elapsed = Date.now() - circuit.lastFailureTime;
      if (elapsed > this.resetTimeoutMs) {
        circuit.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(providerName) {
    const circuit = this.getCircuit(providerName);
    if (circuit.state === 'HALF_OPEN') {
      circuit.successCount++;
      if (circuit.successCount >= 2) {
        circuit.state = 'CLOSED';
        circuit.failures = 0;
        circuit.successCount = 0;
      }
    } else {
      circuit.failures = 0;
      circuit.state = 'CLOSED';
    }
  }

  recordFailure(providerName, error) {
    const circuit = this.getCircuit(providerName);
    const status = error.status || error.statusCode || 500;

    // Only trip on server errors (5xx) or network timeouts, not client 4xx (except 429)
    const isServerOrNetwork = status >= 500 || status === 429 || error.code === 'ECONNRESET' || error.name === 'AbortError';
    if (!isServerOrNetwork) return;

    circuit.failures++;
    circuit.lastFailureTime = Date.now();

    if (circuit.failures >= this.failureThreshold) {
      circuit.state = 'OPEN';
    }
  }

  getStatus() {
    const status = {};
    for (const [provider, c] of this.circuits.entries()) {
      status[provider] = {
        state: c.state,
        failures: c.failures,
        lastFailure: c.lastFailureTime ? new Date(c.lastFailureTime).toISOString() : null
      };
    }
    return status;
  }

  reset(providerName) {
    if (providerName) {
      this.circuits.delete(providerName);
    } else {
      this.circuits.clear();
    }
  }
}

/**
 * Exponential backoff with full jitter
 */
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryWithBackoff(fn, options = {}) {
  const maxRetries = options.maxRetries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 200;
  const maxDelayMs = options.maxDelayMs ?? 2000;
  const retryableStatuses = new Set(options.retryableStatuses || [429, 500, 502, 503, 504]);

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      const status = err.status || err.statusCode || 500;
      const isRetryable = retryableStatuses.has(status) || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT';

      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }

      // Calculate jittered exponential backoff: min(maxDelay, baseDelay * 2^attempt) * random(0.5, 1.5)
      const exponential = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
      const jittered = Math.round(exponential * (0.5 + Math.random()));
      await sleep(jittered);
    }
  }
  throw lastError;
}

// Built-in Default Fallback Matrix
const DEFAULT_FALLBACKS = {
  // Claude 3.5 Sonnet -> GPT-4o -> Gemini 1.5 Pro
  'claude-3-5-sonnet-20241022': ['gpt-4o', 'gemini-1.5-pro'],
  'claude-3-5-haiku-20241022': ['gpt-4o-mini', 'gemini-1.5-flash'],
  // GPT-4o -> Claude 3.5 Sonnet -> Gemini 1.5 Pro
  'gpt-4o': ['claude-3-5-sonnet-20241022', 'gemini-1.5-pro'],
  'gpt-4o-mini': ['claude-3-5-haiku-20241022', 'gemini-1.5-flash'],
  // Gemini -> GPT -> Claude
  'gemini-1.5-pro': ['gpt-4o', 'claude-3-5-sonnet-20241022'],
  'gemini-1.5-flash': ['gpt-4o-mini', 'claude-3-5-haiku-20241022'],
  // DeepSeek -> OpenAI
  'deepseek-chat': ['gpt-4o-mini', 'gemini-1.5-flash']
};

module.exports = {
  CircuitBreaker,
  retryWithBackoff,
  DEFAULT_FALLBACKS,
  circuitBreaker: new CircuitBreaker()
};
