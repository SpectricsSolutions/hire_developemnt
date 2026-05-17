'use strict';

const { generate, verify, generateSecret: genSecret, generateURI } = require('otplib');
const settings = require('../config/settings');

function generateSecret() {
  return genSecret();
}

async function verifyCode(secret, code) {
  const result = await verify({ token: code, secret });
  return result.valid === true;
}

async function getProvisioningUri(secret, email) {
  return generateURI({
    type: 'totp',
    label: email,
    issuer: settings.TOTP_ISSUER,
    secret,
  });
}

module.exports = { generateSecret, verifyCode, getProvisioningUri };
