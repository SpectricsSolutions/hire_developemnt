import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'

import { ROUTES } from './constants/app'
import SplashPage from './pages/splash'

const loadDashboardLayout = () =>
  import('./components/layouts/dashboard-layout')
const loadAuthLayout = () => import('./components/layouts/auth-layout')
const loadHomePage = () => import('./pages/home')
const loadClientsPage = () => import('./pages/clients/index')
const loadNewClientPage = () => import('./pages/clients/new')
const loadClientDetailPage = () => import('./pages/clients/$clientId')
const loadUsersPage = () => import('./pages/users/index')
const loadUserDetailPage = () => import('./pages/users/$userId')
const loadLoginPage = () => import('./pages/login')
const loadSignupPage = () => import('./pages/signup')
const loadForgotPasswordPage = () => import('./pages/forgot-password')
const loadResetPasswordPage = () => import('./pages/reset-password')
const loadSettingsLayout = () => import('./pages/settings/layout')
const loadSecuritySettingsPage = () => import('./pages/settings/security')
const loadRolesSettingsPage = () => import('./pages/settings/roles')
const loadAuditLogsSettingsPage = () => import('./pages/settings/audit-logs')
const loadAdminControlsPage = () => import('./pages/admin/controls/index')
const loadAdminControlDetailPage = () =>
  import('./pages/admin/controls/$templateId')

const router = createBrowserRouter([
  {
    HydrateFallback: SplashPage,
    lazy: () => loadDashboardLayout().then(m => ({ Component: m.default })),
    children: [
      {
        index: true,
        handle: { title: 'Dashboard' },
        lazy: () => loadHomePage().then(m => ({ Component: m.default }))
      },
      {
        path: ROUTES.CLIENTS,
        handle: { title: 'Clients' },
        lazy: () => loadClientsPage().then(m => ({ Component: m.default }))
      },
      {
        path: `${ROUTES.CLIENTS}/new`,
        handle: { title: 'Add Client' },
        lazy: () => loadNewClientPage().then(m => ({ Component: m.default }))
      },
      {
        path: `${ROUTES.CLIENTS}/:clientId`,
        handle: { title: 'Client' },
        lazy: () => loadClientDetailPage().then(m => ({ Component: m.default }))
      },
      {
        path: ROUTES.USERS,
        handle: { title: 'Users' },
        lazy: () => loadUsersPage().then(m => ({ Component: m.default }))
      },
      {
        path: `${ROUTES.USERS}/:userId`,
        handle: { title: 'User' },
        lazy: () => loadUserDetailPage().then(m => ({ Component: m.default }))
      },
      {
        path: ROUTES.ADMIN_CONTROLS,
        handle: { title: 'Control Templates' },
        lazy: () =>
          loadAdminControlsPage().then(m => ({ Component: m.default }))
      },
      {
        path: `${ROUTES.ADMIN_CONTROLS}/:templateId`,
        handle: { title: 'Control Template' },
        lazy: () =>
          loadAdminControlDetailPage().then(m => ({ Component: m.default }))
      },
      {
        path: ROUTES.SETTINGS,
        handle: { title: 'Settings' },
        lazy: () => loadSettingsLayout().then(m => ({ Component: m.default })),
        children: [
          {
            index: true,
            element: <Navigate to={ROUTES.SETTINGS_SECURITY} replace />
          },
          {
            path: 'security',
            lazy: () =>
              loadSecuritySettingsPage().then(m => ({ Component: m.default }))
          },
          {
            path: 'roles',
            lazy: () =>
              loadRolesSettingsPage().then(m => ({ Component: m.default }))
          },
          {
            path: 'audit-logs',
            lazy: () =>
              loadAuditLogsSettingsPage().then(m => ({ Component: m.default }))
          }
        ]
      }
    ]
  },
  {
    HydrateFallback: SplashPage,
    lazy: () => loadAuthLayout().then(m => ({ Component: m.default })),
    children: [
      {
        path: ROUTES.LOGIN,
        lazy: () => loadLoginPage().then(m => ({ Component: m.default }))
      },
      {
        path: ROUTES.SIGNUP,
        lazy: () => loadSignupPage().then(m => ({ Component: m.default }))
      },
      {
        path: ROUTES.FORGOT_PASSWORD,
        lazy: () =>
          loadForgotPasswordPage().then(m => ({ Component: m.default }))
      },
      {
        path: ROUTES.RESET_PASSWORD,
        lazy: () =>
          loadResetPasswordPage().then(m => ({ Component: m.default }))
      }
    ]
  }
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
