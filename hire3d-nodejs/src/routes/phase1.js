'use strict';

const path = require('path');
const express = require('express');
const multer = require('multer');
const router = express.Router({ mergeParams: true });
const asyncHandler = require('../utils/asyncHandler');
const phase1Controller = require('../controllers/phase1Controller');
const { requirePermission } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { updateEvidenceSchema } = require('../validations/phase1Validation');
const { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS } = require('../services/phase1Service');
const { ValidationError } = require('../utils/errors');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/p1'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new ValidationError('Validation error.', {
      file: 'File type not allowed. Accepted: pdf, docx, xlsx, png, jpg, jpeg.',
    }));
  },
});

// GET /api/v1/phase1/:engagementId
router.get(
  '/:engagementId',
  requirePermission('assessments:read'),
  asyncHandler(phase1Controller.getWorkspace),
);

// PUT /api/v1/phase1-evidence/:itemId
router.put(
  '/:itemId',
  requirePermission('assessments:start'),
  validate(updateEvidenceSchema),
  asyncHandler(phase1Controller.updateEvidence),
);

// POST /api/v1/phase1-evidence/:itemId/upload
router.post(
  '/:itemId/upload',
  requirePermission('assessments:start'),
  upload.single('file'),
  asyncHandler(phase1Controller.uploadFile),
);

module.exports = router;
