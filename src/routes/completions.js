// OpenAI-Compatible Chat Completions Route
const crypto = require('crypto');
const config = require('../config');
const registry = require('../providers');
const metrics = require('../middleware/metrics');
const ResponseCache = require('../engine/cache');
const RateLimiter = require('../engine/ratelimit');
const { initSSE, formatOpenAIChunk, sendSSEChunk, sendSSEDone } = require('../engine/sse');

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
    (typeof msg.content === 'string' || Array.isArray(msg.content))
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

  const model = body.model;
  const messages = body.messages;

  if (!isValidModel(model)) {
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
  const clientId = req.ip || req.headers['x-forwarded-for'] || 'anonymous';
  if (rateLimiter.isRateLimited(clientId)) {
    return res.status(429).send(ERROR_RATE_LIMITED);
  }

  // Generate unique completion ID
  if (reqIdCounter >= Number.MAX_SAFE_INTEGER) {
    reqIdCounter = 0;
  }
  const id = reqIdPrefix + (reqIdCounter++);
  const isStream = Boolean(body.stream);

  // Cache Check
  if (config.cache.enabled && !isStream && req.headers['x-cache-bypass'] !== 'true') {
    const cacheKey = cache.generateKey(model, messages, body);
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cachedResponse);
    }
    res.setHeader('X-Cache', 'MISS');
  }

  try {
    const provider = registry.resolveProvider(model);

    if (isStream) {
      initSSE(res);

      const abortController = new AbortController();
      req.on('close', () => abortController.abort());

      await provider.stream(
        { ...body, id },
        (chunk) => sendSSEChunk(res, chunk),
        abortController.signal
      );

      sendSSEDone(res);
    } else {
      const responseData = await provider.complete({ ...body, id });

      // Record tokens in telemetry
      if (responseData.usage) {
        metrics.recordTokens(responseData.usage.prompt_tokens, responseData.usage.completion_tokens);
      }

      // Store in Cache if enabled
      if (config.cache.enabled) {
        const cacheKey = cache.generateKey(model, messages, body);
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
