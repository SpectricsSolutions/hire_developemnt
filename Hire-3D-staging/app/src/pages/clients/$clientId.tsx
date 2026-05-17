import {
  createEngagement,
  deleteClient,
  deleteEngagement,
  getClient,
  listEngagements,
  listUsers,
  updateClient
} from '@/client/sdk.gen'
import type { ClientRead, EngagementRead, UserRead } from '@/client/types.gen'
import { AuditPanel } from '@/components/audit-panel'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  DatePickerField,
  FormSection,
  InputField,
  SelectField
} from '@/components/form-helpers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  AuditStatus,
  AuditStatusLabel,
  BusinessStage,
  BusinessStageLabel,
  ClientStatus,
  ClientStatusLabel,
  FeeStatus,
  FeeStatusLabel,
  Product,
  ProductLabel,
  ROUTES,
  Sectors,
  UKRegion,
  UKRegionLabel,
  type AuditStatus as AuditStatusType,
  type FeeStatus as FeeStatusType,
  type Product as ProductType
} from '@/constants/app'
import { useAuth } from '@/contexts/auth-context'
import { unwrap } from '@/lib/api-client'
import { applyApiError, notifyApiError } from '@/lib/api-errors'
import { formatDate } from '@/lib/datetime'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  CalendarDays,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  X
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'

const clientSchema = z.object({
  companyName: z.string().min(1, 'Company name is required').max(255),
  companiesHouseNumber: z.string().max(50).optional().or(z.literal('')),
  primaryContactName: z.string().min(1, 'Contact name is required').max(100),
  primaryContactEmail: z.string().email('Enter a valid email address'),
  primaryContactPhone: z.string().max(30).optional().or(z.literal('')),
  sector: z.string().optional().or(z.literal('')),
  headcountAtEngagement: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(0, 'Must be 0 or more')),
  currentHeadcount: z
    .string()
    .transform(v => (v === '' ? undefined : Number(v)))
    .pipe(z.number().int().min(0, 'Must be 0 or more').optional()),
  businessStage: z.enum(BusinessStage, { error: 'Select a business stage' }),
  region: z.enum(UKRegion, { error: 'Select a region' }),
  assignedOperatorId: z.string().min(1, 'Assign an operator'),
  internalNotes: z.string().optional().or(z.literal('')),
  introducerFeeApplicable: z.enum(['yes', 'no', 'unknown']).default('unknown'),
  status: z.enum(ClientStatus)
})

const engagementSchema = z
  .object({
    product: z.enum(Product, { error: 'Select a product' }),
    engagementDate: z.string().min(1, 'Engagement date is required'),
    feeCharged: z
      .string()
      .transform(Number)
      .pipe(z.number().min(0, 'Must be 0 or more')),
    feeStatus: z.enum(FeeStatus, { error: 'Select a fee status' }),
    auditDate: z.string().optional().or(z.literal('')),
    reportIssuedDate: z.string().optional().or(z.literal('')),
    auditStatus: z.enum(AuditStatus),
    nextReviewDue: z.string().optional().or(z.literal('')),
    engagementLetterSignedAt: z.string().optional().or(z.literal('')),
    invoiceRaisedAt: z.string().optional().or(z.literal(''))
  })
  .superRefine((v, ctx) => {
    // Mirror the API's cross-field date rules so users see inline errors
    // before submitting. The API enforces these too (engagements/types.py).
    if (v.auditDate && v.auditDate < v.engagementDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['auditDate'],
        message: 'Audit date must be on or after the engagement date.'
      })
    }
    if (v.reportIssuedDate) {
      const boundary = v.auditDate || v.engagementDate
      if (boundary && v.reportIssuedDate < boundary) {
        ctx.addIssue({
          code: 'custom',
          path: ['reportIssuedDate'],
          message:
            'Report issued date must be on or after the audit date (or engagement date if no audit date is set).'
        })
      }
    }
    if (v.nextReviewDue && v.nextReviewDue < v.engagementDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['nextReviewDue'],
        message: 'Next review due must be on or after the engagement date.'
      })
    }
  })

type ClientFormInput = z.input<typeof clientSchema>
type ClientFormValues = z.output<typeof clientSchema>
type EngagementFormInput = z.input<typeof engagementSchema>
type EngagementFormValues = z.output<typeof engagementSchema>

