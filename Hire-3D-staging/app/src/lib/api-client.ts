import { client } from '@/client/client.gen'

client.setConfig({
  baseURL: import.meta.env.DEV ? 'http://localhost:8000' : '',
  withCredentials: true
})

export type JwtUser = {
  sub: string
  email: string
  name: string
  role: string | null
  permissions: string[]
  totp_enabled: boolean
}

export class ApiError extends Error {
  readonly status: number
  readonly errors: Record<string, string> | undefined

  constructor(
    status: number,
    message: string,
    errors?: Record<string, string>
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

// Unwraps an SDK response, throwing ApiError on non-2xx.
// The SDK returns the AxiosError object on failure (not a thrown exception),
// which has `.response.status` and `.response.data`.
export function unwrap<T>(response: object): T {
  const r = response as {
    data?: T
    response?: {
      status: number
      data?: { message?: string; errors?: Record<string, string> }
    }
  }

  if (r.data != null) return r.data

  throw new ApiError(
    r.response?.status ?? 0,
    r.response?.data?.message ?? 'Request failed',
    r.response?.data?.errors
  )
}

let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token

  client.setConfig({
    auth: token ?? undefined
  })
}

/* c8 ignore start */
export function getAccessToken(): string | null {
  return accessToken
}
/* c8 ignore stop */

export function decodeJwt(token: string): JwtUser | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload)) as JwtUser
  } catch {
    return null
  }
}
