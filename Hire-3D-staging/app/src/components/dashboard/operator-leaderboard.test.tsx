import { act, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as sdk from '@/client/sdk.gen'
import { UserRole } from '@/constants/app'
import { OperatorLeaderboard } from './operator-leaderboard'

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
    createdAt: '2026-05-01T10:00:00Z',
    meta: {},
    ...over
  } as never
}

const USERS = [
  {
    id: 'u1',
    name: 'Alice Adams',
    email: 'alice@example.com',
    role: UserRole.OPERATOR,
    status: 'ACTIVE'
  },
  {
    id: 'u2',
    name: 'Bob Brown',
    email: 'bob@example.com',
    role: UserRole.OPERATOR,
    status: 'ACTIVE'
  }
] as never

afterEach(() => vi.clearAllMocks())

describe('OperatorLeaderboard', () => {
  it('shows skeletons while loading', async () => {
    vi.mocked(sdk.listAuditLogs).mockReturnValue(new Promise(() => {}) as never)
    vi.mocked(sdk.listUsers).mockReturnValue(new Promise(() => {}) as never)
    let container: HTMLElement
    await act(async () => {
      ;({ container } = render(<OperatorLeaderboard />))
    })
    expect(container!.querySelectorAll('[data-slot="skeleton"]').length).toBe(4)
  })

  it('renders empty state when no actions in window', async () => {
    vi.mocked(sdk.listAuditLogs).mockResolvedValue({
      data: { data: { items: [], total: 0 } }
    } as never)
    vi.mocked(sdk.listUsers).mockResolvedValue({
      data: { data: USERS }
    } as never)
    await act(async () => render(<OperatorLeaderboard />))
    await waitFor(() =>
      expect(
        screen.getByText('No activity in this window.')
      ).toBeInTheDocument()
    )
  })

  it('aggregates by actor and ranks by total CREATE+UPDATE', async () => {
    vi.mocked(sdk.listAuditLogs).mockResolvedValue({
      data: {
        data: {
          items: [
            logRow({ id: '1', actorId: 'u1', action: 'CREATE' }),
            logRow({ id: '2', actorId: 'u1', action: 'UPDATE' }),
            logRow({ id: '3', actorId: 'u1', action: 'CREATE' }),
            logRow({ id: '4', actorId: 'u2', action: 'UPDATE' }),
            logRow({ id: '5', actorId: 'u1', action: 'LOGIN' }),
            logRow({ id: '6', actorId: 'u1', action: 'DELETE' }),
            logRow({ id: '7', actorId: null, action: 'CREATE' })
          ],
          total: 7
        }
      }
    } as never)
    vi.mocked(sdk.listUsers).mockResolvedValue({
      data: { data: USERS }
    } as never)

    await act(async () => render(<OperatorLeaderboard />))
    await waitFor(() =>
      expect(screen.getByText('Alice Adams')).toBeInTheDocument()
    )

    const items = screen.getAllByRole('listitem')
    expect(items.length).toBe(2)

    const alice = items[0]
    expect(within(alice).getByText('Alice Adams')).toBeInTheDocument()
    expect(within(alice).getByText('3')).toBeInTheDocument()
    expect(within(alice).getByText('2c · 1u')).toBeInTheDocument()

    const bob = items[1]
    expect(within(bob).getByText('Bob Brown')).toBeInTheDocument()
    expect(within(bob).getByText('1')).toBeInTheDocument()
    expect(within(bob).getByText('0c · 1u')).toBeInTheDocument()
  })

  it('drops actors that are not in the user list', async () => {
    vi.mocked(sdk.listAuditLogs).mockResolvedValue({
      data: {
        data: {
          items: [
            logRow({ id: '1', actorId: 'ghost', action: 'CREATE' }),
            logRow({ id: '2', actorId: 'u1', action: 'CREATE' })
          ],
          total: 2
        }
      }
    } as never)
    vi.mocked(sdk.listUsers).mockResolvedValue({
      data: { data: USERS }
    } as never)

    await act(async () => render(<OperatorLeaderboard />))
    await waitFor(() =>
      expect(screen.getByText('Alice Adams')).toBeInTheDocument()
    )
    expect(screen.getAllByRole('listitem').length).toBe(1)
  })

  it('queries audit logs filtered to the last 30 days', async () => {
    const now = new Date('2026-05-02T10:00:00Z').getTime()
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now)
    vi.mocked(sdk.listAuditLogs).mockResolvedValue({
      data: { data: { items: [], total: 0 } }
    } as never)
    vi.mocked(sdk.listUsers).mockResolvedValue({
      data: { data: USERS }
    } as never)

    await act(async () => render(<OperatorLeaderboard />))

    expect(sdk.listAuditLogs).toHaveBeenCalledWith({
      query: {
        limit: 200,
        offset: 0,
        after: '2026-04-02T10:00:00.000Z'
      }
    })
    spy.mockRestore()
  })
})
