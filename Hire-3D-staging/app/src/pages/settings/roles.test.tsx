import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as sdk from '@/client/sdk.gen'
import { UserRole } from '@/constants/app'
import { mockAuth } from '@/test/auth'
import RolesPage from './roles'

vi.mock('@/client/sdk.gen')
vi.mock('@/contexts/auth-context')
vi.mock('react-router', () => ({
  Navigate: ({ to }: { to: string }) => (
    <div data-testid="navigate" data-to={to} />
  )
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    onOpenChange,
    children
  }: {
    open: boolean
    onOpenChange?: (o: boolean) => void
    children: React.ReactNode
  }) =>
    open ? (
      <div data-testid="dialog" data-onchange={!!onOpenChange}>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  DialogTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  DialogClose: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange
  }: {
    checked: boolean
    onCheckedChange: () => void
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={() => onCheckedChange()}
    />
  )
}))

const ADMIN = {
  sub: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: UserRole.ADMIN,
  permissions: ['roles:manage']
}

const PERMS = [
  { id: 'p1', name: 'clients:read', description: 'Read clients' },
  { id: 'p2', name: 'clients:create', description: 'Create clients' },
  { id: 'p3', name: 'users:list', description: null }
]

const SYSTEM_ROLE = {
  id: 'r-admin',
  name: 'Admin',
  description: 'System admin role',
  isSystem: true,
  permissions: PERMS
}

const CUSTOM_ROLE = {
  id: 'r-viewer',
  name: 'Viewer',
  description: 'Read-only access',
  isSystem: false,
  permissions: [PERMS[0]]
}

afterEach(() => vi.clearAllMocks())

describe('access control', () => {
  it('redirects users without roles:manage to /', async () => {
    mockAuth({ role: UserRole.VIEWER })
    await act(async () => render(<RolesPage />))
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/')
  })

  it('does not call listRoles when permission missing', async () => {
    mockAuth({ role: UserRole.VIEWER })
    await act(async () => render(<RolesPage />))
    expect(sdk.listRoles).not.toHaveBeenCalled()
  })
})

describe('loading and rendering', () => {
  beforeEach(() => mockAuth(ADMIN))

  it('renders rows after load', async () => {
    vi.mocked(sdk.listRoles).mockResolvedValue({
      data: { data: [SYSTEM_ROLE, CUSTOM_ROLE] }
    } as never)
    await act(async () => render(<RolesPage />))
    await waitFor(() => expect(screen.getByText('Viewer')).toBeInTheDocument())
    expect(screen.getByText('System')).toBeInTheDocument()
    expect(screen.getByText('Read-only access')).toBeInTheDocument()
    expect(screen.getByText('2 roles')).toBeInTheDocument()
  })

  it('shows singular "role"', async () => {
    vi.mocked(sdk.listRoles).mockResolvedValue({
      data: { data: [CUSTOM_ROLE] }
    } as never)
    await act(async () => render(<RolesPage />))
    await waitFor(() => expect(screen.getByText('1 role')).toBeInTheDocument())
  })

  it('renders dash for null description', async () => {
    vi.mocked(sdk.listRoles).mockResolvedValue({
      data: {
        data: [{ ...CUSTOM_ROLE, description: null }]
      }
    } as never)
    await act(async () => render(<RolesPage />))
    await waitFor(() => expect(screen.getByText('—')).toBeInTheDocument())
  })

  it('shows error toast on load failure', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.listRoles).mockRejectedValue(new Error('500'))
    await act(async () => render(<RolesPage />))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to load roles')
    )
  })
})

describe('create role', () => {
  beforeEach(() => {
    mockAuth(ADMIN)
    vi.mocked(sdk.listRoles).mockResolvedValue({
      data: { data: [SYSTEM_ROLE] }
    } as never)
  })

  async function openCreateDialog() {
    await act(async () => render(<RolesPage />))
    await waitFor(() => expect(screen.getByText('Admin')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /Add Role/ }))
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Add Role' })
      ).toBeInTheDocument()
    )
  }

  it('disables Save until name is entered', async () => {
    await openCreateDialog()
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/Name/), 'Editor')
    expect(save).not.toBeDisabled()
  })

  it('toggles permissions and submits the create payload', async () => {
    const { toast } = await import('sonner')
    const newRole = {
      id: 'r-new',
      name: 'Editor',
      description: 'Edits',
      isSystem: false,
      permissions: [PERMS[1]]
    }
    vi.mocked(sdk.createRole).mockResolvedValue({
      data: { data: newRole }
    } as never)
    await openCreateDialog()
    await userEvent.type(screen.getByLabelText(/Name/), 'Editor')
    await userEvent.type(screen.getByLabelText('Description'), 'Edits')
    // allPermissions are alphabetised: clients:create, clients:read, users:list
    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(sdk.createRole).toHaveBeenCalledWith({
        body: {
          name: 'Editor',
          description: 'Edits',
          permissions: ['clients:create']
        }
      })
    )
    expect(toast.success).toHaveBeenCalledWith('Role created')
    await waitFor(() => expect(screen.getByText('Editor')).toBeInTheDocument())
  })

  it('sends null description when blank', async () => {
    vi.mocked(sdk.createRole).mockResolvedValue({
      data: {
        data: {
          id: 'r-new',
          name: 'Editor',
          description: null,
          isSystem: false,
          permissions: []
        }
      }
    } as never)
    await openCreateDialog()
    await userEvent.type(screen.getByLabelText(/Name/), 'Editor')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(sdk.createRole).toHaveBeenCalledWith({
        body: {
          name: 'Editor',
          description: null,
          permissions: []
        }
      })
    )
  })

  it('shows error toast on create failure', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.createRole).mockRejectedValue(new Error('boom'))
    await openCreateDialog()
    await userEvent.type(screen.getByLabelText(/Name/), 'Editor')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to save role')
    )
  })

  it('cancels and closes the dialog', async () => {
    await openCreateDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Add Role' })
      ).not.toBeInTheDocument()
    )
  })

  it('toggles a permission off when clicked twice', async () => {
    vi.mocked(sdk.createRole).mockResolvedValue({
      data: {
        data: {
          id: 'r-new',
          name: 'Editor',
          description: null,
          isSystem: false,
          permissions: []
        }
      }
    } as never)
    await openCreateDialog()
    await userEvent.type(screen.getByLabelText(/Name/), 'Editor')
    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])
    await userEvent.click(checkboxes[0])
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(sdk.createRole).toHaveBeenCalledWith({
        body: { name: 'Editor', description: null, permissions: [] }
      })
    )
  })
})

