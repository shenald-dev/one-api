#!/usr/bin/env node

const args = process.argv.slice(2);

if (args.includes('-v') || args.includes('--version')) {
  const pkg = require('../package.json');
  console.log(`one-api v${pkg.version}`);
  process.exit(0);
}

if (args.includes('-h') || args.includes('--help')) {
  console.log(`
🌌 one-api — Universal Edge LLM Gateway for 20+ Providers

Usage:
  npx @shenald/one-api [options]
  one-api [options]

Commands & Options:
  --port <number>    Port to listen on (default: 3000 or process.env.PORT)
  --benchmark        Run performance latency benchmark
  -v, --version      Show version
  -h, --help         Show this help message

Endpoints:
  POST /v1/chat/completions   OpenAI-compatible chat completions
  POST /v1/embeddings         OpenAI-compatible embeddings
  GET  /v1/models             List active models & aliases
  GET  /v1/metrics            Gateway telemetry & latency metrics
  GET  /dashboard             Real-time visual monitoring dashboard
  GET  /health                Health probe endpoint
`);
  process.exit(0);
}

// Parse custom port if provided
const portIndex = args.indexOf('--port');
if (portIndex !== -1 && args[portIndex + 1]) {
  process.env.PORT = args[portIndex + 1];
}

// If --benchmark flag is passed, run benchmark without --server
if (args.includes('--benchmark')) {
  require('../src/index.js');
} else {
  // Default action when running npx one-api or one-api is to launch the server
  if (!process.argv.includes('--server')) {
    process.argv.push('--server');
  }
  require('../src/index.js');
}
