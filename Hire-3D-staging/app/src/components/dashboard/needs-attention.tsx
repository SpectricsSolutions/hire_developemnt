import type { ClientRead } from '@/client/types.gen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ClientStatus,
  ClientStatusLabel,
  ROUTES,
  type ClientStatus as ClientStatusType
} from '@/constants/app'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'

const PRIORITY: Record<string, number> = {
  [ClientStatus.FOLLOW_UP_DUE]: 0,
  [ClientStatus.AUDIT_IN_PROGRESS]: 1
}

const STATUS_CLASS: Record<string, string> = {
  [ClientStatus.FOLLOW_UP_DUE]: 'border-amber-200 bg-amber-50 text-amber-700',
  [ClientStatus.AUDIT_IN_PROGRESS]: 'border-blue-200 bg-blue-50 text-blue-700'
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

export function NeedsAttention({
  clients,
  loading
}: {
  clients: ClientRead[]
  loading: boolean
}) {
  const items = clients
    .filter(c => c.status in PRIORITY)
    .sort((a, b) => PRIORITY[a.status] - PRIORITY[b.status])
    .slice(0, 5)

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Needs Attention</CardTitle>
        <CardDescription>
          Clients with follow-ups due or audits in progress
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-sm">All clear — nothing needs attention.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {items.map(c => (
              <li key={c.id}>
                <Link
                  to={ROUTES.CLIENT_DETAIL(c.id)}
                  className="hover:bg-muted/50 group -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors"
                >
                  <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                    {initials(c.companyName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium group-hover:underline">
                      {c.companyName}
                    </p>
                    {c.sector && (
                      <p className="text-muted-foreground truncate text-xs">
                        {c.sector}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={STATUS_CLASS[c.status] ?? ''}
                  >
                    {ClientStatusLabel[c.status as ClientStatusType]}
                  </Badge>
                  <ChevronRight className="text-muted-foreground/40 h-4 w-4" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {items.length > 0 && (
          <div className="mt-auto flex justify-end pt-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to={ROUTES.CLIENTS}>View all clients</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
