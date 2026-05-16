import { createClient, listUsers } from '@/client/sdk.gen'
import type { UserRead } from '@/client/types.gen'
import {
  InputField,
  SelectField,
  TextareaField
} from '@/components/form-helpers'
import { Button } from '@/components/ui/button'
import {
  BusinessStage,
  BusinessStageLabel,
  ClientStatus,
  ClientStatusLabel,
  Sectors,
  UKRegion,
  UKRegionLabel
} from '@/constants/app'
import { unwrap } from '@/lib/api-client'
import { applyApiError, notifyApiError } from '@/lib/api-errors'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { type SubmitHandler, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

const schema = z.object({
  companyName: z.string().min(1, 'Company name is required').max(255),
  companiesHouseNumber: z.string().max(50).optional().or(z.literal('')),
  primaryContactName: z.string().min(1, 'Contact name is required').max(100),
  primaryContactEmail: z.string().email('Enter a valid email address'),
  primaryContactPhone: z.string().max(30).optional().or(z.literal('')),
  sector: z.string().optional().or(z.literal('')),
  headcountAtEngagement: z.coerce
    .number({ error: 'Must be a number' })
    .int()
    .min(0, 'Must be 0 or more'),
  currentHeadcount: z.coerce
    .number()
    .int()
    .min(0, 'Must be 0 or more')
    .optional()
    .or(z.literal('')),
  businessStage: z.enum(BusinessStage, { error: 'Select a business stage' }),
  region: z.enum(UKRegion, { error: 'Select a region' }),
  assignedOperatorId: z.string().min(1, 'Assign an operator'),
  internalNotes: z.string().optional().or(z.literal('')),
  introducerFeeApplicable: z.enum(['yes', 'no', 'unknown']).default('unknown'),
  status: z.enum(ClientStatus)
})

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

type ClientFormProps = {
  onSuccess: (clientId: string) => void
  onCancel: () => void
  submitLabel?: string
  submittingLabel?: string
}

export function ClientForm({
  onSuccess,
  onCancel,
  submitLabel = 'Create Client',
  submittingLabel = 'Creating…'
}: ClientFormProps) {
  const [operators, setOperators] = useState<UserRead[]>([])

  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting }
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: ClientStatus.ACTIVE,
      headcountAtEngagement: 0,
      introducerFeeApplicable: 'unknown'
    }
  })

  useEffect(() => {
    listUsers()
      .then(res => {
        const { data } = unwrap<{ data: UserRead[] }>(res)
        setOperators(data.filter(u => u.role === 'OPERATOR'))
      })
      .catch(err => notifyApiError(err, 'Failed to load operators'))
  }, [])

  const onSubmit: SubmitHandler<FormValues> = async values => {
    try {
      const res = await createClient({
        body: {
          companyName: values.companyName,
          companiesHouseNumber: values.companiesHouseNumber || null,
          primaryContactName: values.primaryContactName,
          primaryContactEmail: values.primaryContactEmail,
          primaryContactPhone: values.primaryContactPhone || null,
          sector: values.sector || null,
          headcountAtEngagement: values.headcountAtEngagement as number,
          currentHeadcount:
            values.currentHeadcount !== '' && values.currentHeadcount != null
              ? (values.currentHeadcount as number)
              : null,
          businessStage: values.businessStage,
          region: values.region,
          assignedOperatorId: values.assignedOperatorId,
          internalNotes: values.internalNotes || null,
          introducerFeeApplicable:
            values.introducerFeeApplicable === 'yes'
              ? true
              : values.introducerFeeApplicable === 'no'
                ? false
                : null,
          status: values.status
        }
      })
      const { data } = unwrap<{ data: { id: string } }>(res)
      toast.success('Client created')
      onSuccess(data.id)
    } catch (err) {
      applyApiError(err, setError, 'Failed to create client')
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4"
    >
      <Section title="Company">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <InputField
            name="companyName"
            control={control}
            label="Company Name"
            required
          />
          <InputField
            name="companiesHouseNumber"
            control={control}
            label="Companies House No."
          />
        </div>
      </Section>

      <Section title="Primary Contact">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <InputField
            name="primaryContactName"
            control={control}
            label="Name"
            required
          />
          <InputField
            name="primaryContactEmail"
            control={control}
            label="Email"
            required
            type="email"
          />
          <InputField
            name="primaryContactPhone"
            control={control}
            label="Phone"
            type="tel"
            placeholder="+44 7700 900123"
            hint="Include country code, e.g. +44 for UK"
          />
        </div>
      </Section>

      <Section title="Business Details">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <SelectField
            name="businessStage"
            control={control}
            label="Business Stage"
            required
            placeholder="Select stage"
            options={Object.values(BusinessStage).map(s => ({
              value: s,
              label: BusinessStageLabel[s]
            }))}
          />
          <SelectField
            name="region"
            control={control}
            label="Region"
            required
            placeholder="Select region"
            options={Object.values(UKRegion).map(r => ({
              value: r,
              label: UKRegionLabel[r]
            }))}
          />
          <SelectField
            name="sector"
            control={control}
            label="Sector"
            placeholder="Select sector"
            options={Sectors.map(s => ({ value: s, label: s }))}
          />
          <InputField
            name="headcountAtEngagement"
            control={control}
            label="Headcount at Engagement"
            required
            type="number"
            min={0}
          />
          <InputField
            name="currentHeadcount"
            control={control}
            label="Current Headcount"
            type="number"
            min={0}
          />
          <SelectField
            name="introducerFeeApplicable"
            control={control}
            label="Introducer Fee Applicable"
            options={[
              { value: 'unknown', label: 'Not specified' },
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' }
            ]}
          />
        </div>
      </Section>

      <Section title="Assignment & Status">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <SelectField
            name="assignedOperatorId"
            control={control}
            label="Assigned Operator"
            required
            placeholder="Select operator"
            options={operators.map(op => ({
              value: op.id,
              label: `${op.name} — ${op.email}`
            }))}
          />
          <SelectField
            name="status"
            control={control}
            label="Status"
            required
            options={Object.values(ClientStatus).map(s => ({
              value: s,
              label: ClientStatusLabel[s]
            }))}
          />
        </div>
      </Section>

      <Section
        title="Internal Notes"
        description="Admin-only. Never shown in client output."
      >
        <TextareaField name="internalNotes" control={control} label="Notes" />
      </Section>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
      </div>
    </form>
  )
}

function Section({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-muted/40 rounded-xl border p-6">
      <div className="mb-4">
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          {title}
        </p>
        {description && (
          <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}
