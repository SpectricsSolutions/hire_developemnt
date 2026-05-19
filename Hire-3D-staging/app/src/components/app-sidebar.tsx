import * as React from 'react'

// import { NavDocuments } from '@/components/nav-documents'
import { NavMain } from '@/components/nav-main'
import { NavSecondary } from '@/components/nav-secondary'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'
import { ROUTES } from '@/constants/app'
import { useAuth } from '@/contexts/auth-context'
import {
  // Analytics01Icon,
  // ChartHistogramIcon,
  Building04Icon,
  CheckListIcon,
  CommandIcon,
  DashboardSquare01Icon,
  // Database01Icon,
  // File01Icon,
  // Folder01Icon,
  // HelpCircleIcon,
  // Menu01Icon,
  // SearchIcon,
  Settings05Icon,
  UserGroupIcon
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

const navMain = [
  {
    title: 'Dashboard',
    url: ROUTES.HOME,
    icon: <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />
  },
  {
    title: 'Clients',
    url: ROUTES.CLIENTS,
    icon: <HugeiconsIcon icon={Building04Icon} strokeWidth={2} />,
    requiredPermission: 'clients:read'
  },
  {
    title: 'Users',
    url: ROUTES.USERS,
    icon: <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />,
    requiredPermission: 'users:list'
  },
  {
    title: 'Controls',
    url: ROUTES.ADMIN_CONTROLS,
    icon: <HugeiconsIcon icon={CheckListIcon} strokeWidth={2} />,
    requiredPermission: 'controls:read'
  }
]

const navSecondary = [
  {
    title: 'Settings',
    url: ROUTES.SETTINGS,
    icon: <HugeiconsIcon icon={Settings05Icon} strokeWidth={2} />
  }
  // { title: 'Get Help', url: '#', icon: <HugeiconsIcon icon={HelpCircleIcon} strokeWidth={2} /> },
  // { title: 'Search', url: '#', icon: <HugeiconsIcon icon={SearchIcon} strokeWidth={2} /> },
]

// const documents = [
//   { name: 'Data Library', url: '#', icon: <HugeiconsIcon icon={Database01Icon} strokeWidth={2} /> },
//   { name: 'Reports', url: '#', icon: <HugeiconsIcon icon={Analytics01Icon} strokeWidth={2} /> },
//   { name: 'Word Assistant', url: '#', icon: <HugeiconsIcon icon={File01Icon} strokeWidth={2} /> },
// ]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, can, logout } = useAuth()

  const visibleNavMain = navMain.filter(
    item => !item.requiredPermission || can(item.requiredPermission)
  )

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="#" />}
            >
              <HugeiconsIcon
                icon={CommandIcon}
                strokeWidth={2}
                className="size-5!"
              />
              <span className="text-base font-semibold">Hire3D</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={visibleNavMain} />
        {/* <NavDocuments items={documents} /> */}
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user?.name ?? '',
            email: user?.email ?? '',
            avatar: '',
            role: user?.role ?? null
          }}
          onLogout={logout}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
