'use strict';

const { randomUUID } = require('crypto');
const { QueryTypes } = require('sequelize');

const OPERATOR_PERMISSIONS = [
  'clients:read',
  'clients:update',
  'engagements:read',
  'engagements:update',
  'controls:read',
  'assessments:read',
  'assessments:start',
  'assessments:close_phase_1',
  'assessments:submit_phase_2',
];

const VIEWER_PERMISSIONS = [
  'clients:read',
  'clients:read_all',
  'engagements:read',
  'controls:read',
  'assessments:read',
];

const now = new Date();

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    const existingRoles = await sequelize.query(
      `SELECT name FROM roles WHERE name IN ('OPERATOR', 'VIEWER')`,
      { type: QueryTypes.SELECT },
    );
    const existing = new Set(existingRoles.map(r => r.name));

    const rolesToInsert = [];
    if (!existing.has('OPERATOR')) {
      rolesToInsert.push({
        id: randomUUID(),
        name: 'OPERATOR',
        description: 'Can manage clients, update engagements, and run assessments.',
        is_system: true,
        created_at: now,
        updated_at: now,
      });
    }
    if (!existing.has('VIEWER')) {
      rolesToInsert.push({
        id: randomUUID(),
        name: 'VIEWER',
        description: 'Read-only access to clients, engagements, controls, and assessments.',
        is_system: true,
        created_at: now,
        updated_at: now,
      });
    }

    if (rolesToInsert.length > 0) {
      await queryInterface.bulkInsert('roles', rolesToInsert);
    }

    // Assign permissions to each role
    const allRoles = await sequelize.query(
      `SELECT id, name FROM roles WHERE name IN ('OPERATOR', 'VIEWER')`,
      { type: QueryTypes.SELECT },
    );

    const allPerms = await sequelize.query(
      `SELECT id, name FROM permissions`,
      { type: QueryTypes.SELECT },
    );
    const permByName = Object.fromEntries(allPerms.map(p => [p.name, p.id]));

    const rpRows = [];
    for (const role of allRoles) {
      const targetPerms = role.name === 'OPERATOR' ? OPERATOR_PERMISSIONS : VIEWER_PERMISSIONS;
      for (const permName of targetPerms) {
        if (permByName[permName]) {
          rpRows.push({ role_id: role.id, permission_id: permByName[permName] });
        }
      }
    }

    if (rpRows.length > 0) {
      await queryInterface.bulkInsert('role_permissions', rpRows, { ignoreDuplicates: true });
    }

    console.log(`OPERATOR (${OPERATOR_PERMISSIONS.length} perms) and VIEWER (${VIEWER_PERMISSIONS.length} perms) seeded.`);
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const roles = await sequelize.query(
      `SELECT id FROM roles WHERE name IN ('OPERATOR', 'VIEWER')`,
      { type: QueryTypes.SELECT },
    );
    for (const role of roles) {
      await sequelize.query(`DELETE FROM role_permissions WHERE role_id = '${role.id}'`);
    }
    await queryInterface.bulkDelete('roles', { name: ['OPERATOR', 'VIEWER'] });
  },
};
