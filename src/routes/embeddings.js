// OpenAI-Compatible Embeddings Route
const embeddingsEngine = require('../providers/embeddings');
const metrics = require('../middleware/metrics');

async function handleEmbeddings(req, res, next) {
  const body = req.body;
  if (!body || (!body.input && body.input !== '')) {
    return res.status(400).json({
      error: {
        message: "Missing required parameter 'input'.",
        type: 'invalid_request_error',
        param: 'input',
        code: 'missing_required_parameter'
      }
    });
  }

  if (body.dimensions !== undefined && (typeof body.dimensions !== 'number' || body.dimensions > 10000 || body.dimensions < 1)) {
    return res.status(400).json({
      error: {
        message: "Invalid 'dimensions'. Must be an integer between 1 and 10000.",
        type: 'invalid_request_error',
        param: 'dimensions',
        code: 'invalid_parameter'
      }
    });
  }

  const model = body.model || 'text-embedding-3-small';

  try {
    const result = await embeddingsEngine.createEmbeddings({
      model,
      input: body.input,
      dimensions: body.dimensions
    });

    if (result.usage?.prompt_tokens) {
      metrics.recordTokens(result.usage.prompt_tokens, 0);
    }

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleEmbeddings
};
