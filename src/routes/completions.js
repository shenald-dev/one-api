// OpenAI-Compatible Chat Completions Route with Fallbacks, Circuit Breakers, Guardrails & Cost Headers
const crypto = require('crypto');
const config = require('../config');
const registry = require('../providers');
const metrics = require('../middleware/metrics');
const ResponseCache = require('../engine/cache');
const RateLimiter = require('../engine/ratelimit');
const { initSSE, sendSSEChunk, sendSSEDone } = require('../engine/sse');
const aliasRegistry = require('../engine/aliases');
const guardrails = require('../engine/guardrails');
const { circuitBreaker, DEFAULT_FALLBACKS } = require('../engine/resilience');
const { calculateCost } = require('../engine/cost');

// Validation helpers
function isValidModel(model) {
  return typeof model === 'string' && model.length < 1000 && model.trim() !== '';
}

function isValidMessagesArray(messages) {
  return Array.isArray(messages) && messages.length > 0;
}

function isValidMessage(msg) {
  return (
    msg != null &&
    typeof msg.role === 'string' &&
    msg.role.trim() !== '' &&
    (typeof msg.content === 'string' ||
      Array.isArray(msg.content) ||
      (msg.role === 'assistant' && msg.content === null && Array.isArray(msg.tool_calls)))
  );
}

function createErrorBuffer(message) {
  return Buffer.from(JSON.stringify({ error: message }));
}

const ERROR_MISSING_MODEL = createErrorBuffer('Missing or invalid model');
const ERROR_MISSING_MESSAGES = createErrorBuffer('Missing or invalid messages');
const ERROR_TOO_MANY_MESSAGES = createErrorBuffer('Too many messages');
const ERROR_MALFORMED_MESSAGE = createErrorBuffer('Malformed message object');
const ERROR_RATE_LIMITED = createErrorBuffer('Rate limit exceeded. Please retry later.');

// Fast ID Generator
let reqIdCounter = 0;
const reqIdPrefix = crypto.randomBytes(16).toString('hex');

// In-Memory Cache and Rate Limiter Instances
const cache = new ResponseCache({
  maxEntries: config.cache.maxEntries,
  ttlSeconds: config.cache.ttlSeconds
});

const rateLimiter = new RateLimiter(config.rateLimitRPM);

async function handleChatCompletions(req, res, next) {
  const body = req.body;
  if (!body) {
    return res.status(400).send(ERROR_MISSING_MODEL);
  }

  const rawModel = body.model;
  let messages = body.messages;

  if (!isValidModel(rawModel)) {
    return res.status(400).send(ERROR_MISSING_MODEL);
  }
  if (!isValidMessagesArray(messages)) {
    return res.status(400).send(ERROR_MISSING_MESSAGES);
  }

  const messagesLen = messages.length;
  if (messagesLen > config.maxMessagesCount) {
    return res.status(400).send(ERROR_TOO_MANY_MESSAGES);
  }

  for (let i = 0; i < messagesLen; i++) {
    if (!isValidMessage(messages[i])) {
      return res.status(400).send(ERROR_MALFORMED_MESSAGE);
    }
  }

  // Rate Limiting
  const clientId = req.ip || 'anonymous';
  if (rateLimiter.isRateLimited(clientId)) {
    return res.status(429).send(ERROR_RATE_LIMITED);
  }

  // Guardrails: PII & Sensitive Credential Redaction / Safety
  try {
    const guardrailResult = guardrails.processMessages(messages);
    messages = guardrailResult.messages;
    if (guardrailResult.violations.length > 0) {
      res.setHeader('X-Guardrails-Violated', 'true');
    }
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  // Resolve virtual model aliases (e.g. 'fast' -> 'gpt-4o-mini')
  const resolvedModel = aliasRegistry.resolve(rawModel);

  // Generate unique completion ID
  if (reqIdCounter >= Number.MAX_SAFE_INTEGER) {
    reqIdCounter = 0;
  }
  const id = reqIdPrefix + (reqIdCounter++);
  const isStream = Boolean(body.stream);

  // Cache Check
  if (config.cache.enabled && !isStream && req.headers['x-cache-bypass'] !== 'true') {
    const cacheKey = cache.generateKey(resolvedModel, messages, body);
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cachedResponse);
    }
    res.setHeader('X-Cache', 'MISS');
  }

  try {
    let targetModel = resolvedModel;
    let provider = registry.resolveProvider(targetModel);
    let fallbackApplied = false;

    // Check circuit breaker
    if (circuitBreaker.isOpen(provider.name)) {
      // Find fallback model if circuit is open
      const fallbacks = DEFAULT_FALLBACKS[targetModel] || [];
      for (const candidate of fallbacks) {
        const candidateProvider = registry.resolveProvider(candidate);
        if (!circuitBreaker.isOpen(candidateProvider.name)) {
          provider = candidateProvider;
          targetModel = candidate;
          fallbackApplied = true;
          break;
        }
      }
    }

    if (isStream) {
      initSSE(res);

      const abortController = new AbortController();
      req.on('close', () => abortController.abort());

      try {
        await provider.stream(
          { ...body, model: targetModel, messages, id },
          (chunk) => sendSSEChunk(res, chunk),
          abortController.signal
        );
        circuitBreaker.recordSuccess(provider.name);
      } catch (streamErr) {
        circuitBreaker.recordFailure(provider.name, streamErr);
        throw streamErr;
      }

      sendSSEDone(res);
    } else {
      let responseData;
      try {
        responseData = await provider.complete({ ...body, model: targetModel, messages, id });
        circuitBreaker.recordSuccess(provider.name);
      } catch (err) {
        circuitBreaker.recordFailure(provider.name, err);

        // Attempt fallback execution on retryable error
        const fallbacks = DEFAULT_FALLBACKS[targetModel] || [];
        let fallbackSuccess = false;

        for (const candidate of fallbacks) {
          const candidateProvider = registry.resolveProvider(candidate);
          if (!circuitBreaker.isOpen(candidateProvider.name)) {
            try {
              responseData = await candidateProvider.complete({ ...body, model: candidate, messages, id });
              circuitBreaker.recordSuccess(candidateProvider.name);
              targetModel = candidate;
              fallbackApplied = true;
              fallbackSuccess = true;
              break;
            } catch (fallbackErr) {
              circuitBreaker.recordFailure(candidateProvider.name, fallbackErr);
            }
          }
        }

        if (!fallbackSuccess) {
          throw err;
        }
      }

      // Preserve requested model name in response if alias was used
      if (rawModel !== targetModel && !fallbackApplied) {
        responseData.model = rawModel;
      }

      // Record tokens & compute cost
      let promptTokens = responseData.usage?.prompt_tokens || 0;
      let completionTokens = responseData.usage?.completion_tokens || 0;
      const costInfo = calculateCost(targetModel, promptTokens, completionTokens);

      if (responseData.usage) {
        metrics.recordTokens(promptTokens, completionTokens, costInfo.totalCost);
      }

      // Headers
      res.setHeader('X-Served-By-Model', targetModel);
      res.setHeader('X-Token-Cost-USD', String(costInfo.totalCost));
      if (fallbackApplied) {
        res.setHeader('X-Fallback-Applied', 'true');
      }

      // Store in Cache if enabled
      if (config.cache.enabled) {
        const cacheKey = cache.generateKey(resolvedModel, messages, body);
        cache.set(cacheKey, responseData);
      }

      res.status(200).json(responseData);
    }
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleChatCompletions,
  isValidModel,
  isValidMessagesArray,
  isValidMessage,
  cache,
  rateLimiter
};
