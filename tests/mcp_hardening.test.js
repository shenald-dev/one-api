const { test } = require('node:test');
const assert = require('node:assert');
const { mcpServer } = require('../src/mcp/server.js');

test('MCP Hardening: tools/call handles execution failures gracefully with isError: true', async () => {
  // Calling a tool with invalid or missing required parameters
  const errorCallRes = await mcpServer.handleMessage({
    jsonrpc: '2.0',
    id: 501,
    method: 'tools/call',
    params: {
      name: 'oneapi_chat_completion',
      arguments: {
        // Missing messages array
        model: 'gpt-4o'
      }
    }
  });

  assert.strictEqual(errorCallRes.jsonrpc, '2.0');
  assert.strictEqual(errorCallRes.id, 501);
  assert.ok(errorCallRes.result);
  assert.strictEqual(errorCallRes.result.isError, true);
  assert.ok(errorCallRes.result.content[0].text.includes('Tool execution failed'));
  assert.ok(errorCallRes.result.content[0].text.includes('Missing required arguments'));
});

test('MCP Hardening: tools/call with unknown tool name returns isError: true', async () => {
  const unknownCallRes = await mcpServer.handleMessage({
    jsonrpc: '2.0',
    id: 502,
    method: 'tools/call',
    params: {
      name: 'non_existent_tool',
      arguments: {}
    }
  });

  assert.strictEqual(unknownCallRes.id, 502);
  assert.strictEqual(unknownCallRes.result.isError, true);
  assert.ok(unknownCallRes.result.content[0].text.includes('Unknown tool name'));
});
