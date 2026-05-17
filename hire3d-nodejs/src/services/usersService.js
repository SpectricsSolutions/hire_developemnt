'use strict';

const { User, Role } = require('../models');
const { hashPassword } = require('../utils/password');
const { DuplicateResourceError, NotFoundError } = require('../utils/errors');
const { logCreate, logUpdate, logDelete } = require('./auditService');

function userSnapshot(user) {
  return {
    name: user.name,
    email: user.email,
    roleId: user.roleId || null,
    status: user.status,
  };
}

async function resolveRoleId(roleName) {
  if (!roleName) return null;
  const role = await Role.findOne({ where: { name: roleName } });
  if (!role) throw new NotFoundError('Role not found.');
  return role.id;
}

async function createUser({ name, email, password, role = null, status = 'PENDING' }) {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new DuplicateResourceError('A user with this email already exists.');

  const roleId = await resolveRoleId(role);
  const hashed = await hashPassword(password);

  const user = await User.create({ name, email, password: hashed, roleId, status, avatar: '', meta: {} });
  const full = await User.findByPk(user.id, { include: [{ model: Role, as: 'Role' }] });

  await logCreate({ type: 'user', id: user.id }, userSnapshot(full));
  return full;
}

async function listUsers() {
  return User.findAll({
    include: [{ model: Role, as: 'Role' }],
    order: [['created_at', 'DESC']],
  });
}

async function getUser(userId) {
  const user = await User.findByPk(userId, { include: [{ model: Role, as: 'Role' }] });
  if (!user) throw new NotFoundError();
  return user;
}

async function updateUser(userId, { name, role, status }) {
  const user = await User.findByPk(userId, { include: [{ model: Role, as: 'Role' }] });
  if (!user) throw new NotFoundError();

  const updates = {};
  if (name !== undefined && name !== null) updates.name = name;
  if (role !== undefined && role !== null) updates.roleId = await resolveRoleId(role);
  if (status !== undefined && status !== null) updates.status = status;

  if (Object.keys(updates).length === 0) return user;

  const before = userSnapshot(user);
  await user.update(updates);
  await user.reload({ include: [{ model: Role, as: 'Role' }] });

  await logUpdate({ type: 'user', id: userId }, before, userSnapshot(user));
  return user;
}

async function deactivateUser(userId) {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError();

  const before = userSnapshot(user);
  await user.update({ status: 'INACTIVE' });
  await logDelete({ type: 'user', id: userId }, before);
}

module.exports = { createUser, listUsers, getUser, updateUser, deactivateUser };
