'use strict';

const phase1Service = require('../services/phase1Service');
const { ValidationError } = require('../utils/errors');
const { success } = require('../utils/response');

async function getWorkspace(req, res) {
  const workspace = await phase1Service.getWorkspace(req.params.engagementId);
  return success(res, workspace);
}

async function updateEvidence(req, res) {
  const item = await phase1Service.updateEvidence(req.params.itemId, req.body);
  return success(res, item.toJSON(), 'Evidence saved.');
}

async function uploadFile(req, res) {
  if (!req.file) {
    throw new ValidationError('Validation error.', { file: 'A file is required.' });
  }
  // MIME type checked by multer fileFilter — extra safety check here
  if (!phase1Service.ALLOWED_MIME_TYPES.has(req.file.mimetype)) {
    throw new ValidationError('Validation error.', {
      file: 'File type not allowed. Accepted: pdf, docx, xlsx, png, jpg, jpeg.',
    });
  }
  const item = await phase1Service.uploadFile(req.params.itemId, req.file);
  return success(res, item.toJSON(), 'File uploaded.');
}

module.exports = { getWorkspace, updateEvidence, uploadFile };
