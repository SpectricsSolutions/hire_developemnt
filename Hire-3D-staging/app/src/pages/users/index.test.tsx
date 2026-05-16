import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as sdk from '@/client/sdk.gen'
import { UserRole, UserStatus } from '@/constants/app'
import { mockAuth } from '@/test/auth'
import UsersPage from './index'

vi.mock('@/client/sdk.gen')
vi.mock('@/contexts/auth-context')
vi.mock('react-router', () => ({
  Navigate: ({ to }: { to: string }) => (
    <div data-testid="navigate" data-to={to} />
  ),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  )
}))
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog">{children}</div>
  ),
  DialogTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const ADMIN_PERMISSIONS = [
  'users:list',
  'users:read',
  'users:update',
  'users:delete',
  'roles:manage'
]

const MOCK_USERS = [
  {
    id: 'user-1',
    name: 'Alice',
    email: 'alice@example.com',
    role: UserRole.VIEWER,
    status: UserStatus.ACTIVE
  },
  {
    id: 'admin-1',
    name: 'Admin',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE
  },
  {
    id: 'user-2',
    name: 'Bob',
    email: 'bob@example.com',
    role: UserRole.OPERATOR,
    status: UserStatus.INACTIVE
  },
  {
    id: 'user-3',
    name: 'Carol',
    email: 'carol@example.com',
    role: null,
    status: UserStatus.PENDING
  }
]

function mockAdmin() {
  mockAuth({
    sub: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin',
    role: UserRole.ADMIN,
    permissions: ADMIN_PERMISSIONS
  })
}

beforeEach(() => {
  vi.mocked(sdk.listRoles).mockResolvedValue({
    data: { data: [] }
  } as never)
})

afterEach(() => vi.clearAllMocks())

describe('access control', () => {
  it('redirects non-admins to /', async () => {
    mockAuth({ role: UserRole.VIEWER })
    await act(async () => render(<UsersPage />))
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/')
  })
})

describe('loading and rendering', () => {
  beforeEach(mockAdmin)

  it('shows loading state initially', async () => {
    vi.mocked(sdk.listUsers).mockReturnValue(new Promise(() => {}) as never)
    await act(async () => render(<UsersPage />))
    expect(
      screen.getByRole('status', { name: 'Loading users' })
    ).toBeInTheDocument()
  })

  it('renders user rows after load', async () => {
    vi.mocked(sdk.listUsers).mockResolvedValue({
      data: { data: MOCK_USERS }
    } as never)
    await act(async () => render(<UsersPage />))
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('shows error toast when load fails', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.listUsers).mockRejectedValue(new Error('500'))
    await act(async () => render(<UsersPage />))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to load users')
    )
  })
})

describe('deactivate', () => {
  beforeEach(() => {
    mockAdmin()
    vi.mocked(sdk.listUsers).mockResolvedValue({
      data: { data: MOCK_USERS }
    } as never)
  })

  it('only shows deactivate for non-self active users', async () => {
    await act(async () => render(<UsersPage />))
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    // Alice (active, not self) → Deactivate shown
    // Admin (active, self) → hidden
    // Bob (inactive) → Activate shown
    // Carol (pending) → Activate shown, not Deactivate
    expect(screen.getAllByRole('button', { name: 'Deactivate' })).toHaveLength(
      1
    )
    expect(screen.getAllByRole('button', { name: 'Activate' })).toHaveLength(2)
  })

  async function clickDeactivateAndConfirm() {
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    await screen.findByText('Deactivate user?')
    const buttons = screen.getAllByRole('button', { name: 'Deactivate' })
    await userEvent.click(buttons[buttons.length - 1])
  }

  it('calls deactivateUser and removes the button', async () => {
    vi.mocked(sdk.deactivateUser).mockResolvedValue({
      data: { success: true }
    } as never)
    const { toast } = await import('sonner')
    await act(async () => render(<UsersPage />))
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    await clickDeactivateAndConfirm()
    await waitFor(() =>
      expect(sdk.deactivateUser).toHaveBeenCalledWith({
        path: { user_id: 'user-1' }
      })
    )
    expect(toast.success).toHaveBeenCalledWith('User deactivated')
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Deactivate' })
      ).not.toBeInTheDocument()
    )
  })

  it('shows error toast on deactivate failure', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.deactivateUser).mockRejectedValue(new Error('500'))
    await act(async () => render(<UsersPage />))
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    await clickDeactivateAndConfirm()
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to deactivate user')
    )
  })
})

