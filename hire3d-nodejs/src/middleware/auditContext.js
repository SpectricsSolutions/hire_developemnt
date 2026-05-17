'use strict';

const { runWithContext, setIpAddress } = require('../utils/auditContext');

function auditContextMiddleware(req, res, next) {
  runWithContext(() => {
    setIpAddress(req.ip || (req.connection && req.connection.remoteAddress) || null);
    next();
  });
}

module.exports = auditContextMiddleware;
