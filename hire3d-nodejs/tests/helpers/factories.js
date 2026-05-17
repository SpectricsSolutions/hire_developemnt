'use strict';

const { User, Client, Engagement, Role } = require('../../src/models');
const { hashPassword } = require('../../src/utils/password');

const DEFAULT_PASSWORD = 'Test1234!';

// Compute the hash once per process — argon2 is slow; the same hash is valid
// for every verifyPassword call with DEFAULT_PASSWORD.
let _cachedHash = null;
async function _getHash() {
  if (!_cachedHash) _cachedHash = await hashPassword(DEFAULT_PASSWORD);
  return _cachedHash;
}

let _seq = 0;
function _seq_() { return ++_seq; }

async function createUser({
  name,
  email,
  roleName = 'ADMIN',
  status = 'ACTIVE',
} = {}) {
  const n = _seq_();
  const role = await Role.findOne({ where: { name: roleName } });
  return User.create({
    name: name || `Test User ${n}`,
    email: email || `testuser${n}@example.com`,
    password: await _getHash(),
    roleId: role ? role.id : null,
    status,
  });
}

async function createClient({
  companyName,
  primaryContactEmail,
  assignedOperatorId = null,
  status = 'ACTIVE',
} = {}) {
  const n = _seq_();
  return Client.create({
    companyName: companyName || `Test Company ${n}`,
    primaryContactName: 'Jane Doe',
    primaryContactEmail: primaryContactEmail || `contact${n}@example.com`,
    headcountAtEngagement: 50,
    businessStage: 'GROWTH',
    region: 'LONDON',
    assignedOperatorId,
    status,
    meta: {},
  });
}

async function createEngagement(clientId, {
  product = 'HIRE_3D_CORE',
  engagementDate = '2026-01-01',
  feeCharged = 2000,
  feeStatus = 'INVOICED',
  auditStatus = 'SCHEDULED',
  engagementLetterSignedAt = null,
  invoiceRaisedAt = null,
} = {}) {
  return Engagement.create({
    clientId,
    product,
    engagementDate,
    feeCharged,
    feeStatus,
    auditStatus,
    engagementLetterSignedAt,
    invoiceRaisedAt,
    meta: {},
  });
}

module.exports = { DEFAULT_PASSWORD, createUser, createClient, createEngagement };
