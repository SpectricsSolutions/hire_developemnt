'use strict';

const authService = require('../services/authService');
const { success, noData } = require('../utils/response');
const settings = require('../config/settings');

const REFRESH_COOKIE = 'refresh_token';

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: !settings.isDevelopment && !settings.isTesting,
    sameSite: 'strict',
    maxAge: settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400 * 1000,
    path: '/api/v1/auth',
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
}

async function login(req, res) {
  const result = await authService.login(req.body.email, req.body.password);

  if (result.requiresTwoFa) {
    return success(res, { requires2Fa: true, totpToken: result.totpToken });
  }

  setRefreshCookie(res, result.refreshToken);
  return success(res, {
    requires2Fa: false,
    accessToken: result.accessToken,
    tokenType: result.tokenType,
  });
}

async function refresh(req, res) {
  const token = req.cookies[REFRESH_COOKIE] || '';
  const result = await authService.refresh(token);
  return success(res, result);
}

async function logout(req, res) {
  const token = req.cookies[REFRESH_COOKIE];
  if (token) await authService.logout(token);
  clearRefreshCookie(res);
  return noData(res);
}

async function totpSetup(req, res) {
  const result = await authService.setupTotp(req.user);
  return success(res, result);
}

async function totpDisable(req, res) {
  await authService.disableTotp(req.user);
  return noData(res);
}

async function totpVerify(req, res) {
  await authService.verifyTotp(req.user, req.body.code);
  return noData(res);
}

async function totpConfirm(req, res) {
  const result = await authService.confirmTotp(req.body.totpToken, req.body.code);
  setRefreshCookie(res, result.refreshToken);
  return success(res, { accessToken: result.accessToken, tokenType: result.tokenType });
}

async function revokeSessions(req, res) {
  await authService.revokeUserSessions(req.params.userId);
  return noData(res);
}

module.exports = { login, refresh, logout, totpSetup, totpDisable, totpVerify, totpConfirm, revokeSessions };
