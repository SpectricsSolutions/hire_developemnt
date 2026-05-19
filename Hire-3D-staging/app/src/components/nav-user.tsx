import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from '@/components/ui/sidebar'
import {
  Logout01Icon,
  MoreVerticalCircle01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  OPERATOR: 'Operator',
  VIEWER: 'Viewer'
}

const ROLE_CLASS: Record<string, string> = {
  ADMIN: 'bg-violet-100 text-violet-700',
  OPERATOR: 'bg-blue-100 text-blue-700',
  VIEWER: 'bg-zinc-100 text-zinc-600'
}

export function NavUser({
  user,
  onLogout
}: {
  user: {
    name: string
    email: string
    avatar: string
    role?: string | null
  }
  onLogout?: () => void
}) {
  const { isMobile } = useSidebar()
  const roleCls = user.role ? (ROLE_CLASS[user.role] ?? 'bg-zinc-100 text-zinc-600') : null
  const roleLabel = user.role ? (ROLE_LABEL[user.role] ?? user.role) : null

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar className="size-8 rounded-lg grayscale">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="rounded-lg">CN</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium">{user.name}</span>
                {roleCls && roleLabel && (
                  <span className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold ${roleCls}`}>
                    {roleLabel}
                  </span>
                )}
              </div>
              <span className="text-foreground/70 truncate text-xs">
                {user.email}
              </span>
            </div>
            <HugeiconsIcon
              icon={MoreVerticalCircle01Icon}
              strokeWidth={2}
              className="ml-auto size-4"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="size-8">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{user.name}</span>
                      {roleCls && roleLabel && (
                        <span className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold ${roleCls}`}>
                          {roleLabel}
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground truncate text-xs">
                      {user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout}>
              <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
