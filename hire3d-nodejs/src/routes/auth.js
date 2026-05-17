'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const authController = require('../controllers/authController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { loginSchema, totpVerifySchema, totpConfirmSchema } = require('../validations/authValidation');

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 */
router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(authController.login));

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh cookie
 *     tags: [Auth]
 */
router.post('/refresh', asyncHandler(authController.refresh));

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout and revoke refresh token
 *     tags: [Auth]
 */
router.post('/logout', asyncHandler(authController.logout));

/**
 * @swagger
 * /api/v1/auth/totp/setup:
 *   post:
 *     summary: Set up TOTP for the current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.post('/totp/setup', authenticate, asyncHandler(authController.totpSetup));

/**
 * @swagger
 * /api/v1/auth/totp:
 *   delete:
 *     summary: Disable TOTP for the current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/totp', authenticate, asyncHandler(authController.totpDisable));

/**
 * @swagger
 * /api/v1/auth/totp/verify:
 *   post:
 *     summary: Verify and enable TOTP for the current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.post('/totp/verify', authenticate, validate(totpVerifySchema), asyncHandler(authController.totpVerify));

/**
 * @swagger
 * /api/v1/auth/totp/confirm:
 *   post:
 *     summary: Confirm TOTP challenge and issue full tokens
 *     tags: [Auth]
 */
router.post('/totp/confirm', validate(totpConfirmSchema), asyncHandler(authController.totpConfirm));

/**
 * @swagger
 * /api/v1/auth/sessions/{userId}:
 *   delete:
 *     summary: Revoke all sessions for a user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/sessions/:userId', requirePermission('users:update'), asyncHandler(authController.revokeSessions));

module.exports = router;
