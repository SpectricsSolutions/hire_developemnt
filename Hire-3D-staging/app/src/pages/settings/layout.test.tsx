import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { UserRole } from '@/constants/app'
import { mockAuth } from '@/test/auth'
import SettingsLayout from './layout'

vi.mock('@/contexts/auth-context')
vi.mock('react-router', () => ({
  NavLink: ({
    to,
    children,
    className
  }: {
    to: string
    children: React.ReactNode
    className: ((args: { isActive: boolean }) => string) | string
  }) => {
    const cls =
      typeof className === 'function'
        ? className({ isActive: to === '/settings/security' })
        : className
    return (
      <a href={to} className={cls} data-to={to}>
        {children}
      </a>
    )
  },
  Outlet: () => <div data-testid="outlet">child route</div>
}))

afterEach(() => vi.clearAllMocks())

describe('SettingsLayout', () => {
  it('always shows Security tab to any authed user', () => {
    mockAuth({ role: UserRole.VIEWER })
    render(<SettingsLayout />)
    expect(screen.getByRole('link', { name: 'Security' })).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Roles & Permissions' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Audit Logs' })
    ).not.toBeInTheDocument()
  })

  it('shows Roles & Permissions only when user has roles:manage', () => {
    mockAuth({ role: UserRole.ADMIN, permissions: ['roles:manage'] })
    render(<SettingsLayout />)
    expect(
      screen.getByRole('link', { name: 'Roles & Permissions' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Audit Logs' })
    ).not.toBeInTheDocument()
  })

  it('shows Audit Logs only when user has audit:read', () => {
    mockAuth({ role: UserRole.ADMIN, permissions: ['audit:read'] })
    render(<SettingsLayout />)
    expect(screen.getByRole('link', { name: 'Audit Logs' })).toBeInTheDocument()
  })

  it('shows all tabs when user has both permissions', () => {
    mockAuth({
      role: UserRole.ADMIN,
      permissions: ['roles:manage', 'audit:read']
    })
    render(<SettingsLayout />)
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it('renders the Outlet for the active child route', () => {
    mockAuth({ role: UserRole.VIEWER })
    render(<SettingsLayout />)
    expect(screen.getByTestId('outlet')).toBeInTheDocument()
  })

  it('applies the active class for the matching route', () => {
    mockAuth({ role: UserRole.VIEWER })
    render(<SettingsLayout />)
    const securityLink = screen.getByRole('link', { name: 'Security' })
    // Active state is keyed off `to === '/settings/security'` in the NavLink mock
    expect(securityLink.className).toContain('text-foreground')
  })
})
