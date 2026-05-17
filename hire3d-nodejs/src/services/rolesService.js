'use strict';

const { Role, Permission, User } = require('../models');
const { NotFoundError, ConflictError } = require('../utils/errors');

async function listRoles() {
  return Role.findAll({ include: [{ model: Permission, as: 'Permissions' }], order: [['name', 'ASC']] });
}

async function getRole(roleId) {
  const role = await Role.findByPk(roleId, { include: [{ model: Permission, as: 'Permissions' }] });
  if (!role) throw new NotFoundError();
  return role;
}

async function createRole(data) {
  const existing = await Role.findOne({ where: { name: data.name } });
  if (existing) throw new ConflictError(`A role named '${data.name}' already exists.`);

  const permissions = data.permissions?.length
    ? await Permission.findAll({ where: { name: data.permissions } })
    : [];

  const role = await Role.create({ name: data.name, description: data.description || null });
  await role.setPermissions(permissions);
  await role.reload({ include: [{ model: Permission, as: 'Permissions' }] });
  return role;
}

async function updateRole(roleId, data) {
  const role = await Role.findByPk(roleId, { include: [{ model: Permission, as: 'Permissions' }] });
  if (!role) throw new NotFoundError();

  if (role.isSystem && data.name !== null && data.name !== role.name) {
    throw new ConflictError('Cannot rename a system role.');
  }

  if (data.name !== null && data.name !== undefined) {
    const existing = await Role.findOne({ where: { name: data.name } });
    if (existing && existing.id !== roleId) {
      throw new ConflictError(`A role named '${data.name}' already exists.`);
    }
    role.name = data.name;
  }
  if (data.description !== undefined) role.description = data.description;

  if (data.permissions !== null && data.permissions !== undefined) {
    const permissions = await Permission.findAll({ where: { name: data.permissions } });
    await role.setPermissions(permissions);
  }

  await role.save();
  await role.reload({ include: [{ model: Permission, as: 'Permissions' }] });
  return role;
}

async function deleteRole(roleId) {
  const role = await Role.findByPk(roleId);
  if (!role) throw new NotFoundError();
  if (role.isSystem) throw new ConflictError('System roles cannot be deleted.');

  const userCount = await User.count({ where: { roleId } });
  if (userCount > 0) throw new ConflictError('Cannot delete a role that is assigned to users.');

  await role.destroy();
}

module.exports = { listRoles, getRole, createRole, updateRole, deleteRole };
