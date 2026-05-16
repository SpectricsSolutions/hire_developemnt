import { listControlTemplates } from '@/client/sdk.gen'
import type { ControlTemplateRead } from '@/client/types.gen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Domain,
  DomainLabel,
  Product,
  ProductLabel,
  ROUTES
} from '@/constants/app'
import { useAuth } from '@/contexts/auth-context'
import { unwrap } from '@/lib/api-client'
import { notifyApiError } from '@/lib/api-errors'
import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'

const PRODUCT_TABS: Product[] = [
  Product.THE_CHECK,
  Product.HIRE_3D_CORE,
  Product.HIRE_3D_ENHANCED
]

export default function AdminControlsPage() {
  const { can } = useAuth()
  const [templates, setTemplates] = useState<ControlTemplateRead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listControlTemplates()
      .then(res => {
        const { data } = unwrap<{ data: ControlTemplateRead[] }>(res)
        setTemplates(data)
      })
      .catch(err => notifyApiError(err, 'Failed to load control templates'))
      .finally(() => setLoading(false))
  }, [])

  if (!can('controls:read')) return <Navigate to={ROUTES.HOME} replace />

  const byProduct = (product: Product) =>
    templates.filter(t => t.product === product)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Control Templates
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          The library of audit controls operators work through during
          assessments. Edit calibration anchors here.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue={Product.THE_CHECK}>
          <TabsList>
            {PRODUCT_TABS.map(p => (
              <TabsTrigger key={p} value={p}>
                {ProductLabel[p]}
                <span className="bg-background ml-2 rounded-full px-1.5 py-0.5 text-xs font-medium">
                  {byProduct(p).length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          {PRODUCT_TABS.map(p => (
            <TabsContent key={p} value={p} className="mt-4">
              <ControlList templates={byProduct(p)} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}

function ControlList({ templates }: { templates: ControlTemplateRead[] }) {
  if (templates.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No control templates seeded for this product yet.
      </p>
    )
  }

  // Group by domain (null = no domain, e.g. THE CHECK).
  const groups = templates.reduce<Record<string, ControlTemplateRead[]>>(
    (acc, t) => {
      const key = t.domain ?? '_'
      acc[key] ??= []
      acc[key].push(t)
      return acc
    },
    {}
  )

  const orderedKeys = Object.keys(groups).sort((a, b) => {
    if (a === '_') return -1
    if (b === '_') return 1
    return a.localeCompare(b)
  })

  return (
    <div className="flex flex-col gap-6">
      {orderedKeys.map(key => (
        <section key={key} className="flex flex-col gap-3">
          {key !== '_' && (
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {DomainLabel[key as Domain]}
            </h3>
          )}
          <div className="flex flex-col gap-2">
            {groups[key].map(t => (
              <ControlRow key={t.id} template={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function ControlRow({ template }: { template: ControlTemplateRead }) {
  return (
    <Link
      to={ROUTES.ADMIN_CONTROL_DETAIL(template.id)}
      className="hover:bg-muted/50 flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors"
    >
      <div className="flex flex-1 items-center gap-3">
        <div className="bg-muted text-muted-foreground flex h-10 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-bold">
          {template.code}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{template.title}</p>
          <p className="text-muted-foreground line-clamp-1 text-xs">
            {template.whatTesting}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="outline" className="gap-1 text-xs">
          {template.calibrationAnchors?.length ?? 0} anchors
        </Badge>
        {!template.isActive && (
          <Badge
            variant="outline"
            className="border-zinc-200 bg-zinc-100 text-zinc-500"
          >
            Inactive
          </Badge>
        )}
        <Button variant="ghost" size="icon" asChild>
          <span>
            <ChevronRight className="h-4 w-4" />
          </span>
        </Button>
      </div>
    </Link>
  )
}
