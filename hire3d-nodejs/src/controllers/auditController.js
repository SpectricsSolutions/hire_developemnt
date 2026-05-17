'use strict';

const auditService = require('../services/auditService');
const { success } = require('../utils/response');

async function listAuditLogs(req, res) {
  const { rows, actors, total } = await auditService.listLogs(req.query);

  const items = rows.map((r) => {
    const data = r.toJSON();
    data.actorName = r.actorId ? actors[r.actorId] || null : null;
    return data;
  });

  return success(res, { items, total });
}

module.exports = { listAuditLogs };
