// Traces and Flight Recorder HTTP Endpoints
const { flightRecorder } = require('../engine/flight-recorder');
const registry = require('../providers');
const aliasRegistry = require('../engine/aliases');

function handleGetTraces(req, res) {
  const {
    limit,
    offset,
    model,
    provider,
    status,
    errorsOnly,
    slowThresholdMs
  } = req.query;

  const result = flightRecorder.query({
    limit: limit ? parseInt(limit, 10) : 50,
    offset: offset ? parseInt(offset, 10) : 0,
    model: model || null,
    provider: provider || null,
    status: status !== undefined ? parseInt(status, 10) : null,
    errorsOnly: errorsOnly === 'true' || errorsOnly === '1',
    slowThresholdMs: slowThresholdMs ? parseInt(slowThresholdMs, 10) : 0
  });

  res.status(200).json({
    gateway: 'one-api',
    ...result
  });
}

function handleGetTraceById(req, res) {
  const { traceId } = req.params;
  const trace = flightRecorder.getTrace(traceId);

  if (!trace) {
    return res.status(404).json({
      error: `Trace not found for id: ${traceId}`
    });
  }

  res.status(200).json(trace);
}

function handleGetTraceStats(req, res) {
  const stats = flightRecorder.getStats();
  res.status(200).json({
    gateway: 'one-api',
    ...stats
  });
}

function handleExportOpenTelemetry(req, res) {
  const otel = flightRecorder.exportOpenTelemetry();
  res.status(200).json(otel);
}

async function handleReplayTrace(req, res) {
  const { traceId } = req.params;
  const trace = flightRecorder.getTrace(traceId);

  if (!trace) {
    return res.status(404).json({
      error: `Trace not found for replay: ${traceId}`
    });
  }

  const overrideModel = req.body?.model || trace.model || 'gpt-4o';
  const targetModel = aliasRegistry.resolve(overrideModel);
  const provider = registry.resolveProvider(targetModel);

  const replayMessages = req.body?.messages || [
    { role: 'user', content: `Replay of trace ${traceId} (model: ${targetModel})` }
  ];

  try {
    const start = Date.now();
    const result = await provider.complete({
      model: targetModel,
      messages: replayMessages,
      id: `replay-${traceId.slice(0, 8)}-${Date.now()}`
    });
    const elapsed = Date.now() - start;

    res.status(200).json({
      replay: {
        original_trace_id: traceId,
        original_model: trace.model,
        original_status: trace.status,
        replayed_model: targetModel,
        replayed_latency_ms: elapsed
      },
      response: result
    });
  } catch (err) {
    res.status(500).json({
      error: `Replay failed: ${err.message}`,
      original_trace_id: traceId
    });
  }
}

module.exports = {
  handleGetTraces,
  handleGetTraceById,
  handleGetTraceStats,
  handleExportOpenTelemetry,
  handleReplayTrace
};
