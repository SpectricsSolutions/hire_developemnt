import { CommandIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { cn } from '@/lib/utils'

type LogoProps = {
  size?: number
  className?: string
}

const Logo: React.FC<LogoProps> = ({ size = 28, className }) => {
  return (
    <HugeiconsIcon
      icon={CommandIcon}
      strokeWidth={2}
      className={cn('shrink-0', className)}
      style={{ width: size, height: size }}
    />
  )
}

export default Logo
