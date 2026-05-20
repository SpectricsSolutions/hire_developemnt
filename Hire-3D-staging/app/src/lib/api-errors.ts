import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { toast } from 'sonner'
import { ApiError } from './api-client'

// Per-status defaults aligned to the API protocol (see docs/API.md
// "Response Envelope"). The API handler returns a generic fixed string for
// these codes, so we replace it with something user-friendly.
const STATUS_DEFAULTS: Record<number, string> = {
  401: 'Your session has expired. Please sign in again.',
  404: 'Not found.',
  429: 'Too many requests. Please slow down and try again.'
}

// Used only when the server didn't supply a useful message of its own. For
// example a bare `raise ForbiddenError` produces an empty 403 body, so we
// surface this; but a `ForbiddenError("Your account is pending approval")`
// wins over it.
const STATUS_FALLBACKS: Record<number, string> = {
  403: "You don't have permission to perform this action."
}

const SERVER_ERROR_MESSAGE = 'Something went wrong. Please try again.'

type Overrides = Partial<Record<number, string>>

// Resolves a user-facing message for an API error, applying in order:
//  1. caller override (per status)
//  2. mask 5xx — never echo server messages
//  3. STATUS_DEFAULTS — replace generic protocol messages with friendlier ones
//  4. server-supplied message (specific 4xx like 409/400/sometimes 403)
//  5. STATUS_FALLBACKS — for codes where server might not supply a message
//  6. caller fallback
export function apiErrorMessage(
  err: unknown,
  fallback: string,
  overrides: Overrides = {}
): string {
  if (!(err instanceof ApiError)) return fallback

  if (err.status in overrides) return overrides[err.status] as string
  if (err.status >= 500) return SERVER_ERROR_MESSAGE
  if (err.status in STATUS_DEFAULTS) return STATUS_DEFAULTS[err.status]
  return err.message || STATUS_FALLBACKS[err.status] || fallback
}

// Toasts the resolved message — for non-form contexts (page fetches, etc.).
export function notifyApiError(
  err: unknown,
  fallback: string,
  overrides: Overrides = {}
): void {
  toast.error(apiErrorMessage(err, fallback, overrides))
}

// Form variant: 422 → react-hook-form field errors; overridden status codes →
// root form error (inline); everything else → toast.
export function applyApiError<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  fallback: string,
  overrides: Overrides = {}
): void {
  if (err instanceof ApiError && err.status === 422 && err.errors) {
    for (const [field, message] of Object.entries(err.errors)) {
      setError(field as Path<T>, { type: 'server', message })
    }
    return
  }
  if (err instanceof ApiError && err.status in overrides) {
    setError('root' as Path<T>, { type: 'server', message: overrides[err.status] as string })
    return
  }
  notifyApiError(err, fallback, overrides)
}
