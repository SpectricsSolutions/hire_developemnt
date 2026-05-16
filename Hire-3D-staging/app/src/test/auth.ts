import { vi } from 'vitest'

import { useAuth } from '@/contexts/auth-context'

type Overrides = {
  sub?: string
  email?: string
  name?: string
  role?: string | null
  permissions?: string[]
  totp_enabled?: boolean
}

export function mockAuth(overrides: Overrides = {}) {
  const permissions = overrides.permissions ?? []
  vi.mocked(useAuth).mockReturnValue({
    user: {
      sub: overrides.sub ?? 'u1',
      email: overrides.email ?? 'user@example.com',
      name: overrides.name ?? 'User',
      role: overrides.role ?? null,
      permissions,
      totp_enabled: overrides.totp_enabled ?? false
    },
    isAuthenticated: true,
    isLoading: false,
    can: (p: string) => permissions.includes(p),
    login: vi.fn(),
    confirmTotp: vi.fn(),
    logout: vi.fn()
  })
}
