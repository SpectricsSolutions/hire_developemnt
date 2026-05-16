import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as sdk from '@/client/sdk.gen'
import { AuthProvider, useAuth } from './auth-context'

vi.mock('@/client/sdk.gen')
vi.mock('@/client/client.gen', () => ({
  client: { setConfig: vi.fn(), post: vi.fn(), get: vi.fn() }
}))

function TestConsumer() {
  const { isAuthenticated, isLoading, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <button onClick={() => login('user@example.com', 'password')}>
        Login
      </button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  )
}

function renderWithAuth() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  )
}

afterEach(() => vi.clearAllMocks())

describe('initial state', () => {
  it('starts loading then resolves unauthenticated when refresh fails', async () => {
    vi.mocked(sdk.refresh).mockResolvedValue({
      data: { success: false, message: 'Unauthorized' }
    } as never)

    renderWithAuth()

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
    expect(screen.getByTestId('authenticated').textContent).toBe('false')
  })

  it('restores session when refresh succeeds', async () => {
    vi.mocked(sdk.refresh).mockResolvedValue({
      data: { data: { accessToken: 'new-access-token', tokenType: 'bearer' } }
    } as never)

    renderWithAuth()

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true')
    })
  })

  it('resolves unauthenticated when refresh throws', async () => {
    vi.mocked(sdk.refresh).mockRejectedValue(new Error('401'))

    renderWithAuth()

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
    expect(screen.getByTestId('authenticated').textContent).toBe('false')
  })
})

describe('login', () => {
  beforeEach(() => {
    vi.mocked(sdk.refresh).mockResolvedValue({
      data: { success: false }
    } as never)
  })

  it('authenticates on successful login', async () => {
    vi.mocked(sdk.login).mockResolvedValue({
      data: {
        data: {
          requires2Fa: false,
          accessToken: 'access',
          tokenType: 'bearer'
        }
      }
    } as never)

    renderWithAuth()
    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false')
    )

    await userEvent.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true')
    })
  })

  it('throws on failed login', async () => {
    vi.mocked(sdk.login).mockResolvedValue({
      data: null
    } as never)

    renderWithAuth()
    await waitFor(() =>
      expect(screen.getByTestId('loading').textContent).toBe('false')
    )

    await expect(
      (async () => {
        const { login } = useAuthOutside()
        await login('user@example.com', 'wrong')
      })()
    ).rejects.toBeDefined()
  })
})

describe('TOTP login', () => {
  beforeEach(() => {
    vi.mocked(sdk.refresh).mockResolvedValue({
      data: { success: false }
    } as never)
  })

  function TOTPConsumer() {
    const { isAuthenticated, login, confirmTotp } = useAuth()
    const [totpToken, setTotpToken] = useState<string | null>(null)

    const handleLogin = async () => {
      const result = await login('user@example.com', 'password')
      if (result.requiresTOTP) setTotpToken(result.totpToken)
    }

    return (
      <div>
        <span data-testid="authenticated">{String(isAuthenticated)}</span>
        {totpToken && <span data-testid="totp-token">{totpToken}</span>}
        <button onClick={handleLogin}>Login</button>
        <button onClick={() => confirmTotp(totpToken!, '123456')}>
          Confirm
        </button>
      </div>
    )
  }

  it('returns TOTP challenge when requires2Fa is true', async () => {
    vi.mocked(sdk.login).mockResolvedValue({
      data: {
        data: { requires2Fa: true, totpToken: 'totp-token-123' }
      }
    } as never)

    render(
      <AuthProvider>
        <TOTPConsumer />
      </AuthProvider>
    )

    await userEvent.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(screen.getByTestId('totp-token')).toHaveTextContent(
        'totp-token-123'
      )
    })
  })

  it('authenticates after confirmTotp', async () => {
    vi.mocked(sdk.login).mockResolvedValue({
      data: {
        data: { requires2Fa: true, totpToken: 'totp-token-123' }
      }
    } as never)
    vi.mocked(sdk.totpConfirm).mockResolvedValue({
      data: { data: { accessToken: 'access', tokenType: 'bearer' } }
    } as never)

    render(
      <AuthProvider>
        <TOTPConsumer />
      </AuthProvider>
    )

    await userEvent.click(screen.getByText('Login'))
    await waitFor(() =>
      expect(screen.getByTestId('totp-token')).toBeInTheDocument()
    )

    await userEvent.click(screen.getByText('Confirm'))

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
    })
  })
})

describe('logout', () => {
  it('clears session on logout', async () => {
    vi.mocked(sdk.refresh).mockResolvedValue({
      data: { data: { accessToken: 'access', tokenType: 'bearer' } }
    } as never)
    vi.mocked(sdk.logout).mockResolvedValue({} as never)

    renderWithAuth()
    await waitFor(() =>
      expect(screen.getByTestId('authenticated').textContent).toBe('true')
    )

    await userEvent.click(screen.getByText('Logout'))

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('false')
    })
  })
})

function useAuthOutside() {
  let value: ReturnType<typeof useAuth> | null = null
  function Extractor() {
    value = useAuth()
    return null
  }
  render(
    <AuthProvider>
      <Extractor />
    </AuthProvider>
  )
  return value!
}
