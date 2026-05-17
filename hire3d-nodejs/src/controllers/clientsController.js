'use strict';

const clientsService = require('../services/clientsService');
const { success, noData } = require('../utils/response');

async function createClient(req, res) {
  const client = await clientsService.createClient(req.body);
  return success(res, client.toJSON(), 'Client created successfully.', 201);
}

async function listClients(req, res) {
  const viewer = {
    canReadAll: req.user.permissions.has('clients:read_all'),
    actorId: req.user.id,
  };
  const clients = await clientsService.listClients(viewer);
  return success(res, clients.map((c) => c.toJSON()));
}

async function getClient(req, res) {
  const viewer = {
    canReadAll: req.user.permissions.has('clients:read_all'),
    actorId: req.user.id,
  };
  const client = await clientsService.getClient(req.params.clientId, viewer);
  return success(res, client.toJSON());
}

async function updateClient(req, res) {
  const client = await clientsService.updateClient(req.params.clientId, req.body);
  return success(res, client.toJSON(), 'Client updated successfully.');
}

async function deleteClient(req, res) {
  await clientsService.deleteClient(req.params.clientId);
  return noData(res, 'Client deleted successfully.');
}

module.exports = { createClient, listClients, getClient, updateClient, deleteClient };
