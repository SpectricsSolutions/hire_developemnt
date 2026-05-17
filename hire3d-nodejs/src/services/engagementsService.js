'use strict';

const { Engagement } = require('../models');
const { NotFoundError } = require('../utils/errors');
const { logCreate, logUpdate, logDelete } = require('./auditService');

async function createEngagement(clientId, data) {
  const engagement = await Engagement.create({ ...data, clientId, meta: {} });
  await logCreate({ type: 'engagement', id: engagement.id }, data);
  return engagement;
}

async function listEngagements(clientId) {
  return Engagement.findAll({ where: { clientId }, order: [['engagement_date', 'DESC']] });
}

async function getEngagement(clientId, engagementId) {
  const engagement = await Engagement.findByPk(engagementId);
  if (!engagement || engagement.clientId !== clientId) throw new NotFoundError();
  return engagement;
}

async function updateEngagement(clientId, engagementId, data) {
  const engagement = await Engagement.findByPk(engagementId);
  if (!engagement || engagement.clientId !== clientId) throw new NotFoundError();

  const before = engagement.toJSON();
  await engagement.update(data);
  await logUpdate({ type: 'engagement', id: engagementId }, before, data);
  return engagement;
}

async function deleteEngagement(clientId, engagementId) {
  const engagement = await Engagement.findByPk(engagementId);
  if (!engagement || engagement.clientId !== clientId) throw new NotFoundError();

  const before = engagement.toJSON();
  await engagement.destroy();
  await logDelete({ type: 'engagement', id: engagementId }, before);
}

module.exports = { createEngagement, listEngagements, getEngagement, updateEngagement, deleteEngagement };
