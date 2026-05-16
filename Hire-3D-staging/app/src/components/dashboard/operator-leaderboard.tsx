import { listAuditLogs, listUsers } from '@/client/sdk.gen'
import type { AuditLogPage, AuditLogRead, UserRead } from '@/client/types.gen'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ROUTES } from '@/constants/app'
import { unwrap } from '@/lib/api-client'
import { notifyApiError } from '@/lib/api-errors'
import { Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

type Row = {
  user: UserRead
  total: number
  created: number
  updated: number
}

const WINDOW_DAYS = 30

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

function aggregate(logs: AuditLogRead[], users: UserRead[]): Row[] {
  const usersById = new Map(users.map(u => [u.id, u]))
  const counts = new Map<
    string,
    { total: number; created: number; updated: number }
  >()

  for (const log of logs) {
    if (!log.actorId) continue
    if (log.action !== 'CREATE' && log.action !== 'UPDATE') continue
    const c = counts.get(log.actorId) ?? { total: 0, created: 0, updated: 0 }
    c.total += 1
    if (log.action === 'CREATE') c.created += 1
    else c.updated += 1
    counts.set(log.actorId, c)
  }

  return [...counts.entries()]
    .map(([id, c]) => {
      const user = usersById.get(id)
      return user ? { user, ...c } : null
    })
    .filter((r): r is Row => r !== null)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
}

export function OperatorLeaderboard() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const after = new Date(
      Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000
    ).toISOString()

    Promise.all([
      listAuditLogs({ query: { limit: 200, offset: 0, after } }),
      listUsers()
    ])
      .then(([logsRes, usersRes]) => {
        if (cancelled) return
        const { data: logs } = unwrap<{ data: AuditLogPage }>(logsRes as never)
        const { data: users } = unwrap<{ data: UserRead[] }>(usersRes as never)
        setRows(aggregate(logs.items, users))
      })
      .catch(err => notifyApiError(err, 'Failed to load leaderboard'))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const max = rows[0]?.total ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Operators</CardTitle>
        <CardDescription>
          Most active in the last {WINDOW_DAYS} days
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center">
            <Trophy className="h-8 w-8 opacity-50" />
            <p className="text-sm">No activity in this window.</p>
          </div>
        ) : (
          <ol className="space-y-3">
            {rows.map((r, i) => {
              const pct = max > 0 ? (r.total / max) * 100 : 0
              return (
                <li key={r.user.id}>
                  <Link
                    to={ROUTES.USER_DETAIL(r.user.id)}
                    className="hover:bg-muted/50 group -mx-2 flex items-center gap-3 rounded-md px-2 py-2"
                  >
                    <span className="text-muted-foreground w-4 text-center text-xs font-semibold tabular-nums">
                      {i + 1}
                    </span>
                    <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                      {initials(r.user.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium group-hover:underline">
                        {r.user.name}
                      </p>
                      <div className="bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {r.total}
                      </p>
                      <p className="text-muted-foreground text-[10px]">
                        {r.created}c · {r.updated}u
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
