import {
  deactivateUser,
  getUser,
  listRoles,
  updateUser
} from '@/client/sdk.gen'
import type { RoleRead, UserRead } from '@/client/types.gen'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ROUTES, UserStatus } from '@/constants/app'
import { useAuth } from '@/contexts/auth-context'
import { unwrap } from '@/lib/api-client'
import { notifyApiError } from '@/lib/api-errors'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

const STATUS_VARIANT: Record<
  UserStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  ACTIVE: 'default',
  PENDING: 'outline',
  INACTIVE: 'secondary',
  SUSPENDED: 'destructive'
}

export default function UserDetailPage() {
  const { user: currentUser, can } = useAuth()
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<UserRead | null>(null)
  const [roles, setRoles] = useState<RoleRead[]>([])
  const [name, setName] = useState('')
  const [role, setRole] = useState<string | null>(null)
  const [status, setStatus] = useState<UserStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  useEffect(() => {
    if (!can('users:update') || !userId) {
      setLoading(false)
      return
    }

    Promise.all([getUser({ path: { user_id: userId } }), listRoles()])
      .then(([userRes, rolesRes]) => {
        const { data } = unwrap<{ data: UserRead }>(userRes)
        const { data: r } = unwrap<{ data: RoleRead[] }>(rolesRes)
        setUser(data)
        setRoles(r)
        setName(data.name)
        setRole(data.role)
        setStatus(data.status)
      })
      .catch(err => notifyApiError(err, 'Failed to load user'))
      .finally(() => setLoading(false))
  }, [can, userId])

  if (!can('users:update')) return <Navigate to={ROUTES.HOME} replace />

  const handleSave = async () => {
    if (!userId) return
    setSaving(true)
    try {
      const res = await updateUser({
        path: { user_id: userId },
        body: { name, role, status }
      })
      const { data } = unwrap<{ data: UserRead }>(res)
      setUser(data)
      toast.success('User updated')
    } catch (err) {
      notifyApiError(err, 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    if (!userId) return
    try {
      await deactivateUser({ path: { user_id: userId } })
      toast.success('User deactivated')
      navigate(ROUTES.USERS)
    } catch (err) {
      notifyApiError(err, 'Failed to deactivate user')
    }
  }

  if (loading)
    return <p className="text-muted-foreground text-sm">Loading...</p>
  if (!user)
    return <p className="text-muted-foreground text-sm">User not found.</p>

  const isSelf = userId === currentUser?.sub

  return (
    <div className="max-w-md space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{user.name}</h1>
        <Badge variant={STATUS_VARIANT[user.status as UserStatus]}>
          {user.status.charAt(0) + user.status.slice(1).toLowerCase()}
        </Badge>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user.email} disabled />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="role">Role</Label>
          <Select
            value={role ?? undefined}
            onValueChange={/* c8 ignore next */ v => setRole(v)}
          >
            <SelectTrigger id="role">
              <SelectValue />
            </SelectTrigger>
            {/* c8 ignore start */}
            <SelectContent>
              {roles.map(r => (
                <SelectItem key={r.id} value={r.name}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
            {/* c8 ignore stop */}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Select
            disabled={isSelf}
            value={status ?? undefined}
            onValueChange={/* c8 ignore next */ v => setStatus(v as UserStatus)}
          >
            <SelectTrigger id="status">
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

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {user.status === UserStatus.ACTIVE && !isSelf && (
          <Button
            variant="destructive"
            onClick={() => setConfirmDeactivate(true)}
          >
            Deactivate
          </Button>
        )}
      </div>

      {confirmDeactivate && (
        <ConfirmDialog
          open
          onOpenChange={setConfirmDeactivate}
          title="Deactivate user?"
          description={`${user.name} will lose access immediately. They can be reactivated later.`}
          confirmLabel="Deactivate"
          destructive
          onConfirm={handleDeactivate}
        />
      )}
    </div>
  )
}
