import { listAuditLogs } from '@/client/sdk.gen'
import type {
  AuditAction,
  AuditLogPage,
  AuditLogRead
} from '@/client/types.gen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { ROUTES } from '@/constants/app'
import { useAuth } from '@/contexts/auth-context'
import { unwrap } from '@/lib/api-client'
import { notifyApiError } from '@/lib/api-errors'
import { formatDateTime } from '@/lib/datetime'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router'

const PAGE_SIZE = 25

const ACTIONS: AuditAction[] = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT']

const ACTION_VARIANT: Record<
  AuditAction,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  CREATE: 'default',
  UPDATE: 'secondary',
  DELETE: 'destructive',
  LOGIN: 'outline',
  LOGOUT: 'outline'
}

export default function AuditLogsPage() {
  const { can } = useAuth()
  const [logs, setLogs] = useState<AuditLogRead[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [resourceFilter, setResourceFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!can('audit:read')) return
    let cancelled = false
    listAuditLogs({
      query: {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        action: actionFilter === 'all' ? null : (actionFilter as AuditAction),
        resource_type: resourceFilter === 'all' ? null : resourceFilter
      }
    })
      .then(res => {
        if (cancelled) return
        const { data } = unwrap<{ data: AuditLogPage }>(res)
        setLogs(data.items)
        setTotal(data.total)
      })
      .catch(
        err => !cancelled && notifyApiError(err, 'Failed to load audit logs')
      )
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [can, page, actionFilter, resourceFilter])

  const resourceTypes = useMemo(() => {
    const set = new Set(logs.map(l => l.resourceType))
    return [...set].sort()
  }, [logs])

  if (!can('audit:read')) return <Navigate to={ROUTES.HOME} replace />

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground text-sm">
          {total} {total === 1 ? 'event' : 'events'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={actionFilter}
          onValueChange={v => {
            setActionFilter(v ?? 'all')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue>
              {actionFilter === 'all' ? 'All actions' : actionFilter}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {ACTIONS.map(a => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={resourceFilter}
          onValueChange={v => {
            setResourceFilter(v ?? 'all')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue>
              {resourceFilter === 'all' ? 'All resources' : resourceFilter}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All resources</SelectItem>
            {resourceTypes.map(r => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div
          role="status"
          aria-label="Loading audit logs"
          className="space-y-2"
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">When</TableHead>
                <TableHead className="w-28">Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map(log => {
                const isOpen = expanded === log.id
                const hasMeta = log.meta && (log.meta.before || log.meta.after)
                return (
                  <>
                    <TableRow
                      key={log.id}
                      className={hasMeta ? 'cursor-pointer' : ''}
                      onClick={() =>
                        hasMeta && setExpanded(isOpen ? null : log.id)
                      }
                    >
                      <TableCell className="text-muted-foreground text-sm tabular-nums">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ACTION_VARIANT[log.action]}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{log.resourceType}</div>
                        {log.resourceId && (
                          <div className="text-muted-foreground font-mono text-xs">
                            {log.resourceId}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.actorName ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {log.ipAddress && (
                          <div className="text-muted-foreground text-xs">
                            {log.ipAddress}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasMeta && (
                          <ChevronDown
                            className={`text-muted-foreground h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                    {isOpen && hasMeta && (
                      <TableRow key={`${log.id}-meta`}>
                        <TableCell colSpan={5} className="bg-muted/30">
                          <div className="grid grid-cols-2 gap-4 p-2 text-xs">
                            <div>
                              <div className="text-muted-foreground mb-1 font-medium">
                                Before
                              </div>
                              <pre className="bg-background overflow-auto rounded border p-2 font-mono">
                                {log.meta.before
                                  ? JSON.stringify(log.meta.before, null, 2)
                                  : '—'}
                              </pre>
                            </div>
                            <div>
                              <div className="text-muted-foreground mb-1 font-medium">
                                After
                              </div>
                              <pre className="bg-background overflow-auto rounded border p-2 font-mono">
                                {log.meta.after
                                  ? JSON.stringify(log.meta.after, null, 2)
                                  : '—'}
                              </pre>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-muted-foreground text-sm">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page === 1}
                  onClick={() => setPage(1)}
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page === totalPages}
                  onClick={() => setPage(totalPages)}
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
