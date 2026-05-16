import { listClients } from '@/client/sdk.gen'
import type { ClientRead } from '@/client/types.gen'
import { NeedsAttention } from '@/components/dashboard/needs-attention'
import { OperatorLeaderboard } from '@/components/dashboard/operator-leaderboard'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { StatCards } from '@/components/dashboard/stat-cards'
import { useAuth } from '@/contexts/auth-context'
import { unwrap } from '@/lib/api-client'
import { notifyApiError } from '@/lib/api-errors'
import { formatLongDate } from '@/lib/datetime'
import { useEffect, useState } from 'react'

export default function HomePage() {
  const { user, can } = useAuth()
  const showAdminWidgets = can('audit:read')
  const scopedToSelf = !can('clients:read_all')

  const [clients, setClients] = useState<ClientRead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    listClients()
      .then(res => {
        if (cancelled) return
        const { data } = unwrap<{ data: ClientRead[] }>(res as never)
        setClients(data)
      })
      .catch(err => notifyApiError(err, 'Failed to load dashboard'))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const today = formatLongDate(new Date())

  const firstName = user?.name?.split(' ')[0] || 'there'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="text-muted-foreground text-sm">{today}</p>
      </div>

      <StatCards clients={clients} loading={loading} scoped={scopedToSelf} />

      {showAdminWidgets ? (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <NeedsAttention clients={clients} loading={loading} />
            </div>
            <RecentActivity />
          </div>
          <OperatorLeaderboard />
        </>
      ) : (
        <NeedsAttention clients={clients} loading={loading} />
      )}
    </div>
  )
}
