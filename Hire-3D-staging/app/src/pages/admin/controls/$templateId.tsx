import {
  getControlTemplate,
  updateControlTemplate,
  upsertCalibrationAnchor
} from '@/client/sdk.gen'
import type {
  CalibrationAnchorCreate,
  ControlTemplateRead,
  ControlTemplateUpdate
} from '@/client/types.gen'
import {
  FormSection,
  InputField,
  TextareaField
} from '@/components/form-helpers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  DomainLabel,
  Product,
  ProductLabel,
  RAGLevelLabel,
  ROUTES,
  ragLevelsForProduct,
  type Domain,
  type RAGLevel
} from '@/constants/app'
import { useAuth } from '@/contexts/auth-context'
import { unwrap } from '@/lib/api-client'
import { applyApiError, notifyApiError } from '@/lib/api-errors'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, Navigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'

const templateSchema = z.object({
  code: z.string().min(1).max(10),
  title: z.string().min(1).max(255),
  whatTesting: z.string().min(1, 'What you are testing is required'),
  whyMatters: z.string().min(1, 'Why this matters is required'),
  primaryQuestion: z.string().min(1, 'Primary question is required'),
  evidencePromptsText: z.string(),
  lookingForText: z.string(),
  samplingText: z.string(),
  ifPartialText: z.string(),
  sortOrder: z
    .string()
    .transform(v => Number(v))
    .pipe(z.number().int()),
  isActive: z.boolean()
})

type TemplateFormInput = z.input<typeof templateSchema>
type TemplateFormValues = z.output<typeof templateSchema>

