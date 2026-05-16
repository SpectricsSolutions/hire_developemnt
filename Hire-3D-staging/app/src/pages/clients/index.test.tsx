import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as sdk from '@/client/sdk.gen'
import { UserRole } from '@/constants/app'
import { mockAuth } from '@/test/auth'
import ClientsPage from './index'

vi.mock('@/client/sdk.gen')
vi.mock('@/contexts/auth-context')
vi.mock('react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
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

const ADMIN_PERMISSIONS = [
  'clients:list',
  'clients:read',
  'clients:create',
  'clients:update',
  'users:list'
]

function makeClient(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'c1',
    companyName: 'Acme Ltd',
    companiesHouseNumber: null,
    primaryContactName: 'Jane Contact',
    primaryContactEmail: 'jane@acme.test',
    primaryContactPhone: null,
    sector: 'Technology',
    headcountAtEngagement: 10,
    currentHeadcount: 12,
    businessStage: 'EARLY',
    region: 'LONDON',
    assignedOperatorId: 'op-1',
    internalNotes: null,
    status: 'ACTIVE',
    ...over
  }
}

const CLIENTS = [
  makeClient({ id: 'c1', companyName: 'Acme Ltd', status: 'ACTIVE' }),
  makeClient({
    id: 'c2',
    companyName: 'Beta Corp',
    primaryContactName: 'Bob',
    primaryContactEmail: 'bob@beta.test',
    sector: 'Finance',
    status: 'AUDIT_IN_PROGRESS',
    assignedOperatorId: 'op-2'
  }),
  makeClient({
    id: 'c3',
    companyName: 'Charlie Ltd',
    primaryContactName: 'Carol',
    primaryContactEmail: 'carol@charlie.test',
    sector: 'Technology',
    status: 'INACTIVE',
    assignedOperatorId: null
  })
]

const OPERATORS = [
  {
    id: 'op-1',
    name: 'Olivia',
    email: 'olivia@example.com',
    role: UserRole.OPERATOR,
    status: 'ACTIVE'
  },
  {
    id: 'op-2',
    name: 'Owen',
    email: 'owen@example.com',
    role: UserRole.OPERATOR,
    status: 'ACTIVE'
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

function mockOperator() {
  mockAuth({
    sub: 'op-1',
    email: 'olivia@example.com',
    name: 'Olivia',
    role: UserRole.OPERATOR,
    permissions: ['clients:list', 'clients:read']
  })
}

beforeEach(() => {
  vi.mocked(sdk.listUsers).mockResolvedValue({
    data: { data: OPERATORS }
  } as never)
})

afterEach(() => vi.clearAllMocks())

describe('loading and rendering', () => {
  it('shows skeleton then renders rows', async () => {
    mockAdmin()
    vi.mocked(sdk.listClients).mockResolvedValue({
      data: { data: CLIENTS }
    } as never)
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Acme Ltd')).toBeInTheDocument()
    )
    expect(screen.getByText('Beta Corp')).toBeInTheDocument()
    expect(screen.getByText('Charlie Ltd')).toBeInTheDocument()
  })

  it('renders operator names when admin', async () => {
    mockAdmin()
    vi.mocked(sdk.listClients).mockResolvedValue({
      data: { data: CLIENTS }
    } as never)
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Acme Ltd')).toBeInTheDocument()
    )
    // Two clients with operators (Olivia, Owen) and one without (—)
    expect(screen.getByText('Olivia')).toBeInTheDocument()
    expect(screen.getByText('Owen')).toBeInTheDocument()
  })

  it('does not call listUsers for non-admins', async () => {
    mockOperator()
    vi.mocked(sdk.listClients).mockResolvedValue({
      data: { data: CLIENTS }
    } as never)
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Acme Ltd')).toBeInTheDocument()
    )
    expect(sdk.listUsers).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('link', { name: /New Client/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Quick Add/ })
    ).not.toBeInTheDocument()
  })

  it('shows add client CTAs only for admins', async () => {
    mockAdmin()
    vi.mocked(sdk.listClients).mockResolvedValue({
      data: { data: CLIENTS }
    } as never)
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Acme Ltd')).toBeInTheDocument()
    )
    expect(
      screen.getByRole('button', { name: /Quick Add/ })
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /New Client/ })).toBeInTheDocument()
  })

  it('shows error toast on load failure', async () => {
    const { toast } = await import('sonner')
    mockAdmin()
    vi.mocked(sdk.listClients).mockRejectedValue(new Error('500'))
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to load clients')
    )
  })

  it('shows empty state for admin with zero clients', async () => {
    mockAdmin()
    vi.mocked(sdk.listClients).mockResolvedValue({
      data: { data: [] }
    } as never)
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('No clients yet')).toBeInTheDocument()
    )
    expect(
      screen.getByText('Add your first client to get started')
    ).toBeInTheDocument()
  })

  it('shows empty state without CTA for non-admins', async () => {
    mockOperator()
    vi.mocked(sdk.listClients).mockResolvedValue({
      data: { data: [] }
    } as never)
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('No clients yet')).toBeInTheDocument()
    )
    expect(screen.queryByText('New Client')).not.toBeInTheDocument()
    expect(screen.queryByText('Quick Add')).not.toBeInTheDocument()
  })

  it('shows singular "client" when exactly one', async () => {
    mockAdmin()
    vi.mocked(sdk.listClients).mockResolvedValue({
      data: { data: [CLIENTS[0]] }
    } as never)
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('1 client')).toBeInTheDocument()
    )
  })

  it('shows plural counter for many clients', async () => {
    mockAdmin()
    vi.mocked(sdk.listClients).mockResolvedValue({
      data: { data: CLIENTS }
    } as never)
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('3 clients')).toBeInTheDocument()
    )
  })
})

