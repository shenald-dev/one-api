#!/usr/bin/env node

const args = process.argv.slice(2);
const command = args[0] || '';

if (args.includes('-v') || args.includes('--version')) {
  const pkg = require('../package.json');
  console.log(`one-api v${pkg.version}`);
  process.exit(0);
}

if (args.includes('-h') || args.includes('--help')) {
  console.log(`
🌌 one-api — Universal Edge LLM Gateway & Distributed Agent Runtime

Usage:
  npx @shenald/one-api [command] [options]
  one-api [command] [options]

Commands:
  start              Launch gateway server (default)
  mcp                Launch Model Context Protocol (MCP) server on stdio
  chat [model]       Launch interactive multi-model terminal REPL
  doctor             Run environment, network & health diagnostics
  benchmark          Run empirical performance benchmark suite

Options:
  --port <number>    Port to listen on (default: 3000 or process.env.PORT)
  --server           Start in server mode
  --mcp              Start stdio MCP server
  --doctor           Run system doctor diagnostics
  --benchmark        Run latency and throughput benchmarks
  -v, --version      Show version
  -h, --help         Show this help message

Endpoints:
  POST /v1/chat/completions   OpenAI-compatible chat completions & SSE streaming
  POST /v1/embeddings         OpenAI-compatible dense vector embeddings
  GET/POST /v1/mcp            Model Context Protocol (MCP) HTTP/SSE server
  GET  /v1/traces             Deterministic flight recorder distributed traces
  GET  /v1/models             List unified catalog of models & virtual aliases
  GET  /v1/metrics            Gateway telemetry & latency metrics
  GET  /dashboard             Cyberpunk edge monitoring dashboard
  GET  /health                Zero-overhead load balancer health probe
`);
  process.exit(0);
}

// Parse custom port if provided
const portIndex = args.indexOf('--port');
if (portIndex !== -1 && args[portIndex + 1]) {
  process.env.PORT = args[portIndex + 1];
}

// Dispatch to src/index.js with appropriate arguments
require('../src/index.js');
