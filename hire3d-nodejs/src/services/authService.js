'use strict';

const { v4: uuidv4 } = require('uuid');
const { User, Role, RefreshToken, UserTOTP, Permission, RolePermission } = require('../models');
const { verifyPassword } = require('../utils/password');
const { issueAccessToken, issueTotpToken, decodeTotpToken } = require('../utils/jwt');
const { generateSecret, verifyCode, getProvisioningUri } = require('../utils/totp');
const { getIpAddress, getActorId } = require('../utils/auditContext');
const { UnauthorizedError, NotFoundError, ForbiddenError } = require('../utils/errors');
const { logLogin, logLogout } = require('./auditService');
const settings = require('../config/settings');
const { Op } = require('sequelize');

async function getPermissionsForUser(userId) {
  const perms = await Permission.findAll({
    include: [
      {
        model: Role,
        as: 'Roles',
        include: [{ model: User, where: { id: userId }, attributes: [] }],
        attributes: [],
        through: { attributes: [] },
      },
    ],
    attributes: ['name'],
  });
  return perms.map((p) => p.name);
}

async function login(email, password) {
  const user = await User.findOne({ where: { email }, include: [{ model: Role, as: 'Role' }] });
  if (!user) throw new UnauthorizedError();

  const valid = await verifyPassword(user.password, password);
  if (!valid) throw new UnauthorizedError();

  if (user.status === 'PENDING') {
    throw new ForbiddenError('Your account is pending approval. Please contact your administrator.');
  }
  if (user.status !== 'ACTIVE') throw new UnauthorizedError();

  const totpRecord = await UserTOTP.findOne({ where: { userId: user.id } });
  if (totpRecord && totpRecord.isEnabled) {
    return { requiresTwoFa: true, totpToken: issueTotpToken(user.id) };
  }

  const permissions = await getPermissionsForUser(user.id);
  const accessToken = issueAccessToken(user, { totpEnabled: false, permissions });
  const refreshToken = await createRefreshToken(user.id);

  await logLogin(user.id);

  return {
    requiresTwoFa: false,
    accessToken,
    tokenType: 'bearer',
    refreshToken: refreshToken.token,
  };
}

async function refresh(rawToken) {
  if (!rawToken) throw new UnauthorizedError();

  const record = await RefreshToken.findOne({ where: { token: rawToken } });
  if (!record) throw new UnauthorizedError();
  if (record.revokedAt) throw new UnauthorizedError();
  if (record.expiresAt <= new Date()) throw new UnauthorizedError();

  await RefreshToken.update({ lastUsedAt: new Date() }, { where: { id: record.id } });

  const user = await User.findByPk(record.userId, { include: [{ model: Role, as: 'Role' }] });
  if (!user || user.status !== 'ACTIVE') throw new UnauthorizedError();

  const totpRecord = await UserTOTP.findOne({ where: { userId: user.id } });
  const totpEnabled = !!(totpRecord && totpRecord.isEnabled);
  const permissions = await getPermissionsForUser(user.id);

  return {
    accessToken: issueAccessToken(user, { totpEnabled, permissions }),
    tokenType: 'bearer',
  };
}

async function logout(rawToken) {
  if (!rawToken) return;
  const record = await RefreshToken.findOne({ where: { token: rawToken } });
  if (record && !record.revokedAt) {
    await RefreshToken.update({ revokedAt: new Date() }, { where: { id: record.id } });
    await logLogout(record.userId);
  }
}

async function setupTotp(user) {
  const secret = generateSecret();
  await UserTOTP.upsert({ userId: user.id, secret, isEnabled: false });
  const qrUri = await getProvisioningUri(secret, user.email);
  return { qrUri, issuer: settings.TOTP_ISSUER };
}

async function disableTotp(user) {
  const record = await UserTOTP.findOne({ where: { userId: user.id } });
  if (!record || !record.isEnabled) throw new NotFoundError();
  await UserTOTP.destroy({ where: { userId: user.id } });
}

async function verifyTotp(user, code) {
  const record = await UserTOTP.findOne({ where: { userId: user.id } });
  if (!record) throw new UnauthorizedError();
  const valid = await verifyCode(record.secret, code);
  if (!valid) throw new UnauthorizedError();
  await UserTOTP.update({ isEnabled: true }, { where: { userId: user.id } });
}

async function confirmTotp(totpToken, code) {
  const payload = decodeTotpToken(totpToken);
  if (!payload.sub) throw new UnauthorizedError();

  const user = await User.findByPk(payload.sub, { include: [{ model: Role, as: 'Role' }] });
  if (!user || user.status !== 'ACTIVE') throw new UnauthorizedError();

  const record = await UserTOTP.findOne({ where: { userId: user.id } });
  if (!record || !record.isEnabled) throw new UnauthorizedError();
  const valid = await verifyCode(record.secret, code);
  if (!valid) throw new UnauthorizedError();

  const permissions = await getPermissionsForUser(user.id);
  const accessToken = issueAccessToken(user, { totpEnabled: true, permissions });
  const refreshToken = await createRefreshToken(user.id);

  await logLogin(user.id);

  return {
    accessToken,
    tokenType: 'bearer',
    refreshToken: refreshToken.token,
  };
}

async function revokeUserSessions(userId) {
  const user = await User.findByPk(userId);
  if (!user) throw new NotFoundError();
  await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { userId, revokedAt: null } },
  );
  await logLogout(null);
}

async function createRefreshToken(userId) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + settings.REFRESH_TOKEN_EXPIRE_DAYS);

  return RefreshToken.create({
    userId,
    token: uuidv4(),
    issuedAt: new Date(),
    expiresAt,
    ipAddress: getIpAddress(),
  });
}

module.exports = { login, refresh, logout, setupTotp, disableTotp, verifyTotp, confirmTotp, revokeUserSessions };
