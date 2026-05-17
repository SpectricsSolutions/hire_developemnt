import { ControlCard } from '@/components/phase1/ControlCard'
import { Phase1Sidebar } from '@/components/phase1/Phase1Sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { useAutoSave } from '@/hooks/useAutoSave'
import {
  type P1Control,
  type P1EvidenceStatus,
  type P1Workspace,
  getPhase1Workspace,
  uploadP1File,
} from '@/lib/phase1Api'
import { notifyApiError } from '@/lib/api-errors'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { ROUTES } from '@/constants/app'

export default function Phase1WorkspacePage() {
  const { engagementId } = useParams<{ engagementId: string }>()
  const { can } = useAuth()
  const [workspace, setWorkspace] = useState<P1Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeControlId, setActiveControlId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  if (!can('assessments:read')) return <Navigate to={ROUTES.HOME} replace />

  // ── Load workspace ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!engagementId) return
    getPhase1Workspace(engagementId)
      .then(setWorkspace)
      .catch((err) => notifyApiError(err, 'Failed to load workspace'))
      .finally(() => setLoading(false))
  }, [engagementId])

  // ── Auto-save ───────────────────────────────────────────────────────────────
  const handleSaved = useCallback((itemId: string, data: { status?: P1EvidenceStatus; notes?: string | null }) => {
    setWorkspace((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        controls: prev.controls.map((c) =>
          c.evidence?.id === itemId
            ? { ...c, evidence: { ...c.evidence!, ...data } }
            : c,
        ),
      }
    })
  }, [])

  const { queueText, saveImmediate, hasPendingSaves } = useAutoSave(handleSaved)

  // ── Navigation guard (T3.04) ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasPendingSaves) e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasPendingSaves])

  // ── Intersection Observer — track active control (T3.03) ───────────────────
  useEffect(() => {
    if (!workspace) return
    const observers: IntersectionObserver[] = []
    workspace.controls.forEach((c) => {
      const el = document.getElementById(`control-${c.id}`)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveControlId(c.id) },
        { root: scrollRef.current, threshold: 0.3 },
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach((o) => o.disconnect())
  }, [workspace])

  // ── Smart resume — scroll to first incomplete control (T3.04) ──────────────
  useEffect(() => {
    if (!workspace || loading) return
    const first = workspace.controls.find(
      (c) => !c.evidence || c.evidence.status === 'not_provided',
    )
    if (first) {
      setTimeout(() => {
        document.getElementById(`control-${first.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    }
  }, [workspace, loading])

  // ── Recalculate progress from current state ─────────────────────────────────
  function recalcProgress(controls: P1Control[]) {
    const counts = { seen: 0, partial: 0, requested: 0, notProvided: 0 }
    for (const c of controls) {
      const s = c.evidence?.status ?? 'not_provided'
      if (s === 'seen') counts.seen++
      else if (s === 'partial') counts.partial++
      else if (s === 'requested') counts.requested++
      else counts.notProvided++
    }
    const done = counts.seen + counts.partial
    const total = controls.length
    return { total, ...counts, percentageComplete: total > 0 ? Math.round((done / total) * 100) : 0 }
  }

  // ── Event handlers ──────────────────────────────────────────────────────────
  function handleNotesChange(control: P1Control, notes: string) {
    if (!control.evidence) return
    queueText(control.evidence.id, { notes })
  }

  function handleStatusChange(control: P1Control, status: P1EvidenceStatus) {
    if (!control.evidence) return
    // Optimistic update
    setWorkspace((prev) => {
      if (!prev) return prev
      const controls = prev.controls.map((c) =>
        c.id === control.id ? { ...c, evidence: { ...c.evidence!, status } } : c,
      )
      return { ...prev, controls, progress: recalcProgress(controls) }
    })
    saveImmediate(control.evidence.id, { status })
  }

  async function handleFileUpload(control: P1Control, file: File) {
    if (!control.evidence) return
    try {
      const updated = await uploadP1File(control.evidence.id, file)
      setWorkspace((prev) => {
        if (!prev) return prev
        const controls = prev.controls.map((c) =>
          c.id === control.id ? { ...c, evidence: updated } : c,
        )
        return { ...prev, controls, progress: recalcProgress(controls) }
      })
      toast.success('File uploaded.')
    } catch (err) {
      notifyApiError(err, 'Upload failed.')
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const progress = workspace ? recalcProgress(workspace.controls) : null

  return (
    /* Full-bleed — escape dashboard layout padding */
    <div className="flex flex-col -mx-4 -my-4 md:-mx-6 md:-my-6 h-[calc(100vh-3.5rem)]">

      {/* ── Navy header + progress bar ───────────────────────────────── */}
      <header className="bg-slate-900 text-white px-6 py-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Link
              to={ROUTES.HOME}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Back"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <p className="text-xs text-slate-400">Phase 1 — Evidence Capture</p>
              <p className="font-semibold text-sm">
                {workspace?.product ?? 'Loading…'}
              </p>
            </div>
          </div>
          {progress && (
            <p className="text-xs text-slate-300">
              {progress.seen + progress.partial}/{progress.total} controls complete
              {progress.requested > 0 && (
                <span className="ml-2 text-red-400">
                  · {progress.requested} requested
                </span>
              )}
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden" role="progressbar"
          aria-valuenow={progress?.percentageComplete ?? 0} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="h-full bg-green-400 transition-all duration-500"
            style={{ width: `${progress?.percentageComplete ?? 0}%` }}
          />
        </div>
      </header>

      {/* ── Body: sidebar + scrollable cards ─────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        {workspace && (
          <Phase1Sidebar
            controls={workspace.controls}
            activeControlId={activeControlId}
          />
        )}

        {/* Scrollable control cards */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
            </div>
          )}

          {!loading && workspace?.controls.length === 0 && (
            <p className="text-slate-500 text-sm text-center mt-12">
              No controls found for this product.
            </p>
          )}

          {!loading && workspace?.controls.map((control) => (
            <ControlCard
              key={control.id}
              control={control}
              onNotesChange={(notes) => handleNotesChange(control, notes)}
              onStatusChange={(status) => handleStatusChange(control, status)}
              onFileUpload={(file) => handleFileUpload(control, file)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