describe('activate', () => {
  beforeEach(() => {
    mockAdmin()
    vi.mocked(sdk.listUsers).mockResolvedValue({
      data: { data: MOCK_USERS }
    } as never)
  })

  it('calls updateUser with ACTIVE status and updates a pending row', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.updateUser).mockResolvedValue({
      data: { data: { ...MOCK_USERS[3], status: 'ACTIVE' } }
    } as never)
    await act(async () => render(<UsersPage />))
    await waitFor(() => expect(screen.getByText('Carol')).toBeInTheDocument())
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Activate' })[1]
    )
    await waitFor(() =>
      expect(sdk.updateUser).toHaveBeenCalledWith({
        path: { user_id: 'user-3' },
        body: { status: 'ACTIVE' }
      })
    )
    expect(toast.success).toHaveBeenCalledWith('User activated')
  })

  it('shows activate for inactive users and reactivates them', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.updateUser).mockResolvedValue({
      data: { data: { ...MOCK_USERS[2], status: 'ACTIVE' } }
    } as never)
    await act(async () => render(<UsersPage />))
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument())

    const activateButtons = screen.getAllByRole('button', { name: 'Activate' })
    await userEvent.click(activateButtons[0])

    await waitFor(() =>
      expect(sdk.updateUser).toHaveBeenCalledWith({
        path: { user_id: 'user-2' },
        body: { status: 'ACTIVE' }
      })
    )
    expect(toast.success).toHaveBeenCalledWith('User activated')
  })

  it('shows error toast on activate failure', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.updateUser).mockRejectedValue(new Error('500'))
    await act(async () => render(<UsersPage />))
    await waitFor(() => expect(screen.getByText('Carol')).toBeInTheDocument())
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Activate' })[1]
    )
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to activate user')
    )
  })
})

