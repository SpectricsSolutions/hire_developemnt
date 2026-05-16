import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as sdk from '@/client/sdk.gen'
import { UserRole } from '@/constants/app'
import { mockAuth } from '@/test/auth'
import HomePage from './home'

vi.mock('@/client/sdk.gen')
vi.mock('@/contexts/auth-context')
vi.mock('react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  )
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

function client(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'c1',
    companyName: 'Acme',
    companiesHouseNumber: null,
    primaryContactName: 'Jane',
    primaryContactEmail: 'jane@acme.test',
    primaryContactPhone: null,
    sector: 'Technology',
    headcountAtEngagement: 10,
    currentHeadcount: 10,
    businessStage: 'EARLY',
    region: 'LONDON',
    assignedOperatorId: null,
    internalNotes: null,
    status: 'ACTIVE',
    ...over
  }
}

function mockListClients(clients: ReturnType<typeof client>[] = []) {
  vi.mocked(sdk.listClients).mockResolvedValue({
    data: { data: clients }
  } as never)
}

function mockEmptyAdminFeeds() {
  vi.mocked(sdk.listAuditLogs).mockResolvedValue({
    data: { data: { items: [], total: 0 } }
  } as never)
  vi.mocked(sdk.listUsers).mockResolvedValue({
    data: { data: [] }
  } as never)
}

afterEach(() => vi.clearAllMocks())

describe('HomePage', () => {
  it('greets the user by first name', async () => {
    mockAuth({ name: 'Yash Patel', permissions: ['clients:read'] })
    mockListClients()
    await act(async () => render(<HomePage />))
    expect(screen.getByText('Welcome back, Yash')).toBeInTheDocument()
  })

  it('admin sees Recent Activity and Top Operators', async () => {
    mockAuth({
      role: UserRole.ADMIN,
      permissions: [
        'clients:read',
        'clients:read_all',
        'audit:read',
        'users:list'
      ]
    })
    mockListClients()
    mockEmptyAdminFeeds()

    await act(async () => render(<HomePage />))
    await waitFor(() =>
      expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    )
    expect(screen.getByText('Top Operators')).toBeInTheDocument()
    expect(screen.getByText('Total Clients')).toBeInTheDocument()
  })

  it('viewer sees stats and Needs Attention but not admin widgets', async () => {
    mockAuth({
      role: UserRole.VIEWER,
      permissions: ['clients:read', 'clients:read_all', 'engagements:read']
    })
    mockListClients()

    await act(async () => render(<HomePage />))
    await waitFor(() =>
      expect(screen.getByText('Needs Attention')).toBeInTheDocument()
    )
    expect(screen.getByText('Total Clients')).toBeInTheDocument()
    expect(screen.queryByText('Recent Activity')).not.toBeInTheDocument()
    expect(screen.queryByText('Top Operators')).not.toBeInTheDocument()
    expect(sdk.listAuditLogs).not.toHaveBeenCalled()
    expect(sdk.listUsers).not.toHaveBeenCalled()
  })

  it('operator sees scoped "My Clients" stat label', async () => {
    mockAuth({
      role: UserRole.OPERATOR,
      permissions: ['clients:read', 'engagements:read']
    })
    mockListClients([client({ status: 'AUDIT_IN_PROGRESS' })])

    await act(async () => render(<HomePage />))
    await waitFor(() =>
      expect(screen.getByText('My Clients')).toBeInTheDocument()
    )
    expect(screen.getByText('Assigned to you')).toBeInTheDocument()
    expect(screen.queryByText('Total Clients')).not.toBeInTheDocument()
    expect(screen.queryByText('Recent Activity')).not.toBeInTheDocument()
  })

  it('falls back to "there" when user has no name', async () => {
    mockAuth({ name: '', permissions: ['clients:read'] })
    mockListClients()
    await act(async () => render(<HomePage />))
    expect(screen.getByText('Welcome back, there')).toBeInTheDocument()
  })
})
