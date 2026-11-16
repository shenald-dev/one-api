const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../src/index.js');
const { FlightRecorder } = require('../src/engine/flight-recorder.js');

test('FlightRecorder Hardening: Invalid capacity values fall back safely without throwing RangeError', () => {
  // Negative capacity
  const negRecorder = new FlightRecorder({ capacity: -10 });
  assert.ok(negRecorder.capacity > 0);
  assert.strictEqual(negRecorder.buffer.length, 1000);

  // NaN capacity
  const nanRecorder = new FlightRecorder({ capacity: 'not_a_number' });
  assert.strictEqual(nanRecorder.capacity, 1000);
  assert.strictEqual(nanRecorder.buffer.length, 1000);

  // Excessive capacity clamped to 100,000
  const maxRecorder = new FlightRecorder({ capacity: 500000 });
  assert.strictEqual(maxRecorder.capacity, 100000);
});

test('FlightRecorder Hardening: Preserves custom X-Request-Id while generating compliant 32-hex W3C traceparent', async () => {
  const customRequestId = 'user-custom-req-uuid-12345';

  const res = await request(app)
    .post('/v1/chat/completions')
    .set('X-Request-Id', customRequestId)
    .send({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Ping' }]
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers['x-request-id'], customRequestId, 'Must preserve custom client X-Request-Id');

  const traceparent = res.headers['traceparent'];
  assert.ok(traceparent);
  const parts = traceparent.split('-');
  assert.strictEqual(parts[0], '00');
  assert.strictEqual(parts[1].length, 32, 'Trace ID in traceparent must strictly be 32 hex chars');
  assert.ok(/^[0-9a-f]{32}$/.test(parts[1]), 'Trace ID must be valid lowercase hex');
  assert.strictEqual(parts[2].length, 16, 'Span ID must be 16 hex chars');
  assert.ok(/^[0-9a-f]{16}$/.test(parts[2]), 'Span ID must be valid lowercase hex');
});

test('FlightRecorder Hardening: OpenTelemetry nanosecond timestamps are accurate 64-bit integer strings', () => {
  const recorder = new FlightRecorder();
  recorder.record({
    trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
    span_id: '00f067aa0ba902b7',
    timestamp: 1731737000123,
    spans: { total_ms: 15 }
  });

  const otel = recorder.exportOpenTelemetry();
  const span = otel.resourceSpans[0].scopeSpans[0].spans[0];
  assert.strictEqual(span.startTimeUnixNano, '1731737000123000000');
  assert.strictEqual(span.endTimeUnixNano, '1731737000138000000');
});