describe('edit role', () => {
  beforeEach(() => {
    mockAuth(ADMIN)
    vi.mocked(sdk.listRoles).mockResolvedValue({
      data: { data: [SYSTEM_ROLE, CUSTOM_ROLE] }
    } as never)
  })

  async function openEditDialog(rowText: string) {
    await act(async () => render(<RolesPage />))
    await waitFor(() => expect(screen.getByText(rowText)).toBeInTheDocument())
    const editButtons = screen.getAllByRole('button')
    // The row's pencil button is the first button after Add Role; identify by sibling structure
    // Easier: each row has two buttons (Pencil, Trash). For the second row (Viewer),
    // those occupy positions after the Admin row's two buttons.
    const target = rowText === 'Viewer' ? editButtons[3] : editButtons[1]
    await userEvent.click(target)
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Edit Role' })
      ).toBeInTheDocument()
    )
  }

  it('pre-fills the form with the role values', async () => {
    await openEditDialog('Viewer')
    expect(screen.getByDisplayValue('Viewer')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Read-only access')).toBeInTheDocument()
    // Sorted: clients:create, clients:read, users:list — Viewer has only clients:read
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(checkboxes[0].checked).toBe(false)
    expect(checkboxes[1].checked).toBe(true)
    expect(checkboxes[2].checked).toBe(false)
  })

  it('disables the name input for system roles', async () => {
    await openEditDialog('Admin')
    expect(screen.getByDisplayValue('Admin')).toBeDisabled()
    expect(
      screen.getByText('System roles cannot be renamed.')
    ).toBeInTheDocument()
  })

  it('saves the edited role and updates the row', async () => {
    const updated = { ...CUSTOM_ROLE, description: 'Updated description' }
    vi.mocked(sdk.updateRole).mockResolvedValue({
      data: { data: updated }
    } as never)
    await openEditDialog('Viewer')
    const description = screen.getByLabelText('Description')
    await userEvent.clear(description)
    await userEvent.type(description, 'Updated description')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(sdk.updateRole).toHaveBeenCalledWith({
        path: { role_id: 'r-viewer' },
        body: expect.objectContaining({
          name: 'Viewer',
          description: 'Updated description'
        })
      })
    )
    await waitFor(() =>
      expect(screen.getByText('Updated description')).toBeInTheDocument()
    )
  })
})

describe('delete role', () => {
  beforeEach(() => {
    mockAuth(ADMIN)
    vi.mocked(sdk.listRoles).mockResolvedValue({
      data: { data: [SYSTEM_ROLE, CUSTOM_ROLE] }
    } as never)
  })

  it('disables the trash button for system roles', async () => {
    await act(async () => render(<RolesPage />))
    await waitFor(() => expect(screen.getByText('Admin')).toBeInTheDocument())
    const buttons = screen.getAllByRole('button')
    // Admin row is first → its trash icon is buttons[2]
    expect(buttons[2]).toBeDisabled()
  })

  it('confirms and deletes a custom role', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.deleteRole).mockResolvedValue({
      data: { success: true }
    } as never)
    await act(async () => render(<RolesPage />))
    await waitFor(() => expect(screen.getByText('Viewer')).toBeInTheDocument())
    const buttons = screen.getAllByRole('button')
    // Viewer row trash is buttons[4] (after Add Role, Admin pencil, Admin trash, Viewer pencil)
    await userEvent.click(buttons[4])
    await waitFor(() =>
      expect(screen.getByText('Delete role?')).toBeInTheDocument()
    )
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(sdk.deleteRole).toHaveBeenCalledWith({
        path: { role_id: 'r-viewer' }
      })
    )
    expect(toast.success).toHaveBeenCalledWith('Role deleted')
    await waitFor(() =>
      expect(screen.queryByText('Viewer')).not.toBeInTheDocument()
    )
  })

  it('shows error toast on delete failure', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.deleteRole).mockRejectedValue(new Error('boom'))
    await act(async () => render(<RolesPage />))
    await waitFor(() => expect(screen.getByText('Viewer')).toBeInTheDocument())
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[4])
    await waitFor(() =>
      expect(screen.getByText('Delete role?')).toBeInTheDocument()
    )
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to delete role')
    )
  })
})
