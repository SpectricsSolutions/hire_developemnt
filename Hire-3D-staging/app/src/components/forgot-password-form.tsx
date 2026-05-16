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
  FieldGroup,
  FieldLabel
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ROUTES } from '@/constants/app'
import { cn } from '@/lib/utils'
import { Link } from 'react-router'

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Reset your password</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  data-testid="forgot-password-email-input"
                  required
                />
              </Field>
              <Field>
                <Button type="submit" data-testid="forgot-password-button">
                  Send reset link
                </Button>
                <FieldDescription className="text-center">
                  Remembered your password?{' '}
                  <Link to={ROUTES.LOGIN}>Back to login</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        Already have a reset link?{' '}
        <Link to={ROUTES.RESET_PASSWORD}>Reset password</Link>.
      </FieldDescription>
      <FieldDescription className="px-6 text-center">
        Need a new account instead?{' '}
        <Link to={ROUTES.SIGNUP}>Create one here</Link>.
      </FieldDescription>
    </div>
  )
}
