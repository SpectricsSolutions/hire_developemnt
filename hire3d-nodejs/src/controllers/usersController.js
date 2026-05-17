'use strict';

const usersService = require('../services/usersService');
const { success, noData } = require('../utils/response');
const { ForbiddenError } = require('../utils/errors');

function toRead(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.Role ? user.Role.name : null,
    status: user.status,
  };
}

async function createUser(req, res) {
  const user = await usersService.createUser({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    role: req.body.role,
    status: req.body.status || 'PENDING',
  });
  return success(res, toRead(user), 'Account created successfully.', 201);
}

async function listUsers(req, res) {
  const users = await usersService.listUsers();
  return success(res, users.map(toRead));
}

async function getUser(req, res) {
  const { userId } = req.params;
  const currentUser = req.user;

  if (!currentUser.permissions.has('users:read') && currentUser.id !== userId) {
    throw new ForbiddenError();
  }

  const user = await usersService.getUser(userId);
  return success(res, toRead(user));
}

async function updateUser(req, res) {
  const { userId } = req.params;
  const currentUser = req.user;
  const canUpdateOthers = currentUser.permissions.has('users:update');
  const isSelf = currentUser.id === userId;

  if (!canUpdateOthers && !isSelf) throw new ForbiddenError();
  if (!canUpdateOthers && (req.body.role !== null || req.body.status !== null)) {
    throw new ForbiddenError();
  }

  const user = await usersService.updateUser(userId, req.body);
  return success(res, toRead(user), 'User updated successfully.');
}

async function deactivateUser(req, res) {
  await usersService.deactivateUser(req.params.userId);
  return noData(res, 'User deactivated.');
}

module.exports = { createUser, listUsers, getUser, updateUser, deactivateUser };
