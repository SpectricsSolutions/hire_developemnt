import {
  login as loginApi,
  logout as logoutApi,
  refresh as refreshApi,
  totpConfirm as totpConfirmApi
} from '@/client/sdk.gen'
import type { TotpChallengeResponse } from '@/client/types.gen'
import {
  type JwtUser,
  decodeJwt,
  setAccessToken,
  unwrap
} from '@/lib/api-client'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'

type TokenResponse = { accessToken: string }

type AuthContextValue = {
  isAuthenticated: boolean
  isLoading: boolean
  user: JwtUser | null
  can: (permission: string) => boolean
  login: (
    email: string,
    password: string
  ) => Promise<
    { requiresTOTP: true; totpToken: string } | { requiresTOTP: false }
  >
  confirmTotp: (totpToken: string, code: string) => Promise<void>
  logout: () => Promise<void>
}

function useSession() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<JwtUser | null>(null)

  const store = useCallback((accessToken: string) => {
    setAccessToken(accessToken)
    setUser(decodeJwt(accessToken))
    setIsAuthenticated(true)
  }, [])

  const clear = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    setIsAuthenticated(false)
  }, [])

  return { isAuthenticated, isLoading, setIsLoading, user, store, clear }
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, setIsLoading, user, store, clear } =
    useSession()

  useEffect(() => {
    refreshApi()
      .then(response => {
        const data = response.data
        if (data && 'data' in data && data.data.accessToken) {
          store(data.data.accessToken)
        } else {
          clear()
        }
      })
      .catch(() => clear())
      .finally(() => setIsLoading(false))
  }, [setIsLoading, store, clear])

  const login = useCallback(
    async (email: string, password: string) => {
      const { data: payload } = unwrap<{
        data: TotpChallengeResponse | TokenResponse
      }>(await loginApi({ body: { email, password } }))

      if ((payload as TotpChallengeResponse).requires2Fa) {
        return {
          requiresTOTP: true as const,
          totpToken: (payload as TotpChallengeResponse).totpToken
        }
      }

      store((payload as TokenResponse).accessToken)
      return { requiresTOTP: false as const }
    },
    [store]
  )

  const confirmTotp = useCallback(
    async (totpToken: string, code: string) => {
      const { data: tokens } = unwrap<{ data: TokenResponse }>(
        await totpConfirmApi({ body: { totpToken, code } })
      )
      store(tokens.accessToken)
    },
    [store]
  )

  const logout = useCallback(async () => {
    await logoutApi().catch(() => {})
    clear()
  }, [clear])

  const can = useCallback(
    (permission: string) => user?.permissions?.includes(permission) ?? false,
    [user]
  )

  return (
    <AuthContext
      value={{
        isAuthenticated,
        isLoading,
        user,
        can,
        login,
        confirmTotp,
        logout
      }}
    >
      {children}
    </AuthContext>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  /* c8 ignore next */
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
