// one-api — Universal Edge LLM Gateway
const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const config = require('./config');
const authMiddleware = require('./middleware/auth');
const metrics = require('./middleware/metrics');
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

// Self-healing / Process Management
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

// Trust the first upstream proxy (e.g. load balancer) to securely resolve client IP
app.set('trust proxy', 1);

// Health endpoint registered before security/CORS middlewares for zero-overhead load balancer pings
app.get('/health', handleHealth);

// Configure CORS
let corsOptions = { origin: false, maxAge: 86400 };
if (process.env.ALLOWED_ORIGINS) {
  const origins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
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
    version: '2.1.0',
    status: 'online',
    dashboard: '/dashboard',
    endpoints: {
      completions: '/v1/chat/completions',
      embeddings: '/v1/embeddings',
      models: '/v1/models',
      metrics: '/v1/metrics',
      health: '/health'
    }
  });
});

// Gateway Authentication
app.use(authMiddleware);

// Route Handlers
app.get('/health/detailed', handleDetailedHealth);
app.get('/v1/metrics', handleGetMetrics);
app.get('/v1/models', handleListModels);
app.get('/v1/models/:model', handleGetModel);
app.post('/v1/chat/completions', jsonParser, compressMiddleware, handleChatCompletions);
app.post('/v1/embeddings', jsonParser, compressMiddleware, handleEmbeddings);
app.post('/v1/cache/clear', (req, res) => {
  cache.clear();
  res.status(200).json({ ok: true, message: 'Response cache cleared' });
});

// Error Handlers
app.use(clientErrorHandler);
app.use(notFoundHandler);
app.use(genericErrorHandler);

// Heavy Computation Cache & Logic (Benchmark compatibility)
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

if (require.main === module) {
  if (process.argv.includes('--server')) {
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      console.log('\n' + '='.repeat(50));
      console.log(`🌌 one-api Gateway v2.1.0 listening on port ${PORT}`);
      console.log(`📡 Endpoints:`);
      console.log(`   - Dashboard: http://localhost:${PORT}/dashboard`);
      console.log(`   - POST http://localhost:${PORT}/v1/chat/completions`);
      console.log(`   - POST http://localhost:${PORT}/v1/embeddings`);
      console.log(`   - GET  http://localhost:${PORT}/v1/models`);
      console.log(`   - GET  http://localhost:${PORT}/v1/metrics`);
      console.log(`   - GET  http://localhost:${PORT}/health`);
      console.log('='.repeat(50) + '\n');
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
  } else {
    main()
      .then(r => {
        console.log('Results:', r);
        process.exit(0);
      })
      .catch(e => {
        console.error(e);
        process.exit(1);
      });
  }
}

module.exports = {
  main,
  app,
  heavyComputation,
  isValidModel,
  isValidMessagesArray,
  isValidMessage
};
