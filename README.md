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

## 🤝 Contributing
Help us build the ultimate universal API gateway! 🌍
- 🐛 **Found a bug?** Open an issue to let us know.
- ✨ **Have a feature idea?** We are open to PRs! Just make sure to run `npm run build` and keep the edge runtime clean.
- 🎨 **Documentation tweaks?** Always welcome!

*Crafted by a Vibe Coder. No complex configurations.*
