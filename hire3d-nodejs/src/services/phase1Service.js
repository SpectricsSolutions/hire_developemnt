'use strict';

const { P1Evidence, ControlTemplate, Engagement, Assessment } = require('../models');
const { NotFoundError } = require('../utils/errors');
const { logUpdate } = require('./auditService');
const { derivePhase } = require('./assessmentsService');

const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'png', 'jpg', 'jpeg']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
]);

function computeProgress(evidenceRows, totalControls) {
  const counts = { seen: 0, partial: 0, requested: 0, notProvided: 0 };
  for (const row of evidenceRows) {
    if (row.status === 'seen') counts.seen++;
    else if (row.status === 'partial') counts.partial++;
    else if (row.status === 'requested') counts.requested++;
    else counts.notProvided++;
  }
  const done = counts.seen + counts.partial;
  return {
    total: totalControls,
    ...counts,
    percentageComplete: totalControls > 0 ? Math.round((done / totalControls) * 100) : 0,
  };
}

async function getWorkspace(engagementId) {
  const engagement = await Engagement.findByPk(engagementId);
  if (!engagement) throw new NotFoundError();

  const assessment = await Assessment.findOne({ where: { engagementId } });

  const controls = await ControlTemplate.findAll({
    where: { product: engagement.product, isActive: true },
    order: [['domain', 'ASC NULLS FIRST'], ['sort_order', 'ASC'], ['code', 'ASC']],
  });

  let evidenceRows = await P1Evidence.findAll({ where: { engagementId } });
  const existingControlIds = new Set(evidenceRows.map((e) => e.controlId));
  const missing = controls.filter((c) => !existingControlIds.has(c.id));
  if (missing.length > 0) {
    await P1Evidence.bulkCreate(
      missing.map((c) => ({ engagementId, controlId: c.id, status: 'not_provided' })),
      { ignoreDuplicates: true },
    );
    evidenceRows = await P1Evidence.findAll({ where: { engagementId } });
  }
  const evidenceByControlId = Object.fromEntries(evidenceRows.map((e) => [e.controlId, e]));

  const controlsWithEvidence = controls.map((c) => {
    const ev = evidenceByControlId[c.id] ?? null;
    return {
      id: c.id,
      code: c.code,
      domain: c.domain,
      title: c.title,
      primaryQuestion: c.primaryQuestion,
      evidencePrompts: c.evidencePrompts,
      lookingFor: c.lookingFor,
      sampling: c.sampling,
      ifPartial: c.ifPartial,
      sortOrder: c.sortOrder,
      evidence: ev
        ? { id: ev.id, status: ev.status, notes: ev.notes, documentNotes: ev.documentNotes, documentLink: ev.documentLink, fileUrl: ev.fileUrl, fileName: ev.fileName }
        : null,
    };
  });

  return {
    engagementId,
    product: engagement.product,
    assessment: assessment ? { id: assessment.id, phase: derivePhase(assessment) } : null,
    controls: controlsWithEvidence,
    progress: computeProgress(evidenceRows, controls.length),
  };
}

async function updateEvidence(itemId, data) {
  const item = await P1Evidence.findByPk(itemId);
  if (!item) throw new NotFoundError();

  const before = item.toJSON();
  const patch = {};
  if (data.status !== undefined) patch.status = data.status;
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.documentNotes !== undefined) patch.documentNotes = data.documentNotes;
  if (data.documentLink !== undefined) patch.documentLink = data.documentLink;
  await item.update(patch);

  await logUpdate({ type: 'p1_evidence', id: itemId }, before, item.toJSON());
  return item;
}

async function uploadFile(itemId, file) {
  const item = await P1Evidence.findByPk(itemId);
  if (!item) throw new NotFoundError();

  const before = item.toJSON();
  const patch = {
    fileUrl: `/uploads/p1/${file.filename}`,
    fileName: file.originalname,
  };
  // Auto-promote: if not yet touched, mark as seen
  if (item.status === 'not_provided') patch.status = 'seen';
  await item.update(patch);

  await logUpdate({ type: 'p1_evidence', id: itemId }, before, item.toJSON());
  return item;
}

module.exports = { getWorkspace, updateEvidence, uploadFile, computeProgress, ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES };
