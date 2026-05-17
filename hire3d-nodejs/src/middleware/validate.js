'use strict';

const { ValidationError } = require('../utils/errors');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const input = req[source] !== undefined ? req[source] : (source === 'body' ? {} : {});
    const { error, value } = schema.validate(input, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const errors = {};
      for (const detail of error.details) {
        const field = detail.path.join('.') || '_';
        if (!errors[field]) errors[field] = detail.message;
      }
      return next(new ValidationError('Validation error.', errors));
    }

    // Express 5 makes req.query a read-only getter — store validated query separately
    if (source === 'query') {
      req.validatedQuery = value;
    } else {
      req[source] = value;
    }
    next();
  };
}

module.exports = validate;
