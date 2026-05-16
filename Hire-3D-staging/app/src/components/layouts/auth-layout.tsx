import Logo from '@/components/logo'
import { ROUTES } from '@/constants/app'
import { useAuth } from '@/contexts/auth-context'
import SplashPage from '@/pages/splash'
import { Link, Navigate, Outlet } from 'react-router'

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <SplashPage />
  if (isAuthenticated) return <Navigate to={ROUTES.HOME} replace />

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link
          to={ROUTES.HOME}
          className="flex items-center gap-x-4 self-center"
          aria-label="Hire3D home"
        >
          <Logo size={36} />
          <span className="text-3xl">HIRE 3D</span>
        </Link>

        <Outlet />
      </div>
    </div>
  )
}
