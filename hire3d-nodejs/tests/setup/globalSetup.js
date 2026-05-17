'use strict';

/**
 * Runs once before all test suites in a separate process.
 * Creates the schema and seeds static reference data (roles, permissions,
 * role-permissions). Data tables are truncated per-test via cleanTables().
 *
 * Prerequisites: the `hire3d_test` database must already exist.
 *   createdb hire3d_test
 */
async function globalSetup() {
  // Set env before any module is loaded.
  process.env.ENVIRONMENT = 'TESTING';
  process.env.DB_NAME = process.env.TEST_DB_NAME || 'hire3d_test';
  process.env.JWT_SECRET = process.env.TEST_JWT_SECRET || 'test-secret-do-not-use-in-production';
  process.env.LOGIN_RATE_LIMIT_PER_MINUTE = '1000';
  process.env.REFRESH_TOKEN_EXPIRE_DAYS = '1';

  const { randomUUID } = require('crypto');
  const { sequelize, Role, Permission, RolePermission } = require('../../src/models');

  const ALL_PERMISSIONS = [
    'clients:create', 'clients:read', 'clients:read_all', 'clients:update', 'clients:delete',
    'engagements:create', 'engagements:read', 'engagements:read_fees', 'engagements:update', 'engagements:delete',
    'users:list', 'users:read', 'users:update', 'users:delete',
    'roles:manage',
    'audit:read',
    'controls:read', 'controls:manage',
    'assessments:read', 'assessments:start', 'assessments:close_phase_1', 'assessments:submit_phase_2', 'assessments:cancel',
  ];

  const OPERATOR_PERMISSIONS = new Set([
    'clients:read', 'clients:update',
    'engagements:read', 'engagements:update',
    'controls:read',
    'assessments:read', 'assessments:start', 'assessments:close_phase_1', 'assessments:submit_phase_2',
  ]);

  const VIEWER_PERMISSIONS = new Set([
    'clients:read', 'clients:read_all',
    'engagements:read',
    'controls:read',
    'assessments:read',
  ]);

  try {
    await sequelize.authenticate();

    // Drop and recreate all tables for a clean baseline.
    await sequelize.sync({ force: true });

    // Seed permissions.
    const now = new Date();
    const permRows = ALL_PERMISSIONS.map((name) => ({
      id: randomUUID(),
      name,
      description: name,
      createdAt: now,
      updatedAt: now,
    }));
    await Permission.bulkCreate(permRows, { ignoreDuplicates: true });

    // Seed roles.
    const roleNames = ['ADMIN', 'SUPER_ADMIN', 'OPERATOR', 'VIEWER'];
    const roleRows = roleNames.map((name) => ({
      id: randomUUID(),
      name,
      description: name,
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    }));
    await Role.bulkCreate(roleRows, { ignoreDuplicates: true });

    // Assign permissions to roles.
    const allRoles = await Role.findAll();
    const allPerms = await Permission.findAll();
    const permByName = Object.fromEntries(allPerms.map((p) => [p.name, p.id]));

    const rpRows = [];
    for (const role of allRoles) {
      let targetPerms;
      if (role.name === 'ADMIN' || role.name === 'SUPER_ADMIN') {
        targetPerms = ALL_PERMISSIONS;
      } else if (role.name === 'OPERATOR') {
        targetPerms = [...OPERATOR_PERMISSIONS];
      } else if (role.name === 'VIEWER') {
        targetPerms = [...VIEWER_PERMISSIONS];
      } else {
        continue;
      }
      for (const permName of targetPerms) {
        if (permByName[permName]) {
          rpRows.push({ roleId: role.id, permissionId: permByName[permName] });
        }
      }
    }
    await RolePermission.bulkCreate(rpRows, { ignoreDuplicates: true });
  } finally {
    await sequelize.close();
  }
}

module.exports = globalSetup;
