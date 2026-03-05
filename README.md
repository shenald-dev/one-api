# ✨ One API

> ⚡ One API for 20+ LLM providers. OpenAI-compatible, single binary, runs forever.

## Features
- **🌐 Edge Ready**: Built on Hono.js for ultra-low latency. 
- **🛡️ Strict Typing**: Zod + OpenAPI specs automatically generated out of the box.
- **🔄 OpenAI Compatible**: Drop-in replacement for OpenAI endpoints (`/v1/chat/completions`).
- **🪶 Single Binary**: Dockerized to an Alpine container for lightweight deployments.

## Quick Start
```bash
npm install
npm run dev
```
```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

*Crafted by a Vibe Coder. No complex configurations.*
