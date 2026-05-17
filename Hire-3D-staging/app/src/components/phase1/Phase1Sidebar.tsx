import type { P1Control } from '@/lib/phase1Api'
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react'

const STATUS_ICON = {
  seen:         <CheckCircle2 size={14} className="text-green-500 shrink-0" />,
  partial:      <Clock size={14} className="text-amber-500 shrink-0" />,
  not_provided: <Circle size={14} className="text-slate-300 shrink-0" />,
  requested:    <AlertCircle size={14} className="text-red-500 shrink-0" />,
}

export function Phase1Sidebar({
  controls,
  activeControlId,
}: {
  controls: P1Control[]
  activeControlId: string | null
}) {
  function scrollTo(controlId: string) {
    document.getElementById(`control-${controlId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Group by domain
  const groups = controls.reduce<Record<string, P1Control[]>>((acc, c) => {
    const key = c.domain ?? 'General'
    ;(acc[key] = acc[key] ?? []).push(c)
    return acc
  }, {})

  return (
    <aside className="w-52 shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto">
      <div className="p-3">
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
    </aside>
  )
}