const RAG_BAND_CLASS: Record<RAGLevel, string> = {
  RED: 'border-red-200 bg-red-50 text-red-700',
  AMBER_RED: 'border-orange-200 bg-orange-50 text-orange-700',
  AMBER: 'border-amber-200 bg-amber-50 text-amber-800',
  GREEN_AMBER: 'border-lime-200 bg-lime-50 text-lime-700',
  GREEN: 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function linesToList(text: string): string[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
}

function listToLines(items: string[]): string {
  return items.join('\n')
}

function buildFormValues(t: ControlTemplateRead): TemplateFormInput {
  return {
    code: t.code,
    title: t.title,
    whatTesting: t.whatTesting,
    whyMatters: t.whyMatters,
    primaryQuestion: t.primaryQuestion,
    evidencePromptsText: listToLines(t.evidencePrompts),
    lookingForText: listToLines(t.lookingFor),
    samplingText: t.sampling ?? '',
    ifPartialText: listToLines(t.ifPartial),
    sortOrder: String(t.sortOrder),
    isActive: t.isActive
  }
}

export default function ControlTemplateDetailPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const { can } = useAuth()
  const [template, setTemplate] = useState<ControlTemplateRead | null>(null)
  const [loading, setLoading] = useState(true)

  const canEdit = can('controls:manage')

  const form = useForm<TemplateFormInput, unknown, TemplateFormValues>({
    resolver: zodResolver(templateSchema)
  })
  const isActive = useWatch({ control: form.control, name: 'isActive' })

  useEffect(() => {
    if (!templateId) return
    getControlTemplate({ path: { template_id: templateId } })
      .then(res => {
        const { data } = unwrap<{ data: ControlTemplateRead }>(res)
        setTemplate(data)
        form.reset(buildFormValues(data))
      })
      .catch(err => notifyApiError(err, 'Failed to load template'))
      .finally(() => setLoading(false))
  }, [templateId, form])

  if (!can('controls:read')) return <Navigate to={ROUTES.HOME} replace />

  const handleSave = async (values: TemplateFormValues) => {
    if (!template) return
    const body: ControlTemplateUpdate = {
      product: template.product,
      domain: template.domain,
      code: values.code,
      title: values.title,
      whatTesting: values.whatTesting,
      whyMatters: values.whyMatters,
      primaryQuestion: values.primaryQuestion,
      evidencePrompts: linesToList(values.evidencePromptsText),
      lookingFor: linesToList(values.lookingForText),
      sampling: values.samplingText.trim() || null,
      ifPartial: linesToList(values.ifPartialText),
      sortOrder: values.sortOrder,
      isActive: values.isActive
    }
    try {
      const res = await updateControlTemplate({
        path: { template_id: template.id },
        body
      })
      const { data } = unwrap<{ data: ControlTemplateRead }>(res)
      setTemplate(data)
      form.reset(buildFormValues(data))
      toast.success('Control template saved')
    } catch (err) {
      applyApiError(err, form.setError, 'Failed to save template')
    }
  }

  const handleAnchorSave = async (anchor: CalibrationAnchorCreate) => {
    if (!template) return
    try {
      await upsertCalibrationAnchor({
        path: { template_id: template.id },
        body: anchor
      })
      const refreshed = await getControlTemplate({
        path: { template_id: template.id }
      })
      const { data } = unwrap<{ data: ControlTemplateRead }>(refreshed)
      setTemplate(data)
      toast.success(`${RAGLevelLabel[anchor.ragLevel]} anchor saved`)
    } catch (err) {
      notifyApiError(err, 'Failed to save anchor')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!template) {
    return <p className="text-muted-foreground text-sm">Template not found.</p>
  }

  const ragLevels = ragLevelsForProduct(template.product as Product)

  return (
    <div className="flex flex-col gap-6">
      <Link
        to={ROUTES.ADMIN_CONTROLS}
        className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Control Templates
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-muted flex h-12 w-14 shrink-0 items-center justify-center rounded-lg text-base font-bold">
            {template.code}
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {template.title}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {ProductLabel[template.product as Product]}
              </Badge>
              {template.domain && (
                <Badge variant="outline" className="text-xs">
                  {DomainLabel[template.domain as Domain]}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                v{template.version}
              </Badge>
              {!template.isActive && (
                <Badge
                  variant="outline"
                  className="border-zinc-200 bg-zinc-100 text-zinc-500"
                >
                  Inactive
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={form.handleSubmit(handleSave)}
        noValidate
        className="flex flex-col gap-8"
      >
        <FormSection title="Identification">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <InputField
              name="code"
              control={form.control}
              label="Code"
              required
              disabled={!canEdit}
            />
            <InputField
              name="title"
              control={form.control}
              label="Title"
              required
              disabled={!canEdit}
            />
            <InputField
              name="sortOrder"
              control={form.control}
              label="Sort order"
              type="number"
              required
              disabled={!canEdit}
            />
          </div>
        </FormSection>

        <FormSection title="Operator brief">
          <TextareaField
            name="whatTesting"
            control={form.control}
            label="What you are testing"
            rows={3}
            required
            disabled={!canEdit}
          />
          <TextareaField
            name="whyMatters"
            control={form.control}
            label="Why this matters"
            rows={4}
            required
            disabled={!canEdit}
          />
          <TextareaField
            name="primaryQuestion"
            control={form.control}
            label="Primary question (ask verbatim)"
            rows={3}
            required
            disabled={!canEdit}
          />
        </FormSection>

        <FormSection title="Evidence guidance — one per line">
          <TextareaField
            name="evidencePromptsText"
            control={form.control}
            label="Follow-up evidence prompts"
            rows={5}
            disabled={!canEdit}
          />
          <TextareaField
            name="lookingForText"
            control={form.control}
            label="What you are looking for"
            rows={5}
            disabled={!canEdit}
          />
          <TextareaField
            name="samplingText"
            control={form.control}
            label="Sampling"
            rows={2}
            disabled={!canEdit}
          />
          <TextareaField
            name="ifPartialText"
            control={form.control}
            label="If evidence is partial"
            rows={5}
            disabled={!canEdit}
          />
        </FormSection>

        {canEdit && (
          <div className="flex items-center justify-between gap-3 border-t pt-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!isActive}
                onChange={e => form.setValue('isActive', e.target.checked)}
                className="rounded border-zinc-300"
              />
              <span>Active (visible to operators)</span>
            </label>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {form.formState.isSubmitting ? 'Saving…' : 'Save Template'}
            </Button>
          </div>
        )}
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight">
          Calibration Anchors
        </h2>
        <p className="text-muted-foreground text-sm">
          Operators reference these anchors when assigning a RAG rating in Phase
          2. Severity hints (1–5) suggest the default severity weight for a
          finding at this band.
        </p>
        <div className="flex flex-col gap-3">
          {ragLevels.map(level => {
            const anchor = template.calibrationAnchors?.find(
              a => a.ragLevel === level
            )
            return (
              <CalibrationAnchorCard
                key={level}
                level={level}
                description={anchor?.description ?? ''}
                severityHint={anchor?.severityHint ?? null}
                disabled={!canEdit}
                onSave={handleAnchorSave}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CalibrationAnchorCard({
  level,
  description,
  severityHint,
  disabled,
  onSave
}: {
  level: RAGLevel
  description: string
  severityHint: number | null
  disabled?: boolean
  onSave: (anchor: CalibrationAnchorCreate) => Promise<void>
}) {
  const [desc, setDesc] = useState(description)
  const [hint, setHint] = useState<string>(
    severityHint != null ? String(severityHint) : ''
  )
  const [saving, setSaving] = useState(false)
  const dirty = desc !== description || (Number(hint) || null) !== severityHint

  useEffect(() => {
    setDesc(description)
    setHint(severityHint != null ? String(severityHint) : '')
  }, [description, severityHint])

  return (
    <div className={`rounded-xl border p-4 ${RAG_BAND_CLASS[level]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold tracking-wide uppercase">
          {RAGLevelLabel[level]}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Severity hint</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={hint}
              onChange={e => setHint(e.target.value)}
              disabled={disabled}
              className="bg-background h-8 w-16"
              placeholder="1–5"
            />
          </div>
          {!disabled && (
            <Button
              size="sm"
              variant="outline"
              disabled={!dirty || saving}
              onClick={async () => {
                setSaving(true)
                try {
                  await onSave({
                    ragLevel: level,
                    description: desc,
                    severityHint: hint === '' ? null : Number(hint)
                  })
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          )}
        </div>
      </div>
      <Textarea
        value={desc}
        onChange={e => setDesc(e.target.value)}
        disabled={disabled}
        rows={3}
        className="bg-background mt-3 resize-y"
        placeholder="Describe what evidence patterns earn this rating…"
      />
    </div>
  )
}
