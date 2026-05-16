# Product Specification

HIRE Partnerships CRM — internal platform for managing client audits across four products.  
Source: KT documents provided by Darren & Pete Thompson, HIRE Partnerships Limited (March 2026).

---

## The Four Products

| Product | Controls | Who it's for |
|---|---|---|
| **HIRE Ready** | None (advisory only) | Pre-hire founders about to make their first hire. Documentation and guidance product — no audit conducted. |
| **THE CHECK** | 10 | Businesses with 3–20 employees. Light-touch compliance review. 3-level RAG. |
| **HIRE 3D Core** | 25 | Growth-stage businesses. Full audit across three domains. 5-level RAG. |
| **HIRE 3D Enhanced** | 34 | Pre-transaction or complex workforce. Extends Domain C with 11 extra controls. 5-level RAG. |

**HIRE Ready clients must never appear as completed or inactive. They are always active prospects for THE CHECK.**

---

## User Roles

| Role | Who | Permissions |
|---|---|---|
| **Admin** | Darren and Pete | Full access: clients, engagements, audits, reports, users, pipeline, revenue, introducers |
| **Operator** | Auditors | Assigned clients only. Conduct Phase 1 and Phase 2 audits. No pipeline, revenue, introducer, or other clients' data. |
| **Viewer** | Dan / advisers | Read-only: client records and issued reports. No revenue or pipeline data. |

Operators have zero visibility of pipeline data, revenue, introducer records, or other clients' work. Hard permission boundary, not a preference.

---

## Data Model

### Client (master record — never deleted)

| Field | Type | Notes |
|---|---|---|
| company_name | Text | Required |
| companies_house_number | Text | Optional |
| primary_contact_name | Text | Required |
| primary_contact_email | Email | Required |
| primary_contact_phone | Text | Optional |
| sector | Dropdown | Configurable list (admin-managed) |
| headcount_at_engagement | Number | Required. Recorded per product purchase. Drives pipeline triggers. |
| current_headcount | Number | Updated manually. Triggers HIRE Ready → THE CHECK alert at 3. |
| business_stage | Dropdown | Pre-hire / Early (1–5) / Growth (6–20) / Established (21+) |
| region | Dropdown | UK regions |
| assigned_operator_id | FK → users | Required before audit can begin |
| internal_notes | Free text | Admin only. Never in any client output. |
| status | Dropdown | Active / Audit in progress / Report issued / Follow-up due / Inactive |
| hubspot_contact_id | Text | Optional. Reserved for future HubSpot integration. |
| created_at | Auto | Read only |

*Introducer and Introducer fee applicable fields deferred — not required at launch.*

### Engagement (one per product purchase, linked to client)

| Field | Type | Notes |
|---|---|---|
| client_id | FK → clients | Required |
| product | Dropdown | HIRE Ready / THE CHECK / HIRE 3D Core / HIRE 3D Enhanced |
| engagement_date | Date | Date product purchased or confirmed |
| fee_charged | Currency | Actual fee for this engagement |
| fee_status | Dropdown | Invoiced / Paid / Overdue |
| audit_date | Date | Date of Phase 1 session. Populated after session closes. |
| report_issued_date | Date | Date executive summary sent to client |
| audit_status | Dropdown | Scheduled / Phase 1 complete / Phase 2 complete / Report issued |
| overall_rag | Auto-calculated | Read only. Derived from findings log after Phase 2. |
| risk_score | Integer 0–100 | Auto-calculated. Read only. Derived after Phase 2 submission. |
| next_review_due | Date | Auto-populated based on product. Editable by Admin. |

### Evidence Log (Phase 1 — one row per control per engagement)

| Field | Type | Notes |
|---|---|---|
| engagement_id | FK → engagements | |
| domain | A / B / C | Auto-populated from control reference |
| control_id | Text (e.g. A3) | Auto-populated |
| control_name | Text | Auto-populated from product framework |
| verbal_evidence | Free text | What the client said in the session |
| documents_produced | Free text + file upload | Description + attached files |
| evidence_status | Dropdown | Seen / Requested / Not Provided / Partial |
| date_evidence_received | Date | Auto-populated on document upload |

### Findings Log (Phase 2 — one row per control per engagement)

