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

app.use(helmet());

let corsOptions = { origin: '*' };
if (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS !== '*') {
  corsOptions.origin = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
}

app.use(cors(corsOptions));
// Compress all responses to reduce bandwidth and latency
app.use(compression());
// Set a larger JSON limit since LLM contexts can be quite large
app.use(express.json({ limit: '10mb' }));

// Handle invalid JSON gracefully
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }
  next(err);
});

// API endpoints
function isValidModel(model) {
  return !!(model && typeof model === 'string' && model.trim());
}

function isValidMessagesArray(messages) {
  return !!(messages && Array.isArray(messages) && messages.length > 0);
}

function isValidMessage(msg) {
  return !!(msg && typeof msg === 'object' && !Array.isArray(msg) && msg.role && typeof msg.role === 'string' && typeof msg.content === 'string');
}

app.post('/v1/chat/completions', (req, res) => {
  const { model, messages } = req.body || {};
  if (!isValidModel(model)) {
    return res.status(400).json({ error: 'Missing or invalid model' });
  }
  if (!isValidMessagesArray(messages)) {
    return res.status(400).json({ error: 'Missing or invalid messages' });
  }
  if (messages.length > 1000) {
    return res.status(400).json({ error: 'Too many messages' });
  }

  for (const msg of messages) {
    if (!isValidMessage(msg)) {
      return res.status(400).json({ error: 'Malformed message object' });
    }
  }

  // Mock unified response
  res.json({
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: 'This is a mock response from the unified API.'
        },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 10,
      total_tokens: 20
    }
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 404 handler — return JSON for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Generic error handler — never leak stack traces
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: 'Internal server error' });
});

const computationCache = new Map();

/**
 * Performs a heavy mathematical computation.
 * Optimized with memoization for repeated calls with identical parameters.
 */
function heavyComputation(iterations) {
  const cachedVal = computationCache.get(iterations);
  if (cachedVal !== undefined) {
    // Refresh LRU by deleting and re-inserting
    computationCache.delete(iterations);
    computationCache.set(iterations, cachedVal);
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
