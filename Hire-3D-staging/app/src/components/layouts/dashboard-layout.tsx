import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { ROUTES } from '@/constants/app'
import { useAuth } from '@/contexts/auth-context'
import SplashPage from '@/pages/splash'
import { Navigate, Outlet } from 'react-router'

export default function DashboardLayout() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <SplashPage />
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />

        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
              <Outlet />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
