import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { P1Control, P1EvidenceStatus } from '@/lib/phase1Api'
import { ChevronDown, ChevronUp, Link2, Paperclip } from 'lucide-react'
import { useRef, useState } from 'react'

// US-021: colour-coded — green=Seen / amber=Partial / grey=Not Provided / blue=Requested
const STATUS_OPTIONS: { value: P1EvidenceStatus; label: string; colour: string }[] = [
  { value: 'not_provided', label: 'Not Provided', colour: 'bg-slate-100 text-slate-600' },
  { value: 'seen',         label: 'Seen',         colour: 'bg-green-100 text-green-700' },
  { value: 'partial',      label: 'Partial',      colour: 'bg-amber-100 text-amber-700' },
  { value: 'requested',    label: 'Requested',    colour: 'bg-blue-100 text-blue-700' },
]

export function ControlCard({
  control,
  onNotesChange,
  onDocumentNotesChange,
  onDocumentLinkChange,
  onStatusChange,
  onFileUpload,
}: {
  control: P1Control
  onNotesChange: (notes: string) => void
  onDocumentNotesChange: (documentNotes: string) => void
  onDocumentLinkChange: (documentLink: string) => void
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
    !!control.sampling ||
    control.ifPartial.length > 0

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try { await onFileUpload(file) }
    finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div id={`control-${control.id}`} className="rounded-lg border border-slate-200 bg-white p-5 mb-4 shadow-sm">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            {control.code}
          </span>
          {control.domain && <span className="text-xs text-slate-400">Domain {control.domain}</span>}
        </div>

        {/* US-021: colour-coded status dropdown */}
        <select
          value={currentStatus}
          onChange={(e) => onStatusChange(e.target.value as P1EvidenceStatus)}
          className={`text-xs font-medium rounded px-2 py-1 border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 ${statusMeta.colour}`}
          aria-label="Evidence status"
          data-testid="status-select"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* US-020: title */}
      <h3 className="font-semibold text-slate-900 mb-3">{control.title}</h3>

      {/* US-020: Primary question — prominent highlighted box */}
      <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Ask Verbatim</p>
        <p className="text-[15px] leading-snug text-slate-800 font-medium italic">{control.primaryQuestion}</p>
      </div>

      {/* US-020: Collapsible follow-up prompts + guidance */}
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
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Follow-Up Evidence Prompts</p>
                  <ul className="list-disc list-inside space-y-1">{control.evidencePrompts.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </div>
              )}
              {control.lookingFor.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">What You Are Looking For</p>
                  <ul className="list-disc list-inside space-y-1">{control.lookingFor.map((l, i) => <li key={i}>{l}</li>)}</ul>
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
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">If Evidence Is Partial</p>
                  <ul className="list-disc list-inside space-y-1">{control.ifPartial.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* US-021: Verbal evidence / notes */}
      <div className="mb-3">
        <label className="text-xs font-medium text-slate-500 mb-1 block">Verbal evidence / notes</label>
        <Textarea
          placeholder="Record what was said in the session…"
          defaultValue={evidence?.notes ?? ''}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          className="text-sm resize-none"
        />
      </div>

      {/* US-021: Documents produced */}
      <div className="mb-3">
        <label className="text-xs font-medium text-slate-500 mb-1 block">Documents produced</label>
        <Textarea
          placeholder="List documents shown during the session…"
          defaultValue={evidence?.documentNotes ?? ''}
          onChange={(e) => onDocumentNotesChange(e.target.value)}
          rows={2}
          className="text-sm resize-none"
        />
      </div>

      {/* US-021: Document link + file upload */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-slate-500 mb-1 block">Document link</label>
          <div className="flex items-center gap-1.5 border border-slate-200 rounded px-2 py-1.5 focus-within:ring-2 focus-within:ring-blue-500">
            <Link2 size={13} className="text-slate-400 shrink-0" />
            <input
              type="url"
              placeholder="https://drive.google.com/…"
              defaultValue={evidence?.documentLink ?? ''}
              onChange={(e) => onDocumentLinkChange(e.target.value)}
              className="flex-1 text-sm bg-transparent focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Attach file</label>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg" className="hidden" onChange={handleFile} aria-label="Upload evidence file" />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="text-xs" data-testid="upload-btn">
            <Paperclip size={12} className="mr-1" />
            {uploading ? 'Uploading…' : 'Attach file'}
          </Button>
          {evidence?.fileName && (
            <a href={evidence.fileUrl ?? '#'} target="_blank" rel="noreferrer" className="ml-2 text-xs text-blue-600 hover:underline truncate max-w-[160px] inline-block align-middle">
              {evidence.fileName}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
