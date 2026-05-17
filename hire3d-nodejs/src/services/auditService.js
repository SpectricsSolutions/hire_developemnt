'use strict';

const { AuditLog, User } = require('../models');
const { getActorId, getIpAddress } = require('../utils/auditContext');
const { Op } = require('sequelize');

async function logAction({ actorId, action, resourceType, event = null, resourceId = null, ipAddress = null, meta = {} }) {
  try {
    await AuditLog.create({
      actorId: actorId || getActorId(),
      action,
      event,
      resourceType,
      resourceId,
      ipAddress: ipAddress || getIpAddress(),
      meta,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

async function logLogin(actorId) {
  await logAction({ actorId, action: 'LOGIN', resourceType: 'session', event: 'user.login' });
}

async function logLogout(actorId = null) {
  await logAction({ actorId, action: 'LOGOUT', resourceType: 'session', event: 'user.logout' });
}

async function logCreate(ref, after) {
  await logAction({ action: 'CREATE', resourceType: ref.type, resourceId: ref.id, meta: { after } });
}

async function logUpdate(ref, before, after) {
  await logAction({ action: 'UPDATE', resourceType: ref.type, resourceId: ref.id, meta: { before, after } });
}

async function logDelete(ref, before) {
  await logAction({ action: 'DELETE', resourceType: ref.type, resourceId: ref.id, meta: { before } });
}

async function listLogs(query) {
  const where = {};
  // Support both camelCase and snake_case keys (SDK sends snake_case from FastAPI spec)
  const action = query.action;
  const resourceType = query.resourceType || query.resource_type;
  const actorId = query.actorId || query.actor_id;
  const before = query.before;
  const after = query.after;

  if (action) where.action = action;
  if (resourceType) where.resourceType = resourceType;
  if (actorId) where.actorId = actorId;
  if (before) where.createdAt = { ...(where.createdAt || {}), [Op.lt]: before };
  if (after) where.createdAt = { ...(where.createdAt || {}), [Op.gte]: after };

  const { count, rows } = await AuditLog.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: query.limit,
    offset: query.offset,
  });

  const actorIds = [...new Set(rows.filter((r) => r.actorId).map((r) => r.actorId))];
  const actors = {};
  if (actorIds.length > 0) {
    const users = await User.findAll({ where: { id: actorIds }, attributes: ['id', 'name'] });
    users.forEach((u) => { actors[u.id] = u.name; });
  }

  return { rows, actors, total: count };
}

module.exports = { logLogin, logLogout, logCreate, logUpdate, logDelete, listLogs };
