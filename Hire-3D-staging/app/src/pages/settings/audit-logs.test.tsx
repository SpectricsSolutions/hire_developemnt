import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as sdk from '@/client/sdk.gen'
import { UserRole } from '@/constants/app'
import { mockAuth } from '@/test/auth'
import AuditLogsPage from './audit-logs'

vi.mock('@/client/sdk.gen')
vi.mock('@/contexts/auth-context')
vi.mock('react-router', () => ({
  Navigate: ({ to }: { to: string }) => (
    <div data-testid="navigate" data-to={to} />
  )
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children
  }: {
    value: string
    onValueChange: (v: string) => void
    children: React.ReactNode
  }) => (
    <select
      data-testid="select-native"
      value={value}
      onChange={e => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectValue: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    value,
    children
  }: {
    value: string
    children: React.ReactNode
  }) => <option value={value}>{children}</option>
}))

const ADMIN = {
  sub: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: UserRole.ADMIN,
  permissions: ['audit:read']
}

function logRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'log-1',
    actorId: 'admin-1',
    actorName: 'Admin User',
    action: 'CREATE',
    resourceType: 'client',
    resourceId: 'c1',
    ipAddress: '127.0.0.1',
    createdAt: '2026-04-01T10:00:00Z',
    meta: {},
    ...over
  }
}

afterEach(() => vi.clearAllMocks())

describe('access control', () => {
  it('redirects users without audit:read to /', async () => {
    mockAuth({ role: UserRole.VIEWER })
    await act(async () => render(<AuditLogsPage />))
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/')
  })

  it('does not call listAuditLogs when permission missing', async () => {
    mockAuth({ role: UserRole.VIEWER })
    await act(async () => render(<AuditLogsPage />))
    expect(sdk.listAuditLogs).not.toHaveBeenCalled()
  })
})

describe('loading and rendering', () => {
  beforeEach(() => mockAuth(ADMIN))

  it('shows loading skeleton then rows', async () => {
    vi.mocked(sdk.listAuditLogs).mockResolvedValue({
      data: { data: { items: [logRow()], total: 1 } }
    } as never)
    await act(async () => render(<AuditLogsPage />))
    await waitFor(() =>
      expect(screen.getByText('Admin User')).toBeInTheDocument()
    )
    expect(screen.getAllByText('client').length).toBeGreaterThan(0)
    expect(screen.getByText('c1')).toBeInTheDocument()
    expect(screen.getAllByText('CREATE').length).toBeGreaterThan(0)
    expect(screen.getByText('1 event')).toBeInTheDocument()
  })

  it('shows plural "events" when total > 1', async () => {
    vi.mocked(sdk.listAuditLogs).mockResolvedValue({
      data: { data: { items: [logRow()], total: 5 } }
    } as never)
    await act(async () => render(<AuditLogsPage />))
    await waitFor(() =>
      expect(screen.getByText('5 events')).toBeInTheDocument()
    )
  })

  it('renders dash when actor is null', async () => {
    vi.mocked(sdk.listAuditLogs).mockResolvedValue({
      data: {
        data: {
          items: [
            logRow({
              id: 'l2',
              actorId: null,
              actorName: null,
              ipAddress: null
            })
          ],
          total: 1
        }
      }
    } as never)
    await act(async () => render(<AuditLogsPage />))
    await waitFor(() => expect(screen.getByText('—')).toBeInTheDocument())
  })

  it('shows error toast on load failure', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.listAuditLogs).mockRejectedValue(new Error('500'))
    await act(async () => render(<AuditLogsPage />))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to load audit logs')
    )
  })
})

describe('filters', () => {
  beforeEach(() => mockAuth(ADMIN))

  it('passes the action filter as query.action', async () => {
    vi.mocked(sdk.listAuditLogs).mockResolvedValue({
      data: { data: { items: [], total: 0 } }
    } as never)
    await act(async () => render(<AuditLogsPage />))
    await waitFor(() => expect(sdk.listAuditLogs).toHaveBeenCalled())

    const selects = screen.getAllByTestId(
      'select-native'
    ) as HTMLSelectElement[]
    await userEvent.selectOptions(selects[0], 'DELETE')
    await waitFor(() =>
      expect(sdk.listAuditLogs).toHaveBeenLastCalledWith({
        query: expect.objectContaining({ action: 'DELETE', offset: 0 })
      })
    )
  })

  it('passes the resource filter as query.resource_type', async () => {
    vi.mocked(sdk.listAuditLogs).mockResolvedValue({
      data: { data: { items: [logRow()], total: 1 } }
    } as never)
    await act(async () => render(<AuditLogsPage />))
    await waitFor(() =>
      expect(screen.getByText('Admin User')).toBeInTheDocument()
    )

    const selects = screen.getAllByTestId(
      'select-native'
    ) as HTMLSelectElement[]
    await userEvent.selectOptions(selects[1], 'client')
    await waitFor(() =>
      expect(sdk.listAuditLogs).toHaveBeenLastCalledWith({
        query: expect.objectContaining({ resource_type: 'client', offset: 0 })
      })
    )
  })
})

