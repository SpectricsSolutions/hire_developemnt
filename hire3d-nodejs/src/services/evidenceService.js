'use strict';

const { EvidenceItem } = require('../models');
const { NotFoundError } = require('../utils/errors');
const { addWorkingDays } = require('../utils/workingDays');
const { logCreate, logUpdate } = require('./auditService');

// ── Status priority ────────────────────────────────────────────────────────────
// Higher number = higher priority in the rollup.
// 'requested' is handled separately (always wins); the values below are used
// only to resolve ties among the other three states.
const STATUS_PRIORITY = {
  not_provided: 3,
  partial: 2,
  seen: 1,
};

/**
 * Pure rollup — accepts an array of evidence item plain objects (or Sequelize
 * instances with a `.status` field).  Extracted so unit tests don't need a DB.
 *
 * Rules (from confirmed client spec, 08 May 2026 demo review):
 *   • Any item is 'requested'  → return 'requested'
 *   • Otherwise               → return the highest-priority status present
 *   • Empty array             → return null  (no items = not blocked)
 */
function computeControlStatus(items) {
  if (!items.length) return null;
  if (items.some((i) => i.status === 'requested')) return 'requested';
  return items.reduce((highest, item) => {
    return (STATUS_PRIORITY[item.status] ?? 0) > (STATUS_PRIORITY[highest] ?? 0)
      ? item.status
      : highest;
  }, 'seen');
}

/**
 * Pure Phase 1 closure check — accepts an array of
 * { controlId, status } objects (one per distinct control).
 */
function computeCanClose(controlStatuses) {
  const blockingControls = controlStatuses
    .filter(({ status }) => status === 'requested')
    .map(({ controlId }) => controlId);
  return { blocked: blockingControls.length > 0, blockingControls };
}

// ── DB-backed functions ────────────────────────────────────────────────────────

async function getControlEvidenceStatus(controlId, engagementId) {
  const items = await EvidenceItem.findAll({ where: { controlId, engagementId } });
  return computeControlStatus(items);
}

/**
 * Returns { blocked: boolean, blockingControls: string[] }
 *
 * Checks every distinct control that has at least one evidence item under this
 * engagement.  A control whose rollup is 'requested' blocks Phase 1 closure.
 */
async function canClosePhase1(engagementId) {
  const items = await EvidenceItem.findAll({
    where: { engagementId },
    attributes: ['controlId', 'status'],
  });

  const byControl = {};
  for (const item of items) {
    (byControl[item.controlId] = byControl[item.controlId] || []).push(item);
  }

  const controlStatuses = Object.entries(byControl).map(([controlId, controlItems]) => ({
    controlId,
    status: computeControlStatus(controlItems),
  }));

  return computeCanClose(controlStatuses);
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

function resolveDeadline(status, existingDeadline) {
  if (status !== 'requested') return null;
  // Preserve an existing deadline if already set; otherwise auto-calculate.
  if (existingDeadline) return existingDeadline;
  return addWorkingDays(new Date(), 5);
}

async function createEvidenceItem(engagementId, data) {
  const deadline = resolveDeadline(data.status, null);
  const item = await EvidenceItem.create({
    engagementId,
    controlId: data.controlId,
    status: data.status,
    deadline,
    description: data.description ?? null,
    notes: data.notes ?? null,
  });
  await logCreate({ type: 'evidence_item', id: item.id }, { engagementId, ...data, deadline });
  return item;
}

async function updateEvidenceItem(itemId, data) {
  const item = await EvidenceItem.findByPk(itemId);
  if (!item) throw new NotFoundError();

  const before = item.toJSON();
  const deadline = resolveDeadline(data.status ?? item.status, item.deadline);

  await item.update({
    ...(data.status !== undefined && { status: data.status }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.notes !== undefined && { notes: data.notes }),
    deadline,
  });

  await logUpdate({ type: 'evidence_item', id: itemId }, before, item.toJSON());
  return item;
}

module.exports = {
  computeControlStatus,
  computeCanClose,
  getControlEvidenceStatus,
  canClosePhase1,
  createEvidenceItem,
  updateEvidenceItem,
};
