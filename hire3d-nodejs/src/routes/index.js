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

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/roles', rolesRoutes);
router.use('/clients', clientsRoutes);
router.use('/clients/:clientId/engagements', engagementsRoutes);
router.use('/', controlsRoutes);
router.use('/', assessmentsRoutes);
router.use('/audit-logs', auditRoutes);

module.exports = router;
