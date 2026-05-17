'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    avatar: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: '',
    },
    roleId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'role_id',
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    meta: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: 'users',
    underscored: true,
  },
);

module.exports = User;
