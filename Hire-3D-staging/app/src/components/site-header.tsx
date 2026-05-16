import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { APP_NAME } from '@/constants/app'
import type { RouteHandle } from '@/types/router'
import { useEffect } from 'react'
import { useMatches } from 'react-router'

export function SiteHeader() {
  const matches = useMatches()
  const title = matches.findLast(m => (m.handle as RouteHandle | null)?.title)
    ?.handle as RouteHandle | undefined

  const pageTitle = title?.title ?? APP_NAME

  useEffect(() => {
    document.title =
      pageTitle === APP_NAME ? APP_NAME : `${pageTitle} — ${APP_NAME}`
  }, [pageTitle])

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <h1 className="text-base font-medium">{pageTitle}</h1>
      </div>
    </header>
  )
}
