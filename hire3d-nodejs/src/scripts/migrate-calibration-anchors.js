'use strict';

require('dotenv').config();
const { DataTypes } = require('sequelize');
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

async function run() {
  const qi = sequelize.getQueryInterface();
  const tableDesc = await sequelize.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'calibration_anchors'`,
    { type: QueryTypes.SELECT }
  );
  const cols = tableDesc.map(r => r.column_name);

  if (!cols.includes('what_this_means')) {
    await qi.addColumn('calibration_anchors', 'what_this_means', { type: DataTypes.TEXT, allowNull: true });
    console.log('Added what_this_means');
  }
  if (!cols.includes('evidence_descriptors')) {
    await qi.addColumn('calibration_anchors', 'evidence_descriptors', { type: DataTypes.TEXT, allowNull: true });
    console.log('Added evidence_descriptors');
  }
  if (!cols.includes('minimum_standard')) {
    await qi.addColumn('calibration_anchors', 'minimum_standard', { type: DataTypes.TEXT, allowNull: true });
    console.log('Added minimum_standard');
  }
  console.log('Migration complete.');
  await sequelize.close();
}

run().catch(err => { console.error(err); process.exit(1); });
