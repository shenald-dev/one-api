// Server-Sent Events (SSE) Protocol Engine for Streaming LLM Completions

function initSSE(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }
}

function formatOpenAIChunk(id, model, deltaContent = '', finishReason = null, usage = null) {
  const created = Math.trunc(Date.now() / 1000);
  const chunk = {
    id: `chatcmpl-${id}`,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [
      {
        index: 0,
        delta: deltaContent ? { content: deltaContent } : {},
        finish_reason: finishReason
      }
    ]
  };

  if (usage) {
    chunk.usage = usage;
  }

  return `data: ${JSON.stringify(chunk)}\n\n`;
}

function sendSSEChunk(res, chunkString) {
  if (!res.writableEnded) {
    res.write(chunkString);
  }
}

function sendSSEDone(res) {
  if (!res.writableEnded) {
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

function sendSSEHeartbeat(res) {
  if (!res.writableEnded) {
    res.write(': keepalive\n\n');
  }
}

module.exports = {
  initSSE,
  formatOpenAIChunk,
  sendSSEChunk,
  sendSSEDone,
  sendSSEHeartbeat
};
