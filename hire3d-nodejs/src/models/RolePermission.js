'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RolePermission = sequelize.define(
  'RolePermission',
  {
    roleId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      field: 'role_id',
    },
    permissionId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      field: 'permission_id',
    },
  },
  {
    tableName: 'role_permissions',
    timestamps: false,
    underscored: true,
  },
);

module.exports = RolePermission;
