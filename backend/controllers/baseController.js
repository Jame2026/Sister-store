const { getDatabaseState } = require('../services/storeService');
const { buildHealthPayload } = require('../models/storeModel');

function getHealth(req, res) {
  res.json(buildHealthPayload(getDatabaseState()));
}

function sendError(res, error, fallbackStatus = 500) {
  res.status(error.statusCode || fallbackStatus).json({
    error: error.message || 'Unexpected server error.',
  });
}

function readPositiveInteger(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`Invalid ${fieldName}.`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

module.exports = {
  getHealth,
  sendError,
  readPositiveInteger,
};
