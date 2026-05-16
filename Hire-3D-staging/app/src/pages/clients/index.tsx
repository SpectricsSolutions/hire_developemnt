import { deleteClient, listClients, listUsers } from '@/client/sdk.gen'
import type { ClientRead, UserRead } from '@/client/types.gen'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { QuickAddClientDialog } from '@/components/quick-add-client-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  BusinessStageLabel,
  ClientStatus,
  ClientStatusLabel,
  ROUTES,
  Sectors,
  type BusinessStage,
  type ClientStatus as ClientStatusType
} from '@/constants/app'
import { useAuth } from '@/contexts/auth-context'
import { unwrap } from '@/lib/api-client'
import { notifyApiError } from '@/lib/api-errors'
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

const STATUS_CLASS: Record<ClientStatusType, string> = {
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  AUDIT_IN_PROGRESS: 'border-blue-200 bg-blue-50 text-blue-700',
  REPORT_ISSUED: 'border-violet-200 bg-violet-50 text-violet-700',
  FOLLOW_UP_DUE: 'border-amber-200 bg-amber-50 text-amber-700',
  INACTIVE: 'border-zinc-200 bg-zinc-100 text-zinc-500'
}

type SortKey =
  | 'companyName'
  | 'primaryContactName'
  | 'operator'
  | 'businessStage'
  | 'status'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 10

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

