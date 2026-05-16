import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as sdk from '@/client/sdk.gen'
import { UserRole } from '@/constants/app'
import { mockAuth } from '@/test/auth'
import ClientDetailPage from './$clientId'

vi.mock('@/client/sdk.gen')
vi.mock('@/contexts/auth-context')

let mockClientId: string | undefined = 'c1'
const mockNavigate = vi.fn()
vi.mock('react-router', () => ({
  Navigate: ({ to }: { to: string }) => (
    <div data-testid="navigate" data-to={to} />
  ),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useParams: () => ({ clientId: mockClientId }),
  useNavigate: () => mockNavigate
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
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
  DialogClose: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TabsTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  TabsContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )
}))

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

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  )
}))

let calendarPickReturns: string | undefined = '2026-04-01'
vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: { onSelect: (d: Date | undefined) => void }) => (
    <div data-testid="calendar">
      <button
        type="button"
        onClick={() =>
          onSelect(
            calendarPickReturns
              ? new Date(calendarPickReturns + 'T00:00:00')
              : undefined
          )
        }
      >
        calendar-pick
      </button>
    </div>
  )
}))

const ADMIN_PERMISSIONS = [
  'clients:list',
  'clients:read',
  'clients:create',
  'clients:update',
  'engagements:create',
  'users:list'
]

const MOCK_CLIENT = {
  id: 'c1',
  companyName: 'Acme Ltd',
  companiesHouseNumber: '12345678',
  primaryContactName: 'Jane Contact',
  primaryContactEmail: 'jane@acme.test',
  primaryContactPhone: '07900 000000',
  sector: 'Technology',
  headcountAtEngagement: 10,
  currentHeadcount: 12,
  businessStage: 'EARLY',
  region: 'LONDON',
  assignedOperatorId: 'op-1',
  internalNotes: 'Some notes',
  status: 'ACTIVE'
}

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

beforeEach(() => {
  mockClientId = 'c1'
  calendarPickReturns = '2026-04-01'
  vi.mocked(sdk.getClient).mockResolvedValue({
    data: { data: MOCK_CLIENT }
  } as never)
  vi.mocked(sdk.listEngagements).mockResolvedValue({
    data: { data: [] }
  } as never)
  vi.mocked(sdk.listUsers).mockResolvedValue({
    data: { data: OPERATORS }
  } as never)
})

afterEach(() => vi.clearAllMocks())

describe('access control', () => {
  it('redirects users without clients:update to /', async () => {
    mockAuth({ role: UserRole.VIEWER })
    await act(async () => render(<ClientDetailPage />))
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/')
  })
})

describe('load and render', () => {
  beforeEach(mockAdmin)

  it('renders header, sections and stats after load', async () => {
    await act(async () => render(<ClientDetailPage />))
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Acme Ltd' })
      ).toBeInTheDocument()
    )
    // Read-mode contact, business, headcount values
    expect(screen.getByText('Jane Contact')).toBeInTheDocument()
    expect(screen.getByText('Technology')).toBeInTheDocument()
    expect(screen.getByText('12345678')).toBeInTheDocument()
    expect(screen.getByText(/Olivia · olivia@example.com/)).toBeInTheDocument()
  })

  it('shows loading skeleton initially', async () => {
    vi.mocked(sdk.getClient).mockReturnValue(new Promise(() => {}) as never)
    await act(async () => render(<ClientDetailPage />))
    // Skeleton renders by absence of heading; verify no client heading yet
    expect(
      screen.queryByRole('heading', { name: 'Acme Ltd' })
    ).not.toBeInTheDocument()
  })

  it('renders "Client not found." when API returns no data', async () => {
    vi.mocked(sdk.getClient).mockResolvedValue({
      response: { status: 404, data: { message: 'Not found' } }
    } as never)
    await act(async () => render(<ClientDetailPage />))
    await waitFor(() =>
      expect(screen.getByText('Client not found.')).toBeInTheDocument()
    )
  })

  it('shows error toast on load failure', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.getClient).mockRejectedValue(new Error('500'))
    await act(async () => render(<ClientDetailPage />))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to load client')
    )
  })

  it('does not call APIs when clientId is missing', async () => {
    mockClientId = undefined
    await act(async () => render(<ClientDetailPage />))
    expect(sdk.getClient).not.toHaveBeenCalled()
    expect(sdk.listEngagements).not.toHaveBeenCalled()
  })
})