describe('search and filters', () => {
  beforeEach(() => {
    mockAdmin()
    vi.mocked(sdk.listClients).mockResolvedValue({
      data: { data: CLIENTS }
    } as never)
  })

  it('filters rows by search query', async () => {
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Acme Ltd')).toBeInTheDocument()
    )
    await userEvent.type(
      screen.getByPlaceholderText('Search by company, contact or email…'),
      'beta'
    )
    await waitFor(() =>
      expect(screen.queryByText('Acme Ltd')).not.toBeInTheDocument()
    )
    expect(screen.getByText('Beta Corp')).toBeInTheDocument()
    expect(screen.queryByText('Charlie Ltd')).not.toBeInTheDocument()
    expect(screen.getByText('1 of 3 clients')).toBeInTheDocument()
  })

  it('matches search against contact email', async () => {
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Acme Ltd')).toBeInTheDocument()
    )
    await userEvent.type(
      screen.getByPlaceholderText('Search by company, contact or email…'),
      'carol@charlie'
    )
    await waitFor(() =>
      expect(screen.getByText('Charlie Ltd')).toBeInTheDocument()
    )
    expect(screen.queryByText('Acme Ltd')).not.toBeInTheDocument()
    expect(screen.queryByText('Beta Corp')).not.toBeInTheDocument()
  })

  it('filters by status', async () => {
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Acme Ltd')).toBeInTheDocument()
    )
    const selects = screen.getAllByTestId(
      'select-native'
    ) as HTMLSelectElement[]
    await userEvent.selectOptions(selects[0], 'INACTIVE')
    await waitFor(() =>
      expect(screen.queryByText('Acme Ltd')).not.toBeInTheDocument()
    )
    expect(screen.getByText('Charlie Ltd')).toBeInTheDocument()
  })

  it('filters by sector', async () => {
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Acme Ltd')).toBeInTheDocument()
    )
    const selects = screen.getAllByTestId(
      'select-native'
    ) as HTMLSelectElement[]
    await userEvent.selectOptions(selects[1], 'Finance')
    await waitFor(() =>
      expect(screen.queryByText('Acme Ltd')).not.toBeInTheDocument()
    )
    expect(screen.getByText('Beta Corp')).toBeInTheDocument()
    expect(screen.queryByText('Charlie Ltd')).not.toBeInTheDocument()
  })

  it('shows no-match empty state with clear-filters CTA', async () => {
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Acme Ltd')).toBeInTheDocument()
    )
    await userEvent.type(
      screen.getByPlaceholderText('Search by company, contact or email…'),
      'no-match-xyz'
    )
    await waitFor(() =>
      expect(screen.getByText('No matching clients')).toBeInTheDocument()
    )
    expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() =>
      expect(screen.getByText('Acme Ltd')).toBeInTheDocument()
    )
  })

  it('clears filters via the inline Clear button', async () => {
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Acme Ltd')).toBeInTheDocument()
    )
    await userEvent.type(
      screen.getByPlaceholderText('Search by company, contact or email…'),
      'beta'
    )
    await waitFor(() =>
      expect(screen.getByText('1 of 3 clients')).toBeInTheDocument()
    )
    await userEvent.click(screen.getByRole('button', { name: /Clear/ }))
    await waitFor(() =>
      expect(screen.getByText('3 clients')).toBeInTheDocument()
    )
  })
})

