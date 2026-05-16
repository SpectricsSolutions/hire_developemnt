import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuth } from '@/contexts/auth-context'
import { ApiError } from '@/lib/api-client'
import { LoginForm } from './login-form'

vi.mock('@/contexts/auth-context')
vi.mock('react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn()
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), info: vi.fn() } }))

const mockLogin = vi.fn()
const mockConfirmTotp = vi.fn()

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    can: () => false,
    login: mockLogin,
    confirmTotp: mockConfirmTotp,
    logout: vi.fn()
  })
})

afterEach(() => vi.clearAllMocks())

function renderForm() {
  return render(<LoginForm />)
}

describe('credentials step', () => {
  it('renders email and password fields', () => {
    renderForm()
    expect(screen.getByTestId('email-input')).toBeInTheDocument()
    expect(screen.getByTestId('password-input')).toBeInTheDocument()
    expect(screen.getByTestId('login-button')).toBeInTheDocument()
  })

  it('shows validation errors for empty submission', async () => {
    renderForm()
    await userEvent.click(screen.getByTestId('login-button'))
    await waitFor(() => {
      expect(
        screen.getByText('Enter a valid email address')
      ).toBeInTheDocument()
    })
  })

  it('shows validation error for invalid email', async () => {
    renderForm()
    await userEvent.type(screen.getByTestId('email-input'), 'not-an-email')
    await userEvent.click(screen.getByTestId('login-button'))
    await waitFor(() => {
      expect(
        screen.getByText('Enter a valid email address')
      ).toBeInTheDocument()
    })
  })

  it('calls login with entered credentials', async () => {
    mockLogin.mockResolvedValue({ requiresTOTP: false })
    renderForm()

    await userEvent.type(screen.getByTestId('email-input'), 'user@example.com')
    await userEvent.type(screen.getByTestId('password-input'), 'password123')
    await userEvent.click(screen.getByTestId('login-button'))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'password123')
    })
  })

  it('shows toast on login failure', async () => {
    const { toast } = await import('sonner')
    mockLogin.mockRejectedValue(new Error('401'))
    renderForm()

    await userEvent.type(screen.getByTestId('email-input'), 'user@example.com')
    await userEvent.type(screen.getByTestId('password-input'), 'wrongpassword')
    await userEvent.click(screen.getByTestId('login-button'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid email or password')
    })
  })

  it('shows server message for ApiError 403', async () => {
    const { toast } = await import('sonner')
    mockLogin.mockRejectedValue(
      new ApiError(403, 'Your account is pending approval')
    )
    renderForm()

    await userEvent.type(screen.getByTestId('email-input'), 'user@example.com')
    await userEvent.type(screen.getByTestId('password-input'), 'password123')
    await userEvent.click(screen.getByTestId('login-button'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Your account is pending approval'
      )
    })
  })
})

describe('TOTP step', () => {
  it('shows TOTP input when login requires 2FA', async () => {
    mockLogin.mockResolvedValue({
      requiresTOTP: true,
      totpToken: 'totp-token-123'
    })
    renderForm()

    await userEvent.type(screen.getByTestId('email-input'), 'user@example.com')
    await userEvent.type(screen.getByTestId('password-input'), 'password123')
    await userEvent.click(screen.getByTestId('login-button'))

    await waitFor(() => {
      expect(screen.getByTestId('totp-code-input')).toBeInTheDocument()
    })
  })

  it('shows validation error for non-numeric code', async () => {
    mockLogin.mockResolvedValue({
      requiresTOTP: true,
      totpToken: 'totp-token-123'
    })
    renderForm()

    await userEvent.type(screen.getByTestId('email-input'), 'user@example.com')
    await userEvent.type(screen.getByTestId('password-input'), 'password123')
    await userEvent.click(screen.getByTestId('login-button'))

    await waitFor(() =>
      expect(screen.getByTestId('totp-code-input')).toBeInTheDocument()
    )

    await userEvent.type(screen.getByTestId('totp-code-input'), 'abcdef')
    await userEvent.click(screen.getByTestId('totp-submit-button'))

    await waitFor(() => {
      expect(screen.getByText('Digits only')).toBeInTheDocument()
    })
  })

  it('calls confirmTotp with token and code', async () => {
    mockLogin.mockResolvedValue({
      requiresTOTP: true,
      totpToken: 'totp-token-123'
    })
    mockConfirmTotp.mockResolvedValue(undefined)
    renderForm()

    await userEvent.type(screen.getByTestId('email-input'), 'user@example.com')
    await userEvent.type(screen.getByTestId('password-input'), 'password123')
    await userEvent.click(screen.getByTestId('login-button'))

    await waitFor(() =>
      expect(screen.getByTestId('totp-code-input')).toBeInTheDocument()
    )

    await userEvent.type(screen.getByTestId('totp-code-input'), '123456')
    await userEvent.click(screen.getByTestId('totp-submit-button'))

    await waitFor(() => {
      expect(mockConfirmTotp).toHaveBeenCalledWith('totp-token-123', '123456')
    })
  })

  it('shows toast and resets on wrong code', async () => {
    const { toast } = await import('sonner')
    mockLogin.mockResolvedValue({
      requiresTOTP: true,
      totpToken: 'totp-token-123'
    })
    mockConfirmTotp.mockRejectedValue(new Error('401'))
    renderForm()

    await userEvent.type(screen.getByTestId('email-input'), 'user@example.com')
    await userEvent.type(screen.getByTestId('password-input'), 'password123')
    await userEvent.click(screen.getByTestId('login-button'))

    await waitFor(() =>
      expect(screen.getByTestId('totp-code-input')).toBeInTheDocument()
    )

    await userEvent.type(screen.getByTestId('totp-code-input'), '000000')
    await userEvent.click(screen.getByTestId('totp-submit-button'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Invalid code. Please try again.'
      )
    })
  })

  it('goes back to credentials step', async () => {
    mockLogin.mockResolvedValue({
      requiresTOTP: true,
      totpToken: 'totp-token-123'
    })
    renderForm()

    await userEvent.type(screen.getByTestId('email-input'), 'user@example.com')
    await userEvent.type(screen.getByTestId('password-input'), 'password123')
    await userEvent.click(screen.getByTestId('login-button'))

    await waitFor(() =>
      expect(screen.getByTestId('totp-code-input')).toBeInTheDocument()
    )

    await userEvent.click(screen.getByText('Back to login'))

    expect(screen.getByTestId('email-input')).toBeInTheDocument()
  })
})
