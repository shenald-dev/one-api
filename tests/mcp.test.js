const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../src/index.js');
const { mcpServer, TOOLS, RESOURCES, PROMPTS } = require('../src/mcp/server.js');

test('MCP: initialize method returns protocol capabilities and server info', async () => {
  const initMsg = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    }
  };

  const response = await mcpServer.handleMessage(initMsg);
  assert.strictEqual(response.jsonrpc, '2.0');
  assert.strictEqual(response.id, 1);
  assert.strictEqual(response.result.protocolVersion, '2024-11-05');
  assert.strictEqual(response.result.serverInfo.name, 'one-api-mcp');
  assert.strictEqual(response.result.serverInfo.version, '3.0.0');
  assert.ok(response.result.capabilities.tools);
  assert.ok(response.result.capabilities.resources);
  assert.ok(response.result.capabilities.prompts);
});

test('MCP: ping and notifications return expected results', async () => {
  const pingRes = await mcpServer.handleMessage({ jsonrpc: '2.0', id: 2, method: 'ping' });
  assert.strictEqual(pingRes.id, 2);
  assert.deepStrictEqual(pingRes.result, {});

  // notifications have no id and return null
  const notifRes = await mcpServer.handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.strictEqual(notifRes, null);
});

test('MCP: tools/list returns complete tool catalog', async () => {
  const res = await mcpServer.handleMessage({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
  assert.strictEqual(res.id, 3);
  assert.ok(Array.isArray(res.result.tools));
  assert.strictEqual(res.result.tools.length, TOOLS.length);

  const toolNames = res.result.tools.map((t) => t.name);
  assert.ok(toolNames.includes('oneapi_chat_completion'));
  assert.ok(toolNames.includes('oneapi_list_models'));
  assert.ok(toolNames.includes('oneapi_evaluate_guardrails'));
  assert.ok(toolNames.includes('oneapi_calculate_cost'));
  assert.ok(toolNames.includes('oneapi_inspect_gateway'));
  assert.ok(toolNames.includes('oneapi_get_traces'));
});

test('MCP: tools/call executes oneapi_calculate_cost correctly', async () => {
  const res = await mcpServer.handleMessage({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'oneapi_calculate_cost',
      arguments: {
        model: 'gpt-4o',
        prompt_tokens: 1000,
        completion_tokens: 500
      }
    }
  });

  assert.strictEqual(res.id, 4);
  assert.strictEqual(res.result.isError, false);
  const data = JSON.parse(res.result.content[0].text);
  assert.strictEqual(data.model, 'gpt-4o');
  assert.ok(data.totalCost > 0);
});

test('MCP: tools/call executes oneapi_evaluate_guardrails correctly', async () => {
  const res = await mcpServer.handleMessage({
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'oneapi_evaluate_guardrails',
      arguments: {
        text: 'Hello, here is my AWS secret: AKIAIOSFODNN7EXAMPLE and SSN 123-45-6789'
      }
    }
  });

  assert.strictEqual(res.id, 5);
  const data = JSON.parse(res.result.content[0].text);
  assert.strictEqual(data.clean, false);
  assert.ok(data.violations.includes('AWS_KEY'));
  assert.ok(data.violations.includes('SSN'));
  assert.ok(data.redacted_text.includes('[REDACTED_AWS_KEY]'));
  assert.ok(data.redacted_text.includes('[REDACTED_SSN]'));
});

test('MCP: tools/call executes oneapi_chat_completion via local engine', async () => {
  const res = await mcpServer.handleMessage({
    jsonrpc: '2.0',
    id: 6,
    method: 'tools/call',
    params: {
      name: 'oneapi_chat_completion',
      arguments: {
        model: 'fast',
        messages: [{ role: 'user', content: 'What is the capital of France?' }]
      }
    }
  });

  assert.strictEqual(res.id, 6);
  const data = JSON.parse(res.result.content[0].text);
  assert.ok(data.completion);
  assert.ok(data.usage.total_tokens > 0);
});

test('MCP: resources/list and resources/read return accurate gateway state', async () => {
  const listRes = await mcpServer.handleMessage({ jsonrpc: '2.0', id: 7, method: 'resources/list' });
  assert.ok(Array.isArray(listRes.result.resources));

  const readRes = await mcpServer.handleMessage({
    jsonrpc: '2.0',
    id: 8,
    method: 'resources/read',
    params: { uri: 'oneapi://metrics' }
  });

  assert.strictEqual(readRes.id, 8);
  const data = JSON.parse(readRes.result.contents[0].text);
  assert.ok(data.uptime_seconds >= 0);
  assert.ok(data.requests);
});

test('MCP: prompts/list and prompts/get generate valid prompt structures', async () => {
  const listRes = await mcpServer.handleMessage({ jsonrpc: '2.0', id: 9, method: 'prompts/list' });
  assert.strictEqual(listRes.result.prompts.length, PROMPTS.length);

  const getRes = await mcpServer.handleMessage({
    jsonrpc: '2.0',
    id: 10,
    method: 'prompts/get',
    params: {
      name: 'optimize_model_choice',
      arguments: { task_type: 'coding', max_budget_usd: '0.01' }
    }
  });

  assert.strictEqual(getRes.id, 10);
  assert.ok(getRes.result.messages[0].content.text.includes('coding'));
});

test('MCP: HTTP transport endpoints POST /mcp and POST /v1/mcp work', async () => {
  const res = await request(app)
    .post('/v1/mcp')
    .send({
      jsonrpc: '2.0',
      id: 99,
      method: 'tools/list'
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.jsonrpc, '2.0');
  assert.strictEqual(res.body.id, 99);
  assert.ok(Array.isArray(res.body.result.tools));
});
