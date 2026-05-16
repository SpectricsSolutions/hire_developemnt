import { format, parseISO } from 'date-fns'
import { enGB } from 'date-fns/locale'

// Single source of truth for date/time formatting.
// Locale fixed to en-GB (UK product). Timezone is the browser's local TZ.

function toDate(input: string | Date): Date {
  if (input instanceof Date) return input
  return parseISO(input)
}

const opts = { locale: enGB }

// "2 May 2026"
export function formatDate(input: string | Date): string {
  return format(toDate(input), 'd MMM yyyy', opts)
}

// "Saturday, 2 May 2026"
export function formatLongDate(input: string | Date): string {
  return format(toDate(input), 'EEEE, d MMMM yyyy', opts)
}

// "2 May 2026, 8:36 AM"
export function formatDateTime(input: string | Date): string {
  return format(toDate(input), 'd MMM yyyy, h:mm a', opts)
}

// "just now" / "5m ago" / "3h ago" / "2d ago" / "2 May 2026"
export function formatRelative(input: string | Date): string {
  const date = toDate(input)
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return formatDate(date)
}
