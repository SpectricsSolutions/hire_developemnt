'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const rolesController = require('../controllers/rolesController');
const { requirePermission } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createRoleSchema, updateRoleSchema } = require('../validations/rolesValidation');

router.get('/', requirePermission('roles:manage'), asyncHandler(rolesController.listRoles));
router.post('/', requirePermission('roles:manage'), validate(createRoleSchema), asyncHandler(rolesController.createRole));
router.patch('/:roleId', requirePermission('roles:manage'), validate(updateRoleSchema), asyncHandler(rolesController.updateRole));
router.delete('/:roleId', requirePermission('roles:manage'), asyncHandler(rolesController.deleteRole));

module.exports = router;
