'use strict';

const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

function getContext() {
  return storage.getStore() || {};
}

function setActorId(actorId) {
  const store = storage.getStore();
  if (store) store.actorId = actorId;
}

function setIpAddress(ip) {
  const store = storage.getStore();
  if (store) store.ipAddress = ip;
}

function getActorId() {
  return getContext().actorId || null;
}

function getIpAddress() {
  return getContext().ipAddress || null;
}

function runWithContext(fn) {
  return storage.run({}, fn);
}

module.exports = { setActorId, setIpAddress, getActorId, getIpAddress, runWithContext };
