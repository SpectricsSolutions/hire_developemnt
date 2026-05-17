'use strict';

const { randomUUID } = require('crypto');

const ALL_PERMISSIONS = [
  ['clients:create',            'Create new clients'],
  ['clients:read',              'Read client records'],
  ['clients:read_all',          'Read all clients (not just assigned ones)'],
  ['clients:update',            'Update client records'],
  ['clients:delete',            'Delete client records'],
  ['engagements:create',        'Create engagements'],
  ['engagements:read',          'Read engagements'],
  ['engagements:read_fees',     'Read engagement commercial fee fields'],
  ['engagements:update',        'Update engagements'],
  ['engagements:delete',        'Delete engagements'],
  ['users:list',                'List all users'],
  ['users:read',                'Read user profiles'],
  ['users:update',              'Update other users'],
  ['users:delete',              'Deactivate users'],
  ['roles:manage',              'Manage roles and permissions'],
  ['audit:read',                'View audit logs'],
  ['controls:read',             'View control templates and calibration'],
  ['controls:manage',           'Create, update, delete control templates and calibration'],
  ['assessments:read',          'View assessments and gate status'],
  ['assessments:start',         'Start a new assessment (Phase 1)'],
  ['assessments:close_phase_1', 'Close Phase 1 of an assessment'],
  ['assessments:submit_phase_2','Submit Phase 2 ratings of an assessment'],
  ['assessments:cancel',        'Cancel an in-progress assessment'],
];

const now = new Date();

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('permissions', ALL_PERMISSIONS.map(([name, description]) => ({
      id: randomUUID(),
      name,
      description,
      created_at: now,
      updated_at: now,
    })), {
      ignoreDuplicates: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('permissions', {
      name: ALL_PERMISSIONS.map(([name]) => name),
    });
  },
};
