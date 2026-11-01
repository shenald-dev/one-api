// Health and Telemetry Metrics Handlers
const metrics = require('../middleware/metrics');
const registry = require('../providers');
const packageJson = require('../../package.json');

const HEALTH_PAYLOAD = Buffer.from(JSON.stringify({ status: 'ok' }));

function handleHealth(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).send(HEALTH_PAYLOAD);
}

function handleDetailedHealth(req, res) {
  res.status(200).json({
    status: 'ok',
    version: packageJson.version,
    uptime_seconds: Math.trunc(process.uptime()),
    providers: {
      active: registry.getActiveProviders()
    },
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
}

function handleGetMetrics(req, res) {
  const snapshot = metrics.getSnapshot();
  res.status(200).json({
    gateway: 'one-api',
    version: packageJson.version,
    active_providers: registry.getActiveProviders(),
    telemetry: snapshot
  });
}

module.exports = {
  handleHealth,
  handleDetailedHealth,
  handleGetMetrics,
  HEALTH_PAYLOAD
};
