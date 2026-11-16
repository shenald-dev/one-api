const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../src/index.js');
const { FlightRecorder } = require('../src/engine/flight-recorder.js');

test('FlightRecorder: W3C traceparent formatting and parsing', () => {
  const recorder = new FlightRecorder();
  const traceId = recorder.generateTraceId();
  const spanId = recorder.generateSpanId();

  assert.strictEqual(traceId.length, 32);
  assert.strictEqual(spanId.length, 16);

  const tp = recorder.formatTraceparent(traceId, spanId);
  assert.strictEqual(tp, `00-${traceId}-${spanId}-01`);

  const parsed = recorder.parseTraceparent(tp);
  assert.strictEqual(parsed.version, '00');
  assert.strictEqual(parsed.traceId, traceId);
  assert.strictEqual(parsed.parentSpanId, spanId);
});

test('FlightRecorder: circular ring buffer and query filters', () => {
  const recorder = new FlightRecorder({ capacity: 5 });

  for (let i = 1; i <= 7; i++) {
    recorder.record({
      trace_id: `trace_${i}`,
      span_id: `span_${i}`,
      model: i % 2 === 0 ? 'gpt-4o' : 'claude-3-5-sonnet',
      status: i === 5 ? 500 : 200,
      spans: { total_ms: i * 10 }
    });
  }

  // Oldest entries (1 and 2) should have been evicted by capacity 5
  assert.strictEqual(recorder.getTrace('trace_1'), null);
  assert.strictEqual(recorder.getTrace('trace_2'), null);
  assert.ok(recorder.getTrace('trace_7'));

  // Query all
  const qAll = recorder.query({ limit: 10 });
  assert.strictEqual(qAll.traces.length, 5);

  // Query errors only
  const qErr = recorder.query({ errorsOnly: true });
  assert.strictEqual(qErr.traces.length, 1);
  assert.strictEqual(qErr.traces[0].trace_id, 'trace_5');

  // Query model filter
  const qModel = recorder.query({ model: 'gpt-4o' });
  for (const t of qModel.traces) {
    assert.strictEqual(t.model, 'gpt-4o');
  }

  // Stats calculation
  const stats = recorder.getStats();
  assert.strictEqual(stats.total_recorded, 5);
  assert.strictEqual(stats.errors, 1);
  assert.ok(stats.error_rate > 0);
  assert.ok(stats.latency_p50_ms > 0);
});

test('FlightRecorder: OpenTelemetry trace export format', () => {
  const recorder = new FlightRecorder({ capacity: 10 });
  recorder.record({
    trace_id: '12345678901234567890123456789012',
    span_id: '1234567890123456',
    model: 'gpt-4o',
    provider: 'openai',
    status: 200,
    spans: { total_ms: 120 }
  });

  const otel = recorder.exportOpenTelemetry();
  assert.ok(Array.isArray(otel.resourceSpans));
  assert.strictEqual(otel.resourceSpans[0].resource.attributes[0].value.stringValue, 'one-api');
  const span = otel.resourceSpans[0].scopeSpans[0].spans[0];
  assert.strictEqual(span.traceId, '12345678901234567890123456789012');
  assert.strictEqual(span.spanId, '1234567890123456');
});

test('FlightRecorder HTTP Endpoints: GET /v1/traces and traceparent headers', async () => {
  // Make a sample request
  const res = await request(app)
    .post('/v1/chat/completions')
    .send({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Trace recorder test' }]
    });

  assert.strictEqual(res.status, 200);
  const traceId = res.headers['x-trace-id'];
  assert.ok(traceId);
  assert.ok(res.headers['traceparent']);

  // Fetch traces list
  const listRes = await request(app).get('/v1/traces');
  assert.strictEqual(listRes.status, 200);
  assert.ok(Array.isArray(listRes.body.traces));
  assert.ok(listRes.body.total > 0);

  // Fetch single trace
  const traceRes = await request(app).get(`/v1/traces/${traceId}`);
  assert.strictEqual(traceRes.status, 200);
  assert.strictEqual(traceRes.body.trace_id, traceId);
  assert.strictEqual(traceRes.body.status, 200);

  // Stats
  const statsRes = await request(app).get('/v1/traces/stats');
  assert.strictEqual(statsRes.status, 200);
  assert.ok(statsRes.body.total_recorded >= 1);

  // OpenTelemetry export
  const otelRes = await request(app).get('/v1/traces/export');
  assert.strictEqual(otelRes.status, 200);
  assert.ok(otelRes.body.resourceSpans);

  // Incident replay
  const replayRes = await request(app)
    .post(`/v1/traces/${traceId}/replay`)
    .send({ model: 'gpt-4o' });

  assert.strictEqual(replayRes.status, 200);
  assert.strictEqual(replayRes.body.replay.original_trace_id, traceId);
  assert.ok(replayRes.body.response);
});
