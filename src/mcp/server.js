// Model Context Protocol (MCP) Server for one-api
// Implements standard JSON-RPC 2.0 MCP protocol over Stdio and HTTP/SSE transports

const readline = require('readline');
const registry = require('../providers');
const aliasRegistry = require('../engine/aliases');
const guardrails = require('../engine/guardrails');
const { calculateCost } = require('../engine/cost');
const metrics = require('../middleware/metrics');
const { flightRecorder } = require('../engine/flight-recorder');

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = {
  name: 'one-api-mcp',
  version: '3.0.0'
};

const TOOLS = [
  {
    name: 'oneapi_chat_completion',
    description: 'Execute an LLM chat completion through one-api unified gateway with automatic routing, guardrails, and cost accounting.',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model name or alias (e.g. gpt-4o, claude-3-5-sonnet, fast, smart, reasoning, code)'
        },
        messages: {
          type: 'array',
          description: 'Array of chat message objects with role and content',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['system', 'user', 'assistant'] },
              content: { type: 'string' }
            },
            required: ['role', 'content']
          }
        },
        temperature: { type: 'number', description: 'Sampling temperature (0.0 to 2.0)' },
        max_tokens: { type: 'integer', description: 'Maximum tokens to generate' }
      },
      required: ['model', 'messages']
    }
  },
  {
    name: 'oneapi_list_models',
    description: 'List all registered upstream models, virtual aliases, and active provider routing status.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Optional search filter for model names' }
      }
    }
  },
  {
    name: 'oneapi_evaluate_guardrails',
    description: 'Scan text or prompt messages for sensitive data, API keys, credentials, PII, and prompt injection attempts.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text string to scan and evaluate' },
        action: { type: 'string', enum: ['redact', 'detect_only'], default: 'redact' }
      },
      required: ['text']
    }
  },
  {
    name: 'oneapi_calculate_cost',
    description: 'Calculate USD financial cost for prompt and completion tokens across any supported model.',
    inputSchema: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Model identifier' },
        prompt_tokens: { type: 'integer', description: 'Count of prompt tokens' },
        completion_tokens: { type: 'integer', description: 'Count of completion tokens' }
      },
      required: ['model', 'prompt_tokens', 'completion_tokens']
    }
  },
  {
    name: 'oneapi_inspect_gateway',
    description: 'Inspect live gateway metrics, active provider circuits, uptime, request volume, and cache health.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'oneapi_get_traces',
    description: 'Query recent incident flight recorder traces, error logs, and latency waterfall timings.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', default: 20 },
        errors_only: { type: 'boolean', default: false },
        model: { type: 'string' }
      }
    }
  }
];

const RESOURCES = [
  {
    uri: 'oneapi://models',
    name: 'Model Catalog',
    mimeType: 'application/json',
    description: 'List of all supported upstream models and virtual aliases'
  },
  {
    uri: 'oneapi://metrics',
    name: 'Gateway Metrics',
    mimeType: 'application/json',
    description: 'Current real-time throughput, token usage, and financial cost'
  },
  {
    uri: 'oneapi://circuits',
    name: 'Provider Circuit Breakers',
    mimeType: 'application/json',
    description: 'Live circuit breaker operational states across upstream providers'
  },
  {
    uri: 'oneapi://traces/recent',
    name: 'Recent Flight Recorder Traces',
    mimeType: 'application/json',
    description: 'Last recorded gateway flight traces and microsecond timings'
  }
];

const PROMPTS = [
  {
    name: 'summarize_incident',
    description: 'Analyze gateway error logs and circuit breaker trip reasons to suggest remediation.',
    arguments: [
      { name: 'trace_id', description: 'Trace ID of the failed request', required: true }
    ]
  },
  {
    name: 'optimize_model_choice',
    description: 'Recommend the optimal model given latency, cost, and capability requirements.',
    arguments: [
      { name: 'task_type', description: 'Type of task (e.g. reasoning, high_throughput, coding, vision)', required: true },
      { name: 'max_budget_usd', description: 'Maximum budget per 1000 requests', required: false }
    ]
  }
];

class MCPServer {
  constructor(options = {}) {
    this.options = options;
  }

  async handleMessage(msg) {
    if (!msg || typeof msg !== 'object') {
      return { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } };
    }

    const { id, method, params } = msg;

    // Handle notifications (no id)
    if (id === undefined || id === null) {
      if (method === 'notifications/initialized') {
        return null;
      }
      return null;
    }

    try {
      switch (method) {
        case 'initialize': {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: {
                tools: { listChanged: false },
                resources: { subscribe: false, listChanged: false },
                prompts: { listChanged: false }
              },
              serverInfo: SERVER_INFO
            }
          };
        }

        case 'ping': {
          return { jsonrpc: '2.0', id, result: {} };
        }

        case 'tools/list': {
          return {
            jsonrpc: '2.0',
            id,
            result: { tools: TOOLS }
          };
        }

