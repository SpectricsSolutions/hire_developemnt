'use strict';

const sequelize = require('../config/database');
const User = require('./User');
const Role = require('./Role');
const Permission = require('./Permission');
const RolePermission = require('./RolePermission');
const RefreshToken = require('./RefreshToken');
const UserTOTP = require('./UserTOTP');
const Client = require('./Client');
const Engagement = require('./Engagement');
const AuditLog = require('./AuditLog');
const ControlTemplate = require('./ControlTemplate');
const CalibrationAnchor = require('./CalibrationAnchor');
const Assessment = require('./Assessment');
const AssessmentGateCheck = require('./AssessmentGateCheck');

// User <-> Role
User.belongsTo(Role, { foreignKey: 'roleId', as: 'Role' });
Role.hasMany(User, { foreignKey: 'roleId' });

// Role <-> Permission (many-to-many through RolePermission)
Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: 'roleId',
  otherKey: 'permissionId',
  as: 'Permissions',
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: 'permissionId',
  otherKey: 'roleId',
  as: 'Roles',
});

// RefreshToken -> User
RefreshToken.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(RefreshToken, { foreignKey: 'userId' });

// UserTOTP -> User
UserTOTP.belongsTo(User, { foreignKey: 'userId' });
User.hasOne(UserTOTP, { foreignKey: 'userId' });

// Engagement -> Client
Engagement.belongsTo(Client, { foreignKey: 'clientId' });
Client.hasMany(Engagement, { foreignKey: 'clientId' });

// CalibrationAnchor -> ControlTemplate
CalibrationAnchor.belongsTo(ControlTemplate, { foreignKey: 'controlTemplateId', as: 'ControlTemplate' });
ControlTemplate.hasMany(CalibrationAnchor, { foreignKey: 'controlTemplateId', as: 'CalibrationAnchors' });

// Assessment -> Engagement
Assessment.belongsTo(Engagement, { foreignKey: 'engagementId' });
Engagement.hasOne(Assessment, { foreignKey: 'engagementId' });

// AssessmentGateCheck -> Engagement/Assessment
AssessmentGateCheck.belongsTo(Engagement, { foreignKey: 'engagementId' });
AssessmentGateCheck.belongsTo(Assessment, { foreignKey: 'assessmentId' });

module.exports = {
  sequelize,
  User,
  Role,
  Permission,
  RolePermission,
  RefreshToken,
  UserTOTP,
  Client,
  Engagement,
  AuditLog,
  ControlTemplate,
  CalibrationAnchor,
  Assessment,
  AssessmentGateCheck,
};