describe('expand row', () => {
  beforeEach(() => mockAuth(ADMIN))

  it('toggles the diff panel for rows with meta', async () => {
    vi.mocked(sdk.listAuditLogs).mockResolvedValue({
      data: {
        data: {
          items: [
            logRow({
              meta: {
                before: { name: 'Old' },
                after: { name: 'New' }
              }
            })
          ],
          total: 1
        }
      }
    } as never)
    await act(async () => render(<AuditLogsPage />))
    await waitFor(() =>
      expect(screen.getByText('Admin User')).toBeInTheDocument()
    )
    expect(screen.queryByText('Before')).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('Admin User'))
    await waitFor(() => expect(screen.getByText('Before')).toBeInTheDocument())
    expect(screen.getByText('After')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Admin User'))
    await waitFor(() =>
      expect(screen.queryByText('Before')).not.toBeInTheDocument()
    )
  })

  it('renders dash when before/after is missing', async () => {
    vi.mocked(sdk.listAuditLogs).mockResolvedValue({
      data: {
        data: {
          items: [logRow({ meta: { after: { x: 1 } } })],
          total: 1
        }
      }
    } as never)
    await act(async () => render(<AuditLogsPage />))
    await waitFor(() =>
      expect(screen.getByText('Admin User')).toBeInTheDocument()
    )
    await userEvent.click(screen.getByText('Admin User'))
    await waitFor(() => expect(screen.getByText('Before')).toBeInTheDocument())
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('does not expand rows without meta', async () => {
    vi.mocked(sdk.listAuditLogs).mockResolvedValue({
      data: {
        data: { items: [logRow({ meta: {} })], total: 1 }
      }
    } as never)
    await act(async () => render(<AuditLogsPage />))
    await waitFor(() =>
      expect(screen.getByText('Admin User')).toBeInTheDocument()
    )
    await userEvent.click(screen.getByText('Admin User'))
    expect(screen.queryByText('Before')).not.toBeInTheDocument()
  })
})

describe('pagination', () => {
  beforeEach(() => mockAuth(ADMIN))

  function pagingButtons() {
    return screen.getAllByRole('button').slice(-4)
  }

  it('paginates next/prev/first/last with correct query offsets', async () => {
    vi.mocked(sdk.listAuditLogs).mockResolvedValue({
      data: {
        data: {
          items: Array.from({ length: 25 }, (_, i) => logRow({ id: `l${i}` })),
          total: 60
        }
      }
    } as never)
    await act(async () => render(<AuditLogsPage />))
    await waitFor(() =>
      expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument()
    )
    expect(pagingButtons()[0]).toBeDisabled()
    expect(pagingButtons()[1]).toBeDisabled()

    await userEvent.click(pagingButtons()[2]) // next
    await waitFor(() =>
      expect(sdk.listAuditLogs).toHaveBeenLastCalledWith({
        query: expect.objectContaining({ offset: 25 })
      })
    )

    await userEvent.click(pagingButtons()[3]) // last
    await waitFor(() =>
      expect(sdk.listAuditLogs).toHaveBeenLastCalledWith({
        query: expect.objectContaining({ offset: 50 })
      })
    )

    await userEvent.click(pagingButtons()[1]) // prev
    await waitFor(() =>
      expect(sdk.listAuditLogs).toHaveBeenLastCalledWith({
        query: expect.objectContaining({ offset: 25 })
      })
    )

    await userEvent.click(pagingButtons()[0]) // first
    await waitFor(() =>
      expect(sdk.listAuditLogs).toHaveBeenLastCalledWith({
        query: expect.objectContaining({ offset: 0 })
      })
    )
  })
})
