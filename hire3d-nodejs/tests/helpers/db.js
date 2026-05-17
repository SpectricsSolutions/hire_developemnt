'use strict';

const { sequelize } = require('../../src/models');

/**
 * Truncate all data tables between tests.
 * Leaves the static seed tables (roles, permissions, role_permissions) intact.
 */
async function cleanTables() {
  try {
    await sequelize.query(`
      TRUNCATE TABLE
        assessment_gate_checks,
        assessments,
        p1_evidence,
        evidence_items,
        refresh_tokens,
        totp_credentials,
        audit_logs,
        engagements,
        clients,
        users
      CASCADE
    `);
  } catch (err) {
    console.error('[cleanTables] TRUNCATE failed:', err.message, err.parent?.message);
    throw err;
  }
}

module.exports = { sequelize, cleanTables };
