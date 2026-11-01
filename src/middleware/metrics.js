// Gateway Telemetry & Performance Metrics Collector

class MetricsCollector {
  constructor() {
    this.startTime = Date.now();
    this.requests = {
      total: 0,
      active: 0,
      success: 0,
      clientError: 0,
      serverError: 0
    };
    this.latencies = [];
    this.maxLatencyHistory = 500;
    this.tokens = {
      prompt: 0,
      completion: 0,
      total: 0
    };
  }

  middleware() {
    return (req, res, next) => {
      this.requests.total++;
      this.requests.active++;
      const start = Date.now();

      res.on('finish', () => {
        this.requests.active--;
        const duration = Date.now() - start;

        if (this.latencies.length >= this.maxLatencyHistory) {
          this.latencies.shift();
        }
        this.latencies.push(duration);

        if (res.statusCode >= 200 && res.statusCode < 400) {
          this.requests.success++;
        } else if (res.statusCode >= 400 && res.statusCode < 500) {
          this.requests.clientError++;
        } else if (res.statusCode >= 500) {
          this.requests.serverError++;
        }
      });

      next();
    };
  }

  recordTokens(promptTokens = 0, completionTokens = 0) {
    this.tokens.prompt += promptTokens;
    this.tokens.completion += completionTokens;
    this.tokens.total += promptTokens + completionTokens;
  }

  getSnapshot() {
    const uptimeSec = Math.trunc((Date.now() - this.startTime) / 1000);
    const avgLatency = this.latencies.length > 0
      ? (this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length).toFixed(2)
      : 0;

    return {
      uptime_seconds: uptimeSec,
      requests: { ...this.requests },
      latency: {
        avg_ms: parseFloat(avgLatency),
        samples: this.latencies.length
      },
      tokens: { ...this.tokens }
    };
  }

  reset() {
    this.requests = { total: 0, active: 0, success: 0, clientError: 0, serverError: 0 };
    this.latencies = [];
    this.tokens = { prompt: 0, completion: 0, total: 0 };
  }
}

const metricsCollector = new MetricsCollector();
module.exports = metricsCollector;
