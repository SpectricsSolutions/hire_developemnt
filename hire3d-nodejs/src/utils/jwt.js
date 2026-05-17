'use strict';

const jwt = require('jsonwebtoken');
const settings = require('../config/settings');
const { UnauthorizedError } = require('./errors');

function signAccessToken(payload, expiresInMinutes) {
  const minutes = expiresInMinutes ?? settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES;
  return jwt.sign(payload, settings.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: `${minutes}m`,
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, settings.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw new UnauthorizedError();
  }
}

function issueAccessToken(user, { totpEnabled = false, permissions = [] } = {}) {
  return signAccessToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.Role ? user.Role.name : null,
    permissions,
    totpEnabled,
  });
}

function issueTotpToken(userId) {
  return signAccessToken(
    { sub: userId, type: 'totp_challenge' },
    settings.TOTP_TOKEN_EXPIRE_MINUTES,
  );
}

function decodeTotpToken(token) {
  const payload = verifyToken(token);
  if (payload.type !== 'totp_challenge') throw new UnauthorizedError();
  return payload;
}

module.exports = { signAccessToken, verifyToken, issueAccessToken, issueTotpToken, decodeTotpToken };
