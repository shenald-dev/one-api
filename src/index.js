// one-api
const { performance } = require('perf_hooks');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Self-healing / Process Management
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Optional: Add recovery or graceful shutdown logic
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Optional: Add recovery or graceful shutdown logic
});

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Handle invalid JSON gracefully
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  next(err);
});

// API endpoints
app.post('/v1/chat/completions', (req, res) => {
  const { model, messages } = req.body;
  if (!model || !messages) {
    return res.status(400).json({ error: 'Missing model or messages' });
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
  res.status(500).json({ error: 'Internal server error' });
});

function heavyComputation(iterations) {
  let sum = 0;
  for (let i = 0; i < iterations; i++) {
    sum += Math.sqrt(i) * Math.sin(i * 0.01);
  }
  return sum;
}

async function main() {
  const iterations = 100000;
  const runs = 10;
  const times = [];

  console.log('Running ' + runs + ' iterations...');
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    heavyComputation(iterations); // Compute without assigning unused variable
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
  // If no args, run benchmark
  if (process.argv.includes('--benchmark')) {
    main().then(r => { console.log('Results:', r); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
  } else if (process.argv.includes('--server')) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`One API Gateway listening on port ${PORT}`);
    });
  } else {
    // Original behavior default: run benchmark
    main().then(r => { console.log('Results:', r); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
  }
}

module.exports = { main, app };