        case 'tools/call': {
          try {
            const callResult = await this.executeTool(params?.name, params?.arguments || {});
            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: typeof callResult === 'string' ? callResult : JSON.stringify(callResult, null, 2)
                  }
                ],
                isError: false
              }
            };
          } catch (toolErr) {
            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `Tool execution failed: ${toolErr.message}`
                  }
                ],
                isError: true
              }
            };
          }
        }

        case 'resources/list': {
          return {
            jsonrpc: '2.0',
            id,
            result: { resources: RESOURCES }
          };
        }

        case 'resources/read': {
          const uri = params?.uri;
          const resourceData = await this.readResource(uri);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(resourceData, null, 2)
                }
              ]
            }
          };
        }

        case 'prompts/list': {
          return {
            jsonrpc: '2.0',
            id,
            result: { prompts: PROMPTS }
          };
        }

        case 'prompts/get': {
          const promptName = params?.name;
          const promptArgs = params?.arguments || {};
          const promptContent = this.getPrompt(promptName, promptArgs);
          return {
            jsonrpc: '2.0',
            id,
            result: promptContent
          };
        }

        default: {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${method}` }
          };
        }
      }
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: `Internal tool error: ${err.message}`
        }
      };
    }
  }

  async executeTool(name, args) {
    switch (name) {
      case 'oneapi_chat_completion': {
        const { model, messages, temperature, max_tokens } = args;
        if (!model || !Array.isArray(messages)) {
          throw new Error('Missing required arguments: model and messages array');
        }

        // Apply guardrails
        const { messages: sanitized, violations } = guardrails.processMessages(messages);
        const resolvedModel = aliasRegistry.resolve(model);
        const provider = registry.resolveProvider(resolvedModel);

        const result = await provider.complete({
          model: resolvedModel,
          messages: sanitized,
          temperature,
          max_tokens,
          id: `mcp-${Date.now()}`
        });

        const promptTok = result.usage?.prompt_tokens || 0;
        const compTok = result.usage?.completion_tokens || 0;
        const cost = calculateCost(resolvedModel, promptTok, compTok);

        return {
          model: resolvedModel,
          completion: result.choices?.[0]?.message?.content || '',
          tool_calls: result.choices?.[0]?.message?.tool_calls || null,
          usage: result.usage,
          cost_usd: cost.totalCost,
          guardrail_violations: violations
        };
      }

      case 'oneapi_list_models': {
        const active = registry.getActiveProviders();
        const aliases = aliasRegistry.getAllAliases();
        let models = [
          'gpt-4o', 'gpt-4o-mini', 'o1', 'o3',
          'claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus',
          'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash',
          'deepseek-chat', 'deepseek-reasoner',
          'llama-3.3-70b-versatile', 'mistral-large-latest'
        ];

        if (args.filter) {
          const filterLower = args.filter.toLowerCase();
          models = models.filter((m) => m.toLowerCase().includes(filterLower));
        }

        return {
          models,
          aliases,
          active_providers: active
        };
      }

      case 'oneapi_evaluate_guardrails': {
        const { text, action = 'redact' } = args;
        const scan = guardrails.scanText(text, { action });
        return {
          clean: scan.violations.length === 0,
          violations: scan.violations,
          redacted_text: scan.text
        };
      }

      case 'oneapi_calculate_cost': {
        const { model, prompt_tokens, completion_tokens } = args;
        return {
          model,
          prompt_tokens,
          completion_tokens,
          ...calculateCost(model, prompt_tokens, completion_tokens)
        };
      }

      case 'oneapi_inspect_gateway': {
        return {
          version: '3.0.0',
          uptime_seconds: Math.trunc(process.uptime()),
          active_providers: registry.getActiveProviders(),
          circuit_breakers: registry.getCircuitBreakerStatus(),
          telemetry: metrics.getSnapshot(),
          flight_stats: flightRecorder.getStats()
        };
      }

      case 'oneapi_get_traces': {
        const { limit = 20, errors_only = false, model } = args;
        return flightRecorder.query({ limit, errorsOnly: errors_only, model });
      }

      default:
        throw new Error(`Unknown tool name: ${name}`);
    }
  }

  async readResource(uri) {
    switch (uri) {
      case 'oneapi://models':
        return {
          aliases: aliasRegistry.getAllAliases(),
          active_providers: registry.getActiveProviders()
        };
      case 'oneapi://metrics':
        return metrics.getSnapshot();
      case 'oneapi://circuits':
        return registry.getCircuitBreakerStatus();
      case 'oneapi://traces/recent':
        return flightRecorder.query({ limit: 25 });
      default:
        throw new Error(`Resource not found for uri: ${uri}`);
    }
  }

  getPrompt(name, args) {
    switch (name) {
      case 'summarize_incident': {
        const trace = flightRecorder.getTrace(args.trace_id);
        return {
          description: `Analysis prompt for trace ${args.trace_id}`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Analyze the following one-api gateway incident trace and explain why it failed or degraded:\n\n${JSON.stringify(trace, null, 2)}`
              }
            }
          ]
        };
      }
      case 'optimize_model_choice': {
        return {
          description: `Model selection guidance for task: ${args.task_type}`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Given task requirements: ${args.task_type} (budget: ${args.max_budget_usd || 'flexible'}), recommend the top 2 models to route through one-api for optimal latency and cost.`
              }
            }
          ]
        };
      }
      default:
        throw new Error(`Unknown prompt template: ${name}`);
    }
  }

  startStdio() {
    // In stdio MCP mode, redirect standard console logging to stderr to prevent
    // corrupting the client's JSON-RPC stream on stdout
    console.log = (...args) => process.stderr.write(args.join(' ') + '\n');
    console.info = (...args) => process.stderr.write(args.join(' ') + '\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    rl.on('line', async (line) => {
      if (!line.trim()) return;
      try {
        const parsed = JSON.parse(line);
        const response = await this.handleMessage(parsed);
        if (response) {
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      } catch (err) {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: `Parse error: ${err.message}` }
          }) + '\n'
        );
      }
    });

    // Handle close
    rl.on('close', () => {
      process.exit(0);
    });
  }
}

const mcpServer = new MCPServer();

module.exports = {
  MCPServer,
  mcpServer,
  TOOLS,
  RESOURCES,
  PROMPTS
};
