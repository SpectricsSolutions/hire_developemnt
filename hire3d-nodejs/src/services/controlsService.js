'use strict';

const sequelize = require('../config/database');
const { ControlTemplate, CalibrationAnchor } = require('../models');
const { NotFoundError, ConflictError } = require('../utils/errors');
const { logCreate, logUpdate, logDelete } = require('./auditService');

async function listTemplates({ product, domain, activeOnly }) {
  const where = {};
  if (product) where.product = product;
  if (domain) where.domain = domain;
  if (activeOnly) where.isActive = true;

  return ControlTemplate.findAll({
    where,
    include: [{ model: CalibrationAnchor, as: 'CalibrationAnchors' }],
    order: [
      ['product', 'ASC'],
      ['sort_order', 'ASC'],
      ['code', 'ASC'],
    ],
  });
}

async function getTemplate(templateId) {
  const template = await ControlTemplate.findByPk(templateId, {
    include: [{ model: CalibrationAnchor, as: 'CalibrationAnchors' }],
  });
  if (!template) throw new NotFoundError();
  return template;
}

async function createTemplate(data) {
  const t = await sequelize.transaction();
  try {
    const { calibrationAnchors, ...templateData } = data;

    const template = await ControlTemplate.create(
      { ...templateData, version: 1, meta: {} },
      { transaction: t },
    );

    if (calibrationAnchors && calibrationAnchors.length > 0) {
      await CalibrationAnchor.bulkCreate(
        calibrationAnchors.map((a) => ({ ...a, controlTemplateId: template.id })),
        { transaction: t },
      );
    }

    await t.commit();

    const full = await ControlTemplate.findByPk(template.id, {
      include: [{ model: CalibrationAnchor, as: 'CalibrationAnchors' }],
    });

    await logCreate({ type: 'control_template', id: template.id }, data);
    return full;
  } catch (err) {
    await t.rollback();
    if (err.name === 'SequelizeUniqueConstraintError') {
      throw new ConflictError(`A control with code '${data.code}' already exists for ${data.product}.`);
    }
    throw err;
  }
}

async function updateTemplate(templateId, data) {
  const template = await getTemplate(templateId);
  const before = templateSnapshot(template);

  const t = await sequelize.transaction();
  try {
    const { calibrationAnchors, ...templateData } = data;
    await template.update({ ...templateData, version: template.version + 1 }, { transaction: t });

    if (calibrationAnchors !== null && calibrationAnchors !== undefined) {
      await CalibrationAnchor.destroy({ where: { controlTemplateId: templateId }, transaction: t });
      if (calibrationAnchors.length > 0) {
        await CalibrationAnchor.bulkCreate(
          calibrationAnchors.map((a) => ({ ...a, controlTemplateId: templateId })),
          { transaction: t },
        );
      }
    }

    await t.commit();
  } catch (err) {
    await t.rollback();
    if (err.name === 'SequelizeUniqueConstraintError') {
      throw new ConflictError(`A control with code '${data.code}' already exists for ${data.product}.`);
    }
    throw err;
  }

  const updated = await ControlTemplate.findByPk(templateId, {
    include: [{ model: CalibrationAnchor, as: 'CalibrationAnchors' }],
  });

  await logUpdate({ type: 'control_template', id: templateId }, before, data);
  return updated;
}

async function deleteTemplate(templateId) {
  const template = await getTemplate(templateId);
  const before = templateSnapshot(template);

  try {
    await template.destroy();
  } catch (err) {
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      throw new ConflictError('Cannot delete a control template referenced by existing assessments.');
    }
    throw err;
  }

  await logDelete({ type: 'control_template', id: templateId }, before);
}

async function upsertAnchor(templateId, data) {
  const template = await getTemplate(templateId);

  let anchor = await CalibrationAnchor.findOne({
    where: { controlTemplateId: templateId, ragLevel: data.ragLevel },
  });

  if (!anchor) {
    anchor = await CalibrationAnchor.create({ ...data, controlTemplateId: templateId });
  } else {
    await anchor.update(data);
  }

  await logUpdate(
    { type: 'calibration_anchor', id: anchor.id },
    { controlTemplateId: templateId },
    data,
  );
  return anchor;
}

async function updateAnchor(anchorId, data) {
  const anchor = await CalibrationAnchor.findByPk(anchorId);
  if (!anchor) throw new NotFoundError();

  const before = { ragLevel: anchor.ragLevel, description: anchor.description, severityHint: anchor.severityHint };
  await anchor.update(data);
  await logUpdate({ type: 'calibration_anchor', id: anchorId }, before, data);
  return anchor;
}

async function deleteAnchor(anchorId) {
  const anchor = await CalibrationAnchor.findByPk(anchorId);
  if (!anchor) throw new NotFoundError();

  const before = {
    controlTemplateId: anchor.controlTemplateId,
    ragLevel: anchor.ragLevel,
    description: anchor.description,
    severityHint: anchor.severityHint,
  };
  await anchor.destroy();
  await logDelete({ type: 'calibration_anchor', id: anchorId }, before);
}

function templateSnapshot(template) {
  return {
    product: template.product,
    domain: template.domain,
    code: template.code,
    title: template.title,
    whatTesting: template.whatTesting,
    whyMatters: template.whyMatters,
    primaryQuestion: template.primaryQuestion,
    evidencePrompts: template.evidencePrompts,
    lookingFor: template.lookingFor,
    sampling: template.sampling,
    ifPartial: template.ifPartial,
    sortOrder: template.sortOrder,
    isActive: template.isActive,
    version: template.version,
  };
}

module.exports = { listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate, upsertAnchor, updateAnchor, deleteAnchor };
