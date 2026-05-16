import { ClientForm } from '@/components/client-form'
import { ROUTES } from '@/constants/app'
import { useAuth } from '@/contexts/auth-context'
import { ArrowLeft } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router'

export default function NewClientPage() {
  const { can } = useAuth()
  const navigate = useNavigate()

  if (!can('clients:create')) return <Navigate to={ROUTES.HOME} replace />

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Link
        to={ROUTES.CLIENTS}
        className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Clients
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Client</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Create a new client record and assign it to an operator.
        </p>
      </div>

      <ClientForm
        onSuccess={id => navigate(ROUTES.CLIENT_DETAIL(id))}
        onCancel={() => navigate(ROUTES.CLIENTS)}
      />
    </div>
  )
}
