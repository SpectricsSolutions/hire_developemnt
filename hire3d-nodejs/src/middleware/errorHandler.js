'use strict';

const {
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  DuplicateResourceError,
  ConflictError,
  GateBlockedError,
  ValidationError,
} = require('../utils/errors');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ValidationError) {
    return res.status(422).json({
      success: false,
      message: err.message,
      errors: err.errors,
      data: null,
    });
  }

  if (err instanceof GateBlockedError) {
    return res.status(422).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  if (err instanceof UnauthorizedError) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }

  if (err instanceof ForbiddenError) {
    return res.status(403).json({ success: false, message: err.message || 'Forbidden.' });
  }

  if (err instanceof NotFoundError) {
    return res.status(404).json({ success: false, message: 'Resource not found.' });
  }

  if (err instanceof DuplicateResourceError || err instanceof ConflictError) {
    return res.status(409).json({ success: false, message: err.message });
  }

  // Sequelize unique constraint violation
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ success: false, message: 'Resource already exists.' });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({ success: false, message: 'Internal server error.' });
}

module.exports = errorHandler;