describe('sorting', () => {
  beforeEach(() => {
    mockAdmin()
    vi.mocked(sdk.listClients).mockResolvedValue({
      data: { data: CLIENTS }
    } as never)
  })

  it('toggles sort direction when clicking the same column twice', async () => {
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Acme Ltd')).toBeInTheDocument()
    )
    const allRows = () =>
      screen
        .getAllByRole('row')
        .map(
          r =>
            within(r).queryByText(/Acme Ltd|Beta Corp|Charlie Ltd/)?.textContent
        )
        .filter(Boolean) as string[]
    expect(allRows()).toEqual(['Acme Ltd', 'Beta Corp', 'Charlie Ltd'])
    await userEvent.click(screen.getByText('Company'))
    await waitFor(() =>
      expect(allRows()).toEqual(['Charlie Ltd', 'Beta Corp', 'Acme Ltd'])
    )
  })

  it('can sort by status', async () => {
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Acme Ltd')).toBeInTheDocument()
    )
    await userEvent.click(screen.getByText('Status'))
    // ACTIVE → AUDIT_IN_PROGRESS → INACTIVE labels: Active < Audit in Progress < Inactive
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByText('Acme Ltd')).toBeInTheDocument()
  })

  it('can sort by stage', async () => {
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Acme Ltd')).toBeInTheDocument()
    )
    await userEvent.click(screen.getByText('Stage'))
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1)
  })

  it('can sort by contact name', async () => {
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Acme Ltd')).toBeInTheDocument()
    )
    await userEvent.click(screen.getByText('Contact'))
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1)
  })

  it('can sort by operator', async () => {
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Acme Ltd')).toBeInTheDocument()
    )
    await userEvent.click(screen.getByText('Operator'))
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1)
  })
})

describe('pagination', () => {
  function getPagingButtons() {
    const all = screen.getAllByRole('button')
    return all.slice(-4) // << < > >>
  }

  beforeEach(() => {
    mockAdmin()
    const many = Array.from({ length: 25 }, (_, i) =>
      makeClient({
        id: `c${i}`,
        companyName: `Client ${String(i + 1).padStart(2, '0')}`,
        primaryContactName: `Contact ${i}`,
        primaryContactEmail: `c${i}@example.test`,
        assignedOperatorId: 'op-1'
      })
    )
    vi.mocked(sdk.listClients).mockResolvedValue({
      data: { data: many }
    } as never)
  })

  it('initial state: only the first 10 rows render', async () => {
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Client 01')).toBeInTheDocument()
    )
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.queryByText('Client 11')).not.toBeInTheDocument()
  })

  it('Next button advances one page', async () => {
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Client 01')).toBeInTheDocument()
    )
    const [, , next] = getPagingButtons()
    await userEvent.click(next)
    await waitFor(() =>
      expect(screen.getByText('Client 11')).toBeInTheDocument()
    )
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('Last button jumps to the last page', async () => {
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Client 01')).toBeInTheDocument()
    )
    const [, , , last] = getPagingButtons()
    await userEvent.click(last)
    await waitFor(() =>
      expect(screen.getByText('Client 21')).toBeInTheDocument()
    )
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
  })

  it('First button returns to page 1', async () => {
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Client 01')).toBeInTheDocument()
    )
    const buttons = getPagingButtons()
    await userEvent.click(buttons[3]) // last
    await waitFor(() => expect(screen.getByText('3 / 3')).toBeInTheDocument())
    await userEvent.click(getPagingButtons()[0]) // first
    await waitFor(() => expect(screen.getByText('1 / 3')).toBeInTheDocument())
  })

  it('Prev button goes back one page', async () => {
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Client 01')).toBeInTheDocument()
    )
    await userEvent.click(getPagingButtons()[2]) // next
    await waitFor(() => expect(screen.getByText('2 / 3')).toBeInTheDocument())
    await userEvent.click(getPagingButtons()[1]) // prev
    await waitFor(() => expect(screen.getByText('1 / 3')).toBeInTheDocument())
  })

  it('first/prev are disabled on page 1; next/last on the last page', async () => {
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('Client 01')).toBeInTheDocument()
    )
    const buttons = getPagingButtons()
    expect(buttons[0]).toBeDisabled()
    expect(buttons[1]).toBeDisabled()
    expect(buttons[2]).not.toBeDisabled()
    expect(buttons[3]).not.toBeDisabled()
    await userEvent.click(buttons[3])
    await waitFor(() => expect(screen.getByText('3 / 3')).toBeInTheDocument())
    const after = getPagingButtons()
    expect(after[0]).not.toBeDisabled()
    expect(after[1]).not.toBeDisabled()
    expect(after[2]).toBeDisabled()
    expect(after[3]).toBeDisabled()
  })

  it('shows the row range label e.g. "1–10 of 25"', async () => {
    await act(async () => render(<ClientsPage />))
    await waitFor(() =>
      expect(screen.getByText('1–10 of 25')).toBeInTheDocument()
    )
  })
})