describe('edit and save', () => {
  beforeEach(mockAdmin)

  async function enterEditMode() {
    await act(async () => render(<ClientDetailPage />))
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Acme Ltd' })
      ).toBeInTheDocument()
    )
    await userEvent.click(screen.getByRole('button', { name: /Edit/ }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Save Changes' })
      ).toBeInTheDocument()
    )
  }

  it('switches to edit mode and pre-fills the form', async () => {
    await enterEditMode()
    expect(screen.getByDisplayValue('Acme Ltd')).toBeInTheDocument()
    expect(screen.getByDisplayValue('jane@acme.test')).toBeInTheDocument()
  })

  it('cancel returns to read mode, discarding edits', async () => {
    await enterEditMode()
    await userEvent.clear(screen.getByLabelText(/^Company Name/))
    await userEvent.type(screen.getByLabelText(/^Company Name/), 'Edited Co')
    // Click the form-footer Cancel (header X + form footer + always-mounted dialog close)
    const cancels = screen.getAllByRole('button', { name: /Cancel/ })
    await userEvent.click(cancels[1])
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Save Changes' })
      ).not.toBeInTheDocument()
    )
    expect(
      screen.getByRole('heading', { name: 'Acme Ltd' })
    ).toBeInTheDocument()
  })

  it('saves the form and re-renders the read view', async () => {
    const { toast } = await import('sonner')
    const updated = { ...MOCK_CLIENT, companyName: 'Acme Holdings' }
    vi.mocked(sdk.updateClient).mockResolvedValue({
      data: { data: updated }
    } as never)
    await enterEditMode()
    await userEvent.clear(screen.getByLabelText(/^Company Name/))
    await userEvent.type(
      screen.getByLabelText(/^Company Name/),
      'Acme Holdings'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() =>
      expect(sdk.updateClient).toHaveBeenCalledWith({
        path: { client_id: 'c1' },
        body: expect.objectContaining({ companyName: 'Acme Holdings' })
      })
    )
    expect(toast.success).toHaveBeenCalledWith('Client updated')
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Acme Holdings' })
      ).toBeInTheDocument()
    )
  })

  it('shows server field errors on 422 from save', async () => {
    vi.mocked(sdk.updateClient).mockResolvedValue({
      response: {
        status: 422,
        data: {
          message: 'Validation error.',
          errors: { primaryContactEmail: 'Email already in use' }
        }
      }
    } as never)
    await enterEditMode()
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() =>
      expect(screen.getByText('Email already in use')).toBeInTheDocument()
    )
  })

  it('shows toast on save failure', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.updateClient).mockRejectedValue(new Error('boom'))
    await enterEditMode()
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to update client')
    )
  })
})

describe('notes', () => {
  beforeEach(mockAdmin)

  it('saves notes via updateClient', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.updateClient).mockResolvedValue({
      data: { data: { ...MOCK_CLIENT, internalNotes: 'Some notes\nAdded' } }
    } as never)
    await act(async () => render(<ClientDetailPage />))
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Acme Ltd' })
      ).toBeInTheDocument()
    )
    const notes = screen.getByPlaceholderText(
      'Add internal notes about this client…'
    ) as HTMLTextAreaElement
    expect(notes.value).toBe('Some notes')
    await userEvent.clear(notes)
    await userEvent.type(notes, 'Updated note')
    await userEvent.click(screen.getByRole('button', { name: 'Save Notes' }))
    await waitFor(() =>
      expect(sdk.updateClient).toHaveBeenCalledWith({
        path: { client_id: 'c1' },
        body: expect.objectContaining({ internalNotes: 'Updated note' })
      })
    )
    expect(toast.success).toHaveBeenCalledWith('Notes saved')
  })

  it('sends null when notes are cleared', async () => {
    vi.mocked(sdk.updateClient).mockResolvedValue({
      data: { data: { ...MOCK_CLIENT, internalNotes: null } }
    } as never)
    await act(async () => render(<ClientDetailPage />))
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Acme Ltd' })
      ).toBeInTheDocument()
    )
    const notes = screen.getByPlaceholderText(
      'Add internal notes about this client…'
    )
    await userEvent.clear(notes)
    await userEvent.click(screen.getByRole('button', { name: 'Save Notes' }))
    await waitFor(() =>
      expect(sdk.updateClient).toHaveBeenCalledWith({
        path: { client_id: 'c1' },
        body: expect.objectContaining({ internalNotes: null })
      })
    )
  })

  it('shows error toast on save notes failure', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.updateClient).mockRejectedValue(new Error('boom'))
    await act(async () => render(<ClientDetailPage />))
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Acme Ltd' })
      ).toBeInTheDocument()
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save Notes' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to save notes')
    )
  })
})

