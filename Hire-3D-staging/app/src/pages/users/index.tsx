import {
  createUser,
  deactivateUser,
  listRoles,
  listUsers,
  updateUser
} from '@/client/sdk.gen'
import type { RoleRead, UserRead } from '@/client/types.gen'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { ROUTES, UserRole, UserStatus } from '@/constants/app'
import { useAuth } from '@/contexts/auth-context'
import { ApiError, unwrap } from '@/lib/api-client'
import { notifyApiError } from '@/lib/api-errors'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Plus,
  Search,
  Users,
  X
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { toast } from 'sonner'

const USER_STATUS_CLASS: Record<UserStatus, string> = {
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  INACTIVE: 'border-zinc-200 bg-zinc-100 text-zinc-500',
  SUSPENDED: 'border-red-200 bg-red-50 text-red-700'
}

const USER_STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  PENDING: 'Pending',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended'
}

const USER_ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  OPERATOR: 'Operator',
  VIEWER: 'Viewer'
}

const USER_ROLE_CLASS: Record<string, string> = {
  ADMIN: 'border-violet-200 bg-violet-50 text-violet-700',
  OPERATOR: 'border-blue-200 bg-blue-50 text-blue-700',
  VIEWER: 'border-zinc-200 bg-zinc-100 text-zinc-600'
}

type UserSortKey = 'name' | 'email' | 'role' | 'status'
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

