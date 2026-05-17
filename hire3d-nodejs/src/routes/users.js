'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const usersController = require('../controllers/usersController');
const { authenticate, requirePermission } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createUserSchema, updateUserSchema } = require('../validations/usersValidation');

/**
 * @swagger
 * /api/v1/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 */
router.post('/', validate(createUserSchema), asyncHandler(usersController.createUser));

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: List all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', requirePermission('users:list'), asyncHandler(usersController.listUsers));

/**
 * @swagger
 * /api/v1/users/{userId}:
 *   get:
 *     summary: Get a user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:userId', authenticate, asyncHandler(usersController.getUser));

/**
 * @swagger
 * /api/v1/users/{userId}:
 *   patch:
 *     summary: Update a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:userId', authenticate, validate(updateUserSchema), asyncHandler(usersController.updateUser));

/**
 * @swagger
 * /api/v1/users/{userId}:
 *   delete:
 *     summary: Deactivate a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:userId', requirePermission('users:delete'), asyncHandler(usersController.deactivateUser));

module.exports = router;
