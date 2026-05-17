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
User.belongsTo(Role, { foreignKey: 'role_id', as: 'Role' });
Role.hasMany(User, { foreignKey: 'role_id' });

// Role <-> Permission (many-to-many through RolePermission)
Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: 'role_id',
  otherKey: 'permission_id',
  as: 'Permissions',
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: 'permission_id',
  otherKey: 'role_id',
  as: 'Roles',
});

// RefreshToken -> User
RefreshToken.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(RefreshToken, { foreignKey: 'user_id' });

// UserTOTP -> User
UserTOTP.belongsTo(User, { foreignKey: 'user_id' });
User.hasOne(UserTOTP, { foreignKey: 'user_id' });

// Engagement -> Client
Engagement.belongsTo(Client, { foreignKey: 'client_id' });
Client.hasMany(Engagement, { foreignKey: 'client_id' });

// CalibrationAnchor -> ControlTemplate
CalibrationAnchor.belongsTo(ControlTemplate, { foreignKey: 'control_template_id', as: 'ControlTemplate' });
ControlTemplate.hasMany(CalibrationAnchor, { foreignKey: 'control_template_id', as: 'CalibrationAnchors' });

// Assessment -> Engagement
Assessment.belongsTo(Engagement, { foreignKey: 'engagement_id' });
Engagement.hasOne(Assessment, { foreignKey: 'engagement_id' });

// AssessmentGateCheck -> Engagement/Assessment
AssessmentGateCheck.belongsTo(Engagement, { foreignKey: 'engagement_id' });
AssessmentGateCheck.belongsTo(Assessment, { foreignKey: 'assessment_id' });

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
