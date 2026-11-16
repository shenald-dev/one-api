// MCP HTTP & SSE Transport Router
const { mcpServer } = require('../mcp/server');
const { initSSE } = require('../engine/sse');

// Active SSE client connections
const sseClients = new Set();

function handleMcpSse(req, res) {
  initSSE(res);
  sseClients.add(res);

  // Send initial endpoint event
  res.write(`event: endpoint\ndata: ${JSON.stringify({ endpoint: '/mcp/messages' })}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
}

async function handleMcpJsonRpc(req, res) {
  const body = req.body;
  if (!body) {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error: Missing body' }
    });
  }

  const response = await mcpServer.handleMessage(body);

  // If client wants notification broadcasts, push to SSE clients
  if (response && sseClients.size > 0 && body.method && body.method.startsWith('notifications/')) {
    const chunk = `event: message\ndata: ${JSON.stringify(response)}\n\n`;
    for (const client of sseClients) {
      client.write(chunk);
    }
  }

  if (response === null) {
    return res.status(204).end();
  }

  return res.status(200).json(response);
}

module.exports = {
  handleMcpSse,
  handleMcpJsonRpc
};