| Field | Type | Notes |
|---|---|---|
| engagement_id | FK → engagements | |
| domain | A / B / C | Auto-populated |
| control_id | Text | Auto-populated |
| control_name | Text | Auto-populated |
| rag_rating | Dropdown | 5-level (HIRE 3D) or 3-level (THE CHECK) |
| observed | Free text | What the evidence shows. Mandatory for Red/Amber-Red. |
| evidence | Free text | Specific documents or statements relied upon |
| consequence | Free text | What the risk means for this business. Mandatory for Red/Amber-Red. |
| exposure | Free text | Financial or legal penalty range. Mandatory for Red/Amber-Red. Feeds exposure calculator. |
| required_action | Free text | What the client must do. Appears verbatim in report. Mandatory for Red/Amber-Red. |
| severity | 1–5 | 1=Critical (days), 2=High (30d), 3=Medium (90d), 4=Low (next cycle), 5=Informational |
| remediation_owner | Text | Named individual at client responsible |
| target_remediation_date | Date | Operator-assigned. Drives follow-up alerts. |
| date_finding_closed | Date | Admin only. Populated when remediation confirmed. |

**Consequence and Exposure are always two separate fields — never merged.**

---

## RAG Rating Systems

| Product | Levels |
|---|---|
| THE CHECK | Red / Amber / Green |
| HIRE 3D Core & Enhanced | Red / Amber-Red / Amber / Green-Amber / Green |

---

## Risk Score Formula (HIRE 3D only — not used for THE CHECK)

**Step 1 — RAG base score**

| RAG | Base Score |
|---|---|
| Red | 0 |
| Amber-Red | 25 |
| Amber | 50 |
| Green-Amber | 75 |
| Green | 100 |

**Step 2 — Severity weight**

| Severity | Label | Weight |
|---|---|---|
| 1 | Critical | 5 |
| 2 | High | 4 |
| 3 | Medium | 3 |
| 4 | Low | 2 |
| 5 | Informational | 1 |

**Step 3 — Weighted score per control**
`Weighted Score = RAG Base Score × Severity Weight`

**Step 4 — Overall score (0–100)**
`Overall Score = (Sum of Weighted Scores ÷ Sum of Maximum Possible Weighted Scores) × 100`

Maximum possible weighted score per control = `100 × Severity Weight`. Round to nearest whole number.

**Step 5 — Domain scores**
Apply the same formula to controls within each domain independently. Each domain (A, B, C) produces its own 0–100 score.

Validated reference: Meridian Growth Partners Ltd (H3D-2026-0112, 25 controls) — overall 43/100, domains A:28 B:59 C:36.

---

## Two-Phase Audit Workflow

### Phase 1 — Audit Session (client present)

- Operator works through controls with client in the room or on a call
- For each control: records verbal notes, documents produced, sets evidence status
- **No RAG ratings assigned under any circumstances — platform enforces by hiding RAG fields entirely**
- Phase 1 remains open until operator actively closes it (evidence may arrive by email after session)
- CRM sets a 5-working-day reminder for any control with status `Requested`

### Phase 2 — Evidence Review & Rating (client absent)

- Only becomes available after Phase 1 is actively closed (irreversible action)
- Operator reviews evidence against calibration guide, assigns RAG to each control
- For Red and Amber-Red ratings: Observed, Consequence, Exposure, Required Action, and Severity are **mandatory** — platform blocks submission until complete
- On submit: risk score calculated, overall RAG auto-populated, status → Phase 2 complete

### Hard Gates (enforced at platform level, no exceptions)

| Gate | Rule |
|---|---|
| Before audit is scheduled | Signed engagement letter on file |
| Before audit session begins | Invoice raised |
| During Phase 1 | No RAG fields exist on Phase 1 screen |
| Before Phase 2 opens | Operator must actively close Phase 1 |
| Before Phase 2 submits | Mandatory fields complete for all Red/Amber-Red controls |
| Before report is generated | QA sign-off by Admin (Darren or Pete) |
| Before report is sent | Admin reviews both reports and covering letter |

---

## Pipeline Funnel & Progression Triggers

**Product ladder:** HIRE Ready → THE CHECK → HIRE 3D Core → HIRE 3D Enhanced

| From | Trigger | Platform action |
|---|---|---|
| HIRE Ready | 12 months since engagement date | Flag for THE CHECK outreach. Dashboard alert + Admin notification. |
| HIRE Ready | Current headcount updated to ≥ 3 | Immediate flag regardless of time elapsed. Overrides 12-month trigger. |
| THE CHECK | 12 months since report issued | Flag for HIRE 3D Core conversation. |
| THE CHECK | Red finding with no closed date at 90 days | Flag for follow-up call. |
| HIRE 3D Core | Transaction or fundraise planned (Admin sets manually) | Flag as Enhanced candidate. |
| Any product | Next review date reached | Admin notification. Dashboard alert. |

