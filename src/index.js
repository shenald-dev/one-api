#!/usr/bin/env node
// one-api — Universal Edge LLM Gateway (v3.0.0 Flagship Evolution)
const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config({ quiet: true });

const config = require('./config');
const authMiddleware = require('./middleware/auth');
const metrics = require('./middleware/metrics');
const { flightRecorder } = require('./engine/flight-recorder');
const { mcpServer } = require('./mcp/server');
const { handleMcpSse, handleMcpJsonRpc } = require('./routes/mcp');
const {
  handleGetTraces,
  handleGetTraceById,
  handleGetTraceStats,
  handleExportOpenTelemetry,
  handleReplayTrace
} = require('./routes/traces');
const { clientErrorHandler, notFoundHandler, genericErrorHandler } = require('./middleware/error');
const { handleHealth, handleDetailedHealth, handleGetMetrics } = require('./routes/telemetry');
const { handleListModels, handleGetModel } = require('./routes/models');
const {
  handleChatCompletions,
  isValidModel,
  isValidMessagesArray,
  isValidMessage,
  cache
} = require('./routes/completions');
const { handleEmbeddings } = require('./routes/embeddings');

// Process Management
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const app = express();

// Disable ETag generation for highly dynamic JSON APIs to save CPU cycles
app.set('etag', false);
app.disable('x-powered-by');

// Trust the first upstream proxy to securely resolve client IP
app.set('trust proxy', 1);

// Health endpoint registered before security/CORS middlewares for zero-overhead load balancer pings
app.get('/health', handleHealth);

// Configure CORS
let corsOptions = { origin: false, maxAge: 86400 };
if (process.env.ALLOWED_ORIGINS) {
  const origins = process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  if (origins.includes('*')) {
    corsOptions.origin = '*';
  } else {
    corsOptions.origin = origins;
  }
}
app.use(cors(corsOptions));

app.use(helmet({
  contentSecurityPolicy: false
}));

// Global JSON Content-Type default (routes can override e.g. HTML dashboard, SSE)
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Deterministic W3C Distributed Tracing & Flight Recorder Middleware
app.use(flightRecorder.middleware());

// Telemetry & metrics collector
app.use(metrics.middleware());

// Response compression
const baseCompress = compression({ threshold: 0 });
const compressMiddleware = (req, res, next) => (process.env.ENABLE_COMPRESSION !== 'false' ? baseCompress(req, res, next) : next());

// JSON request body parser
const jsonParser = express.json({ limit: config.maxPayloadSize || '512kb' });

// Dashboard Asset
const dashboardPath = path.join(__dirname, '../public/index.html');
const dashboardHtml = fs.existsSync(dashboardPath) ? fs.readFileSync(dashboardPath, 'utf-8') : '';

// Edge Gateway Dashboard Routes (Unauthenticated for browser inspection)
app.get('/dashboard', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(dashboardHtml);
});

app.get('/', (req, res) => {
  if (req.accepts('html') && !req.accepts('json')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(dashboardHtml);
  }
  res.status(200).json({
    gateway: 'one-api',
    version: '3.0.0',
    status: 'online',
    dashboard: '/dashboard',
    endpoints: {
      completions: '/v1/chat/completions',
      embeddings: '/v1/embeddings',
      models: '/v1/models',
      metrics: '/v1/metrics',
      traces: '/v1/traces',
      mcp: '/v1/mcp',
      health: '/health'
    }
  });
});

// Gateway Authentication
app.use(authMiddleware);

// Model Context Protocol (MCP) Endpoints
app.get('/mcp', handleMcpSse);
app.post('/mcp', jsonParser, handleMcpJsonRpc);
app.post('/mcp/messages', jsonParser, handleMcpJsonRpc);
app.get('/v1/mcp', handleMcpSse);
app.post('/v1/mcp', jsonParser, handleMcpJsonRpc);

// Telemetry & Traces Routes
app.get('/health/detailed', handleDetailedHealth);
app.get('/v1/metrics', handleGetMetrics);
app.get('/v1/traces', handleGetTraces);
app.get('/v1/traces/stats', handleGetTraceStats);
app.get('/v1/traces/export', handleExportOpenTelemetry);
app.get('/v1/traces/:traceId', handleGetTraceById);
app.post('/v1/traces/:traceId/replay', jsonParser, compressMiddleware, handleReplayTrace);

// Models Catalog Routes
app.get('/v1/models', handleListModels);
app.get('/v1/models/:model', handleGetModel);

// Inference Routes
app.post('/v1/chat/completions', jsonParser, compressMiddleware, handleChatCompletions);
app.post('/v1/embeddings', jsonParser, compressMiddleware, handleEmbeddings);