describe('create user', () => {
  beforeEach(() => {
    mockAdmin()
    vi.mocked(sdk.listUsers).mockResolvedValue({
      data: { data: MOCK_USERS }
    } as never)
  })

  async function openDialog() {
    await act(async () => render(<UsersPage />))
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Add User' }))
  }

  it('shows the add user dialog when button is clicked', async () => {
    await openDialog()
    expect(screen.getByLabelText(/^Name\b/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Email\b/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Password\b/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Role')).toBeInTheDocument()
    expect(screen.getByLabelText('Status')).toBeInTheDocument()
  })

  it('create button is disabled until name/email/password are filled', async () => {
    await openDialog()
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/^Name\b/i), 'Dave')
    await userEvent.type(screen.getByLabelText(/^Email\b/i), 'dave@example.com')
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/^Password\b/i), 'password123')
    expect(screen.getByRole('button', { name: 'Create' })).not.toBeDisabled()
  })

  it('sends VIEWER/ACTIVE defaults and prepends the new user', async () => {
    const { toast } = await import('sonner')
    const newUser = {
      id: 'user-4',
      name: 'Dave',
      email: 'dave@example.com',
      role: UserRole.VIEWER,
      status: UserStatus.ACTIVE
    }
    vi.mocked(sdk.createUser).mockResolvedValue({
      data: { data: newUser }
    } as never)
    await openDialog()
    await userEvent.type(screen.getByLabelText(/^Name\b/i), 'Dave')
    await userEvent.type(screen.getByLabelText(/^Email\b/i), 'dave@example.com')
    await userEvent.type(screen.getByLabelText(/^Password\b/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() =>
      expect(sdk.createUser).toHaveBeenCalledWith({
        body: {
          name: 'Dave',
          email: 'dave@example.com',
          password: 'password123',
          role: UserRole.VIEWER,
          status: UserStatus.ACTIVE
        }
      })
    )
    expect(toast.success).toHaveBeenCalledWith('User created')
    await waitFor(() => expect(screen.getByText('Dave')).toBeInTheDocument())
  })

  it('shows field errors on 422', async () => {
    vi.mocked(sdk.createUser).mockResolvedValue({
      response: {
        status: 422,
        data: {
          message: 'Validation error.',
          errors: { email: 'Value is not a valid email address' }
        }
      }
    } as never)
    await openDialog()
    await userEvent.type(screen.getByLabelText(/^Name\b/i), 'Dave')
    await userEvent.type(screen.getByLabelText(/^Email\b/i), 'not-an-email')
    await userEvent.type(screen.getByLabelText(/^Password\b/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() =>
      expect(
        screen.getByText('Value is not a valid email address')
      ).toBeInTheDocument()
    )
    expect(screen.getByLabelText(/^Email\b/i)).toHaveAttribute(
      'aria-invalid',
      'true'
    )
  })

  it('clears field errors as the user edits each field', async () => {
    vi.mocked(sdk.createUser).mockResolvedValue({
      response: {
        status: 422,
        data: {
          message: 'Validation error.',
          errors: {
            name: 'Name is required',
            email: 'Value is not a valid email address',
            password: 'Password must be at least 8 characters'
          }
        }
      }
    } as never)
    await openDialog()
    await userEvent.type(screen.getByLabelText(/^Name\b/i), 'Dave')
    await userEvent.type(screen.getByLabelText(/^Email\b/i), 'not-an-email')
    await userEvent.type(screen.getByLabelText(/^Password\b/i), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() =>
      expect(screen.getByText('Name is required')).toBeInTheDocument()
    )

    await userEvent.type(screen.getByLabelText(/^Name\b/i), ' Updated')
    await waitFor(() =>
      expect(screen.queryByText('Name is required')).not.toBeInTheDocument()
    )

    await userEvent.type(screen.getByLabelText(/^Email\b/i), '.com')
    await waitFor(() =>
      expect(
        screen.queryByText('Value is not a valid email address')
      ).not.toBeInTheDocument()
    )

    await userEvent.type(screen.getByLabelText(/^Password\b/i), 'password123')
    await waitFor(() =>
      expect(
        screen.queryByText('Password must be at least 8 characters')
      ).not.toBeInTheDocument()
    )
  })

  it('shows backend message on 409', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.createUser).mockResolvedValue({
      response: {
        status: 409,
        data: { message: 'A user with this email already exists.' }
      }
    } as never)
    await openDialog()
    await userEvent.type(screen.getByLabelText(/^Name\b/i), 'Dave')
    await userEvent.type(
      screen.getByLabelText(/^Email\b/i),
      'alice@example.com'
    )
    await userEvent.type(screen.getByLabelText(/^Password\b/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'A user with this email already exists.'
      )
    )
  })

  it('shows error toast on create failure', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.createUser).mockRejectedValue(new Error('500'))
    await openDialog()
    await userEvent.type(screen.getByLabelText(/^Name\b/i), 'Dave')
    await userEvent.type(screen.getByLabelText(/^Email\b/i), 'dave@example.com')
    await userEvent.type(screen.getByLabelText(/^Password\b/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to create user')
    )
  })

  it('resets the create form after success', async () => {
    vi.mocked(sdk.createUser).mockResolvedValue({
      data: {
        data: {
          id: 'user-4',
          name: 'Dave',
          email: 'dave@example.com',
          role: UserRole.VIEWER,
          status: UserStatus.ACTIVE
        }
      }
    } as never)
    await openDialog()
    const nameInput = screen.getByLabelText(/^Name\b/i)
    const emailInput = screen.getByLabelText(/^Email\b/i)
    const passwordInput = screen.getByLabelText(/^Password\b/i)

    await userEvent.type(nameInput, 'Dave')
    await userEvent.type(emailInput, 'dave@example.com')
    await userEvent.type(passwordInput, 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(screen.getByText('Dave')).toBeInTheDocument())
    expect(nameInput).toHaveValue('')
    expect(emailInput).toHaveValue('')
    expect(passwordInput).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
  })
})
