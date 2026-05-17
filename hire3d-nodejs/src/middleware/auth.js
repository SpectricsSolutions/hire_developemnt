'use strict';

const { verifyToken } = require('../utils/jwt');
const { setActorId } = require('../utils/auditContext');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const { User, Role, Permission, RolePermission } = require('../models');
const { Op } = require('sequelize');

async function getPermissionsForUser(userId) {
  // Look up the user's roleId directly, then fetch that role's permissions.
  // A nested include without required:true returns a LEFT JOIN which ignores
  // the where clause at the Permission level and returns all permissions.
  const user = await User.findByPk(userId, { attributes: ['roleId'] });
  if (!user || !user.roleId) return [];

  const rows = await Permission.findAll({
    include: [
      {
        model: Role,
        as: 'Roles',
        where: { id: user.roleId },
        required: true,
        attributes: [],
        through: { attributes: [] },
      },
    ],
    attributes: ['name'],
  });
  return rows.map((p) => p.name);
}

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError();
    }
    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    const user = await User.findByPk(payload.sub, {
      include: [{ model: Role, as: 'Role' }],
    });
    if (!user) throw new UnauthorizedError();

    const permissions = await getPermissionsForUser(user.id);
    user.permissions = new Set(permissions);

    setActorId(user.id);
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

function requirePermission(...required) {
  return [
    authenticate,
    (req, res, next) => {
      const perms = req.user.permissions;
      const missing = required.filter((p) => !perms.has(p));
      if (missing.length > 0) return next(new ForbiddenError());
      next();
    },
  ];
}

module.exports = { authenticate, requirePermission, getPermissionsForUser };
