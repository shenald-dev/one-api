// Standardized HTTP Error Middleware

function createErrorBuffer(message) {
  return Buffer.from(JSON.stringify({ error: message }));
}

const ERROR_INVALID_JSON = createErrorBuffer('Invalid JSON payload');
const ERROR_PAYLOAD_TOO_LARGE = createErrorBuffer('Payload too large');
const ERROR_UNSUPPORTED_MEDIA_TYPE = createErrorBuffer('Unsupported media type');
const ERROR_BAD_REQUEST = createErrorBuffer('Bad request');
const ERROR_NOT_FOUND = createErrorBuffer('Not found');
const ERROR_INTERNAL_SERVER = createErrorBuffer('Internal server error');

function clientErrorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).send(ERROR_INVALID_JSON);
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).send(ERROR_PAYLOAD_TOO_LARGE);
  }
  if (err.type === 'charset.unsupported' || err.type === 'encoding.unsupported') {
    return res.status(415).send(ERROR_UNSUPPORTED_MEDIA_TYPE);
  }
  if (err.type === 'request.aborted' || err.type === 'entity.parse.failed' || err.type === 'request.size.invalid') {
    return res.status(400).send(ERROR_BAD_REQUEST);
  }

  next(err);
}

function notFoundHandler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(404).send(ERROR_NOT_FOUND);
}

function genericErrorHandler(err, req, res, next) {
  console.error('Unhandled error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(err.status || 500).send(ERROR_INTERNAL_SERVER);
}

module.exports = {
  clientErrorHandler,
  notFoundHandler,
  genericErrorHandler
};
