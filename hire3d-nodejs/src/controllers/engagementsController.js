'use strict';

const engagementsService = require('../services/engagementsService');
const { success, noData } = require('../utils/response');

function redact(engagement, canReadFees) {
  const data = engagement.toJSON ? engagement.toJSON() : { ...engagement };
  if (!canReadFees) {
    delete data.feeCharged;
    delete data.feeStatus;
    delete data.fee_charged;
    delete data.fee_status;
  }
  return data;
}

async function createEngagement(req, res) {
  const canReadFees = req.user.permissions.has('engagements:read_fees');
  const engagement = await engagementsService.createEngagement(req.params.clientId, req.body);
  return success(res, redact(engagement, canReadFees), 'Engagement created successfully.', 201);
}

async function listEngagements(req, res) {
  const canReadFees = req.user.permissions.has('engagements:read_fees');
  const engagements = await engagementsService.listEngagements(req.params.clientId);
  return success(res, engagements.map((e) => redact(e, canReadFees)));
}

async function getEngagement(req, res) {
  const canReadFees = req.user.permissions.has('engagements:read_fees');
  const engagement = await engagementsService.getEngagement(req.params.clientId, req.params.engagementId);
  return success(res, redact(engagement, canReadFees));
}

async function updateEngagement(req, res) {
  const canReadFees = req.user.permissions.has('engagements:read_fees');
  const engagement = await engagementsService.updateEngagement(
    req.params.clientId,
    req.params.engagementId,
    req.body,
  );
  return success(res, redact(engagement, canReadFees), 'Engagement updated successfully.');
}

async function deleteEngagement(req, res) {
  await engagementsService.deleteEngagement(req.params.clientId, req.params.engagementId);
  return noData(res, 'Engagement deleted successfully.');
}

module.exports = { createEngagement, listEngagements, getEngagement, updateEngagement, deleteEngagement };
