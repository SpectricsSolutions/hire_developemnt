'use strict';

const argon2 = require('argon2');

async function hashPassword(password) {
  return argon2.hash(password);
}

async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
