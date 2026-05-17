'use strict';

const { QueryTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    const roles = await sequelize.query(
      `SELECT id, name FROM roles WHERE name IN ('ADMIN', 'SUPER_ADMIN')`,
      { type: QueryTypes.SELECT },
    );

    const permissions = await sequelize.query(
      `SELECT id FROM permissions`,
      { type: QueryTypes.SELECT },
    );

    const rows = [];
    for (const role of roles) {
      for (const perm of permissions) {
        rows.push({ role_id: role.id, permission_id: perm.id });
      }
    }

    if (rows.length > 0) {
      await queryInterface.bulkInsert('role_permissions', rows, { ignoreDuplicates: true });
    }
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const roles = await sequelize.query(
      `SELECT id FROM roles WHERE name IN ('ADMIN', 'SUPER_ADMIN')`,
      { type: QueryTypes.SELECT },
    );
    const ids = roles.map((r) => `'${r.id}'`).join(',');
    if (ids) {
      await sequelize.query(`DELETE FROM role_permissions WHERE role_id IN (${ids})`);
    }
  },
};
