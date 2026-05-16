import type { ClientRead } from '@/client/types.gen'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientStatus } from '@/constants/app'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ClipboardList,
  type LucideIcon
} from 'lucide-react'

type Stat = {
  label: string
  value: number
  hint: string
  icon: LucideIcon
  tone: string
}

function buildStats(clients: ClientRead[], scoped: boolean): Stat[] {
  const by = (status: string) => clients.filter(c => c.status === status).length
  const total = clients.length

  return [
    {
      label: scoped ? 'My Clients' : 'Total Clients',
      value: total,
      hint: scoped ? 'Assigned to you' : 'Across all operators',
      icon: Building2,
      tone: 'text-blue-600 bg-blue-50'
    },
    {
      label: 'Audits in Progress',
      value: by(ClientStatus.AUDIT_IN_PROGRESS),
      hint: 'Currently being worked',
      icon: ClipboardList,
      tone: 'text-violet-600 bg-violet-50'
    },
    {
      label: 'Follow-ups Due',
      value: by(ClientStatus.FOLLOW_UP_DUE),
      hint: 'Need attention soon',
      icon: AlertCircle,
      tone: 'text-amber-600 bg-amber-50'
    },
    {
      label: 'Reports Issued',
      value: by(ClientStatus.REPORT_ISSUED),
      hint: 'Completed this period',
      icon: CheckCircle2,
      tone: 'text-emerald-600 bg-emerald-50'
    }
  ]
}

export function StatCards({
  clients,
  loading,
  scoped
}: {
  clients: ClientRead[]
  loading: boolean
  scoped: boolean
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  }

  const stats = buildStats(clients, scoped)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map(s => {
        const Icon = s.icon
        return (
          <Card key={s.label} className="overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div className="space-y-1">
                <CardDescription>{s.label}</CardDescription>
                <CardTitle className="text-3xl font-semibold tabular-nums">
                  {s.value}
                </CardTitle>
                <p className="text-muted-foreground text-xs">{s.hint}</p>
              </div>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.tone}`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </CardHeader>
          </Card>
        )
      })}
    </div>
  )
}
