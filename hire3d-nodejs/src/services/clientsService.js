'use strict';

const { Op } = require('sequelize');
const { Client } = require('../models');
const { NotFoundError, ForbiddenError, ConflictError } = require('../utils/errors');
const { logCreate, logUpdate, logDelete } = require('./auditService');

async function assertNoDuplicate(companyName, primaryContactEmail, excludeId = null) {
  const where = {
    companyName: { [Op.iLike]: companyName },
    primaryContactEmail: { [Op.iLike]: primaryContactEmail },
  };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const existing = await Client.findOne({ where });
  if (existing) {
    throw new ConflictError('A client with this company name and email already exists.');
  }
}

async function createClient(data) {
  await assertNoDuplicate(data.companyName, data.primaryContactEmail);
  const client = await Client.create({ ...data, meta: {} });
  await logCreate({ type: 'client', id: client.id }, data);
  return client;
}

async function listClients({ canReadAll, actorId }) {
  if (canReadAll) {
    return Client.findAll({ order: [['created_at', 'DESC']] });
  }
  return Client.findAll({ where: { assignedOperatorId: actorId }, order: [['created_at', 'DESC']] });
}

async function getClient(clientId, { canReadAll, actorId }) {
  const client = await Client.findByPk(clientId);
  if (!client) throw new NotFoundError();
  if (!canReadAll && client.assignedOperatorId !== actorId) throw new ForbiddenError();
  return client;
}

async function updateClient(clientId, data) {
  const client = await Client.findByPk(clientId);
  if (!client) throw new NotFoundError();

  const newName = data.companyName ?? client.companyName;
  const newEmail = data.primaryContactEmail ?? client.primaryContactEmail;
  await assertNoDuplicate(newName, newEmail, clientId);

  const before = client.toJSON();
  await client.update(data);
  await logUpdate({ type: 'client', id: clientId }, before, data);
  return client;
}

async function deleteClient(clientId) {
  const client = await Client.findByPk(clientId);
  if (!client) throw new NotFoundError();

  const before = client.toJSON();
  try {
    await client.destroy();
  } catch (err) {
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      throw new ConflictError('Cannot delete client with existing engagements.');
    }
    throw err;
  }
  await logDelete({ type: 'client', id: clientId }, before);
}

module.exports = { createClient, listClients, getClient, updateClient, deleteClient };