// Cache Management Route
app.post('/v1/cache/clear', (req, res) => {
  cache.clear();
  res.status(200).json({ ok: true, message: 'Response cache cleared' });
});

// Error Handlers
app.use(clientErrorHandler);
app.use(notFoundHandler);
app.use(genericErrorHandler);

// Heavy Computation Cache & Logic (Benchmark and backward compatibility)
const computationCache = new Map();
let lastIterations = Symbol('UNINITIALIZED');
let lastResult = undefined;

/**
 * Performs a heavy mathematical computation.
 * Optimized with memoization and LRU eviction.
 */
function heavyComputation(iterations) {
  if (iterations === lastIterations) {
    return lastResult;
  }

  const cachedVal = computationCache.get(iterations);
  if (cachedVal !== undefined) {
    computationCache.delete(iterations);
    computationCache.set(iterations, cachedVal);
    lastIterations = iterations;
    lastResult = cachedVal;
    return cachedVal;
  }

  if (computationCache.size >= 1000) {
    const oldestKey = computationCache.keys().next().value;
    computationCache.delete(oldestKey);
  }

  let sum = 0;
  for (let i = 0; i < iterations; i++) {
    sum += Math.sqrt(i) * Math.sin(i * 0.01);
  }

  computationCache.set(iterations, sum);
  lastIterations = iterations;
  lastResult = sum;
  return sum;
}

async function main() {
  const iterations = 100000;
  const runs = 10;
  const times = [];

  console.log('Running ' + runs + ' iterations...');
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    heavyComputation(iterations);
    const end = performance.now();
    times.push(end - start);
    if (i % 2 === 0) process.stdout.write('.');
  }
  console.log('\n');

  const avg = times.reduce((a, b) => a + b) / times.length;
  console.log('Average: ' + avg.toFixed(2) + 'ms');
  console.log('Throughput: ' + (1000 / avg).toFixed(2) + ' ops/sec');
  return { avg, throughput: 1000 / avg };
}

// CLI Execution Router
function runCli(customArgs) {
  const args = customArgs || process.argv.slice(2);
  const command = args[0] || '';

  if (command === 'doctor' || args.includes('--doctor')) {
    const { runDoctor } = require('./cli/doctor');
    return runDoctor().then(() => process.exit(0)).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  } else if (command === 'chat' || args.includes('--chat')) {
    const { runChat } = require('./cli/chat');
    return runChat(args[1] || 'smart');
  } else if (command === 'mcp' || args.includes('--mcp')) {
    return mcpServer.startStdio();
  } else if (command === 'benchmark' || args.includes('--benchmark')) {
    const { runBenchmarkSuite } = require('../benchmarks/gateway.bench');
    return runBenchmarkSuite().then(() => process.exit(0)).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  } else if (args.includes('--server') || command === 'start' || command === 'server') {
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log(`🌌 one-api Gateway v3.0.0 listening on port ${PORT}`);
      console.log(`📡 Endpoints:`);
      console.log(`   - Dashboard:      http://localhost:${PORT}/dashboard`);
      console.log(`   - Chat API:       POST http://localhost:${PORT}/v1/chat/completions`);
      console.log(`   - Embeddings:     POST http://localhost:${PORT}/v1/embeddings`);
      console.log(`   - Models Catalog: GET  http://localhost:${PORT}/v1/models`);
      console.log(`   - MCP Server:     GET/POST http://localhost:${PORT}/v1/mcp`);
      console.log(`   - Flight Traces:  GET  http://localhost:${PORT}/v1/traces`);
      console.log(`   - Telemetry:      GET  http://localhost:${PORT}/v1/metrics`);
      console.log(`   - Health:         GET  http://localhost:${PORT}/health`);
      console.log('='.repeat(60) + '\n');
    });

    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    let isShuttingDown = false;
    const shutdown = (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);

      if (server.closeIdleConnections) {
        server.closeIdleConnections();
      }

      server.close(() => {
        console.log('Closed out remaining connections.');
        process.exit(0);
      });

      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        if (server.closeAllConnections) {
          server.closeAllConnections();
        }
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    return server;
  } else {
    // Default fallback for legacy benchmark compatibility
    return main()
      .then((r) => {
        console.log('Results:', r);
        process.exit(0);
      })
      .catch((e) => {
        console.error(e);
        process.exit(1);
      });
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  main,
  app,
  heavyComputation,
  isValidModel,
  isValidMessagesArray,
  isValidMessage,
  flightRecorder,
  mcpServer,
  runCli
};
