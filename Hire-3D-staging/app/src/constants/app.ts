export const APP_NAME = 'Hire3D'

export const UserRole = {
  VIEWER: 'VIEWER',
  OPERATOR: 'OPERATOR',
  ADMIN: 'ADMIN'
} as const
export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  PENDING: 'PENDING',
  SUSPENDED: 'SUSPENDED'
} as const
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus]

export const ClientStatus = {
  ACTIVE: 'ACTIVE',
  AUDIT_IN_PROGRESS: 'AUDIT_IN_PROGRESS',
  REPORT_ISSUED: 'REPORT_ISSUED',
  FOLLOW_UP_DUE: 'FOLLOW_UP_DUE',
  INACTIVE: 'INACTIVE'
} as const
export type ClientStatus = (typeof ClientStatus)[keyof typeof ClientStatus]

export const ClientStatusLabel: Record<ClientStatus, string> = {
  ACTIVE: 'Active',
  AUDIT_IN_PROGRESS: 'Audit in Progress',
  REPORT_ISSUED: 'Report Issued',
  FOLLOW_UP_DUE: 'Follow-up Due',
  INACTIVE: 'Inactive'
}

export const BusinessStage = {
  PRE_HIRE: 'PRE_HIRE',
  EARLY: 'EARLY',
  GROWTH: 'GROWTH',
  ESTABLISHED: 'ESTABLISHED'
} as const
export type BusinessStage = (typeof BusinessStage)[keyof typeof BusinessStage]

export const BusinessStageLabel: Record<BusinessStage, string> = {
  PRE_HIRE: 'Pre-hire',
  EARLY: 'Early (1–5)',
  GROWTH: 'Growth (6–20)',
  ESTABLISHED: 'Established (21+)'
}

export const UKRegion = {
  EAST_MIDLANDS: 'EAST_MIDLANDS',
  EAST_OF_ENGLAND: 'EAST_OF_ENGLAND',
  LONDON: 'LONDON',
  NORTH_EAST: 'NORTH_EAST',
  NORTH_WEST: 'NORTH_WEST',
  SOUTH_EAST: 'SOUTH_EAST',
  SOUTH_WEST: 'SOUTH_WEST',
  WEST_MIDLANDS: 'WEST_MIDLANDS',
  YORKSHIRE_AND_THE_HUMBER: 'YORKSHIRE_AND_THE_HUMBER',
  NORTHERN_IRELAND: 'NORTHERN_IRELAND',
  SCOTLAND: 'SCOTLAND',
  WALES: 'WALES'
} as const
export type UKRegion = (typeof UKRegion)[keyof typeof UKRegion]

export const UKRegionLabel: Record<UKRegion, string> = {
  EAST_MIDLANDS: 'East Midlands',
  EAST_OF_ENGLAND: 'East of England',
  LONDON: 'London',
  NORTH_EAST: 'North East',
  NORTH_WEST: 'North West',
  SOUTH_EAST: 'South East',
  SOUTH_WEST: 'South West',
  WEST_MIDLANDS: 'West Midlands',
  YORKSHIRE_AND_THE_HUMBER: 'Yorkshire and The Humber',
  NORTHERN_IRELAND: 'Northern Ireland',
  SCOTLAND: 'Scotland',
  WALES: 'Wales'
}

export const Sectors = [
  'Construction',
  'Education',
  'Finance',
  'Healthcare',
  'Hospitality',
  'Legal',
  'Manufacturing',
  'Retail',
  'Technology',
  'Transport',
  'Other'
] as const
export type Sector = (typeof Sectors)[number]

export const Product = {
  HIRE_READY: 'HIRE_READY',
  THE_CHECK: 'THE_CHECK',
  HIRE_3D_CORE: 'HIRE_3D_CORE',
  HIRE_3D_ENHANCED: 'HIRE_3D_ENHANCED'
} as const
export type Product = (typeof Product)[keyof typeof Product]

export const ProductLabel: Record<Product, string> = {
  HIRE_READY: 'HIRE Ready',
  THE_CHECK: 'THE CHECK',
  HIRE_3D_CORE: 'HIRE 3D Core',
  HIRE_3D_ENHANCED: 'HIRE 3D Enhanced'
}

export const FeeStatus = {
  INVOICED: 'INVOICED',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE'
} as const
export type FeeStatus = (typeof FeeStatus)[keyof typeof FeeStatus]

export const FeeStatusLabel: Record<FeeStatus, string> = {
  INVOICED: 'Invoiced',
  PAID: 'Paid',
  OVERDUE: 'Overdue'
}

export const AuditStatus = {
  SCHEDULED: 'SCHEDULED',
  PHASE_1_COMPLETE: 'PHASE_1_COMPLETE',
  PHASE_2_COMPLETE: 'PHASE_2_COMPLETE',
  REPORT_ISSUED: 'REPORT_ISSUED'
} as const
export type AuditStatus = (typeof AuditStatus)[keyof typeof AuditStatus]

