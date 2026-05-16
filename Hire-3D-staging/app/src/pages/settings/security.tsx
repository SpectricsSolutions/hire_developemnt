import { totpDisable, totpSetup, totpVerify } from '@/client/sdk.gen'
import type { TotpSetupResponse } from '@/client/types.gen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import { unwrap } from '@/lib/api-client'
import { apiErrorMessage, notifyApiError } from '@/lib/api-errors'
import { useState } from 'react'
import QRCode from 'react-qr-code'
import { toast } from 'sonner'

type Step = 'idle' | 'setup' | 'enabled'

function extractSecret(qrUri: string): string {
  try {
    return new URL(qrUri).searchParams.get('secret') ?? ''
  } catch {
    return ''
  }
}

export default function SecuritySettingsPage() {
  const { user, can } = useAuth()
  const [step, setStep] = useState<Step>(
    user?.totp_enabled ? 'enabled' : 'idle'
  )
  const [setup, setSetup] = useState<TotpSetupResponse | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSetup = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await totpSetup()
      const { data } = unwrap<{ data: TotpSetupResponse }>(res)
      setSetup(data)
      setStep('setup')
    } catch (err) {
      notifyApiError(err, 'Failed to start TOTP setup')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app')
      return
    }
    setLoading(true)
    setError(null)
    try {
      unwrap(await totpVerify({ body: { code } }))
      setStep('enabled')
      toast.success('Two-factor authentication enabled')
    } catch (err) {
      setError(apiErrorMessage(err, 'Invalid code. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const handleDisable = async () => {
    setLoading(true)
    try {
      await totpDisable()
      setStep('idle')
      toast.success('Two-factor authentication disabled')
    } catch (err) {
      notifyApiError(err, 'Failed to disable two-factor authentication')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'enabled') {
    return (
      <div className="max-w-md space-y-4">
        <h1 className="text-xl font-semibold">Security</h1>
        <div className="space-y-3 rounded-lg border p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Two-factor authentication</p>
            <p className="text-muted-foreground text-sm">
              Authenticator app is active. Your account is protected.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDisable}
            disabled={loading}
          >
            {loading ? 'Disabling…' : 'Disable 2FA'}
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'setup' && setup) {
    const secret = extractSecret(setup.qrUri)
    return (
      <div className="max-w-md space-y-6">
        <h1 className="text-xl font-semibold">
          Set up two-factor authentication
        </h1>

        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Scan the QR code with your authenticator app (Google Authenticator,
            Microsoft Authenticator, etc.), then enter the 6-digit code to
            confirm.
          </p>
          <div className="flex justify-center rounded-lg border bg-white p-4">
            <QRCode value={setup.qrUri} size={180} />
          </div>
          {secret && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">
                Can't scan? Enter this key manually:
              </p>
              <code className="bg-muted block rounded px-3 py-2 font-mono text-xs break-all select-all">
                {secret}
              </code>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="code">Verification code</Label>
            <Input
              id="code"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={e => {
                setCode(e.target.value.replace(/\D/g, ''))
                setError(null)
              }}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
            />
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleVerify} disabled={loading}>
              {loading ? 'Verifying…' : 'Enable 2FA'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setStep('idle')
                setSetup(null)
                setCode('')
                setError(null)
              }}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-xl font-semibold">Security</h1>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Two-factor authentication</p>
          <p className="text-muted-foreground text-sm">
            Add an extra layer of security to your account using an
            authenticator app.
          </p>
        </div>
        <Button onClick={handleSetup} disabled={loading} size="sm">
          {loading ? 'Loading…' : 'Set up authenticator app'}
        </Button>
      </div>

      {can('roles:manage') && (
        <p className="text-muted-foreground text-xs">
          As an admin, 2FA may be required for your role.
        </p>
      )}
    </div>
  )
}