describe('engagements', () => {
  beforeEach(mockAdmin)

  it('shows empty state with admin hint', async () => {
    await act(async () => render(<ClientDetailPage />))
    await waitFor(() =>
      expect(screen.getByText('No engagements yet')).toBeInTheDocument()
    )
    expect(
      screen.getByText('Add the first engagement above')
    ).toBeInTheDocument()
  })

  it('renders existing engagement cards with formatted fee', async () => {
    vi.mocked(sdk.listEngagements).mockResolvedValue({
      data: {
        data: [
          {
            id: 'e1',
            clientId: 'c1',
            product: 'HIRE_READY',
            engagementDate: '2026-01-15',
            feeCharged: '1500.50',
            feeStatus: 'PAID',
            auditDate: null,
            reportIssuedDate: null,
            auditStatus: 'SCHEDULED',
            nextReviewDue: '2026-07-15'
          }
        ]
      }
    } as never)
    await act(async () => render(<ClientDetailPage />))
    await waitFor(() => expect(screen.getByText(/£1,500/)).toBeInTheDocument())
    expect(screen.getAllByText('HIRE Ready').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Review/).length).toBeGreaterThan(0)
  })

  async function clickAddEngagementSubmit() {
    const all = screen.getAllByRole('button', { name: 'Add Engagement' })
    const submit =
      all.find(b => (b as HTMLButtonElement).type === 'submit') ??
      all[all.length - 1]
    await userEvent.click(submit)
  }

  async function fillEngagementForm() {
    const selects = screen.getAllByTestId(
      'select-native'
    ) as HTMLSelectElement[]
    // Order: businessStage, region, sector, assignedOperatorId, status, product, feeStatus, auditStatus
    // But edit mode is off; engagement form selects are: product, feeStatus, auditStatus
    // We're not in edit mode → only engagement selects exist
    await userEvent.selectOptions(selects[0], 'HIRE_READY') // product
    // Click date pickers — engagementDate is the first calendar
    const calendarBtns = screen.getAllByText('calendar-pick')
    calendarPickReturns = '2026-02-01'
    await userEvent.click(calendarBtns[0])
    const fee = screen.getByLabelText(/Fee Charged/) as HTMLInputElement
    await userEvent.type(fee, '500')
    await userEvent.selectOptions(selects[1], 'INVOICED') // feeStatus
  }

  it('submits a new engagement and prepends it to the list', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.createEngagement).mockResolvedValue({
      data: {
        data: {
          id: 'e1',
          clientId: 'c1',
          product: 'HIRE_READY',
          engagementDate: '2026-02-01',
          feeCharged: '500',
          feeStatus: 'INVOICED',
          auditDate: null,
          reportIssuedDate: null,
          auditStatus: 'SCHEDULED',
          nextReviewDue: null
        }
      }
    } as never)
    await act(async () => render(<ClientDetailPage />))
    await waitFor(() =>
      expect(screen.getByText('No engagements yet')).toBeInTheDocument()
    )

    await fillEngagementForm()
    await clickAddEngagementSubmit()
    await waitFor(() =>
      expect(sdk.createEngagement).toHaveBeenCalledWith({
        path: { client_id: 'c1' },
        body: expect.objectContaining({
          product: 'HIRE_READY',
          engagementDate: '2026-02-01',
          feeCharged: 500,
          feeStatus: 'INVOICED',
          auditStatus: 'SCHEDULED'
        })
      })
    )
    expect(toast.success).toHaveBeenCalledWith('Engagement added')
    await waitFor(() => expect(screen.getByText(/£500/)).toBeInTheDocument())
  })

  it('shows server field errors on 422 from create engagement', async () => {
    vi.mocked(sdk.createEngagement).mockResolvedValue({
      response: {
        status: 422,
        data: {
          message: 'Validation error.',
          errors: { feeCharged: 'Fee must be positive' }
        }
      }
    } as never)
    await act(async () => render(<ClientDetailPage />))
    await waitFor(() =>
      expect(screen.getByText('No engagements yet')).toBeInTheDocument()
    )
    await fillEngagementForm()
    await clickAddEngagementSubmit()
    await waitFor(() =>
      expect(screen.getByText('Fee must be positive')).toBeInTheDocument()
    )
  })

  it('shows toast on engagement create failure', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.createEngagement).mockRejectedValue(new Error('boom'))
    await act(async () => render(<ClientDetailPage />))
    await waitFor(() =>
      expect(screen.getByText('No engagements yet')).toBeInTheDocument()
    )
    await fillEngagementForm()
    await clickAddEngagementSubmit()
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to add engagement')
    )
  })

  it('does not submit when engagement date is missing', async () => {
    await act(async () => render(<ClientDetailPage />))
    await waitFor(() =>
      expect(screen.getByText('No engagements yet')).toBeInTheDocument()
    )
    const selects = screen.getAllByTestId(
      'select-native'
    ) as HTMLSelectElement[]
    await userEvent.selectOptions(selects[0], 'HIRE_READY')
    await userEvent.type(screen.getByLabelText(/Fee Charged/), '500')
    await userEvent.selectOptions(selects[1], 'INVOICED')
    await clickAddEngagementSubmit()
    // zod blocks the submission — render any error and confirm no API call
    await waitFor(() => expect(sdk.createEngagement).not.toHaveBeenCalled())
  })
})