const CLIENT_STATUS_CLASS: Record<ClientStatus, string> = {
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  AUDIT_IN_PROGRESS: 'border-blue-200 bg-blue-50 text-blue-700',
  REPORT_ISSUED: 'border-violet-200 bg-violet-50 text-violet-700',
  FOLLOW_UP_DUE: 'border-amber-200 bg-amber-50 text-amber-700',
  INACTIVE: 'border-zinc-200 bg-zinc-100 text-zinc-500'
}

const FEE_STATUS_CLASS: Record<FeeStatusType, string> = {
  INVOICED: 'border-blue-200 bg-blue-50 text-blue-700',
  PAID: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  OVERDUE: 'border-red-200 bg-red-50 text-red-700'
}

const AUDIT_STATUS_CLASS: Record<AuditStatusType, string> = {
  SCHEDULED: 'border-zinc-200 bg-zinc-100 text-zinc-600',
  PHASE_1_COMPLETE: 'border-amber-200 bg-amber-50 text-amber-700',
  PHASE_2_COMPLETE: 'border-blue-200 bg-blue-50 text-blue-700',
  REPORT_ISSUED: 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const { can } = useAuth()
  const navigate = useNavigate()

  const [client, setClient] = useState<ClientRead | null>(null)
  const [engagements, setEngagements] = useState<EngagementRead[]>([])
  const [operators, setOperators] = useState<UserRead[]>([])
  const [loading, setLoading] = useState(true)
  const [engagementDialogOpen, setEngagementDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [deleteClientOpen, setDeleteClientOpen] = useState(false)
  const [engagementToDelete, setEngagementToDelete] =
    useState<EngagementRead | null>(null)

  const canEditClient = can('clients:update')
  const canListUsers = can('users:list')
  const canCreateEngagement = can('engagements:create')
  const canDeleteClient = can('clients:delete')
  const canDeleteEngagement = can('engagements:delete')

  const clientForm = useForm<ClientFormInput, unknown, ClientFormValues>({
    resolver: zodResolver(clientSchema)
  })

  const engagementForm = useForm<
    EngagementFormInput,
    unknown,
    EngagementFormValues
  >({
    resolver: zodResolver(engagementSchema),
    defaultValues: { auditStatus: AuditStatus.SCHEDULED }
  })

  const buildFormValues = (c: ClientRead): ClientFormInput => ({
    companyName: c.companyName,
    companiesHouseNumber: c.companiesHouseNumber ?? '',
    primaryContactName: c.primaryContactName,
    primaryContactEmail: c.primaryContactEmail,
    primaryContactPhone: c.primaryContactPhone ?? '',
    sector: c.sector ?? '',
    headcountAtEngagement: String(c.headcountAtEngagement),
    currentHeadcount:
      c.currentHeadcount != null ? String(c.currentHeadcount) : '',
    businessStage:
      c.businessStage as (typeof BusinessStage)[keyof typeof BusinessStage],
    region: c.region as (typeof UKRegion)[keyof typeof UKRegion],
    assignedOperatorId: c.assignedOperatorId ?? '',
    internalNotes: c.internalNotes ?? '',
    introducerFeeApplicable:
      c.introducerFeeApplicable === true
        ? 'yes'
        : c.introducerFeeApplicable === false
          ? 'no'
          : 'unknown',
    status: c.status as (typeof ClientStatus)[keyof typeof ClientStatus]
  })

  useEffect(() => {
    if (!clientId) return

    const requests: Promise<unknown>[] = [
      getClient({ path: { client_id: clientId } }),
      listEngagements({ path: { client_id: clientId } })
    ]
    if (canListUsers) requests.push(listUsers())

    Promise.all(requests)
      .then(([clientRes, engagementsRes, usersRes]) => {
        const { data: c } = unwrap<{ data: ClientRead }>(clientRes as never)
        const { data: e } = unwrap<{ data: EngagementRead[] }>(
          engagementsRes as never
        )
        setClient(c)
        setEngagements(e)
        setNotes(c.internalNotes ?? '')

        if (canListUsers && usersRes) {
          const { data: users } = unwrap<{ data: UserRead[] }>(
            usersRes as never
          )
          setOperators(users.filter(u => u.role === 'OPERATOR'))
        }

        clientForm.reset(buildFormValues(c))
      })
      .catch(err => notifyApiError(err, 'Failed to load client'))
      .finally(() => setLoading(false))
  }, [clientId, canListUsers, clientForm])

  if (!can('clients:read')) return <Navigate to={ROUTES.HOME} replace />

  const handleClientSave = async (values: ClientFormValues) => {
    if (!clientId) return
    try {
      const res = await updateClient({
        path: { client_id: clientId },
        body: {
          companyName: values.companyName,
          companiesHouseNumber: values.companiesHouseNumber || null,
          primaryContactName: values.primaryContactName,
          primaryContactEmail: values.primaryContactEmail,
          primaryContactPhone: values.primaryContactPhone || null,
          sector: values.sector || null,
          headcountAtEngagement: values.headcountAtEngagement,
          currentHeadcount: values.currentHeadcount ?? null,
          businessStage: values.businessStage,
          region: values.region,
          assignedOperatorId: values.assignedOperatorId,
          internalNotes: client?.internalNotes ?? null,
          introducerFeeApplicable:
            values.introducerFeeApplicable === 'yes'
              ? true
              : values.introducerFeeApplicable === 'no'
                ? false
                : null,
          status: values.status
        }
      })
      const { data } = unwrap<{ data: ClientRead }>(res)
      setClient(data)
      clientForm.reset(buildFormValues(data))
      setIsEditing(false)
      toast.success('Client updated')
    } catch (err) {
      applyApiError(err, clientForm.setError, 'Failed to update client')
    }
  }

  const handleCancel = () => {
    if (client) clientForm.reset(buildFormValues(client))
    setIsEditing(false)
  }

  const handleSaveNotes = async () => {
    if (!clientId || !client) return
    setNotesSaving(true)
    try {
      const res = await updateClient({
        path: { client_id: clientId },
        body: {
          companyName: client.companyName,
          companiesHouseNumber: client.companiesHouseNumber ?? null,
          primaryContactName: client.primaryContactName,
          primaryContactEmail: client.primaryContactEmail,
          primaryContactPhone: client.primaryContactPhone ?? null,
          sector: client.sector ?? null,
          headcountAtEngagement: client.headcountAtEngagement,
          currentHeadcount: client.currentHeadcount ?? null,
          businessStage: client.businessStage,
          region: client.region,
          assignedOperatorId: client.assignedOperatorId ?? '',
          internalNotes: notes || null,
          introducerFeeApplicable: client.introducerFeeApplicable ?? null,
          status: client.status
        }
      })
      const { data } = unwrap<{ data: ClientRead }>(res)
      setClient(data)
      clientForm.setValue('internalNotes', data.internalNotes ?? '')
      toast.success('Notes saved')
    } catch (err) {
      notifyApiError(err, 'Failed to save notes')
    } finally {
      setNotesSaving(false)
    }
  }

  const handleAddEngagement = async (values: EngagementFormValues) => {
    if (!clientId) return
    try {
      const res = await createEngagement({
        path: { client_id: clientId },
        body: {
          product: values.product,
          engagementDate: values.engagementDate,
          feeCharged: values.feeCharged,
          feeStatus: values.feeStatus,
          auditDate: values.auditDate || null,
          reportIssuedDate: values.reportIssuedDate || null,
          auditStatus: values.auditStatus,
          nextReviewDue: values.nextReviewDue || null,
          engagementLetterSignedAt: values.engagementLetterSignedAt || null,
          invoiceRaisedAt: values.invoiceRaisedAt || null
        }
      })
      const { data } = unwrap<{ data: EngagementRead }>(res)
      setEngagements(prev => [data, ...prev])
      setEngagementDialogOpen(false)
      engagementForm.reset({ auditStatus: AuditStatus.SCHEDULED })
      toast.success('Engagement added')
    } catch (err) {
      applyApiError(err, engagementForm.setError, 'Failed to add engagement')
    }
  }

  const handleDeleteClient = async () => {
    if (!clientId) return
    try {
      await deleteClient({ path: { client_id: clientId } })
      toast.success('Client deleted')
      navigate(ROUTES.CLIENTS)
    } catch (err) {
      notifyApiError(err, 'Failed to delete client')
    }
  }

  const handleDeleteEngagement = async (engagementId: string) => {
    if (!clientId) return
    try {
      await deleteEngagement({
        path: { client_id: clientId, engagement_id: engagementId }
      })
      setEngagements(prev => prev.filter(e => e.id !== engagementId))
      toast.success('Engagement deleted')
    } catch (err) {
      notifyApiError(err, 'Failed to delete engagement')
    }
  }

  const assignedOperator = operators.find(
    op => op.id === client?.assignedOperatorId
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  if (!client)
    return <p className="text-muted-foreground text-sm">Client not found.</p>

  return (
    <div className="flex flex-col gap-6">
      <Link
        to={ROUTES.CLIENTS}
        className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Clients
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-muted flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold">
            {initials(client.companyName)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {client.companyName}
              </h1>
              <Badge
                variant="outline"
                className={CLIENT_STATUS_CLASS[client.status as ClientStatus]}
              >
                {ClientStatusLabel[client.status as ClientStatus]}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {client.primaryContactName} · {client.primaryContactEmail}
            </p>
          </div>
        </div>

        {canEditClient && !isEditing && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
            {canDeleteClient && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteClientOpen(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
            )}
          </div>
        )}
        {canEditClient && isEditing && (
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Cancel
          </Button>
        )}
      </div>

      {deleteClientOpen && (
        <ConfirmDialog
          open
          onOpenChange={setDeleteClientOpen}
          title={`Delete ${client.companyName}?`}
          description="This permanently removes the client. Engagements must be deleted first."
          confirmLabel="Delete"
          destructive
          onConfirm={handleDeleteClient}
        />
      )}

      {engagementToDelete && (
        <ConfirmDialog
          open
          onOpenChange={open => !open && setEngagementToDelete(null)}
          title="Delete this engagement?"
          description="This permanently removes the engagement record."
          confirmLabel="Delete"
          destructive
          onConfirm={async () => {
            await handleDeleteEngagement(engagementToDelete.id as string)
            setEngagementToDelete(null)
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Stage"
          value={BusinessStageLabel[client.businessStage as BusinessStage]}
        />
        <StatCard
          label="Region"
          value={UKRegionLabel[client.region as keyof typeof UKRegionLabel]}
        />
        <StatCard
          label="Current Headcount"
          value={
            client.currentHeadcount != null
              ? String(client.currentHeadcount)
              : String(client.headcountAtEngagement)
          }
        />
        <StatCard label="Engagements" value={String(engagements.length)} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagements">
            Engagements
            {engagements.length > 0 && (
              <span className="bg-background ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium">
                {engagements.length}
              </span>
            )}
          </TabsTrigger>
          {canEditClient && <TabsTrigger value="notes">Notes</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {canEditClient && isEditing ? (
            <form
              onSubmit={clientForm.handleSubmit(handleClientSave)}
              noValidate
              className="flex flex-col gap-8"
            >
              <FormSection title="Company">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InputField
                    name="companyName"
                    control={clientForm.control}
                    label="Company Name"
                    required
                  />
                  <InputField
                    name="companiesHouseNumber"
                    control={clientForm.control}
                    label="Companies House No."
                  />
                </div>
              </FormSection>

              <FormSection title="Primary Contact">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InputField
                    name="primaryContactName"
                    control={clientForm.control}
                    label="Name"
                    required
                  />
                  <InputField
                    name="primaryContactEmail"
                    control={clientForm.control}
                    label="Email"
                    required
                    type="email"
                  />
                  <InputField
                    name="primaryContactPhone"
                    control={clientForm.control}
                    label="Phone"
                    type="tel"
                  />
                </div>
              </FormSection>

              <FormSection title="Business Details">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <SelectField
                    name="businessStage"
                    control={clientForm.control}
                    label="Business Stage"
                    required
                    options={Object.values(BusinessStage).map(s => ({
                      value: s,
                      label: BusinessStageLabel[s]
                    }))}
                  />
                  <SelectField
                    name="region"
                    control={clientForm.control}
                    label="Region"
                    required
                    options={Object.values(UKRegion).map(r => ({
                      value: r,
                      label: UKRegionLabel[r]
                    }))}
                  />
                  <SelectField
                    name="sector"
                    control={clientForm.control}
                    label="Sector"
                    placeholder="Select sector"
                    options={Sectors.map(s => ({ value: s, label: s }))}
                  />
                  <InputField
                    name="headcountAtEngagement"
                    control={clientForm.control}
                    label="Headcount at Engagement"
                    required
                    type="number"
                    min={0}
                  />
                  <InputField
                    name="currentHeadcount"
                    control={clientForm.control}
                    label="Current Headcount"
                    type="number"
                    min={0}
                  />
                  <SelectField
                    name="introducerFeeApplicable"
                    control={clientForm.control}
                    label="Introducer Fee Applicable"
                    options={[
                      { value: 'unknown', label: 'Not specified' },
                      { value: 'yes', label: 'Yes' },
                      { value: 'no', label: 'No' }
                    ]}
                  />
                </div>
              </FormSection>

              <FormSection title="Assignment & Status">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <SelectField
                    name="assignedOperatorId"
                    control={clientForm.control}
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
                    control={clientForm.control}
                    label="Status"
                    required
                    options={Object.values(ClientStatus).map(s => ({
                      value: s,
                      label: ClientStatusLabel[s]
                    }))}
                  />
                </div>
              </FormSection>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={clientForm.formState.isSubmitting}
                >
                  {clientForm.formState.isSubmitting
                    ? 'Saving…'
                    : 'Save Changes'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <section>
                <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                  Contact
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <ReadField label="Name" value={client.primaryContactName} />
                  <ReadField label="Email" value={client.primaryContactEmail} />
                  <ReadField label="Phone" value={client.primaryContactPhone} />
                </div>
              </section>

              <Separator />

              <section>
                <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                  Business
                </h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <ReadField
                    label="Stage"
                    value={
                      BusinessStageLabel[client.businessStage as BusinessStage]
                    }
                  />
                  <ReadField
                    label="Region"
                    value={
                      UKRegionLabel[client.region as keyof typeof UKRegionLabel]
                    }
                  />
                  <ReadField label="Sector" value={client.sector} />
                  <ReadField
                    label="Companies House No."
                    value={client.companiesHouseNumber}
                  />
                  <ReadField
                    label="Introducer Fee Applicable"
                    value={
                      client.introducerFeeApplicable === true
                        ? 'Yes'
                        : client.introducerFeeApplicable === false
                          ? 'No'
                          : undefined
                    }
                  />
                </div>
              </section>

              <Separator />

              <section>
                <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                  Headcount
                </h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <ReadField
                    label="At Engagement"
                    value={String(client.headcountAtEngagement)}
                  />
                  <ReadField
                    label="Current"
                    value={
                      client.currentHeadcount != null
                        ? String(client.currentHeadcount)
                        : undefined
                    }
                  />
                </div>
              </section>

              {canListUsers && assignedOperator && (
                <>
                  <Separator />
                  <section>
                    <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                      Assignment
                    </h3>
                    <ReadField
                      label="Operator"
                      value={`${assignedOperator.name} · ${assignedOperator.email}`}
                    />
                  </section>
                </>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="engagements" className="mt-4">
          <div className="flex flex-col gap-4">
            {canCreateEngagement && (
              <div className="flex justify-end">
                <Dialog
                  open={engagementDialogOpen}
                  onOpenChange={setEngagementDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-1.5 h-4 w-4" />
                      Add Engagement
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Add Engagement</DialogTitle>
                      <p className="text-muted-foreground text-sm">
                        Record a new engagement for {client.companyName}.
                      </p>
                    </DialogHeader>
                    <form
                      id="engagement-form"
                      onSubmit={engagementForm.handleSubmit(
                        handleAddEngagement
                      )}
                      noValidate
                      className="flex flex-col gap-4"
                    >
                      <SelectField
                        name="product"
                        control={engagementForm.control}
                        label="Product"
                        required
                        placeholder="Select product"
                        options={Object.values(Product).map(p => ({
                          value: p,
                          label: ProductLabel[p]
                        }))}
                      />
                      <DatePickerField
                        name="engagementDate"
                        control={engagementForm.control}
                        label="Engagement Date"
                        required
                        placeholder="Pick engagement date"
                      />
                      <div className="bg-muted/40 rounded-xl border p-4">
                        <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                          Financial
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <InputField
                            name="feeCharged"
                            control={engagementForm.control}
                            label="Fee Charged (£)"
                            required
                            type="number"
                            min={0}
                            step="0.01"
                          />
                          <SelectField
                            name="feeStatus"
                            control={engagementForm.control}
                            label="Fee Status"
                            required
                            placeholder="Select status"
                            options={Object.values(FeeStatus).map(s => ({
                              value: s,
                              label: FeeStatusLabel[s]
                            }))}
                          />
                        </div>
                      </div>
                      <div className="bg-muted/40 rounded-xl border p-4">
                        <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                          Audit & Review
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <SelectField
                            name="auditStatus"
                            control={engagementForm.control}
                            label="Audit Status"
                            required
                            options={Object.values(AuditStatus).map(s => ({
                              value: s,
                              label: AuditStatusLabel[s]
                            }))}
                          />
                          <DatePickerField
                            name="nextReviewDue"
                            control={engagementForm.control}
                            label="Next Review Due"
                            placeholder="Pick review date"
                          />
                          <DatePickerField
                            name="engagementLetterSignedAt"
                            control={engagementForm.control}
                            label="Engagement Letter Signed"
                            placeholder="Pick date signed"
                          />
                          <DatePickerField
                            name="invoiceRaisedAt"
                            control={engagementForm.control}
                            label="Invoice Raised"
                            placeholder="Pick date raised"
                          />
                        </div>
                      </div>
                    </form>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="outline">
                          Cancel
                        </Button>
                      </DialogClose>
                      <Button
                        form="engagement-form"
                        type="submit"
                        disabled={engagementForm.formState.isSubmitting}
                      >
                        {engagementForm.formState.isSubmitting
                          ? 'Adding…'
                          : 'Add Engagement'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {engagements.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
                  <CalendarDays className="text-muted-foreground h-6 w-6" />
                </div>
                <p className="font-medium">No engagements yet</p>
                {canCreateEngagement && (
                  <p className="text-muted-foreground text-sm">
                    Add the first engagement above
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {engagements.map(e => (
                  <EngagementCard
                    key={e.id as string}
                    engagement={e}
                    canViewAudit={can('assessments:read')}
                    onDelete={
                      canDeleteEngagement
                        ? () => setEngagementToDelete(e)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {canEditClient && (
          <TabsContent value="notes" className="mt-4">
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">
                Internal notes — never shown in client output.
              </p>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add internal notes about this client…"
                className="min-h-40 resize-none"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={notesSaving}
                >
                  {notesSaving ? 'Saving…' : 'Save Notes'}
                </Button>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-xl border p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  )
}

function ReadField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className="text-sm">{value ?? '—'}</p>
    </div>
  )
}

function EngagementCard({
  engagement: e,
  canViewAudit,
  onDelete
}: {
  engagement: EngagementRead
  canViewAudit: boolean
  onDelete?: () => void
}) {
  const [auditOpen, setAuditOpen] = useState(false)

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {ProductLabel[e.product as ProductType]}
          </p>
          <p className="text-muted-foreground text-xs">
            {formatDate(e.engagementDate as string)}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <p className="text-lg font-bold">
            £{Number(e.feeCharged).toLocaleString()}
          </p>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive h-7 w-7"
              onClick={onDelete}
              aria-label="Delete engagement"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={FEE_STATUS_CLASS[e.feeStatus as FeeStatusType]}
        >
          {FeeStatusLabel[e.feeStatus as FeeStatusType]}
        </Badge>
        <Badge
          variant="outline"
          className={AUDIT_STATUS_CLASS[e.auditStatus as AuditStatusType]}
        >
          {AuditStatusLabel[e.auditStatus as AuditStatusType]}
        </Badge>
        {e.nextReviewDue != null && (
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <CalendarDays className="h-3 w-3" />
            Review {formatDate(e.nextReviewDue as string)}
          </span>
        )}
      </div>
      {canViewAudit && (
        <>
          <div className="mt-3 flex justify-end gap-2">
            {/* T3.04 — Resume Phase 1 button */}
            {e.auditStatus === AuditStatus.SCHEDULED && (
              <Button variant="default" size="sm" asChild>
                <Link to={ROUTES.PHASE1_WORKSPACE(e.id as string)}>
                  Resume Phase 1
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAuditOpen(true)}
            >
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              Audit &amp; Gates
            </Button>
          </div>
          <AuditPanel
            open={auditOpen}
            onOpenChange={setAuditOpen}
            engagementId={e.id as string}
            productLabel={ProductLabel[e.product as ProductType]}
          />
        </>
      )}
    </div>
  )
}
