'use strict';

const { randomUUID } = require('crypto');
const argon2 = require('argon2');
const { QueryTypes } = require('sequelize');

const ADMIN_EMAIL = 'admin@hire3d.com';
const ADMIN_PASSWORD = 'Admin@1234';

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    const [role] = await sequelize.query(
      `SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1`,
      { type: QueryTypes.SELECT },
    );

    if (!role) throw new Error('ADMIN role not found. Run role seeder first.');

    const existing = await sequelize.query(
      `SELECT id FROM users WHERE email = '${ADMIN_EMAIL}' LIMIT 1`,
      { type: QueryTypes.SELECT },
    );

    if (existing.length > 0) {
      console.log('Admin user already exists, skipping.');
      return;
    }

    const hashedPassword = await argon2.hash(ADMIN_PASSWORD);
    const now = new Date();

    await queryInterface.bulkInsert('users', [
      {
        id: randomUUID(),
        name: 'Admin',
        email: ADMIN_EMAIL,
        password: hashedPassword,
        avatar: '',
        role_id: role.id,
        status: 'ACTIVE',
        meta: JSON.stringify({}),
        created_at: now,
        updated_at: now,
      },
    ]);

    console.log(`Admin user created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', { email: ADMIN_EMAIL });
  },
};
