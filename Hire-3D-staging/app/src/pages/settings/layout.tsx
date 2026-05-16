import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'
import { NavLink, Outlet } from 'react-router'

type SettingsTab = {
  to: string
  label: string
  permission?: string
}

const TABS: SettingsTab[] = [
  { to: '/settings/security', label: 'Security' },
  {
    to: '/settings/roles',
    label: 'Roles & Permissions',
    permission: 'roles:manage'
  },
  {
    to: '/settings/audit-logs',
    label: 'Audit Logs',
    permission: 'audit:read'
  }
]

export default function SettingsLayout() {
  const { can } = useAuth()
  const visibleTabs = TABS.filter(t => !t.permission || can(t.permission))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your account and workspace preferences.
        </p>
      </div>

      <nav className="border-b">
        <ul className="-mb-px flex gap-6">
          {visibleTabs.map(tab => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                className={({ isActive }) =>
                  cn(
                    'inline-flex h-10 items-center border-b-2 px-1 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-primary text-foreground'
                      : 'text-muted-foreground hover:text-foreground border-transparent'
                  )
                }
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Outlet />
    </div>
  )
}