export default function UsersPage() {
  const { user, can } = useAuth()
  const [users, setUsers] = useState<UserRead[]>([])
  const [roles, setRoles] = useState<RoleRead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [sort, setSort] = useState<{ key: UserSortKey; dir: SortDir }>({
    key: 'name',
    dir: 'asc'
  })
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<string>(UserRole.VIEWER)
  const [newStatus, setNewStatus] = useState<UserStatus>(UserStatus.ACTIVE)
  const [creating, setCreating] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [deactivateTarget, setDeactivateTarget] = useState<UserRead | null>(
    null
  )

  useEffect(() => {
    if (!can('users:list')) return
    Promise.all([listUsers(), listRoles()])
      .then(([usersRes, rolesRes]) => {
        const { data: u } = unwrap<{ data: UserRead[] }>(usersRes)
        const { data: r } = unwrap<{ data: RoleRead[] }>(rolesRes)
        setUsers(u)
        setRoles(r)
      })
      .catch(err => notifyApiError(err, 'Failed to load users'))
      .finally(() => setLoading(false))
  }, [can])

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (statusFilter !== 'all' && u.status !== statusFilter) return false
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !u.name.toLowerCase().includes(q) &&
          !u.email.toLowerCase().includes(q)
        )
          return false
      }
      return true
    })
  }, [users, search, statusFilter, roleFilter])

  const sorted = useMemo(() => {
    const getVal = (u: UserRead) => {
      switch (sort.key) {
        case 'name':
          return u.name.toLowerCase()
        case 'email':
          return u.email.toLowerCase()
        case 'role':
          return (u.role ?? '').toLowerCase()
        case 'status':
          return u.status.toLowerCase()
      }
    }
    return [...filtered].sort((a, b) => {
      const cmp = getVal(a).localeCompare(getVal(b))
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sort])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (!can('users:list')) return <Navigate to={ROUTES.HOME} replace />

  const hasActiveFilters =
    search !== '' || statusFilter !== 'all' || roleFilter !== 'all'

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setRoleFilter('all')
    setPage(1)
  }

  const toggleSort = (key: UserSortKey) => {
    setSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc'
    }))
    setPage(1)
  }

  /* c8 ignore start */
  const handleRoleChange = async (userId: string, role: string) => {
    try {
      const res = await updateUser({
        path: { user_id: userId },
        body: { role }
      })
      const { data } = unwrap<{ data: UserRead }>(res)
      setUsers(prev => prev.map(u => (u.id === userId ? data : u)))
      toast.success('Role updated')
    } catch (err) {
      notifyApiError(err, 'Failed to update role')
    }
  }
  /* c8 ignore stop */

  const handleActivate = async (userId: string) => {
    try {
      const res = await updateUser({
        path: { user_id: userId },
        body: { status: UserStatus.ACTIVE }
      })
      const { data } = unwrap<{ data: UserRead }>(res)
      setUsers(prev => prev.map(u => (u.id === userId ? data : u)))
      toast.success('User activated')
    } catch (err) {
      notifyApiError(err, 'Failed to activate user')
    }
  }

  const handleDeactivate = async (userId: string) => {
    try {
      await deactivateUser({ path: { user_id: userId } })
      setUsers(prev =>
        prev.map(u =>
          u.id === userId ? { ...u, status: UserStatus.INACTIVE } : u
        )
      )
      toast.success('User deactivated')
    } catch (err) {
      notifyApiError(err, 'Failed to deactivate user')
    }
  }

  const handleCreate = async () => {
    setCreating(true)
    setFieldErrors({})
    try {
      const res = await createUser({
        body: {
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
          status: newStatus
        }
      })
      const { data } = unwrap<{ data: UserRead }>(res)
      setUsers(prev => [data, ...prev])
      setDialogOpen(false)
      setNewName('')
      setNewEmail('')
      setNewPassword('')
      setNewRole(UserRole.VIEWER)
      setNewStatus(UserStatus.ACTIVE)
      toast.success('User created')
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && err.errors) {
        setFieldErrors(err.errors)
      } else {
        notifyApiError(err, 'Failed to create user')
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Users</h1>
          {!loading && (
            <p className="text-muted-foreground text-sm">
              {hasActiveFilters
                ? `${sorted.length} of ${users.length} users`
                : `${users.length} ${users.length === 1 ? 'user' : 'users'}`}
            </p>
          )}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add User</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-name">
                  Name{' '}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </Label>
                <Input
                  id="new-name"
                  value={newName}
                  aria-invalid={!!fieldErrors.name}
                  className={
                    fieldErrors.name
                      ? 'border-destructive ring-destructive/20 ring-[3px]'
                      : undefined
                  }
                  onChange={e => {
                    setNewName(e.target.value)
                    if (fieldErrors.name)
                      setFieldErrors(p => ({ ...p, name: '' }))
                  }}
                />
                {fieldErrors.name && (
                  <p className="text-destructive text-sm">{fieldErrors.name}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-email">
                  Email{' '}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  aria-invalid={!!fieldErrors.email}
                  onChange={e => {
                    setNewEmail(e.target.value)
                    if (fieldErrors.email)
                      setFieldErrors(p => ({ ...p, email: '' }))
                  }}
                />
                {fieldErrors.email && (
                  <p className="text-destructive text-sm">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">
                  Password{' '}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  aria-invalid={!!fieldErrors.password}
                  onChange={e => {
                    setNewPassword(e.target.value)
                    if (fieldErrors.password)
                      setFieldErrors(p => ({ ...p, password: '' }))
                  }}
                />
                {fieldErrors.password && (
                  <p className="text-destructive text-sm">
                    {fieldErrors.password}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-role">Role</Label>
                <Select
                  value={newRole}
                  onValueChange={/* c8 ignore next */ v => setNewRole(v ?? '')}
                >
                  <SelectTrigger id="new-role">
                    <SelectValue />
                  </SelectTrigger>
                  {/* c8 ignore start */}
                  <SelectContent>
                    {roles.map(r => (
                      <SelectItem key={r.id} value={r.name}>
                        {USER_ROLE_LABEL[r.name] ?? r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                  {/* c8 ignore stop */}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-status">Status</Label>
                <Select
                  value={newStatus}
                  onValueChange={
                    /* c8 ignore next */ v => setNewStatus(v as UserStatus)
                  }
                >
                  <SelectTrigger id="new-status">
                    <SelectValue />
                  </SelectTrigger>
                  {/* c8 ignore start */}
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  </SelectContent>
                  {/* c8 ignore stop */}
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={creating || !newName || !newEmail || !newPassword}
              >
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name or email…"
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
              setStatusFilter(v as UserStatus | 'all')
              setPage(1)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue>
                {statusFilter === 'all'
                  ? 'Statuses'
                  : USER_STATUS_LABEL[statusFilter]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Statuses</SelectItem>
              <SelectItem value={UserStatus.ACTIVE}>Active</SelectItem>
              <SelectItem value={UserStatus.PENDING}>Pending</SelectItem>
              <SelectItem value={UserStatus.INACTIVE}>Inactive</SelectItem>
              <SelectItem value={UserStatus.SUSPENDED}>Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={roleFilter}
            onValueChange={v => {
              setRoleFilter(v ?? 'all')
              setPage(1)
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue>
                {roleFilter === 'all' ? 'Roles' : USER_ROLE_LABEL[roleFilter]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Roles</SelectItem>
              {roles.map(r => (
                <SelectItem key={r.id} value={r.name}>
                  {USER_ROLE_LABEL[r.name] ?? r.name}
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
        <div role="status" aria-label="Loading users" className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-full">
            <Users className="text-muted-foreground h-7 w-7" />
          </div>
          <div>
            <p className="font-medium">
              {hasActiveFilters ? 'No matching users' : 'No users yet'}
            </p>
            <p className="text-muted-foreground text-sm">
              {hasActiveFilters
                ? 'Try adjusting your filters'
                : 'Add the first user above'}
            </p>
          </div>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <SortHead
                  label="Name"
                  isActive={sort.key === 'name'}
                  dir={sort.dir}
                  onClick={() => toggleSort('name')}
                  className="w-[25%]"
                />
                <SortHead
                  label="Email"
                  isActive={sort.key === 'email'}
                  dir={sort.dir}
                  onClick={() => toggleSort('email')}
                />
                <SortHead
                  label="Role"
                  isActive={sort.key === 'role'}
                  dir={sort.dir}
                  onClick={() => toggleSort('role')}
                />
                <SortHead
                  label="Status"
                  isActive={sort.key === 'status'}
                  dir={sort.dir}
                  onClick={() => toggleSort('status')}
                />
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map(u => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link
                      to={ROUTES.USER_DETAIL(u.id)}
                      className="group flex items-center gap-3"
                    >
                      <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                        {initials(u.name)}
                      </div>
                      <span className="font-medium group-hover:underline">
                        {u.name}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {u.email}
                  </TableCell>
                  <TableCell>
                    {u.id === user?.sub ? (
                      <Badge
                        variant="outline"
                        className={USER_ROLE_CLASS[u.role ?? ''] ?? 'border-zinc-200 bg-zinc-100 text-zinc-600'}
                      >
                        {USER_ROLE_LABEL[u.role ?? ''] ?? u.role}
                      </Badge>
                    ) : (
                      <Select
                        value={u.role ?? undefined}
                        /* c8 ignore next */
                        onValueChange={role =>
                          role && handleRoleChange(u.id, role)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map(r => (
                            <SelectItem key={r.id} value={r.name}>
                              {USER_ROLE_LABEL[r.name] ?? r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={USER_STATUS_CLASS[u.status as UserStatus]}
                    >
                      {USER_STATUS_LABEL[u.status as UserStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {(u.status === UserStatus.PENDING ||
                      u.status === UserStatus.INACTIVE) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleActivate(u.id)}
                      >
                        Activate
                      </Button>
                    )}
                    {u.status === UserStatus.ACTIVE && u.id !== user?.sub && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeactivateTarget(u)}
                      >
                        Deactivate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
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

      {deactivateTarget && (
        <ConfirmDialog
          open
          onOpenChange={open => !open && setDeactivateTarget(null)}
          title="Deactivate user?"
          description={`${deactivateTarget.name} will lose access immediately. They can be reactivated later.`}
          confirmLabel="Deactivate"
          destructive
          onConfirm={() => handleDeactivate(deactivateTarget.id)}
        />
      )}
    </div>
  )
}
