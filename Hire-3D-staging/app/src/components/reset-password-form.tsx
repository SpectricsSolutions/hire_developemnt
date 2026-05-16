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

export function ResetPasswordForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create a new password</CardTitle>
          <CardDescription>
            Enter and confirm your new password to finish resetting your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="password">New password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  data-testid="reset-password-input"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirmPassword">
                  Confirm password
                </FieldLabel>
                <Input
                  id="confirmPassword"
                  type="password"
                  data-testid="reset-password-confirm-input"
                  required
                />
              </Field>
              <Field>
                <Button type="submit" data-testid="reset-password-button">
                  Update password
                </Button>
                <FieldDescription className="text-center">
                  Return to <Link to={ROUTES.LOGIN}>login</Link>.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        Didn&apos;t get an email?{' '}
        <Link to={ROUTES.FORGOT_PASSWORD}>Request another reset link</Link>.
      </FieldDescription>
    </div>
  )
}
