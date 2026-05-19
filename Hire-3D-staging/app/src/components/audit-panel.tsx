import {
  cancelAssessment,
  closeAssessmentPhase1,
  getEngagementAssessment,
  getEngagementGates,
  startAssessment,
  submitAssessmentPhase2
} from '@/client/sdk.gen'
import type { AssessmentRead, GateReport, GateStatus } from '@/client/types.gen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AssessmentPhase,
  AssessmentPhaseLabel,
  GateLabel,
  GateName
} from '@/constants/app'
import { useAuth } from '@/contexts/auth-context'
import { unwrap } from '@/lib/api-client'
import { notifyApiError } from '@/lib/api-errors'
import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

const PRE_START_GATES: GateName[] = [
  GateName.ENGAGEMENT_LETTER_SIGNED,
  GateName.INVOICE_RAISED
]
const REPORT_GATES: GateName[] = [
  GateName.QA_SIGN_OFF,
  GateName.ADMIN_REPORT_REVIEW
]

export function AuditPanel({
  open,
  onOpenChange,
  engagementId,
  productLabel,
  onChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  engagementId: string
  productLabel: string
  onChange?: () => void
}) {
  const { can } = useAuth()
  const [assessment, setAssessment] = useState<AssessmentRead | null>(null)
  const [gates, setGates] = useState<GateReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [startConfirmOpen, setStartConfirmOpen] = useState(false)

  const reload = async () => {
    setLoading(true)
    try {
      const [aRes, gRes] = await Promise.all([
        getEngagementAssessment({ path: { engagement_id: engagementId } }),
        getEngagementGates({ path: { engagement_id: engagementId } })
      ])
      const a = unwrap<{ data: AssessmentRead | null }>(aRes).data
      const g = unwrap<{ data: GateReport }>(gRes).data
      setAssessment(a)
      setGates(g)
    } catch (err) {
      notifyApiError(err, 'Failed to load assessment status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) void reload()
  }, [open, engagementId])

  const phase = assessment?.phase ?? AssessmentPhase.NOT_STARTED
  const preStartFailures =
    gates?.gates.filter(g => PRE_START_GATES.includes(g.gate) && !g.passed) ??
    []

  const handleAction = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
      toast.success(label)
      await reload()
      onChange?.()
    } catch (err) {
      notifyApiError(err, `Failed: ${label.toLowerCase()}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Audit — {productLabel}</DialogTitle>
          <p className="text-muted-foreground text-sm">
            Phase 1 collects evidence with the client. Phase 2 rates evidence
            client-absent against the calibration guide.
          </p>
        </DialogHeader>

        {loading || !gates ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="bg-muted/40 flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  Status
                </p>
                <p className="text-sm font-semibold">
                  {AssessmentPhaseLabel[phase]}
                </p>
              </div>
              {assessment && (
                <div className="text-muted-foreground space-y-0.5 text-right text-xs">
                  {assessment.phase1StartedAt && (
                    <p>
                      Started{' '}
                      {new Date(assessment.phase1StartedAt).toLocaleString()}
                    </p>
                  )}
                  {assessment.phase1ClosedAt && (
                    <p>
                      Phase 1 closed{' '}
                      {new Date(assessment.phase1ClosedAt).toLocaleString()}
                    </p>
                  )}
                  {assessment.phase2SubmittedAt && (
                    <p>
                      Submitted{' '}
                      {new Date(assessment.phase2SubmittedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Hard Gates
              </p>
              <div className="flex flex-col divide-y rounded-xl border">
                {gates.gates.map(g => (
                  <GateRow key={g.gate} status={g} />
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-wrap gap-2 sm:flex-row">
          {!loading &&
            phase === AssessmentPhase.NOT_STARTED &&
            can('assessments:start') && (
              <>
                <Button
                  disabled={busy || preStartFailures.length > 0}
                  onClick={() => setStartConfirmOpen(true)}
                  title={
                    preStartFailures.length > 0
                      ? preStartFailures
                          .map(g => `${GateLabel[g.gate]}: ${g.reason}`)
                          .join('\n')
                      : undefined
                  }
                >
                  Schedule Audit
                </Button>
                {startConfirmOpen && (
                  <Dialog open onOpenChange={setStartConfirmOpen}>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                          Confirm: Start Phase 1
                        </DialogTitle>
                      </DialogHeader>
                      <div className="flex flex-col gap-3 text-sm">
                        <p>
                          Starting Phase 1 will create the audit session and
                          auto-generate evidence rows for all active controls.
                          This action is for <strong>Admin use only</strong> and
                          cannot be undone without cancelling the assessment.
                        </p>
                        {gates && (
                          <div className="bg-muted/40 rounded-lg border p-3">
                            <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                              Gate status
                            </p>
                            {gates.gates
                              .filter(g => PRE_START_GATES.includes(g.gate))
                              .map(g => (
                                <div
                                  key={g.gate}
                                  className="flex items-center gap-2 text-xs"
                                >
                                  {g.passed ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  ) : (
                                    <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                                  )}
                                  {GateLabel[g.gate]}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setStartConfirmOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          disabled={busy}
                          onClick={() => {
                            setStartConfirmOpen(false)
                            void handleAction('Phase 1 started', () =>
                              startAssessment({
                                path: { engagement_id: engagementId }
                              })
                            )
                          }}
                        >
                          Confirm — Start Phase 1
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </>
            )}

          {!loading &&
            phase === AssessmentPhase.PHASE_1_IN_PROGRESS &&
            can('assessments:close_phase_1') &&
            assessment && (
              <Button
                disabled={busy}
                onClick={() =>
                  handleAction('Phase 1 closed', () =>
                    closeAssessmentPhase1({
                      path: { assessment_id: assessment.id }
                    })
                  )
                }
              >
                Close Phase 1
              </Button>
            )}

          {!loading &&
            phase === AssessmentPhase.PHASE_1_CLOSED &&
            can('assessments:submit_phase_2') &&
            assessment && (
              <Button
                disabled={busy}
                onClick={() =>
                  handleAction('Phase 2 submitted', () =>
                    submitAssessmentPhase2({
                      path: { assessment_id: assessment.id }
                    })
                  )
                }
              >
                Submit Phase 2
              </Button>
            )}

          {!loading &&
            assessment &&
            (phase === AssessmentPhase.PHASE_1_IN_PROGRESS ||
              phase === AssessmentPhase.PHASE_1_CLOSED) &&
            can('assessments:cancel') && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  handleAction('Assessment cancelled', () =>
                    cancelAssessment({
                      path: { assessment_id: assessment.id }
                    })
                  )
                }
              >
                Cancel Assessment
              </Button>
            )}

          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GateRow({ status }: { status: GateStatus }) {
  const isInformational =
    REPORT_GATES.includes(status.gate) ||
    status.gate === GateName.PHASE_2_MANDATORY_FIELDS_COMPLETE
  return (
    <div className="flex items-start gap-3 p-3">
      {status.passed ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      )}
      <div className="flex-1">
        <p className="text-sm font-medium">{GateLabel[status.gate]}</p>
        {!status.passed && status.reason && (
          <p className="text-muted-foreground mt-0.5 text-xs">
            {status.reason}
          </p>
        )}
        {status.passed && isInformational && (
          <p className="text-muted-foreground mt-0.5 text-xs italic">
            Informational — full enforcement comes online with later phases.
          </p>
        )}
      </div>
      {status.passed ? (
        <Badge
          variant="outline"
          className="border-emerald-200 bg-emerald-50 text-emerald-700"
        >
          Pass
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="border-amber-200 bg-amber-50 text-amber-700"
        >
          Pending
        </Badge>
      )}
    </div>
  )
}

export function AuditStatusBadge({ phase }: { phase: AssessmentPhase }) {
  const cls =
    phase === AssessmentPhase.PHASE_2_SUBMITTED
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : phase === AssessmentPhase.PHASE_1_CLOSED
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : phase === AssessmentPhase.PHASE_1_IN_PROGRESS
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : phase === AssessmentPhase.CANCELLED
            ? 'border-zinc-200 bg-zinc-100 text-zinc-500'
            : 'border-zinc-200 bg-zinc-100 text-zinc-600'
  return (
    <Badge variant="outline" className={cls}>
      <ShieldCheck className="mr-1 h-3 w-3" />
      {AssessmentPhaseLabel[phase]}
    </Badge>
  )
}
