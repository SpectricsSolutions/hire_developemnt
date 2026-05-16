import { listAuditLogs } from '@/client/sdk.gen'
import type {
  AuditAction,
  AuditLogPage,
  AuditLogRead
} from '@/client/types.gen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { formatRelative } from '@/lib/datetime'
import { Activity } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

const ACTION_CLASS: Record<AuditAction, string> = {
  CREATE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  UPDATE: 'border-blue-200 bg-blue-50 text-blue-700',
  DELETE: 'border-rose-200 bg-rose-50 text-rose-700',
  LOGIN: 'border-zinc-200 bg-zinc-100 text-zinc-600',
  LOGOUT: 'border-zinc-200 bg-zinc-100 text-zinc-600'
}

function describe(log: AuditLogRead): string {
  if (log.event) {
    return log.event
      .replace(/[_.]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
  }
  const verb =
    log.action === 'CREATE'
      ? 'Created'
      : log.action === 'UPDATE'
        ? 'Updated'
        : log.action === 'DELETE'
          ? 'Deleted'
          : log.action.charAt(0) + log.action.slice(1).toLowerCase()
  return `${verb} ${log.resourceType}`
}

export function RecentActivity() {
  const [logs, setLogs] = useState<AuditLogRead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    listAuditLogs({ query: { limit: 6, offset: 0 } })
      .then(res => {
        if (cancelled) return
        const { data } = unwrap<{ data: AuditLogPage }>(res as never)
        setLogs(data.items)
      })
      .catch(err => notifyApiError(err, 'Failed to load activity'))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest changes across the system</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-md" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center">
            <Activity className="h-8 w-8 opacity-50" />
            <p className="text-sm">No activity yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {logs.map(log => (
              <li key={log.id} className="flex items-start gap-3 text-sm">
                <Badge
                  variant="outline"
                  className={`${ACTION_CLASS[log.action]} mt-0.5 shrink-0 text-[10px]`}
                >
                  {log.action}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <span className="font-medium">
                      {log.actorName ?? 'System'}
                    </span>{' '}
                    <span className="text-muted-foreground">
                      {describe(log)}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatRelative(log.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {logs.length > 0 && (
          <div className="mt-auto flex justify-end pt-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to={ROUTES.SETTINGS_AUDIT_LOGS}>View all</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
