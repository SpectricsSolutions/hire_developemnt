import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as sdk from '@/client/sdk.gen'
import { RecentActivity } from './recent-activity'

vi.mock('@/client/sdk.gen')
vi.mock('react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  )
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

function logRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'log-1',
    actorId: 'u1',
    actorName: 'Alice',
    action: 'CREATE',
    event: null,
    resourceType: 'client',
    resourceId: 'c1',
    ipAddress: null,
    createdAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    meta: {},
    ...over
  } as never
}

function isoMinutesAgo(min: number) {
  return new Date(Date.now() - min * 60_000).toISOString()
}

afterEach(() => vi.clearAllMocks())

describe('RecentActivity', () => {
  it('shows skeletons while loading', async () => {
    vi.mocked(sdk.listAuditLogs).mockReturnValue(new Promise(() => {}) as never)
    let container: HTMLElement
    await act(async () => {
      ;({ container } = render(<RecentActivity />))
    })
    expect(container!.querySelectorAll('[data-slot="skeleton"]').length).toBe(6)
  })

  it('renders empty state when no logs', async () => {
    vi.mocked(sdk.listAuditLogs).mockResolvedValue({
      data: { data: { items: [], total: 0 } }
    } as never)
    await act(async () => render(<RecentActivity />))
    await waitFor(() =>
      expect(screen.getByText('No activity yet.')).toBeInTheDocument()
    )
    expect(screen.queryByText('View all')).not.toBeInTheDocument()
  })

  it('renders log entries with action, actor, derived label and relative time', async () => {
    vi.mocked(sdk.listAuditLogs).mockResolvedValue({
      data: {
        data: {
          items: [
            logRow({
              id: 'log-1',
              action: 'UPDATE',
              actorName: 'Alice',
              resourceType: 'client',
              event: null,
              createdAt: isoMinutesAgo(30)
            }),
            logRow({
              id: 'log-2',
              action: 'CREATE',
              actorName: null,
              event: 'user.login',
              createdAt: isoMinutesAgo(120)
            })
          ],
          total: 2
        }
      }
    } as never)
    await act(async () => render(<RecentActivity />))
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    expect(screen.getByText('UPDATE')).toBeInTheDocument()
    expect(screen.getByText('Updated client')).toBeInTheDocument()
    expect(screen.getByText('30m ago')).toBeInTheDocument()

    expect(screen.getByText('System')).toBeInTheDocument()
    expect(screen.getByText('User Login')).toBeInTheDocument()
    expect(screen.getByText('2h ago')).toBeInTheDocument()
  })

  it('requests 6 most recent log entries', async () => {
    vi.mocked(sdk.listAuditLogs).mockResolvedValue({
      data: { data: { items: [], total: 0 } }
    } as never)
    await act(async () => render(<RecentActivity />))
    expect(sdk.listAuditLogs).toHaveBeenCalledWith({
      query: { limit: 6, offset: 0 }
    })
  })

  it('links to the audit log page when there are entries', async () => {
    vi.mocked(sdk.listAuditLogs).mockResolvedValue({
      data: { data: { items: [logRow()], total: 1 } }
    } as never)
    await act(async () => render(<RecentActivity />))
    await waitFor(() =>
      expect(screen.getByText('View all')).toBeInTheDocument()
    )
    expect(screen.getByText('View all').closest('a')).toHaveAttribute(
      'href',
      '/settings/audit-logs'
    )
  })
})
