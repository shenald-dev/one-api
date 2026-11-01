// Centralized Gateway Configuration
require('dotenv').config();

const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  isCompressionEnabled: () => process.env.ENABLE_COMPRESSION !== 'false',

  // Gateway Auth & Security
  apiKey: process.env.ONE_API_KEY || process.env.GATEWAY_API_KEY || '',
  allowedOrigins: process.env.ALLOWED_ORIGINS || '',
  maxPayloadSize: process.env.MAX_PAYLOAD_SIZE || '512kb',
  maxMessagesCount: parseInt(process.env.MAX_MESSAGES_COUNT || '1000', 10),
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '60000', 10),

  // Rate Limiting
  rateLimitRPM: parseInt(process.env.RATE_LIMIT_RPM || '0', 10), // 0 = disabled

  // In-Memory Response Caching
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
    maxEntries: parseInt(process.env.CACHE_MAX_ENTRIES || '1000', 10)
  },

  // Upstream Providers
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      baseUrl: (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1').replace(/\/+$/, ''),
      apiVersion: process.env.ANTHROPIC_VERSION || '2023-06-01'
    },
    gemini: {
      apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '',
      baseUrl: (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '')
    },
    ollama: {
      baseUrl: (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '')
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '')
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY || '',
      baseUrl: (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, '')
    },
    mistral: {
      apiKey: process.env.MISTRAL_API_KEY || '',
      baseUrl: (process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai/v1').replace(/\/+$/, '')
    },
    together: {
      apiKey: process.env.TOGETHER_API_KEY || '',
      baseUrl: (process.env.TOGETHER_BASE_URL || 'https://api.together.xyz/v1').replace(/\/+$/, '')
    }
  }
};

module.exports = config;
