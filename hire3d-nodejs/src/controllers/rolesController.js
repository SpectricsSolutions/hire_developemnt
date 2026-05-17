'use strict';

const rolesService = require('../services/rolesService');
const { success, noData } = require('../utils/response');

function toRead(role) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: (role.Permissions || []).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
    })),
  };
}

async function listRoles(req, res) {
  const roles = await rolesService.listRoles();
  return success(res, roles.map(toRead));
}

async function createRole(req, res) {
  const role = await rolesService.createRole(req.body);
  return success(res, toRead(role), 'Role created successfully.', 201);
}

async function updateRole(req, res) {
  const role = await rolesService.updateRole(req.params.roleId, req.body);
  return success(res, toRead(role), 'Role updated successfully.');
}

async function deleteRole(req, res) {
  await rolesService.deleteRole(req.params.roleId);
  return noData(res, 'Role deleted.');
}

module.exports = { listRoles, createRole, updateRole, deleteRole };
