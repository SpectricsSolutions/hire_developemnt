import { client } from '@/client/client.gen'
import { unwrap } from '@/lib/api-client'

// ── Types ─────────────────────────────────────────────────────────────────────

export type P1EvidenceStatus = 'not_provided' | 'seen' | 'partial' | 'requested'

export type P1Evidence = {
  id: string
  status: P1EvidenceStatus
  notes: string | null           // verbal evidence / session notes
  documentNotes: string | null   // documents produced (US-021)
  documentLink: string | null    // URL link to document (US-021)
  fileUrl: string | null
  fileName: string | null
}

export type P1Control = {
  id: string
  code: string
  domain: string | null
  title: string
  primaryQuestion: string
  evidencePrompts: string[]
  lookingFor: string[]
  sampling: string | null
  ifPartial: string[]
  sortOrder: number
  evidence: P1Evidence | null
}

export type P1Progress = {
  total: number
  seen: number
  partial: number
  requested: number
  notProvided: number
  percentageComplete: number
}

export type P1Workspace = {
  engagementId: string
  product: string
  assessment: { id: string; phase: string } | null
  controls: P1Control[]
  progress: P1Progress
}

// ── API calls ─────────────────────────────────────────────────────────────────

const BEARER = [{ scheme: 'bearer', type: 'http' }] as const

export async function getPhase1Workspace(engagementId: string): Promise<P1Workspace> {
  const res = await client.get<{ data: P1Workspace }>({
    url: `/api/v1/phase1/${engagementId}`,
    responseType: 'json',
    security: BEARER,
  })
  return unwrap<{ data: P1Workspace }>(res).data
}

export async function updateP1Evidence(
  itemId: string,
  data: { status?: P1EvidenceStatus; notes?: string | null; documentNotes?: string | null; documentLink?: string | null }
): Promise<P1Evidence> {
  const res = await client.put<{ data: P1Evidence }>({
    url: `/api/v1/phase1-evidence/${itemId}`,
    body: data,
    responseType: 'json',
    security: BEARER,
  })
  return unwrap<{ data: P1Evidence }>(res).data
}

export async function uploadP1File(itemId: string, file: File): Promise<P1Evidence> {
  const form = new FormData()
  form.append('file', file)
  const res = await client.post<{ data: P1Evidence }>({
    url: `/api/v1/phase1-evidence/${itemId}/upload`,
    body: form,
    responseType: 'json',
    security: BEARER,
    headers: { 'Content-Type': undefined }, // let browser set multipart boundary
  })
  return unwrap<{ data: P1Evidence }>(res).data
}
