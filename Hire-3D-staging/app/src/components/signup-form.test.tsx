import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import * as sdk from '@/client/sdk.gen'
import { ApiError } from '@/lib/api-client'
import { SignupForm } from './signup-form'

vi.mock('@/client/sdk.gen')
vi.mock('react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn()
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function renderForm() {
  return render(<SignupForm />)
}

describe('validation', () => {
  it('renders all fields', () => {
    renderForm()
    expect(screen.getByTestId('name-input')).toBeInTheDocument()
    expect(screen.getByTestId('signup-email-input')).toBeInTheDocument()
    expect(screen.getByTestId('signup-password-input')).toBeInTheDocument()
    expect(screen.getByTestId('signup-button')).toBeInTheDocument()
  })

  it('shows error for empty name', async () => {
    renderForm()
    await userEvent.click(screen.getByTestId('signup-button'))
    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument()
    })
  })

  it('shows error for invalid email', async () => {
    renderForm()
    await userEvent.type(screen.getByTestId('name-input'), 'Test User')
    await userEvent.type(
      screen.getByTestId('signup-email-input'),
      'not-an-email'
    )
    await userEvent.click(screen.getByTestId('signup-button'))
    await waitFor(() => {
      expect(
        screen.getByText('Enter a valid email address')
      ).toBeInTheDocument()
    })
  })

  it('shows error for short password', async () => {
    renderForm()
    await userEvent.type(screen.getByTestId('name-input'), 'Test User')
    await userEvent.type(
      screen.getByTestId('signup-email-input'),
      'user@example.com'
    )
    await userEvent.type(screen.getByTestId('signup-password-input'), 'short')
    await userEvent.click(screen.getByTestId('signup-button'))
    await waitFor(() => {
      expect(
        screen.getByText('Password must be at least 8 characters')
      ).toBeInTheDocument()
    })
  })
})

describe('submission', () => {
  it('calls API with entered values', async () => {
    vi.mocked(sdk.createUser).mockResolvedValue({} as never)
    renderForm()

    await userEvent.type(screen.getByTestId('name-input'), 'Test User')
    await userEvent.type(
      screen.getByTestId('signup-email-input'),
      'user@example.com'
    )
    await userEvent.type(
      screen.getByTestId('signup-password-input'),
      'password123'
    )
    await userEvent.click(screen.getByTestId('signup-button'))

    await waitFor(() => {
      expect(sdk.createUser).toHaveBeenCalledWith({
        body: {
          name: 'Test User',
          email: 'user@example.com',
          password: 'password123'
        }
      })
    })
  })

  it('shows success toast and navigates on success', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.createUser).mockResolvedValue({} as never)
    renderForm()

    await userEvent.type(screen.getByTestId('name-input'), 'Test User')
    await userEvent.type(
      screen.getByTestId('signup-email-input'),
      'user@example.com'
    )
    await userEvent.type(
      screen.getByTestId('signup-password-input'),
      'password123'
    )
    await userEvent.click(screen.getByTestId('signup-button'))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Account created. You can now sign in.'
      )
    })
  })

  it('shows error toast on failure', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.createUser).mockRejectedValue(new Error('409'))
    renderForm()

    await userEvent.type(screen.getByTestId('name-input'), 'Test User')
    await userEvent.type(
      screen.getByTestId('signup-email-input'),
      'user@example.com'
    )
    await userEvent.type(
      screen.getByTestId('signup-password-input'),
      'password123'
    )
    await userEvent.click(screen.getByTestId('signup-button'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Could not create account. Please try again.'
      )
    })
  })

  it('shows server message for ApiError 409', async () => {
    const { toast } = await import('sonner')
    vi.mocked(sdk.createUser).mockRejectedValue(
      new ApiError(409, 'Email already in use')
    )
    renderForm()

    await userEvent.type(screen.getByTestId('name-input'), 'Test User')
    await userEvent.type(
      screen.getByTestId('signup-email-input'),
      'user@example.com'
    )
    await userEvent.type(
      screen.getByTestId('signup-password-input'),
      'password123'
    )
    await userEvent.click(screen.getByTestId('signup-button'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Email already in use')
    })
  })
})
