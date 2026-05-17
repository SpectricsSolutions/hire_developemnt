'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const clientsController = require('../controllers/clientsController');
const { requirePermission } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createClientSchema, updateClientSchema } = require('../validations/clientsValidation');

router.post('/', requirePermission('clients:create'), validate(createClientSchema), asyncHandler(clientsController.createClient));
router.get('/', requirePermission('clients:read'), asyncHandler(clientsController.listClients));
router.get('/:clientId', requirePermission('clients:read'), asyncHandler(clientsController.getClient));
router.put('/:clientId', requirePermission('clients:update'), validate(updateClientSchema), asyncHandler(clientsController.updateClient));
router.delete('/:clientId', requirePermission('clients:delete'), asyncHandler(clientsController.deleteClient));

module.exports = router;
