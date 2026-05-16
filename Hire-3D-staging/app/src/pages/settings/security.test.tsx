import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as sdk from '@/client/sdk.gen'
import { UserRole } from '@/constants/app'
import { ApiError } from '@/lib/api-client'
import { mockAuth } from '@/test/auth'
import SecuritySettingsPage from './security'

vi.mock('@/client/sdk.gen')
vi.mock('@/contexts/auth-context')
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function mockUser(role: UserRole = UserRole.VIEWER, totp_enabled = false) {
  mockAuth({
    role,
    totp_enabled,
    permissions: role === UserRole.ADMIN ? ['roles:manage'] : []
  })
}

const MOCK_SETUP = {
  qrUri:
    'otpauth://totp/Hire3D:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Hire3D',
  issuer: 'Hire3D'
}

afterEach(() => vi.clearAllMocks())

describe('idle state', () => {
  it('renders the set up button', async () => {
    mockUser()
    await act(async () => render(<SecuritySettingsPage />))
    expect(
      screen.getByRole('button', { name: 'Set up authenticator app' })
    ).toBeInTheDocument()
  })

  it('shows admin notice for admin users', async () => {
    mockUser(UserRole.ADMIN)
    await act(async () => render(<SecuritySettingsPage />))
    expect(screen.getByText(/2FA may be required/i)).toBeInTheDocument()
  })

  it('does not show admin notice for non-admin users', async () => {
    mockUser(UserRole.VIEWER)
    await act(async () => render(<SecuritySettingsPage />))
    expect(screen.queryByText(/2FA may be required/i)).not.toBeInTheDocument()
  })
})

describe('already enrolled state', () => {
  it('shows enabled state when totp_enabled is true in token', async () => {
    mockUser(UserRole.VIEWER, true)
    await act(async () => render(<SecuritySettingsPage />))
    expect(screen.getByText(/Authenticator app is active/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Set up authenticator app' })
    ).not.toBeInTheDocument()
  })
})

describe('setup flow', () => {
  it('shows QR code and input after clicking set up', async () => {
    mockUser()
    vi.mocked(sdk.totpSetup).mockResolvedValue({
      data: { data: MOCK_SETUP }
    } as never)
    await act(async () => render(<SecuritySettingsPage />))
    await userEvent.click(
      screen.getByRole('button', { name: 'Set up authenticator app' })
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Enable 2FA' })
      ).toBeInTheDocument()
    )
    expect(screen.getByLabelText('Verification code')).toBeInTheDocument()
    expect(screen.getByText(/JBSWY3DPEHPK3PXP/)).toBeInTheDocument()
  })

  it('omits manual secret when setup QR URI is malformed', async () => {
    mockUser()
    vi.mocked(sdk.totpSetup).mockResolvedValue({
      data: { data: { ...MOCK_SETUP, qrUri: 'not-a-valid-uri' } }
    } as never)
    await act(async () => render(<SecuritySettingsPage />))
    await userEvent.click(
      screen.getByRole('button', { name: 'Set up authenticator app' })
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Enable 2FA' })
      ).toBeInTheDocument()
    )
    expect(
      screen.queryByText(/Enter this key manually/i)
    ).not.toBeInTheDocument()
  })

  it('shows error toast when setup API fails', async () => {
    const { toast } = await import('sonner')
    mockUser()
    vi.mocked(sdk.totpSetup).mockRejectedValue(new Error('500'))
    await act(async () => render(<SecuritySettingsPage />))
    await userEvent.click(
      screen.getByRole('button', { name: 'Set up authenticator app' })
    )
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to start TOTP setup')
    )
  })

  it('cancel returns to idle state', async () => {
    mockUser()
    vi.mocked(sdk.totpSetup).mockResolvedValue({
      data: { data: MOCK_SETUP }
    } as never)
    await act(async () => render(<SecuritySettingsPage />))
    await userEvent.click(
      screen.getByRole('button', { name: 'Set up authenticator app' })
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(
      screen.getByRole('button', { name: 'Set up authenticator app' })
    ).toBeInTheDocument()
  })
})

