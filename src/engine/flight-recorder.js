// Deterministic Incident Flight Recorder & W3C Distributed Tracing Engine
const crypto = require('crypto');

class FlightRecorder {
  constructor(options = {}) {
    const rawCapacity = parseInt(options.capacity || process.env.FLIGHT_RECORDER_CAPACITY || '1000', 10);
    this.capacity = isNaN(rawCapacity) || rawCapacity < 1 ? 1000 : Math.min(Math.max(1, rawCapacity), 100000);
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.size = 0;
    this.indexByTraceId = new Map();
  }

  generateTraceId() {
    return crypto.randomBytes(16).toString('hex');
  }

  generateSpanId() {
    return crypto.randomBytes(8).toString('hex');
  }

  formatTraceparent(traceId, spanId) {
    return `00-${traceId}-${spanId}-01`;
  }

  parseTraceparent(header) {
    if (!header || typeof header !== 'string') return null;
    const parts = header.trim().split('-');
    if (parts.length < 4 || parts[0] !== '00') return null;
    return {
      version: parts[0],
      traceId: parts[1],
      parentSpanId: parts[2],
      traceFlags: parts[3]
    };
  }

  record(record) {
    const traceId = record.trace_id;
    if (!traceId) return;

    const entry = {
      ...record,
      recorded_at: Date.now()
    };

    // If buffer slot is occupied, remove old traceId from index
    const existing = this.buffer[this.head];
    if (existing && existing.trace_id) {
      this.indexByTraceId.delete(existing.trace_id);
    }

    this.buffer[this.head] = entry;
    this.indexByTraceId.set(traceId, entry);

    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }

