'use strict';

const { randomUUID } = require('crypto');

const now = new Date();

const roles = [
  {
    id: randomUUID(),
    name: 'ADMIN',
    description: 'Full access to all system features.',
    is_system: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: randomUUID(),
    name: 'SUPER_ADMIN',
    description: 'Super administrator with unrestricted privileges.',
    is_system: true,
    created_at: now,
    updated_at: now,
  },
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('roles', roles, { ignoreDuplicates: true });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('roles', { name: ['ADMIN', 'SUPER_ADMIN'] });
  },
};
