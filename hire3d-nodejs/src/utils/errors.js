'use strict';

class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized.') {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
  }
}

class NotFoundError extends Error {
  constructor(message = 'Resource not found.') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class ForbiddenError extends Error {
  constructor(message = 'Forbidden.') {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

class DuplicateResourceError extends Error {
  constructor(message = 'Resource already exists.') {
    super(message);
    this.name = 'DuplicateResourceError';
    this.statusCode = 409;
  }
}

class ConflictError extends Error {
  constructor(message = 'Conflict.') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

class InternalServerError extends Error {
  constructor(message = 'Internal server error.') {
    super(message);
    this.name = 'InternalServerError';
    this.statusCode = 500;
  }
}

class GateBlockedError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = 'GateBlockedError';
    this.statusCode = 422;
    this.message = message;
    this.errors = errors;
  }
}

class ValidationError extends Error {
  constructor(message = 'Validation error.', errors = {}) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 422;
    this.errors = errors;
  }
}

module.exports = {
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  DuplicateResourceError,
  ConflictError,
  InternalServerError,
  GateBlockedError,
  ValidationError,
};
