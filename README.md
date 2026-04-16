# one-api

> **One API to rule them all.**  
> Unify OpenAI, Anthropic, Google, DeepSeek, and more behind a single endpoint.

---

## ✨ What is this?

A dead-simple, single-binary gateway that turns **dozens of LLM providers** into one clean API.  
Run it once, forget about provider differences. Keys, models, endpoints — all abstracted.

**Why?** Because juggling multiple SDKs and API formats is a pain.  
This just works.

---

## 🚀 Quick Start

```bash
# 1️⃣ Clone & install
git clone https://github.com/shenald-dev/one-api
cd one-api
npm install

# 2️⃣ Configure (copy .env.example → .env and add your keys)
cp .env.example .env
# Edit .env with your provider API keys

# 3️⃣ Run
npm start

# 4️⃣ Use
curl -H "Content-Type: application/json" \
     -d '{"model":"gpt-4","messages":[{"role":"user","content":"Hello!"}]}' \
     http://localhost:3000/v1/chat/completions
```

That's it. Your app now talks to **any** LLM provider through the same `/v1` OpenAI-compatible interface.

---

## 🧠 Supported Providers

- OpenAI
- Anthropic Claude
- Google Gemini
- Azure OpenAI
- DeepSeek
- Groq
- Together AI
- Mistral AI
- Local inference (Ollama, LM Studio)
- +20 more...

---

## 📦 Docker (recommended)

```bash
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e OPENAI_API_KEY=sk-... \
  -e ANTHROPIC_API_KEY=sk-... \
  shenald/one-api:latest
```

Single command, up forever.

---

## ⚙️ Configuration

Environment variables in `.env`:

```bash
# Port
PORT=3000

# Security
# Set a comma-separated list of allowed origins for CORS. Defaults to '*' (all origins) if unset.
# Examples: "http://localhost:3000, https://myapp.com" or "*"
# Note: If set to an empty string or whitespace-only, ALL origins will be blocked.
ALLOWED_ORIGINS=*

# Add any provider keys you need
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
GOOGLE_API_KEY=...
DEEPSEEK_API_KEY=...
# ... see .env.example for full list
```

No database, no migrations. JSON file storage. Just run.

---

## 📈 Why this over alternatives?

- **Zero config** — starts, works, stays
- **Single binary** — no Node, no Python, just `npm i && npm start` or Docker
- **OpenAI-compatible** — your existing code works unchanged
- **Lightweight** — no admin UI bloat, just the API
- **Fast** — response compression built-in for reduced bandwidth and lower latency
- **Free & open** — MIT license, no SaaS tier

---

## 🛠️ Development

```bash
# Install deps
npm install

# Run dev with hot reload
npm run dev

# Test
npm test

# Build Docker image
docker build -t shenald/one-api .
```

---

## 📄 License

MIT — do whatever you want.

---

## 🙋‍♂️ About

Built by a vibe coder who got tired of rewriting integrations.  
If it's useful, star it ⭐ — if not, open an issue and tell me why.

**Keep it simple.** 🧘
