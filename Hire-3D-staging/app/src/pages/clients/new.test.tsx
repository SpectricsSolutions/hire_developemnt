import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as sdk from '@/client/sdk.gen'
import { UserRole } from '@/constants/app'
import { mockAuth } from '@/test/auth'
import NewClientPage from './new'

vi.mock('@/client/sdk.gen')
vi.mock('@/contexts/auth-context')

const mockNavigate = vi.fn()
vi.mock('react-router', () => ({
  Navigate: ({ to }: { to: string }) => (
    <div data-testid="navigate" data-to={to} />
  ),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => mockNavigate
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

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
      <option value="">--</option>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectValue: () => null,
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
  'clients:update'
]

const OPERATORS = [
  {
    id: 'op-1',
    name: 'Olivia Operator',
    email: 'olivia@example.com',
    role: UserRole.OPERATOR,
    status: 'ACTIVE'
  },
  {
    id: 'op-2',
    name: 'Owen Operator',
    email: 'owen@example.com',
    role: UserRole.OPERATOR,
    status: 'ACTIVE'
  },
  {
    id: 'admin-1',
    name: 'Admin',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
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

beforeEach(() => {
  vi.mocked(sdk.listUsers).mockResolvedValue({
    data: { data: OPERATORS }
  } as never)
})

afterEach(() => vi.clearAllMocks())

async function fillRequiredFields() {
  await userEvent.type(screen.getByLabelText(/^Company Name/), 'Acme Ltd')
  await userEvent.type(screen.getByLabelText(/^Name/), 'Jane Contact')
  await userEvent.type(screen.getByLabelText(/^Email/), 'jane@example.com')
  // Selects: businessStage, region, sector, introducerFeeApplicable, assignedOperatorId, status
  const selects = screen.getAllByTestId('select-native') as HTMLSelectElement[]
  await userEvent.selectOptions(selects[0], 'EARLY') // businessStage
  await userEvent.selectOptions(selects[1], 'LONDON') // region
  await userEvent.selectOptions(selects[4], 'op-1') // assignedOperatorId
}

describe('access control', () => {
  it('redirects users without clients:create to /', async () => {
    mockAuth({ role: UserRole.VIEWER })
    await act(async () => render(<NewClientPage />))
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/')
  })
})

describe('operators load', () => {
  beforeEach(mockAdmin)

  it('loads only OPERATOR-role users into the assignment select', async () => {
    await act(async () => render(<NewClientPage />))
    await waitFor(() => expect(sdk.listUsers).toHaveBeenCalled())
    expect(
      await screen.findByText(/Olivia Operator — olivia@example.com/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Owen Operator — owen@example.com/)
    ).toBeInTheDocument()
    expect(screen.queryByText(/admin@example.com/)).not.toBeInTheDocument()
  })

  it('shows error toast when listUsers fails', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.listUsers).mockRejectedValue(new Error('500'))
    await act(async () => render(<NewClientPage />))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to load operators')
    )
  })
})

describe('validation', () => {
  beforeEach(mockAdmin)

  it('shows required errors when text fields are emptied and submitted', async () => {
    await act(async () => render(<NewClientPage />))
    // Type and clear so the value is the empty string, exercising .min(1)
    const company = screen.getByLabelText(/^Company Name/)
    await userEvent.type(company, 'x')
    await userEvent.clear(company)
    const contact = screen.getByLabelText(/^Name/)
    await userEvent.type(contact, 'x')
    await userEvent.clear(contact)
    await userEvent.click(screen.getByRole('button', { name: 'Create Client' }))
    await waitFor(() =>
      expect(screen.getByText('Company name is required')).toBeInTheDocument()
    )
    expect(screen.getByText('Contact name is required')).toBeInTheDocument()
    // Enum-keyed Selects produce custom messages even when undefined
    expect(screen.getByText('Select a business stage')).toBeInTheDocument()
    expect(screen.getByText('Select a region')).toBeInTheDocument()
    expect(sdk.createClient).not.toHaveBeenCalled()
  })

  it('rejects invalid email', async () => {
    await act(async () => render(<NewClientPage />))
    await userEvent.type(screen.getByLabelText(/^Email/), 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: 'Create Client' }))
    await waitFor(() =>
      expect(
        screen.getByText('Enter a valid email address')
      ).toBeInTheDocument()
    )
  })

  it('rejects negative headcount', async () => {
    await act(async () => render(<NewClientPage />))
    const headcount = screen.getByLabelText(
      /^Headcount at Engagement/
    ) as HTMLInputElement
    await userEvent.clear(headcount)
    await userEvent.type(headcount, '-3')
    await userEvent.click(screen.getByRole('button', { name: 'Create Client' }))
    await waitFor(() =>
      expect(screen.getByText('Must be 0 or more')).toBeInTheDocument()
    )
  })
})

