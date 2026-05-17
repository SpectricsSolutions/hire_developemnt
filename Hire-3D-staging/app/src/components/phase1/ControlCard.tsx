import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { P1Control, P1EvidenceStatus } from '@/lib/phase1Api'
import { ChevronDown, ChevronUp, Paperclip } from 'lucide-react'
import { useRef, useState } from 'react'

const STATUS_OPTIONS: { value: P1EvidenceStatus; label: string; colour: string }[] = [
  { value: 'not_provided', label: 'Not Provided', colour: 'bg-slate-100 text-slate-700' },
  { value: 'seen',         label: 'Seen',         colour: 'bg-green-100 text-green-700' },
  { value: 'partial',      label: 'Partial',      colour: 'bg-amber-100 text-amber-700' },
  { value: 'requested',    label: 'Requested',    colour: 'bg-red-100 text-red-700' },
]

export function ControlCard({
  control,
  onNotesChange,
  onStatusChange,
  onFileUpload,
}: {
  control: P1Control
  onNotesChange: (notes: string) => void
  onStatusChange: (status: P1EvidenceStatus) => void
  onFileUpload: (file: File) => Promise<void>
}) {
  const [guidanceOpen, setGuidanceOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const evidence = control.evidence
  const currentStatus: P1EvidenceStatus = evidence?.status ?? 'not_provided'
  const statusMeta = STATUS_OPTIONS.find((s) => s.value === currentStatus)!

  const hasGuidance =
    control.evidencePrompts.length > 0 ||
    control.lookingFor.length > 0 ||
    control.sampling ||
    control.ifPartial.length > 0

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await onFileUpload(file)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div
      id={`control-${control.id}`}
      className="rounded-lg border border-slate-200 bg-white p-5 mb-4 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            {control.code}
          </span>
          {control.domain && (
            <span className="text-xs text-slate-400">Domain {control.domain}</span>
          )}
        </div>
        {/* Status dropdown */}
        <select
          value={currentStatus}
          onChange={(e) => onStatusChange(e.target.value as P1EvidenceStatus)}
          className={`text-xs font-medium rounded px-2 py-1 border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 ${statusMeta.colour}`}
          aria-label="Evidence status"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-slate-900 mb-3">{control.title}</h3>

      {/* Primary question — prominent */}
      <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
          Primary Question
        </p>
        <p className="text-sm text-slate-800">{control.primaryQuestion}</p>
      </div>

      {/* Collapsible guidance */}
      {hasGuidance && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setGuidanceOpen((o) => !o)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {guidanceOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {guidanceOpen ? 'Hide guidance' : 'Show guidance'}
          </button>

          {guidanceOpen && (
            <div className="mt-3 space-y-3 text-sm text-slate-700 border-l-2 border-blue-200 pl-3">
              {control.evidencePrompts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
                    Evidence Prompts
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {control.evidencePrompts.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}
              {control.lookingFor.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
                    What We're Looking For
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {control.lookingFor.map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                </div>
              )}
              {control.sampling && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Sampling</p>
                  <p>{control.sampling}</p>
                </div>
              )}
              {control.ifPartial.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
                    If Evidence is Partial
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {control.ifPartial.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <Textarea
        placeholder="Add notes…"
        defaultValue={evidence?.notes ?? ''}
        onChange={(e) => onNotesChange(e.target.value)}
        rows={3}
        className="text-sm resize-none mb-3"
      />

      {/* File upload */}
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
          className="hidden"
          onChange={handleFile}
          aria-label="Upload evidence file"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="text-xs"
          data-testid="upload-btn"
        >
          <Paperclip size={12} className="mr-1" />
          {uploading ? 'Uploading…' : 'Attach file'}
        </Button>
        {evidence?.fileName && (
          <a
            href={evidence.fileUrl ?? '#'}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline truncate max-w-[200px]"
          >
            {evidence.fileName}
          </a>
        )}
      </div>
    </div>
  )
}
