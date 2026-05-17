'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs is append-only';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
      CREATE TRIGGER audit_logs_no_update
        BEFORE UPDATE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
    `);

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS audit_logs_no_delete ON audit_logs;
      CREATE TRIGGER audit_logs_no_delete
        BEFORE DELETE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
    `);

    console.log('Audit logs append-only triggers applied.');
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS audit_logs_no_delete ON audit_logs`);
    await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs`);
    await queryInterface.sequelize.query(`DROP FUNCTION IF EXISTS prevent_audit_log_modification`);
  },
};
