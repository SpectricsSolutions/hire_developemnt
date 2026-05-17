'use strict';

const evidenceService = require('../services/evidenceService');
const { success } = require('../utils/response');

async function createEvidenceItem(req, res) {
  const item = await evidenceService.createEvidenceItem(req.params.engagementId, req.body);
  return success(res, item.toJSON(), 'Evidence item created.', 201);
}

async function updateEvidenceItem(req, res) {
  const item = await evidenceService.updateEvidenceItem(req.params.itemId, req.body);
  return success(res, item.toJSON(), 'Evidence item updated.');
}

async function getControlEvidenceStatus(req, res) {
  const { engagementId, controlId } = req.params;
  const status = await evidenceService.getControlEvidenceStatus(controlId, engagementId);
  return success(res, { controlId, engagementId, status });
}

module.exports = { createEvidenceItem, updateEvidenceItem, getControlEvidenceStatus };
