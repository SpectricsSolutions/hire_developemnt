'use strict';

const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const usersRoutes = require('./users');
const rolesRoutes = require('./roles');
const clientsRoutes = require('./clients');
const engagementsRoutes = require('./engagements');
const controlsRoutes = require('./controls');
const assessmentsRoutes = require('./assessments');
const auditRoutes = require('./audit');
const evidenceRoutes = require('./evidence');

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/roles', rolesRoutes);
router.use('/clients', clientsRoutes);
router.use('/clients/:clientId/engagements', engagementsRoutes);
router.use('/', controlsRoutes);
router.use('/', assessmentsRoutes);
router.use('/audit-logs', auditRoutes);
// Evidence: engagement-scoped creation + control status
router.use('/engagements/:engagementId/evidence-items', evidenceRoutes);
// Evidence: item-level updates (PATCH /api/v1/evidence-items/:itemId)
router.use('/evidence-items', evidenceRoutes);

module.exports = router;
