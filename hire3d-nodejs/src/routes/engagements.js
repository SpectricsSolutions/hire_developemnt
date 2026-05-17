'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const asyncHandler = require('../utils/asyncHandler');
const engagementsController = require('../controllers/engagementsController');
const { requirePermission } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createEngagementSchema, updateEngagementSchema } = require('../validations/engagementsValidation');

router.post('/', requirePermission('engagements:create', 'engagements:read'), validate(createEngagementSchema), asyncHandler(engagementsController.createEngagement));
router.get('/', requirePermission('engagements:read'), asyncHandler(engagementsController.listEngagements));
router.get('/:engagementId', requirePermission('engagements:read'), asyncHandler(engagementsController.getEngagement));
router.put('/:engagementId', requirePermission('engagements:update', 'engagements:read'), validate(updateEngagementSchema), asyncHandler(engagementsController.updateEngagement));
router.delete('/:engagementId', requirePermission('engagements:delete'), asyncHandler(engagementsController.deleteEngagement));

module.exports = router;
