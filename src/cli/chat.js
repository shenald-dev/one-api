// one-api Interactive Terminal REPL & Multi-Model Chat TUI
const readline = require('readline');
const registry = require('../providers');
const aliasRegistry = require('../engine/aliases');
const { calculateCost } = require('../engine/cost');
const guardrails = require('../engine/guardrails');

async function runChat(initialModel = 'smart') {
  let currentModel = initialModel;
  const conversation = [];

  console.log('\n' + '='.repeat(60));
  console.log('💬 one-api Interactive Multi-Model Terminal REPL');
  console.log(`Active Model: [${currentModel}] (Resolved: ${aliasRegistry.resolve(currentModel)})`);
  console.log('Commands:');
  console.log('  /model <name>  - Switch target model (e.g. gpt-4o, claude-3-5-sonnet, fast, reasoning)');
  console.log('  /models        - List common models and aliases');
  console.log('  /clear         - Clear conversation history');
  console.log('  /exit          - Exit the chat session');
  console.log('='.repeat(60) + '\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `one-api [${currentModel}]> `
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === '/exit' || input === '/quit') {
      console.log('Exiting one-api chat. Goodbye!\n');
      process.exit(0);
    }

    if (input === '/clear') {
      conversation.length = 0;
      console.log('🧹 Conversation history cleared.\n');
      rl.prompt();
      return;
    }

    if (input.startsWith('/model ')) {
      const newModel = input.slice(7).trim();
      if (newModel) {
        currentModel = newModel;
        console.log(`Switched model to: [${currentModel}] (Resolved: ${aliasRegistry.resolve(currentModel)})\n`);
        rl.setPrompt(`one-api [${currentModel}]> `);
      }
      rl.prompt();
      return;
    }

    if (input === '/models') {
      console.log('\nAvailable Virtual Aliases:');
      const aliases = aliasRegistry.getAllAliases();
      for (const [alias, target] of Object.entries(aliases)) {
        console.log(`  - ${alias.padEnd(12)} -> ${target}`);
      }
      console.log('\nPopular Provider Models:');
      console.log('  - gpt-4o, gpt-4o-mini, o1, o3 (OpenAI)');
      console.log('  - claude-3-5-sonnet, claude-3-5-haiku (Anthropic)');
      console.log('  - gemini-1.5-pro, gemini-2.0-flash (Google)');
      console.log('  - deepseek-chat, deepseek-reasoner (DeepSeek)');
      console.log('  - llama-3.3-70b-versatile (Groq)\n');
      rl.prompt();
      return;
    }

    // User message
    conversation.push({ role: 'user', content: input });

    try {
      const resolved = aliasRegistry.resolve(currentModel);
      const provider = registry.resolveProvider(resolved);

      process.stdout.write(`\n🤖 [${resolved}] generating: `);
      const start = Date.now();

      const { messages: sanitized, violations } = guardrails.processMessages(conversation);
      if (violations.length > 0) {
        console.log(`\n⚠️ Guardrail Alert: Detected ${violations.join(', ')}`);
      }

      const response = await provider.complete({
        model: resolved,
        messages: sanitized,
        id: `cli-${Date.now()}`
      });

      const elapsed = Date.now() - start;
      const content = response.choices?.[0]?.message?.content || 'No response';
      const promptTok = response.usage?.prompt_tokens || 0;
      const compTok = response.usage?.completion_tokens || 0;
      const cost = calculateCost(resolved, promptTok, compTok);

      console.log(content);
      console.log(`\n⏱️ Latency: ${elapsed}ms | 📊 Tokens: ${promptTok} prompt, ${compTok} completion | 💰 Cost: $${cost.totalCost.toFixed(6)}\n`);

      conversation.push({ role: 'assistant', content });
    } catch (err) {
      console.error(`\n❌ Error: ${err.message}\n`);
    }

    rl.prompt();
  });
}

module.exports = { runChat };