---

## Report Generation

Two documents produced per completed engagement, assembled automatically from findings log data. Operator does not type the report.

### Executive Summary

| Page | Content |
|---|---|
| 1 | Executive snapshot: client details, overall risk score, three-domain RAG strip, one-paragraph assessment |
| 2 | Risk dashboard: RAG count blocks, proportional colour strip, domain compliance summary, radar chart |
| 3 | Financial exposure: Low/Mid/High scenario summary, per-finding exposure table |
| 4 | Full heat map: all controls, RAG-coloured, grouped by domain |
| 5+ | Detailed findings: one card per control — what we found, why it matters, exposure strip, required action |
| Final | What happens next: timeline with specific dates including FWA launch (7 April 2026), contact close-out |

THE CHECK: 5 pages, 3-level RAG.  
HIRE 3D Core/Enhanced: 7+ pages, 5-level RAG, radar chart, financial exposure page.

### Full Findings Report

Longer document for legal advisers and due diligence. Same findings log data as the Executive Summary.

### Covering Letter

Per-engagement. References audit reference number, report date, how to read the report, FWA launch date, confidentiality instruction.

### Export Format

Both reports exportable as Word (.docx) and PDF. Word version for internal editing; PDF is the send-to-client version. No automated sending — Admin sends manually.

### Branding

Arial throughout. HIRE Partnerships logo on cover page. HIRE 3D Audit™ trademark on all outputs.

---

## Required Report Visuals

| Visual | What it shows |
|---|---|
| RAG count blocks | Coloured blocks showing count per rating level (5 for HIRE 3D, 3 for THE CHECK) |
| Proportional colour strip | Horizontal bar showing RAG distribution as proportional colour segments |
| Financial exposure summary | Low/Mid/High scenario totals in three coloured columns |
| Domain compliance radar chart | Three-axis spider chart, 0–100 scale per domain, Red/Amber/Green zone shading |
| Per-finding financial strip | Inline Low/Mid/High strip within each Red or Amber-Red finding card |
| Priority heat map table | All controls in one table, RAG-coloured, grouped by domain, with timescale column |

---

## Admin Dashboard Data

| Data point | Description |
|---|---|
| Active clients by product | Count and list at each product stage |
| Pipeline value | Estimated revenue from clients eligible for next product |
| Revenue — invoiced and paid | Month to date and year to date, broken down by product |
| Audit completion rates | Phase 1 complete / Phase 2 complete / report issued — by operator and period |
| Outstanding findings | Open Red and Amber-Red findings across all active clients |
| Overdue evidence requests | Controls with status Requested, no document received within 5 working days |
| Clients approaching review dates | Pipeline alert list for outreach planning |

---

## Technical Requirements

- UK data residency (eu-west-2) — already in place
- GDPR compliant, data encrypted at rest and in transit — already in place
- RBAC enforced at application layer — already in place
- Daily automated backup — already in place (14-day RDS retention)
- Audit trail for all findings record edits (user ID + timestamp) — audit_logs table already in place
- Session timeout after inactivity — configurable via `REFRESH_TOKEN_EXPIRE_DAYS`
- 2FA available for all users — TOTP already in place
- Financial exposure penalty ranges: Admin-configurable (regulatory figures change)

### HubSpot Integration (future)

Not required at launch. Client records carry a `hubspot_contact_id` field. Key status changes (report issued, review due, pipeline progression) should be triggerable via webhook when integration is built.

---

## Build Phases

| Phase | Scope |
|---|---|
| **A** | Clients + Engagements CRUD (data foundation) |
| **B** | Controls seed data + Evidence Log (Phase 1 audit workflow) |
| **C** | Findings Log + Phase 2 workflow + risk score calculation |
| **D** | Pipeline dashboard + progression triggers + automated reminders |
| **E** | Report generation — Word/PDF export (Executive Summary + Full Findings) |
| **F** | Revenue reporting, QA sign-off workflow, Admin dashboard data |

---

## Open Questions (from client)

| # | Question | Status |
|---|---|---|
| 1 | Risk score formula | Resolved — see formula above |
| 2 | Report format: live web vs Word/PDF | Resolved — Word + PDF export |
| 3 | Client portal (founders log in to view results) | Not required at launch. May be Phase 2. |
| 4 | Financial exposure penalty ranges: fixed in code or Admin-configurable? | Admin-configurable |
| 5 | AI-assisted report drafting | Not required at launch. Structured data foundation being built now. |
