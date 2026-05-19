'use strict';

const { Engagement } = require('../models');
const { NotFoundError } = require('../utils/errors');
const { logCreate, logUpdate, logDelete } = require('./auditService');

function engagementSnapshot(e) {
  return {
    product: e.product,
    engagementDate: e.engagementDate,
    feeCharged: e.feeCharged,
    feeStatus: e.feeStatus,
    auditDate: e.auditDate,
    reportIssuedDate: e.reportIssuedDate,
    auditStatus: e.auditStatus,
    nextReviewDue: e.nextReviewDue,
    engagementLetterSignedAt: e.engagementLetterSignedAt,
    invoiceRaisedAt: e.invoiceRaisedAt,
  };
}

async function createEngagement(clientId, data) {
  const engagement = await Engagement.create({ ...data, clientId, meta: {} });
  await logCreate({ type: 'engagement', id: engagement.id }, engagementSnapshot(engagement));
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

  const before = engagementSnapshot(engagement);
  await engagement.update(data);
  await logUpdate({ type: 'engagement', id: engagementId }, before, engagementSnapshot(engagement));
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
