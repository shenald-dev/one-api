// Gateway API Key Authentication Middleware
const config = require('../config');

function authMiddleware(req, res, next) {
  // If no gateway API key is configured in env, allow open access (zero config)
  if (!config.apiKey) {
    return next();
  }

  // Bypass auth for health check and CORS preflight
  if (req.path === '/health' || req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      error: {
        message: 'Missing Authorization header. Pass Bearer <GATEWAY_API_KEY>.',
        type: 'invalid_request_error',
        param: null,
        code: 'invalid_api_key'
      }
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || parts[1] !== config.apiKey) {
    return res.status(401).json({
      error: {
        message: 'Incorrect API key provided.',
        type: 'invalid_request_error',
        param: null,
        code: 'invalid_api_key'
      }
    });
  }

  next();
}

module.exports = authMiddleware;
