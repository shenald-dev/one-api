// OpenAI-Compatible Models Catalog Handlers
const registry = require('../providers');

function handleListModels(req, res) {
  const models = registry.getUnifiedModelsList();
  res.status(200).json({
    object: 'list',
    data: models
  });
}

function handleGetModel(req, res) {
  const { model } = req.params;
  const models = registry.getUnifiedModelsList();
  const found = models.find(m => m.id === model || m.id.toLowerCase() === model.toLowerCase());

  if (!found) {
    return res.status(404).json({
      error: {
        message: `Model '${model}' not found in unified catalog.`,
        type: 'invalid_request_error',
        param: 'model',
        code: 'model_not_found'
      }
    });
  }

  res.status(200).json(found);
}

module.exports = {
  handleListModels,
  handleGetModel
};
