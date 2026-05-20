import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ROUTES } from '@/constants/app'
import { useAuth } from '@/contexts/auth-context'
import { applyApiError } from '@/lib/api-errors'
import { cn } from '@/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'

const credentialsSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required')
})

const totpSchema = z.object({
  code: z
    .string()
    .length(6, 'Code must be 6 digits')
    .regex(/^\d+$/, 'Digits only')
})

type CredentialsValues = z.infer<typeof credentialsSchema>
type TOTPValues = z.infer<typeof totpSchema>

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const { login, confirmTotp } = useAuth()
  const navigate = useNavigate()

  const [totpToken, setTotpToken] = useState<string | null>(null)

  const credentialsForm = useForm<CredentialsValues>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: '', password: '' }
  })

  const totpForm = useForm<TOTPValues>({
    resolver: zodResolver(totpSchema),
    defaultValues: { code: '' }
  })

  const onCredentialsSubmit = async (values: CredentialsValues) => {
    try {
      const result = await login(values.email, values.password)
      if (result.requiresTOTP) {
        setTotpToken(result.totpToken)
      } else {
        navigate(ROUTES.HOME, { replace: true })
      }
    } catch (err) {
      applyApiError(
        err,
        credentialsForm.setError,
        'Invalid email or password',
        {
          401: 'Invalid email or password',
          429: 'Too many sign-in attempts. Please wait a moment before trying again.'
        }
      )
    }
  }

  const onTOTPSubmit = async (values: TOTPValues) => {
    /* c8 ignore next */
    if (!totpToken) return
    try {
      await confirmTotp(totpToken, values.code)
      navigate(ROUTES.HOME, { replace: true })
    } catch {
      toast.error('Invalid code. Please try again.')
      totpForm.reset()
    }
  }

  if (totpToken) {
    return (
      <div className={cn('flex flex-col gap-6', className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Two-factor authentication</CardTitle>
            <CardDescription>
              Enter the 6-digit code from your authenticator app
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={totpForm.handleSubmit(onTOTPSubmit)}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="code" required>
                    Authentication code
                  </FieldLabel>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    autoFocus
                    data-testid="totp-code-input"
                    {...totpForm.register('code')}
                  />
                  <FieldError errors={[totpForm.formState.errors.code]} />
                </Field>
                <Field>
                  <Button
                    type="submit"
                    disabled={totpForm.formState.isSubmitting}
                    data-testid="totp-submit-button"
                  >
                    {totpForm.formState.isSubmitting ? 'Verifying…' : 'Verify'}
                  </Button>
                  <FieldDescription className="text-center">
                    <button
                      type="button"
                      className="underline underline-offset-4"
                      onClick={() => setTotpToken(null)}
                    >
                      Back to login
                    </button>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Enter your email and password to sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={credentialsForm.handleSubmit(onCredentialsSubmit)}>
            <FieldGroup>
              {credentialsForm.formState.errors.root && (
                <p className="text-destructive rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm">
                  {credentialsForm.formState.errors.root.message}
                </p>
              )}
              <Field>
                <FieldLabel htmlFor="email" required>
                  Email
                </FieldLabel>
                <Input
                  id="email"
                  type="text"
                  autoComplete="email"
                  data-testid="email-input"
                  {...credentialsForm.register('email')}
                />
                <FieldError errors={[credentialsForm.formState.errors.email]} />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password" required>
                    Password
                  </FieldLabel>
                  <Link
                    to={ROUTES.FORGOT_PASSWORD}
                    className="ml-auto text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  data-testid="password-input"
                  {...credentialsForm.register('password')}
                />
                <FieldError
                  errors={[credentialsForm.formState.errors.password]}
                />
              </Field>
              <Field>
                <Button
                  type="submit"
                  disabled={credentialsForm.formState.isSubmitting}
                  data-testid="login-button"
                >
                  {credentialsForm.formState.isSubmitting
                    ? 'Signing in…'
                    : 'Sign in'}
                </Button>
                <FieldDescription className="text-center">
                  Don&apos;t have an account?{' '}
                  <Link to={ROUTES.SIGNUP}>Sign up</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By signing in, you agree to our <a href="#">Terms of Service</a> and{' '}
        <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
