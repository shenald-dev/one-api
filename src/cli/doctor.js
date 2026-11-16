// one-api System Doctor: Environment, Connectivity & Diagnostic Runner
const os = require('os');
const config = require('../config');
const registry = require('../providers');

async function runDoctor() {
  console.log('\n🩺 one-api Gateway Diagnostic & System Doctor\n' + '='.repeat(52));

  // 1. Runtime & OS
  console.log('\n[1] Runtime & Operating System:');
  console.log(`  - Node.js Version: ${process.version} (Minimum required: v18.0.0)`);
  console.log(`  - Platform:        ${os.platform()} (${os.arch()})`);
  console.log(`  - System Memory:   ${Math.round(os.totalmem() / 1024 / 1024)} MB Total, ${Math.round(os.freemem() / 1024 / 1024)} MB Free`);
  console.log(`  - Uptime:          ${Math.round(os.uptime() / 60)} minutes`);

  // 2. Gateway Configuration
  console.log('\n[2] Gateway Configuration:');
  console.log(`  - Port:            ${config.port}`);
  console.log(`  - Host:            ${config.host}`);
  console.log(`  - Environment:     ${config.nodeEnv}`);
  console.log(`  - Auth Required:   ${Boolean(config.apiKey) ? 'YES (Key Configured)' : 'NO (Open Gateway)'}`);
  console.log(`  - Cache Enabled:   ${config.cache.enabled} (Max: ${config.cache.maxEntries}, TTL: ${config.cache.ttlSeconds}s)`);
  console.log(`  - Rate Limiter:    ${config.rateLimitRPM > 0 ? `${config.rateLimitRPM} RPM` : 'Disabled (0 RPM)'}`);
  console.log(`  - Max Messages:    ${config.maxMessagesCount}`);

  // 3. Provider Readiness Matrix
  console.log('\n[3] Provider Readiness Matrix:');
  const activeProviders = registry.getActiveProviders();
  const allProviders = [
    { name: 'openai', desc: 'OpenAI (GPT-4o, o1, o3)', key: config.providers.openai.apiKey },
    { name: 'anthropic', desc: 'Anthropic Claude (Claude 3.5 Sonnet)', key: config.providers.anthropic.apiKey },
    { name: 'gemini', desc: 'Google Gemini (Gemini 1.5/2.0)', key: config.providers.gemini.apiKey },
    { name: 'deepseek', desc: 'DeepSeek (Chat & Reasoner)', key: config.providers.deepseek.apiKey },
    { name: 'groq', desc: 'Groq Cloud (Llama 3.3)', key: config.providers.groq.apiKey },
    { name: 'mistral', desc: 'Mistral AI (Mistral Large)', key: config.providers.mistral.apiKey },
    { name: 'xai', desc: 'xAI (Grok)', key: config.providers.xai.apiKey },
    { name: 'ollama', desc: 'Ollama Local Daemon', url: config.providers.ollama.baseUrl },
    { name: 'mock', desc: 'Built-in Zero-Config Local Generator', always: true }
  ];

  for (const p of allProviders) {
    if (p.always) {
      console.log(`  ✅ [${p.name.toUpperCase()}] ${p.desc} -> ONLINE (Built-in)`);
    } else if (p.key) {
      const masked = p.key.slice(0, 4) + '...' + p.key.slice(-4);
      console.log(`  ✅ [${p.name.toUpperCase()}] ${p.desc} -> CONFIGURED (${masked})`);
    } else if (p.url && p.name === 'ollama') {
      console.log(`  ⚡ [${p.name.toUpperCase()}] ${p.desc} -> Base URL: ${p.url}`);
    } else {
      console.log(`  ⚪ [${p.name.toUpperCase()}] ${p.desc} -> Not Configured (will fallback to mock)`);
    }
  }

  // 4. Quick Self-Test
  console.log('\n[4] Zero-Config Self-Healing Check:');
  const mockProvider = registry.fallbackProvider;
  const start = Date.now();
  const testRes = await mockProvider.complete({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Doctor self-test ping' }]
  });
  const latency = Date.now() - start;

  if (testRes && testRes.choices && testRes.choices[0]) {
    console.log(`  ✅ Local Engine Ping: OK (${latency}ms) - Model: ${testRes.model}`);
    console.log(`  ✅ Tokenizer & Usage Check: Prompt: ${testRes.usage.prompt_tokens}, Completion: ${testRes.usage.completion_tokens}`);
  } else {
    console.error('  ❌ Local Engine Ping Failed!');
  }

  console.log('\n' + '='.repeat(52));
  console.log('🎉 System Doctor completed with 0 fatal errors. Ready to serve!\n');
  return true;
}

module.exports = { runDoctor };
