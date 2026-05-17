'use strict';

const controlsService = require('../services/controlsService');
const { success, noData } = require('../utils/response');

async function listControlTemplates(req, res) {
  const { product, domain, activeOnly } = req.query;
  const templates = await controlsService.listTemplates({
    product: product || null,
    domain: domain || null,
    activeOnly: activeOnly === 'true' || activeOnly === true,
  });
  return success(res, templates.map((t) => t.toJSON()));
}

async function getControlTemplate(req, res) {
  const template = await controlsService.getTemplate(req.params.templateId);
  return success(res, template.toJSON());
}

async function createControlTemplate(req, res) {
  const template = await controlsService.createTemplate(req.body);
  return success(res, template.toJSON(), 'Control template created successfully.', 201);
}

async function updateControlTemplate(req, res) {
  const template = await controlsService.updateTemplate(req.params.templateId, req.body);
  return success(res, template.toJSON(), 'Control template updated successfully.');
}

async function deleteControlTemplate(req, res) {
  await controlsService.deleteTemplate(req.params.templateId);
  return noData(res, 'Control template deleted successfully.');
}

async function upsertCalibrationAnchor(req, res) {
  const anchor = await controlsService.upsertAnchor(req.params.templateId, req.body);
  return success(res, anchor.toJSON(), 'Calibration anchor saved.');
}

async function updateCalibrationAnchor(req, res) {
  const anchor = await controlsService.updateAnchor(req.params.anchorId, req.body);
  return success(res, anchor.toJSON(), 'Calibration anchor updated.');
}

async function deleteCalibrationAnchor(req, res) {
  await controlsService.deleteAnchor(req.params.anchorId);
  return noData(res, 'Calibration anchor deleted.');
}

module.exports = {
  listControlTemplates,
  getControlTemplate,
  createControlTemplate,
  updateControlTemplate,
  deleteControlTemplate,
  upsertCalibrationAnchor,
  updateCalibrationAnchor,
  deleteCalibrationAnchor,
};
