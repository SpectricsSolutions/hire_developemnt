'use strict';

const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

const SOURCES_DIR = path.resolve(
  __dirname,
  '../../Hire-3D-staging/api/controls/seeding/sources',
);

const PRODUCT_SOURCES = [
  ['THE_CHECK', 'the_check.md'],
  ['HIRE_3D_CORE', 'hire_3d_core.md'],
  ['HIRE_3D_ENHANCED', 'hire_3d_enhanced.md'],
];

// --- Markdown parser (mirrors Python parser.py) ---

const HEADING = /^##\s+\*\*\s*(?<code>[A-Z]?\d+)\s+[—\-]+\s+(?<title>.+?)\s*\*\*\s*$/;
const SECTION = /^\*\*\s*(?<label>[^*]+?)\s*:\*\*\s*$/;
const BULLET  = /^\s*[•*\-]\s+(?<text>.+?)\s*$/;

const LABEL_TO_FIELD = {
  'what you are testing': 'whatTesting',
  'why this matters': 'whyMatters',
  'primary question (ask verbatim)': 'primaryQuestion',
  'follow-up evidence prompts (what you want them to show you)': 'evidencePrompts',
  'what you are looking for': 'lookingFor',
  'sampling': 'sampling',
  'if evidence is partial': 'ifPartial',
};
const LIST_FIELDS  = new Set(['evidencePrompts', 'lookingFor', 'ifPartial']);
const PROSE_FIELDS = new Set(['whatTesting', 'whyMatters', 'primaryQuestion', 'sampling']);

function stripEmphasis(text) {
  let s = text.trim();
  while (s.length > 1 && '_*'.includes(s[0]) && '_*'.includes(s[s.length - 1])) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function parseMarkdown(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  const controls = [];
  let current = null;
  let currentField = null;
  let proseBuffer = [];

  function flushProse() {
    if (!current || !currentField) { proseBuffer = []; return; }
    if (PROSE_FIELDS.has(currentField) && proseBuffer.length) {
      const joined = stripEmphasis(proseBuffer.map(l => l.trim()).filter(Boolean).join(' '));
      const existing = current[currentField] || '';
      current[currentField] = existing ? `${existing} ${joined}`.trim() : joined;
    }
    proseBuffer = [];
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    const hm = line.match(HEADING);
    if (hm) {
      flushProse();
      if (current) controls.push(current);
      const { code, title } = hm.groups;
      current = {
        code,
        title,
        domain: /^[A-Z]/.test(code) ? code[0] : null,
        whatTesting: '',
        whyMatters: '',
        primaryQuestion: '',
        evidencePrompts: [],
        lookingFor: [],
        sampling: null,
        ifPartial: [],
      };
      currentField = null;
      continue;
    }
    if (!current) continue;

    const sm = line.match(SECTION);
    if (sm) {
      flushProse();
      currentField = LABEL_TO_FIELD[sm.groups.label.trim().toLowerCase()] || null;
      continue;
    }
    if (!currentField) continue;

    if (LIST_FIELDS.has(currentField)) {
      const bm = line.match(BULLET);
      if (bm) current[currentField].push(bm.groups.text.trim());
      continue;
    }
    if (line.trim()) proseBuffer.push(line);
  }

  flushProse();
  if (current) controls.push(current);
  return controls;
}

// --- Calibration anchor templates ---

const THE_CHECK_ANCHORS = [
  { ragLevel: 'GREEN', description: 'All required items demonstrated; documents produced on request and consistent with described practice.', severityHint: 4 },
  { ragLevel: 'AMBER', description: 'Some required items demonstrated, but gaps consistent with the partial-evidence patterns are present.', severityHint: 3 },
  { ragLevel: 'RED',   description: 'Required items materially absent; founder cannot demonstrate compliance; one or more partial-evidence patterns clearly observed.', severityHint: 1 },
];

const HIRE_3D_ANCHORS = [
  { ragLevel: 'GREEN',       description: "Full evidence: every item in 'What You Are Looking For' demonstrated, documentation comprehensive, current, and accessible without delay.", severityHint: 5 },
  { ragLevel: 'GREEN_AMBER', description: 'Substantively compliant: all items present but with minor gaps in currency, completeness, or access control.', severityHint: 4 },
  { ragLevel: 'AMBER',       description: "Partial compliance: one or more 'What You Are Looking For' items missing or weak; partial-evidence patterns observed; remediation needed.", severityHint: 3 },
  { ragLevel: 'AMBER_RED',   description: 'Significant gap: multiple partial-evidence patterns; key controls missing; investor or regulator would flag on inspection.', severityHint: 2 },
  { ragLevel: 'RED',         description: 'Material absence: required items not in place; founder cannot demonstrate basic compliance; immediate exposure to enforcement.', severityHint: 1 },
];

function composeAnchorDesc(template, control) {
  let cue = '';
  if (['RED', 'AMBER_RED', 'AMBER'].includes(template.ragLevel) && control.ifPartial.length) {
    cue = ' Examples for this control: ' + control.ifPartial.slice(0, 3).join('; ') + '.';
  } else if (['GREEN', 'GREEN_AMBER'].includes(template.ragLevel) && control.lookingFor.length) {
    cue = ' Examples for this control: ' + control.lookingFor.slice(0, 3).join('; ') + '.';
  }
  return template.description + cue;
}

function buildAnchors(product, control, templateId, now) {
  const templates = product === 'THE_CHECK' ? THE_CHECK_ANCHORS : HIRE_3D_ANCHORS;
  return templates.map(t => ({
    id: randomUUID(),
    control_template_id: templateId,
    rag_level: t.ragLevel,
    description: composeAnchorDesc(t, control),
    severity_hint: t.severityHint,
    created_at: now,
    updated_at: now,
  }));
}

// --- Seeder ---

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const templateRows = [];
    const anchorRows = [];

    for (const [product, filename] of PRODUCT_SOURCES) {
      const filePath = path.join(SOURCES_DIR, filename);
      if (!fs.existsSync(filePath)) {
        console.warn(`Source file not found: ${filePath} — skipping`);
        continue;
      }
      const controls = parseMarkdown(filePath);
      console.log(`Parsed ${controls.length} controls for ${product}`);

      controls.forEach((ctrl, idx) => {
        const templateId = randomUUID();
        templateRows.push({
          id: templateId,
          product,
          domain: ctrl.domain,
          code: ctrl.code,
          title: ctrl.title,
          what_testing: ctrl.whatTesting,
          why_matters: ctrl.whyMatters,
          primary_question: ctrl.primaryQuestion,
          evidence_prompts: JSON.stringify(ctrl.evidencePrompts),
          looking_for: JSON.stringify(ctrl.lookingFor),
          sampling: ctrl.sampling,
          if_partial: JSON.stringify(ctrl.ifPartial),
          sort_order: idx + 1,
          is_active: true,
          version: 1,
          meta: '{}',
          created_at: now,
          updated_at: now,
        });
        anchorRows.push(...buildAnchors(product, ctrl, templateId, now));
      });
    }

    if (templateRows.length > 0) {
      await queryInterface.bulkInsert('control_templates', templateRows, { ignoreDuplicates: true });
      await queryInterface.bulkInsert('calibration_anchors', anchorRows, { ignoreDuplicates: true });
      console.log(`Seeded ${templateRows.length} control templates and ${anchorRows.length} calibration anchors.`);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('calibration_anchors', null, {});
    await queryInterface.bulkDelete('control_templates', null, {});
  },
};
