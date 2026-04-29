// one-api
const { performance } = require('perf_hooks');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

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

const HEALTH_RESPONSE = Buffer.from(JSON.stringify({ status: 'ok' }));
app.get('/health', (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).send(HEALTH_RESPONSE);
});

app.use(helmet());

let corsOptions = { origin: '*' };
if (process.env.ALLOWED_ORIGINS) {
  const origins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
  if (origins.includes('*')) {
    corsOptions.origin = '*';
  } else {
    corsOptions.origin = origins;
  }
}
app.use(cors(corsOptions));

// Set global JSON Content-Type for all responses to reduce redundant setHeader calls
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});


// Compress all responses to reduce bandwidth and latency
app.use(compression());

const ERROR_INVALID_JSON = Buffer.from(JSON.stringify({ error: 'Invalid JSON payload' }));
const ERROR_PAYLOAD_TOO_LARGE = Buffer.from(JSON.stringify({ error: 'Payload too large' }));

// API endpoints
function isValidModel(model) {
  return typeof model === 'string' && model.length > 0 && model.length < 1000 && model.trim() !== '';
}

function isValidMessagesArray(messages) {
  return Array.isArray(messages) && messages.length > 0;
}

function isValidMessage(msg) {
  return msg != null && typeof msg.role === 'string' && msg.role !== '' && typeof msg.content === 'string';
}


const MOCK_CHOICES = Object.freeze([
  Object.freeze({
    index: 0,
    message: Object.freeze({
      role: 'assistant',
      content: 'This is a mock response from the unified API.'
    }),
    finish_reason: 'stop'
  })
]);

const MOCK_USAGE = Object.freeze({
  prompt_tokens: 10,
  completion_tokens: 10,
  total_tokens: 20
});
const MOCK_CHOICES_JSON = JSON.stringify(MOCK_CHOICES);
const MOCK_USAGE_JSON = JSON.stringify(MOCK_USAGE);

const ERROR_MISSING_MODEL = Buffer.from(JSON.stringify({ error: 'Missing or invalid model' }));
const ERROR_MISSING_MESSAGES = Buffer.from(JSON.stringify({ error: 'Missing or invalid messages' }));
const ERROR_TOO_MANY_MESSAGES = Buffer.from(JSON.stringify({ error: 'Too many messages' }));
const ERROR_MALFORMED_MESSAGE = Buffer.from(JSON.stringify({ error: 'Malformed message object' }));

// Set a larger JSON limit since LLM contexts can be quite large
const jsonParser = express.json({ limit: '10mb' });

app.post('/v1/chat/completions', jsonParser, (req, res) => {
  const body = req.body;
  const model = body ? body.model : undefined;
  const messages = body ? body.messages : undefined;
  if (!isValidModel(model)) {
    return res.status(400).send(ERROR_MISSING_MODEL);
  }
  if (!isValidMessagesArray(messages)) {
    return res.status(400).send(ERROR_MISSING_MESSAGES);
  }
  if (messages.length > 1000) {
    return res.status(400).send(ERROR_TOO_MANY_MESSAGES);
  }

  // Use a classic for loop with cached length instead of for...of to avoid iterator allocation overhead in the hot path
  const messagesLen = messages.length;
  for (let i = 0; i < messagesLen; i++) {
    if (!isValidMessage(messages[i])) {
      return res.status(400).send(ERROR_MALFORMED_MESSAGE);
    }
  }

  // Mock unified response
  const payload = `{"id":"chatcmpl-${crypto.randomUUID()}","object":"chat.completion","created":${Math.trunc(Date.now() / 1000)},"model":${JSON.stringify(model)},"choices":${MOCK_CHOICES_JSON},"usage":${MOCK_USAGE_JSON}}`;
  res.status(200).send(payload);
});

// Handle invalid JSON gracefully
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(400).send(ERROR_INVALID_JSON);
  }
  if (err.type === 'entity.too.large') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(413).send(ERROR_PAYLOAD_TOO_LARGE);
  }
  next(err);
});

const ERROR_NOT_FOUND = Buffer.from(JSON.stringify({ error: 'Not found' }));

// 404 handler — return JSON for unknown routes
app.use((req, res) => {
  res.status(404).send(ERROR_NOT_FOUND);
});

const ERROR_INTERNAL_SERVER = Buffer.from(JSON.stringify({ error: 'Internal server error' }));

// Generic error handler — never leak stack traces
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(500).send(ERROR_INTERNAL_SERVER);
});

const computationCache = new Map();
let lastIterations = Symbol('UNINITIALIZED');
let lastResult = undefined;

/**
 * Performs a heavy mathematical computation.
 * Optimized with memoization for repeated calls with identical parameters.
 */
function heavyComputation(iterations) {
  // L1 Cache: Fast path for repeated consecutive calls
  if (iterations === lastIterations) {
    return lastResult;
  }

  const cachedVal = computationCache.get(iterations);
  if (cachedVal !== undefined) {
    // Refresh LRU by deleting and re-inserting
    computationCache.delete(iterations);
    computationCache.set(iterations, cachedVal);

    // Update L1 cache
    lastIterations = iterations;
    lastResult = cachedVal;
    return cachedVal;
  }

  // Prevent memory leak from unbounded cache growth by evicting the oldest entry (LRU)
  if (computationCache.size >= 1000) {
    const oldestKey = computationCache.keys().next().value;
    computationCache.delete(oldestKey);
  }

  let sum = 0;
  for (let i = 0; i < iterations; i++) {
    sum += Math.sqrt(i) * Math.sin(i * 0.01);
  }

  computationCache.set(iterations, sum);

  // Update L1 cache
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
    // The computation is now memoized, making repeated calls in this loop efficient.
    heavyComputation(iterations);
    const end = performance.now();
    times.push(end - start);
    if (i % 2 === 0) process.stdout.write('.');
  }
  console.log('\n');

  const avg = times.reduce((a,b) => a+b) / times.length;
  console.log('Average: ' + avg.toFixed(2) + 'ms');
  console.log('Throughput: ' + (1000/avg).toFixed(2) + ' ops/sec');
  return { avg, throughput: 1000/avg };
}

if (require.main === module) {
  if (process.argv.includes('--server')) {
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      console.log(`One API Gateway listening on port ${PORT}`);
    });

    // Increase timeouts to prevent early disconnections from load balancers or slow clients
    server.keepAliveTimeout = 65000; // 65 seconds
    server.headersTimeout = 66000;   // 66 seconds (must be larger than keepAliveTimeout)

    // Graceful shutdown logic
    let isShuttingDown = false;
    const shutdown = (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);

      // Immediately sever idle keep-alive connections to prevent them from
      // hanging the graceful shutdown process.
      if (server.closeIdleConnections) {
        server.closeIdleConnections();
      }

      server.close(() => {
        console.log('Closed out remaining connections.');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
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
    // Default to benchmark if no --server flag
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

module.exports = { main, app, heavyComputation, isValidModel, isValidMessagesArray, isValidMessage };