export const AuditStatusLabel: Record<AuditStatus, string> = {
  SCHEDULED: 'Scheduled',
  PHASE_1_COMPLETE: 'Phase 1 Complete',
  PHASE_2_COMPLETE: 'Phase 2 Complete',
  REPORT_ISSUED: 'Report Issued'
}

export const Domain = {
  A: 'A',
  B: 'B',
  C: 'C'
} as const
export type Domain = (typeof Domain)[keyof typeof Domain]

export const DomainLabel: Record<Domain, string> = {
  A: 'A — Employment & Legal Exposure',
  B: 'B — Operational Governance',
  C: 'C — Enhanced Controls'
}

export const RAGLevel = {
  RED: 'RED',
  AMBER_RED: 'AMBER_RED',
  AMBER: 'AMBER',
  GREEN_AMBER: 'GREEN_AMBER',
  GREEN: 'GREEN'
} as const
export type RAGLevel = (typeof RAGLevel)[keyof typeof RAGLevel]

export const RAGLevelLabel: Record<RAGLevel, string> = {
  RED: 'Red',
  AMBER_RED: 'Amber-Red',
  AMBER: 'Amber',
  GREEN_AMBER: 'Green-Amber',
  GREEN: 'Green'
}

export const RAGLevelOrder: RAGLevel[] = [
  'RED',
  'AMBER_RED',
  'AMBER',
  'GREEN_AMBER',
  'GREEN'
]

export const TheCheckRagLevels: RAGLevel[] = ['RED', 'AMBER', 'GREEN']
export const Hire3dRagLevels: RAGLevel[] = [
  'RED',
  'AMBER_RED',
  'AMBER',
  'GREEN_AMBER',
  'GREEN'
]

export function ragLevelsForProduct(product: Product): RAGLevel[] {
  if (product === 'THE_CHECK') return TheCheckRagLevels
  if (product === 'HIRE_3D_CORE' || product === 'HIRE_3D_ENHANCED')
    return Hire3dRagLevels
  return []
}

export const AssessmentPhase = {
  NOT_STARTED: 'NOT_STARTED',
  PHASE_1_IN_PROGRESS: 'PHASE_1_IN_PROGRESS',
  PHASE_1_CLOSED: 'PHASE_1_CLOSED',
  PHASE_2_SUBMITTED: 'PHASE_2_SUBMITTED',
  CANCELLED: 'CANCELLED'
} as const
export type AssessmentPhase =
  (typeof AssessmentPhase)[keyof typeof AssessmentPhase]

export const AssessmentPhaseLabel: Record<AssessmentPhase, string> = {
  NOT_STARTED: 'Not started',
  PHASE_1_IN_PROGRESS: 'Phase 1 in progress',
  PHASE_1_CLOSED: 'Phase 1 closed',
  PHASE_2_SUBMITTED: 'Phase 2 submitted',
  CANCELLED: 'Cancelled'
}

export const GateName = {
  ENGAGEMENT_LETTER_SIGNED: 'ENGAGEMENT_LETTER_SIGNED',
  INVOICE_RAISED: 'INVOICE_RAISED',
  NO_RAG_DURING_PHASE_1: 'NO_RAG_DURING_PHASE_1',
  PHASE_1_CLOSED: 'PHASE_1_CLOSED',
  PHASE_2_MANDATORY_FIELDS_COMPLETE: 'PHASE_2_MANDATORY_FIELDS_COMPLETE',
  QA_SIGN_OFF: 'QA_SIGN_OFF',
  ADMIN_REPORT_REVIEW: 'ADMIN_REPORT_REVIEW'
} as const
export type GateName = (typeof GateName)[keyof typeof GateName]

export const GateLabel: Record<GateName, string> = {
  ENGAGEMENT_LETTER_SIGNED: 'Engagement letter signed',
  INVOICE_RAISED: 'Invoice raised',
  NO_RAG_DURING_PHASE_1: 'No RAG ratings during Phase 1',
  PHASE_1_CLOSED: 'Phase 1 actively closed',
  PHASE_2_MANDATORY_FIELDS_COMPLETE:
    'Mandatory fields complete on Red / Amber-Red',
  QA_SIGN_OFF: 'QA sign-off by admin',
  ADMIN_REPORT_REVIEW: 'Admin report review'
}

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  USERS: '/users',
  USER_DETAIL: (userId: string) => `/users/${userId}`,
  SETTINGS: '/settings',
  SETTINGS_SECURITY: '/settings/security',
  SETTINGS_ROLES: '/settings/roles',
  SETTINGS_AUDIT_LOGS: '/settings/audit-logs',
  CLIENTS: '/clients',
  CLIENT_DETAIL: (clientId: string) => `/clients/${clientId}`,
  ADMIN_CONTROLS: '/admin/controls',
  ADMIN_CONTROL_DETAIL: (templateId: string) => `/admin/controls/${templateId}`
} as const
