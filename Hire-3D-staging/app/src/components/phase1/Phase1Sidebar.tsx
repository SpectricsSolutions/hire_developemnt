import type { P1Control } from '@/lib/phase1Api'
import { CheckCircle2, Circle, Clock, AlertCircle, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

const STATUS_ICON = {
  seen:         <CheckCircle2 size={14} className="text-green-500 shrink-0" />,
  partial:      <Clock size={14} className="text-amber-500 shrink-0" />,
  not_provided: <Circle size={14} className="text-slate-300 shrink-0" />,
  requested:    <AlertCircle size={14} className="text-blue-500 shrink-0" />,
}

export function Phase1Sidebar({
  controls,
  activeControlId,
  open,
  onToggle,
}: {
  controls: P1Control[]
  activeControlId: string | null
  open: boolean
  onToggle: () => void
}) {
  function scrollTo(controlId: string) {
    document.getElementById(`control-${controlId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const groups = controls.reduce<Record<string, P1Control[]>>((acc, c) => {
    const key = c.domain ?? 'General'
    ;(acc[key] = acc[key] ?? []).push(c)
    return acc
  }, {})

  return (
    <aside
      className={`shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col transition-[width] duration-200 overflow-hidden ${
        open ? 'w-52' : 'w-10'
      }`}
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-center h-9 w-full border-b border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
        aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
        title={open ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {open
          ? <PanelLeftClose size={15} />
          : <PanelLeftOpen size={15} />
        }
      </button>

      {/* Control list — hidden when collapsed */}
      {open && (
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
            Controls
          </p>
          {Object.entries(groups).map(([domain, items]) => (
            <div key={domain} className="mb-3">
              {domain !== 'General' && (
                <p className="text-xs font-medium text-slate-400 px-1 mb-1">Domain {domain}</p>
              )}
              <ul className="space-y-0.5">
                {items.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => scrollTo(c.id)}
                      className={`w-full flex items-center gap-2 text-left px-2 py-1.5 rounded text-xs transition-colors ${
                        activeControlId === c.id
                          ? 'bg-blue-100 text-blue-800 font-medium'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {STATUS_ICON[c.evidence?.status ?? 'not_provided']}
                      <span className="truncate">{c.code} — {c.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Collapsed: show status dots only */}
      {!open && (
        <div className="flex-1 overflow-y-auto py-2 flex flex-col items-center gap-1">
          {controls.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => scrollTo(c.id)}
              title={`${c.code} — ${c.title}`}
              className={`p-1 rounded transition-colors ${
                activeControlId === c.id ? 'bg-blue-100' : 'hover:bg-slate-200'
              }`}
            >
              {STATUS_ICON[c.evidence?.status ?? 'not_provided']}
            </button>
          ))}
        </div>
      )}
    </aside>
  )
}