describe('submit', () => {
  beforeEach(mockAdmin)

  it('sends a normalized payload, toasts and navigates on success', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.createClient).mockResolvedValue({
      data: { data: { id: 'client-99' } }
    } as never)
    await act(async () => render(<NewClientPage />))
    await waitFor(() =>
      expect(
        screen.getByText(/Olivia Operator — olivia@example.com/)
      ).toBeInTheDocument()
    )

    await fillRequiredFields()
    await userEvent.click(screen.getByRole('button', { name: 'Create Client' }))

    await waitFor(() =>
      expect(sdk.createClient).toHaveBeenCalledWith({
        body: expect.objectContaining({
          companyName: 'Acme Ltd',
          companiesHouseNumber: null,
          primaryContactName: 'Jane Contact',
          primaryContactEmail: 'jane@example.com',
          primaryContactPhone: null,
          sector: null,
          headcountAtEngagement: 0,
          currentHeadcount: null,
          businessStage: 'EARLY',
          region: 'LONDON',
          assignedOperatorId: 'op-1',
          internalNotes: null,
          status: 'ACTIVE'
        })
      })
    )
    expect(toast.success).toHaveBeenCalledWith('Client created')
    expect(mockNavigate).toHaveBeenCalledWith('/clients/client-99')
  })

  it('shows field errors on 422 from the server', async () => {
    vi.mocked(sdk.createClient).mockResolvedValue({
      response: {
        status: 422,
        data: {
          message: 'Validation error.',
          errors: { primaryContactEmail: 'Email already in use' }
        }
      }
    } as never)
    await act(async () => render(<NewClientPage />))
    await waitFor(() => expect(sdk.listUsers).toHaveBeenCalled())
    await fillRequiredFields()
    await userEvent.click(screen.getByRole('button', { name: 'Create Client' }))
    await waitFor(() =>
      expect(screen.getByText('Email already in use')).toBeInTheDocument()
    )
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('toasts the server message on 409', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.createClient).mockResolvedValue({
      response: {
        status: 409,
        data: { message: 'A client with this name already exists.' }
      }
    } as never)
    await act(async () => render(<NewClientPage />))
    await waitFor(() => expect(sdk.listUsers).toHaveBeenCalled())
    await fillRequiredFields()
    await userEvent.click(screen.getByRole('button', { name: 'Create Client' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'A client with this name already exists.'
      )
    )
  })

  it('shows generic toast on network failure', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.createClient).mockRejectedValue(new Error('boom'))
    await act(async () => render(<NewClientPage />))
    await waitFor(() => expect(sdk.listUsers).toHaveBeenCalled())
    await fillRequiredFields()
    await userEvent.click(screen.getByRole('button', { name: 'Create Client' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to create client')
    )
  })

  it('passes optional fields through when filled', async () => {
    vi.mocked(sdk.createClient).mockResolvedValue({
      data: { data: { id: 'client-99' } }
    } as never)
    await act(async () => render(<NewClientPage />))
    await waitFor(() => expect(sdk.listUsers).toHaveBeenCalled())
    await fillRequiredFields()
    await userEvent.type(
      screen.getByLabelText(/^Companies House No\./),
      '12345678'
    )
    await userEvent.type(screen.getByLabelText(/^Phone/), '07900 000000')
    const currentHeadcount = screen.getByLabelText(
      /^Current Headcount/
    ) as HTMLInputElement
    await userEvent.type(currentHeadcount, '15')
    await userEvent.type(screen.getByLabelText(/^Notes/), 'Long-time client')
    const selects = screen.getAllByTestId(
      'select-native'
    ) as HTMLSelectElement[]
    await userEvent.selectOptions(selects[2], 'Technology') // sector

    await userEvent.click(screen.getByRole('button', { name: 'Create Client' }))

    await waitFor(() =>
      expect(sdk.createClient).toHaveBeenCalledWith({
        body: expect.objectContaining({
          companiesHouseNumber: '12345678',
          primaryContactPhone: '07900 000000',
          sector: 'Technology',
          currentHeadcount: 15,
          internalNotes: 'Long-time client'
        })
      })
    )
  })
})

describe('cancel', () => {
  beforeEach(mockAdmin)

  it('navigates back to /clients on Cancel click', async () => {
    await act(async () => render(<NewClientPage />))
    await waitFor(() => expect(sdk.listUsers).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockNavigate).toHaveBeenCalledWith('/clients')
  })
})
