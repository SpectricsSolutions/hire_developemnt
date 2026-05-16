import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as sdk from '@/client/sdk.gen'
import { ROUTES, UserRole } from '@/constants/app'
import { mockAuth } from '@/test/auth'
import UserDetailPage from './$userId'

vi.mock('@/client/sdk.gen')
vi.mock('@/contexts/auth-context')

const mockNavigate = vi.fn()
let mockUserId = 'user-1'
vi.mock('react-router', () => ({
  Navigate: ({ to }: { to: string }) => (
    <div data-testid="navigate" data-to={to} />
  ),
  useParams: () => ({ userId: mockUserId }),
  useNavigate: () => mockNavigate
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const MOCK_USER = {
  id: 'user-1',
  name: 'Alice',
  email: 'alice@example.com',
  role: UserRole.VIEWER,
  status: 'ACTIVE' as const
}

const ADMIN_PERMISSIONS = [
  'users:list',
  'users:read',
  'users:update',
  'users:delete',
  'roles:manage'
]

function mockAdmin(sub = 'admin-1') {
  mockAuth({
    sub,
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

afterEach(() => {
  mockUserId = 'user-1'
  vi.clearAllMocks()
})

describe('access control', () => {
  it('redirects non-admins to /', async () => {
    mockAuth({ role: UserRole.VIEWER })
    await act(async () => render(<UserDetailPage />))
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/')
  })
})

describe('loading and rendering', () => {
  beforeEach(() => {
    mockAdmin()
    vi.mocked(sdk.getUser).mockResolvedValue({
      data: { data: MOCK_USER }
    } as never)
  })

  it('shows loading state initially', async () => {
    vi.mocked(sdk.getUser).mockReturnValue(new Promise(() => {}) as never)
    await act(async () => render(<UserDetailPage />))
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders user data after load', async () => {
    await act(async () => render(<UserDetailPage />))
    await waitFor(() =>
      expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
    )
    expect(screen.getByDisplayValue('alice@example.com')).toBeInTheDocument()
  })

  it('shows error toast when load fails', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.getUser).mockRejectedValue(new Error('500'))
    await act(async () => render(<UserDetailPage />))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to load user')
    )
  })
})

describe('save', () => {
  beforeEach(() => {
    mockAdmin()
    vi.mocked(sdk.getUser).mockResolvedValue({
      data: { data: MOCK_USER }
    } as never)
  })

  it('calls updateUser with updated name', async () => {
    vi.mocked(sdk.updateUser).mockResolvedValue({
      data: { data: { ...MOCK_USER, name: 'Alice Updated' } }
    } as never)
    await act(async () => render(<UserDetailPage />))
    await waitFor(() =>
      expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
    )
    await userEvent.clear(screen.getByLabelText('Name'))
    await userEvent.type(screen.getByLabelText('Name'), 'Alice Updated')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(sdk.updateUser).toHaveBeenCalledWith({
        path: { user_id: 'user-1' },
        body: expect.objectContaining({ name: 'Alice Updated' })
      })
    )
  })

  it('shows success toast on save', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.updateUser).mockResolvedValue({
      data: { data: MOCK_USER }
    } as never)
    await act(async () => render(<UserDetailPage />))
    await waitFor(() =>
      expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('User updated')
    )
  })

  it('shows error toast on save failure', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.updateUser).mockRejectedValue(new Error('500'))
    await act(async () => render(<UserDetailPage />))
    await waitFor(() =>
      expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to update user')
    )
  })

  it('does not call updateUser when the route param is missing', async () => {
    mockUserId = ''
    mockAdmin()
    await act(async () => render(<UserDetailPage />))
    await waitFor(() =>
      expect(screen.getByText('User not found.')).toBeInTheDocument()
    )
    expect(
      screen.queryByRole('button', { name: 'Save' })
    ).not.toBeInTheDocument()
    expect(sdk.updateUser).not.toHaveBeenCalled()
  })
})

describe('deactivate', () => {
  async function clickDeactivateAndConfirm() {
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    await screen.findByText('Deactivate user?')
    const buttons = screen.getAllByRole('button', { name: 'Deactivate' })
    await userEvent.click(buttons[buttons.length - 1])
  }

  it('calls deactivateUser and navigates to /users', async () => {
    const { toast } = await import('sonner')
    mockAdmin()
    vi.mocked(sdk.getUser).mockResolvedValue({
      data: { data: MOCK_USER }
    } as never)
    vi.mocked(sdk.deactivateUser).mockResolvedValue({
      data: { success: true }
    } as never)
    await act(async () => render(<UserDetailPage />))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Deactivate' })
      ).toBeInTheDocument()
    )
    await clickDeactivateAndConfirm()
    await waitFor(() => {
      expect(sdk.deactivateUser).toHaveBeenCalledWith({
        path: { user_id: 'user-1' }
      })
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.USERS)
      expect(toast.success).toHaveBeenCalledWith('User deactivated')
    })
  })

  it('hides deactivate button when viewing self', async () => {
    // userId from useParams is 'user-1'; admin sub matches it
    mockAdmin('user-1')
    vi.mocked(sdk.getUser).mockResolvedValue({
      data: { data: MOCK_USER }
    } as never)
    await act(async () => render(<UserDetailPage />))
    await waitFor(() =>
      expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
    )
    expect(
      screen.queryByRole('button', { name: 'Deactivate' })
    ).not.toBeInTheDocument()
  })

  it('disables status select when viewing self', async () => {
    mockAdmin('user-1')
    vi.mocked(sdk.getUser).mockResolvedValue({
      data: { data: MOCK_USER }
    } as never)
    await act(async () => render(<UserDetailPage />))
    await waitFor(() =>
      expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
    )
    expect(screen.getByLabelText('Status')).toBeDisabled()
  })

  it('hides deactivate button for inactive users', async () => {
    mockAdmin()
    vi.mocked(sdk.getUser).mockResolvedValue({
      data: { data: { ...MOCK_USER, status: 'INACTIVE' } }
    } as never)
    await act(async () => render(<UserDetailPage />))
    await waitFor(() =>
      expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
    )
    expect(
      screen.queryByRole('button', { name: 'Deactivate' })
    ).not.toBeInTheDocument()
  })

  it('shows error toast on deactivate failure', async () => {
    const { toast } = await import('sonner')
    mockAdmin()
    vi.mocked(sdk.getUser).mockResolvedValue({
      data: { data: MOCK_USER }
    } as never)
    vi.mocked(sdk.deactivateUser).mockRejectedValue(new Error('500'))
    await act(async () => render(<UserDetailPage />))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Deactivate' })
      ).toBeInTheDocument()
    )
    await clickDeactivateAndConfirm()
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to deactivate user')
    )
  })

  it('does not call deactivateUser when the route param is missing', async () => {
    mockUserId = ''
    mockAdmin()
    await act(async () => render(<UserDetailPage />))
    await waitFor(() =>
      expect(screen.getByText('User not found.')).toBeInTheDocument()
    )
    expect(
      screen.queryByRole('button', { name: 'Deactivate' })
    ).not.toBeInTheDocument()
    expect(sdk.deactivateUser).not.toHaveBeenCalled()
  })
})