    return entry;
  }

  getTrace(traceId) {
    if (!traceId) return null;
    return this.indexByTraceId.get(traceId) || null;
  }

  query(options = {}) {
    const {
      limit = 50,
      offset = 0,
      model = null,
      provider = null,
      status = null,
      errorsOnly = false,
      slowThresholdMs = 0
    } = options;

    const results = [];
    const max = Math.min(this.size, this.capacity);

    // Iterate backwards from newest to oldest
    for (let i = 0; i < max; i++) {
      const idx = (this.head - 1 - i + this.capacity) % this.capacity;
      const entry = this.buffer[idx];
      if (!entry) continue;

      if (errorsOnly && (entry.status < 400 && !entry.error)) continue;
      if (status !== null && entry.status !== parseInt(status, 10)) continue;
      if (model && entry.model !== model && entry.resolved_model !== model) continue;
      if (provider && entry.provider !== provider) continue;
      if (slowThresholdMs > 0 && (entry.spans?.total_ms || 0) < slowThresholdMs) continue;

      results.push(entry);
    }

    const start = Math.max(0, parseInt(offset, 10) || 0);
    const end = start + (parseInt(limit, 10) || 50);
    return {
      total: results.length,
      limit: parseInt(limit, 10) || 50,
      offset: start,
      traces: results.slice(start, end)
    };
  }

  getStats() {
    const max = Math.min(this.size, this.capacity);
    if (max === 0) {
      return {
        total_recorded: 0,
        errors: 0,
        error_rate: 0,
        latency_p50_ms: 0,
        latency_p90_ms: 0,
        latency_p99_ms: 0,
        avg_ttft_ms: 0
      };
    }

    let errorCount = 0;
    const latencies = [];
    let ttftSum = 0;
    let ttftCount = 0;

    for (let i = 0; i < max; i++) {
      const entry = this.buffer[i];
      if (!entry) continue;

      if (entry.status >= 400 || entry.error) {
        errorCount++;
      }

      const totalMs = entry.spans?.total_ms || 0;
      latencies.push(totalMs);

      if (entry.spans?.ttft_ms > 0) {
        ttftSum += entry.spans.ttft_ms;
        ttftCount++;
      }
    }

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p90 = latencies[Math.floor(latencies.length * 0.9)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

    return {
      total_recorded: max,
      errors: errorCount,
      error_rate: parseFloat(((errorCount / max) * 100).toFixed(2)),
      latency_p50_ms: parseFloat(p50.toFixed(2)),
      latency_p90_ms: parseFloat(p90.toFixed(2)),
      latency_p99_ms: parseFloat(p99.toFixed(2)),
      avg_ttft_ms: ttftCount > 0 ? parseFloat((ttftSum / ttftCount).toFixed(2)) : 0
    };
  }

  exportOpenTelemetry() {
    const max = Math.min(this.size, this.capacity);
    const spans = [];

    for (let i = 0; i < max; i++) {
      const entry = this.buffer[i];
      if (!entry) continue;

      const startTimeMs = BigInt(entry.timestamp || Date.now());
      const startTimeUnixNano = (startTimeMs * 1000000n).toString();
      const durationMs = BigInt(Math.max(0, Math.round(entry.spans?.total_ms || 0)));
      const endTimeUnixNano = ((startTimeMs + durationMs) * 1000000n).toString();

      spans.push({
        traceId: entry.trace_id,
        spanId: entry.span_id,
        parentSpanId: entry.parent_span_id || '',
        name: `${entry.method || 'POST'} ${entry.path || '/v1/chat/completions'}`,
        kind: 1, // SPAN_KIND_INTERNAL / SERVER
        startTimeUnixNano: String(startTimeUnixNano),
        endTimeUnixNano: String(endTimeUnixNano),
        attributes: [
          { key: 'http.method', value: { stringValue: entry.method || 'POST' } },
          { key: 'http.status_code', value: { intValue: entry.status || 200 } },
          { key: 'llm.request.model', value: { stringValue: entry.model || '' } },
          { key: 'llm.response.model', value: { stringValue: entry.resolved_model || entry.model || '' } },
          { key: 'llm.provider', value: { stringValue: entry.provider || 'unknown' } },
          { key: 'llm.usage.prompt_tokens', value: { intValue: entry.tokens?.prompt_tokens || 0 } },
          { key: 'llm.usage.completion_tokens', value: { intValue: entry.tokens?.completion_tokens || 0 } },
          { key: 'llm.usage.cost_usd', value: { doubleValue: entry.tokens?.cost_usd || 0 } },
          { key: 'oneapi.cached', value: { boolValue: Boolean(entry.cached) } },
          { key: 'oneapi.cache_type', value: { stringValue: entry.cache_type || 'NONE' } },
          { key: 'oneapi.guardrail_violated', value: { boolValue: Boolean(entry.guardrail_violated) } }
        ],
        status: {
          code: entry.status >= 400 || entry.error ? 2 : 1, // 1: OK, 2: ERROR
          message: entry.error?.message || ''
        }
      });
    }

    return {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'one-api' } },
              { key: 'service.version', value: { stringValue: '3.0.0' } }
            ]
          },
          scopeSpans: [
            {
              scope: { name: 'one-api.flight-recorder', version: '3.0.0' },
              spans
            }
          ]
        }
      ]
    };
  }

  clear() {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.size = 0;
    this.indexByTraceId.clear();
  }

  middleware() {
    return (req, res, next) => {
      const incomingTraceparent = req.headers['traceparent'];
      const parsed = this.parseTraceparent(incomingTraceparent);

      let traceId = parsed?.traceId;
      if (!traceId) {
        const customId = req.headers['x-trace-id'] || req.headers['x-request-id'];
        if (customId && /^[0-9a-f]{32}$/i.test(customId)) {
          traceId = customId.toLowerCase();
        } else {
          traceId = this.generateTraceId();
        }
      }

      const parentSpanId = parsed?.parentSpanId || null;
      const spanId = this.generateSpanId();
      const traceparent = this.formatTraceparent(traceId, spanId);

      const clientReqId = req.headers['x-request-id'] || traceId;
      req.traceId = traceId;
      req.spanId = spanId;
      req.parentSpanId = parentSpanId;
      req.traceparent = traceparent;
      req.flightContext = {
        startTime: Date.now(),
        spans: {
          guardrails_ms: 0,
          cache_lookup_ms: 0,
          routing_ms: 0,
          upstream_ms: 0,
          ttft_ms: 0,
          total_ms: 0
        },
        model: null,
        resolvedModel: null,
        provider: null,
        cached: false,
        cacheType: 'NONE',
        cacheSimilarity: null,
        guardrailViolated: false,
        guardrailViolations: [],
        fallbackApplied: false,
        tokens: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          cost_usd: 0
        },
        error: null
      };

      res.setHeader('X-Trace-Id', traceId);
      res.setHeader('X-Request-Id', clientReqId);
      res.setHeader('traceparent', traceparent);

      res.on('finish', () => {
        const ctx = req.flightContext;
        ctx.spans.total_ms = Math.max(0, Date.now() - ctx.startTime);

        this.record({
          id: `flight_${traceId.slice(0, 8)}_${Date.now()}`,
          trace_id: traceId,
          span_id: spanId,
          parent_span_id: parentSpanId,
          traceparent,
          timestamp: ctx.startTime,
          method: req.method,
          path: req.originalUrl || req.path,
          client_ip: req.ip || '127.0.0.1',
          status: res.statusCode,
          model: ctx.model || req.body?.model || null,
          resolved_model: ctx.resolvedModel || null,
          provider: ctx.provider || null,
          cached: ctx.cached,
          cache_type: ctx.cacheType,
          cache_similarity: ctx.cacheSimilarity,
          guardrail_violated: ctx.guardrailViolated,
          guardrail_violations: ctx.guardrailViolations,
          fallback_applied: ctx.fallbackApplied,
          spans: ctx.spans,
          tokens: ctx.tokens,
          error: ctx.error
        });
      });

      next();
    };
  }
}

const flightRecorder = new FlightRecorder();

module.exports = {
  FlightRecorder,
  flightRecorder
};