function SortHead({
  label,
  isActive,
  dir,
  onClick,
  className
}: {
  label: string
  isActive: boolean
  dir: SortDir
  onClick: () => void
  className?: string
}) {
  return (
    <TableHead
      className={`cursor-pointer select-none${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {isActive ? (
          dir === 'asc' ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronsUpDown className="text-muted-foreground/40 h-3.5 w-3.5" />
        )}
      </div>
    </TableHead>
  )
}

function TablePagination({
  page,
  totalPages,
  totalItems,
  onPage
}: {
  page: number
  totalPages: number
  totalItems: number
  onPage: (p: number) => void
}) {
  if (totalPages <= 1) return null
  const start = (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, totalItems)
  return (
    <div className="flex items-center justify-between border-t px-4 py-3">
      <p className="text-muted-foreground text-sm">
        {start}–{end} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page === 1}
          onClick={() => onPage(1)}
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-muted-foreground px-2 text-sm tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page === totalPages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={page === totalPages}
          onClick={() => onPage(totalPages)}
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export default function ClientsPage() {
  const { can } = useAuth()
  const isAdmin = can('clients:create')
  const canDelete = can('clients:delete')

  const [clients, setClients] = useState<ClientRead[]>([])
  const [clientToDelete, setClientToDelete] = useState<ClientRead | null>(null)
  const [operatorsMap, setOperatorsMap] = useState<Map<string, UserRead>>(
    new Map()
  )
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ClientStatusType | 'all'>(
    'all'
  )
  const [sectorFilter, setSectorFilter] = useState<string>('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'companyName',
    dir: 'asc'
  })
  const [page, setPage] = useState(1)
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  const load = useCallback(
    (initial = false) => {
      const requests: Promise<unknown>[] = [listClients()]
      if (isAdmin) requests.push(listUsers())

      return Promise.all(requests)
        .then(([clientsRes, usersRes]) => {
          const { data } = unwrap<{ data: ClientRead[] }>(clientsRes as never)
          setClients(data)

          if (isAdmin && usersRes) {
            const { data: users } = unwrap<{ data: UserRead[] }>(
              usersRes as never
            )
            setOperatorsMap(new Map(users.map(u => [u.id, u])))
          }
        })
        .catch(err => notifyApiError(err, 'Failed to load clients'))
        .finally(() => {
          if (initial) setLoading(false)
        })
    },
    [isAdmin]
  )

  useEffect(() => {
    load(true)
  }, [load])

  const filtered = useMemo(() => {
    return clients.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (sectorFilter !== 'all' && c.sector !== sectorFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !c.companyName.toLowerCase().includes(q) &&
          !c.primaryContactName.toLowerCase().includes(q) &&
          !c.primaryContactEmail.toLowerCase().includes(q)
        )
          return false
      }
      return true
    })
  }, [clients, search, statusFilter, sectorFilter])

  const sorted = useMemo(() => {
    const getVal = (c: ClientRead) => {
      switch (sort.key) {
        case 'companyName':
          return c.companyName.toLowerCase()
        case 'primaryContactName':
          return c.primaryContactName.toLowerCase()
        case 'operator':
          return (
            c.assignedOperatorId
              ? (operatorsMap.get(c.assignedOperatorId)?.name ?? '')
              : ''
          ).toLowerCase()
        case 'businessStage':
          return BusinessStageLabel[
            c.businessStage as BusinessStage
          ].toLowerCase()
        case 'status':
          return ClientStatusLabel[c.status as ClientStatusType].toLowerCase()
      }
    }
    return [...filtered].sort((a, b) => {
      const cmp = getVal(a).localeCompare(getVal(b))
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sort, operatorsMap])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const hasActiveFilters =
    search !== '' || statusFilter !== 'all' || sectorFilter !== 'all'

  const toggleSort = (key: SortKey) => {
    setSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc'
    }))
    setPage(1)
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setSectorFilter('all')
    setPage(1)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteClient({ path: { client_id: id } })
      setClients(prev => prev.filter(c => c.id !== id))
      toast.success('Client deleted')
    } catch (err) {
      notifyApiError(err, 'Failed to delete client')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Clients</h1>
          {!loading && (
            <p className="text-muted-foreground text-sm">
              {hasActiveFilters
                ? `${sorted.length} of ${clients.length} clients`
                : `${clients.length} ${clients.length === 1 ? 'client' : 'clients'}`}
            </p>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickAddOpen(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Quick Add
            </Button>
            <Button size="sm" asChild>
              <Link to={`${ROUTES.CLIENTS}/new`}>
                <Plus className="mr-1.5 h-4 w-4" />
                New Client
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by company, contact or email…"
            className="pl-9"
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={v => {
              setStatusFilter(v as ClientStatusType | 'all')
              setPage(1)
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue>
                {statusFilter === 'all'
                  ? 'Statuses'
                  : ClientStatusLabel[statusFilter]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Statuses</SelectItem>
              {Object.values(ClientStatus).map(s => (
                <SelectItem key={s} value={s}>
                  {ClientStatusLabel[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sectorFilter}
            onValueChange={v => {
              setSectorFilter(v ?? 'all')
              setPage(1)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue>
                {sectorFilter === 'all' ? 'Sectors' : sectorFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Sectors</SelectItem>
              {Sectors.map(s => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-full">
            <Building2 className="text-muted-foreground h-7 w-7" />
          </div>
          <div>
            <p className="font-medium">
              {hasActiveFilters ? 'No matching clients' : 'No clients yet'}
            </p>
            <p className="text-muted-foreground text-sm">
              {hasActiveFilters
                ? 'Try adjusting your filters'
                : 'Add your first client to get started'}
            </p>
          </div>
          {hasActiveFilters ? (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : (
            isAdmin && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickAddOpen(true)}
                >
                  Quick Add
                </Button>
                <Button size="sm" asChild>
                  <Link to={`${ROUTES.CLIENTS}/new`}>New Client</Link>
                </Button>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <SortHead
                  label="Company"
                  isActive={sort.key === 'companyName'}
                  dir={sort.dir}
                  onClick={() => toggleSort('companyName')}
                  className="w-[30%]"
                />
                <SortHead
                  label="Contact"
                  isActive={sort.key === 'primaryContactName'}
                  dir={sort.dir}
                  onClick={() => toggleSort('primaryContactName')}
                />
                {isAdmin && (
                  <SortHead
                    label="Operator"
                    isActive={sort.key === 'operator'}
                    dir={sort.dir}
                    onClick={() => toggleSort('operator')}
                  />
                )}
                <SortHead
                  label="Stage"
                  isActive={sort.key === 'businessStage'}
                  dir={sort.dir}
                  onClick={() => toggleSort('businessStage')}
                />
                <SortHead
                  label="Status"
                  isActive={sort.key === 'status'}
                  dir={sort.dir}
                  onClick={() => toggleSort('status')}
                />
                {canDelete && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map(c => {
                const operator = c.assignedOperatorId
                  ? operatorsMap.get(c.assignedOperatorId)
                  : undefined
                return (
                  <TableRow key={c.id} className="group">
                    <TableCell>
                      <Link
                        to={ROUTES.CLIENT_DETAIL(c.id)}
                        className="flex items-center gap-3"
                      >
                        <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                          {initials(c.companyName)}
                        </div>
                        <div>
                          <p className="font-medium group-hover:underline">
                            {c.companyName}
                          </p>
                          {c.sector && (
                            <p className="text-muted-foreground text-xs">
                              {c.sector}
                            </p>
                          )}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{c.primaryContactName}</p>
                      <p className="text-muted-foreground text-xs">
                        {c.primaryContactEmail}
                      </p>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        {operator ? (
                          <Link
                            to={ROUTES.USER_DETAIL(operator.id)}
                            className="text-sm hover:underline"
                          >
                            {operator.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            —
                          </span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-sm">
                      {BusinessStageLabel[c.businessStage as BusinessStage]}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_CLASS[c.status as ClientStatusType]}
                      >
                        {ClientStatusLabel[c.status as ClientStatusType]}
                      </Badge>
                    </TableCell>
                    {canDelete && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive h-7 w-7"
                          onClick={() => setClientToDelete(c)}
                          aria-label={`Delete ${c.companyName}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <TablePagination
            page={page}
            totalPages={totalPages}
            totalItems={sorted.length}
            onPage={setPage}
          />
        </div>
      )}

      <QuickAddClientDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        onCreated={() => load()}
      />

      {clientToDelete && (
        <ConfirmDialog
          open
          onOpenChange={open => !open && setClientToDelete(null)}
          title={`Delete ${clientToDelete.companyName}?`}
          description="This permanently removes the client. Engagements must be deleted first."
          confirmLabel="Delete"
          destructive
          onConfirm={async () => {
            await handleDelete(clientToDelete.id)
            setClientToDelete(null)
          }}
        />
      )}
    </div>
  )
}
