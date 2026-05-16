import { createRole, deleteRole, listRoles, updateRole } from '@/client/sdk.gen'
import type { PermissionRead, RoleRead } from '@/client/types.gen'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ROUTES } from '@/constants/app'
import { useAuth } from '@/contexts/auth-context'
import { unwrap } from '@/lib/api-client'
import { notifyApiError } from '@/lib/api-errors'
import { Pencil, Plus, Shield, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router'
import { toast } from 'sonner'

type DialogMode = 'create' | { type: 'edit'; role: RoleRead }

export default function RolesPage() {
  const { can } = useAuth()
  const [roles, setRoles] = useState<RoleRead[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<DialogMode | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RoleRead | null>(null)

  useEffect(() => {
    if (!can('roles:manage')) return
    listRoles()
      .then(res => {
        const { data } = unwrap<{ data: RoleRead[] }>(res)
        setRoles(data)
      })
      .catch(err => notifyApiError(err, 'Failed to load roles'))
      .finally(() => setLoading(false))
  }, [can])

  const allPermissions = useMemo(() => {
    const map = new Map<string, PermissionRead>()
    roles.forEach(r => r.permissions.forEach(p => map.set(p.name, p)))
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [roles])

  if (!can('roles:manage')) return <Navigate to={ROUTES.HOME} replace />

  const handleSaved = (saved: RoleRead, isNew: boolean) => {
    setRoles(prev =>
      isNew ? [saved, ...prev] : prev.map(r => (r.id === saved.id ? saved : r))
    )
    setDialog(null)
  }

  const handleDelete = async (role: RoleRead) => {
    try {
      await deleteRole({ path: { role_id: role.id } })
      setRoles(prev => prev.filter(r => r.id !== role.id))
      toast.success('Role deleted')
    } catch (err) {
      notifyApiError(err, 'Failed to delete role')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Roles</h1>
          {!loading && (
            <p className="text-muted-foreground text-sm">
              {roles.length} {roles.length === 1 ? 'role' : 'roles'}
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setDialog('create')}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Role
        </Button>
      </div>

      {loading ? (
        <div role="status" aria-label="Loading roles" className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map(role => (
                <TableRow key={role.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Shield className="text-muted-foreground h-4 w-4" />
                      <span className="font-medium">{role.name}</span>
                      {role.isSystem && (
                        <Badge variant="outline" className="text-xs">
                          System
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {role.description ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {role.permissions.length}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDialog({ type: 'edit', role })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={role.isSystem}
                        onClick={() => setDeleteTarget(role)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {dialog && (
        <RoleDialog
          mode={dialog}
          allPermissions={allPermissions}
          onClose={() => setDialog(null)}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          onOpenChange={open => !open && setDeleteTarget(null)}
          title="Delete role?"
          description={`"${deleteTarget.name}" will be permanently removed.`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </div>
  )
}

function RoleDialog({
  mode,
  allPermissions,
  onClose,
  onSaved
}: {
  mode: DialogMode
  allPermissions: PermissionRead[]
  onClose: () => void
  onSaved: (role: RoleRead, isNew: boolean) => void
}) {
  const isEdit = mode !== 'create'
  const role = isEdit ? mode.role : null

  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [selected, setSelected] = useState<Set<string>>(
    new Set(role?.permissions.map(p => p.name) ?? [])
  )
  const [saving, setSaving] = useState(false)

  const togglePermission = (permName: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(permName)) next.delete(permName)
      else next.add(permName)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {
        name,
        description: description || null,
        permissions: [...selected]
      }
      if (role) {
        const res = await updateRole({
          path: { role_id: role.id },
          body
        })
        const { data } = unwrap<{ data: RoleRead }>(res)
        onSaved(data, false)
        toast.success('Role updated')
      } else {
        const res = await createRole({ body })
        const { data } = unwrap<{ data: RoleRead }>(res)
        onSaved(data, true)
        toast.success('Role created')
      }
    } catch (err) {
      notifyApiError(err, 'Failed to save role')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{role ? 'Edit Role' : 'Add Role'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">
              Name{' '}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <Input
              id="role-name"
              value={name}
              disabled={role?.isSystem}
              onChange={e => setName(e.target.value)}
            />
            {role?.isSystem && (
              <p className="text-muted-foreground text-xs">
                System roles cannot be renamed.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role-description">Description</Label>
            <Textarea
              id="role-description"
              value={description ?? ''}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-3">
              {allPermissions.map(p => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-start gap-3"
                >
                  <Checkbox
                    checked={selected.has(p.name)}
                    onCheckedChange={() => togglePermission(p.name)}
                  />
                  <div className="flex-1">
                    <div className="font-mono text-sm">{p.name}</div>
                    {p.description && (
                      <div className="text-muted-foreground text-xs">
                        {p.description}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
