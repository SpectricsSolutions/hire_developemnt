# SPIKE: RAG Dial for THE CHECK Executive Summary
**Date:** 18 May 2026  
**Status:** Awaiting Darren's decision  
**Author:** Spectrics Solutions  

---

## 1. Effort Estimate

### Option A — Build (full weighting engine + dial)
| Component | Effort |
|---|---|
| `weight` column on `control_templates` + admin UI to configure | 2 days |
| Validation that weights sum to 100 per product | 0.5 days |
| Scoring rollup: control RAG → numeric score → company-level dial score | 1.5 days |
| Dial visualisation component on exec summary | 1 day |
| Tests + integration | 1 day |
| **Total** | **~6 days** |

### Option B — Build lite (dial only, manual score entry)
| Component | Effort |
|---|---|
| `weight` column seeded with defaults — no admin UI | 0.5 days |
| Operator enters dial score manually on exec summary screen | 0.5 days |
| Dial visualisation component | 1 day |
| **Total** | **~2 days** |

### Option C — Defer
Zero effort. Park entirely. Ship MVP without the dial.

---

## 2. Schema Impact

### Change required regardless of option chosen (Build or Build lite)
Add a `weight` column to `control_templates`:

```sql
ALTER TABLE control_templates ADD COLUMN weight INTEGER DEFAULT NULL;
```

- Nullable — only populated for `THE_CHECK` product controls (10 controls, must sum to 100)
- No impact on `HIRE_3D_CORE` or `HIRE_3D_ENHANCED` — weights left null for those products
- No conflict with existing model decisions

### Additional change for Build (Option A only)
Add a `rag_score` column to `assessments` (or a separate `findings_summary` table):

```sql
ALTER TABLE assessments ADD COLUMN rag_score NUMERIC(5,2) DEFAULT NULL;
```

- Computed from: (control RAG → numeric mapping) × weight, summed across 10 controls
- Stored at assessment close for the exec summary report
- No impact on Phase 1 closure logic (evidence rollup remains separate)

### No conflict with existing data model
The existing `p1_evidence` and `evidence_items` tables hold delivery status only — the comment in `P1Evidence.js` explicitly marks `"NO RAG, severity, consequence, or findings fields (Phase 1 gate)"`. The weight/score additions sit entirely in Phase 2 and do not touch Phase 1 logic.

---

## 3. Cycle Placement

| Cycle | What lands |
|---|---|
| Cycle 3 (current) | No RAG dial work. `weight` column could be added as a schema seed — low risk, zero UI. |
| Cycle 5 | Phase 2 RAG assignment for THE CHECK — **natural home for scoring rollup** if Build chosen |
| Cycle 6 | Report production — **natural home for dial visualisation** if Build chosen |

**Earlier dependency flag:**  
If proceeding with Build or Build lite, the `weight` column should be seeded in Cycle 3 so Darren can validate defaults early. This is a one-line schema change — no UI, no risk.

**Tickets needing scope adjustment if Build chosen:**
- Cycle 5 ticket for Phase 2 RAG assignment — add scoring rollup scope
- Cycle 6 report production ticket — add dial component scope
- No Cycle 3 or 4 tickets need adjustment

---

## 4. Calibration Mechanics

### How weights are set
- **Seed defaults** from day one — weights pre-populated per Darren's input against the 10 THE CHECK controls (see weighting sheet below)
- **No admin UI at MVP** — weights are static seed data, updated via a migration if Darren wants to adjust post-launch
- **Admin UI deferred** to post-MVP if clients ask to customise weights per engagement

### Validation
- Weights must sum to exactly 100 for `THE_CHECK` product
- Enforced at the application layer on Phase 2 close, not at DB level (nullable column allows partial setup during development)
- Normalisation (auto-rescaling) **not recommended** — silent rescaling would change scores without the operator knowing. Prefer a hard validation error.

### Weights apply per control, not per evidence item
- One weight per control template
- Score = sum of (control RAG numeric value × control weight / 100)
- RAG numeric mapping: Green = 100, Amber = 50, Red = 0 (or Darren's preferred scale — confirm before build)

---

## 5. Inconsistency: THE CHECK Product Spec vs. CRM Spec

**The inconsistency:**
- **THE CHECK product spec** (`THE_CHECK_Exec_Summary_v2_1_.docx`) describes risk exposure as qualitative narrative — no numeric score, no dial
- **CRM spec** (`HIRE_CRM_Spec.docx`) describes financial exposure visuals as required across **all products**

**This RAG dial discussion is the right moment to resolve it.**  
The two specs are in conflict on whether THE CHECK produces a numeric output. Before any build work begins, Darren and Pete need to confirm:

1. Does THE CHECK exec summary carry a numeric/visual risk score at MVP, or qualitative only?
2. If the CRM spec's financial exposure visual is a hard requirement across all products, does that override the THE CHECK spec?

Recommend raising this explicitly in the position conversation with Darren — it affects report template design in Cycle 6 regardless of the dial decision.

---

## 6. Recommendation: **Build lite**

**Rationale:**  
The client's own framing — *"a visual to focus the mind, not something that can be scientifically analysed"* — maps exactly to Build lite. A manually-entered dial score gives the visual without the complexity of a validated weighting engine. The engine adds ~4 days of effort and introduces calibration questions (RAG-to-number mapping, weight validation, score storage) that are not needed if the score is operator-owned.

Build lite also fits the MVP timeline: the dial lands in Cycle 6 (report production) at ~2 days total effort, with no disruption to Cycles 3–5.

**Recommended approach:**
1. Seed `weight` defaults in Cycle 3 (schema only, 0.5 days) so Darren can validate the weightings early
2. Operator enters overall dial score manually when producing the exec summary (Cycle 6)
3. Dial visualisation component built in Cycle 6 alongside the rest of the exec summary report
4. Full weighting engine deferred to post-MVP — revisit if clients ask for it

**If Darren prefers Build (full engine):** The logical home remains Cycles 5–6. Add ~4 days to those cycles. Raise spec inconsistency (section 5) before design begins.

**If Darren prefers Defer:** No action. Remove `weight` column consideration from Cycle 3 backlog.

---

## Weighting Sheet — THE CHECK Controls
*For Darren to populate. Weights must sum to 100.*

| # | Control | Suggested Weight | Darren's Weight |
|---|---|---|---|
| 1 | Employee Contracts and Written Particulars | 10 | |
| 2 | Contractor and Freelancer Agreements | 8 | |
| 3 | IR35 and Contractor Employment Status | 12 | |
| 4 | Right-to-Work Checks and Evidence Retention | 15 | |
| 5 | Payroll, NMW, SSP, and Pension Auto-Enrolment | 12 | |
| 6 | Core Employment Policies | 10 | |
| 7 | Data Protection, Confidentiality, and ICO Registration | 10 | |
| 8 | Record-Keeping and Document Retrieval | 8 | |
| 9 | Operational Resilience and Single Points of Failure | 8 | |
| 10 | People Risk Awareness | 7 | |
| | **Total** | **100** | |

*Suggested weights are indicative only — Right-to-Work (4) and IR35 (3) weighted heavier given regulatory exposure. Darren to confirm or redistribute.*

---

## Next Steps
1. Share this document with Darren via SCC
2. Log Darren's decision (Build / Build lite / Defer) in SCC
3. **No build ticket raised until decision is logged**