describe('disable flow', () => {
  it('calls totpDisable, returns to idle and shows success toast', async () => {
    const { toast } = await import('sonner')
    mockUser(UserRole.VIEWER, true)
    vi.mocked(sdk.totpDisable).mockResolvedValue({
      data: { success: true }
    } as never)
    await act(async () => render(<SecuritySettingsPage />))
    await userEvent.click(screen.getByRole('button', { name: 'Disable 2FA' }))
    await waitFor(() => expect(sdk.totpDisable).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalledWith(
      'Two-factor authentication disabled'
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Set up authenticator app' })
      ).toBeInTheDocument()
    )
  })

  it('shows error toast on disable failure', async () => {
    const { toast } = await import('sonner')
    mockUser(UserRole.VIEWER, true)
    vi.mocked(sdk.totpDisable).mockRejectedValue(new Error('boom'))
    await act(async () => render(<SecuritySettingsPage />))
    await userEvent.click(screen.getByRole('button', { name: 'Disable 2FA' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to disable two-factor authentication'
      )
    )
  })
})

describe('verify flow', () => {
  async function renderSetupStep() {
    mockUser()
    vi.mocked(sdk.totpSetup).mockResolvedValue({
      data: { data: MOCK_SETUP }
    } as never)
    await act(async () => render(<SecuritySettingsPage />))
    await userEvent.click(
      screen.getByRole('button', { name: 'Set up authenticator app' })
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Enable 2FA' })
      ).toBeInTheDocument()
    )
  }

  it('shows validation error when code is empty', async () => {
    await renderSetupStep()
    await userEvent.click(screen.getByRole('button', { name: 'Enable 2FA' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Enter the 6-digit code from your authenticator app'
      )
    )
  })

  it('shows validation error when code is not 6 digits', async () => {
    await renderSetupStep()
    await userEvent.type(screen.getByLabelText('Verification code'), '123')
    await userEvent.click(screen.getByRole('button', { name: 'Enable 2FA' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Enter the 6-digit code from your authenticator app'
      )
    )
  })

  it('submits code and shows enabled state on success', async () => {
    const { toast } = await import('sonner')
    await renderSetupStep()
    vi.mocked(sdk.totpVerify).mockResolvedValue({
      data: { success: true }
    } as never)
    await userEvent.type(screen.getByLabelText('Verification code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Enable 2FA' }))
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Two-factor authentication enabled'
      )
    )
    expect(screen.getByText(/Authenticator app is active/i)).toBeInTheDocument()
  })

  it('shows error message when code is invalid', async () => {
    await renderSetupStep()
    vi.mocked(sdk.totpVerify).mockRejectedValue(new Error('Invalid'))
    await userEvent.type(screen.getByLabelText('Verification code'), '000000')
    await userEvent.click(screen.getByRole('button', { name: 'Enable 2FA' }))
    await waitFor(() =>
      expect(screen.getByText(/Invalid code/i)).toBeInTheDocument()
    )
  })

  it('shows ApiError message when verification fails with API details', async () => {
    await renderSetupStep()
    vi.mocked(sdk.totpVerify).mockRejectedValue(
      new ApiError(400, 'Code expired')
    )
    await userEvent.type(screen.getByLabelText('Verification code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Enable 2FA' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Code expired')
    )
  })

  it('submits on Enter key press', async () => {
    const { toast } = await import('sonner')
    await renderSetupStep()
    vi.mocked(sdk.totpVerify).mockResolvedValue({
      data: { success: true }
    } as never)
    await userEvent.type(
      screen.getByLabelText('Verification code'),
      '123456{Enter}'
    )
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Two-factor authentication enabled'
      )
    )
  })
})
