'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Permission = sequelize.define(
  'Permission',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'permissions',
    underscored: true,
  },
);

module.exports = Permission;
