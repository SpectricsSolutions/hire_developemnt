import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import {
  type Control,
  type FieldPath,
  type FieldValues,
  useController
} from 'react-hook-form'

export function FormSection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-muted-foreground border-b pb-2 text-xs font-semibold tracking-widest uppercase">
        {title}
      </h3>
      {children}
    </div>
  )
}

export function FormField({
  id,
  label,
  required,
  error,
  hint,
  children
}: {
  id?: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  )
}

export function InputField<
  T extends FieldValues = FieldValues,
  TTransformedValues extends FieldValues | undefined = undefined,
  TName extends FieldPath<T> = FieldPath<T>
>({
  name,
  control,
  label,
  required,
  type = 'text',
  min,
  step,
  placeholder,
  hint,
  disabled
}: {
  name: TName
  control: Control<T, unknown, TTransformedValues>
  label: string
  required?: boolean
  type?: string
  min?: number
  step?: string
  placeholder?: string
  hint?: string
  disabled?: boolean
}) {
  const { field, fieldState } = useController({ name, control })
  return (
    <FormField
      id={name}
      label={label}
      required={required}
      error={fieldState.error?.message}
      hint={hint}
    >
      <Input
        id={name}
        type={type}
        min={min}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
        {...field}
        value={field.value ?? ''}
      />
    </FormField>
  )
}

export function SelectField<
  T extends FieldValues = FieldValues,
  TTransformedValues extends FieldValues | undefined = undefined,
  TName extends FieldPath<T> = FieldPath<T>
>({
  name,
  control,
  label,
  required,
  placeholder,
  options
}: {
  name: TName
  control: Control<T, unknown, TTransformedValues>
  label: string
  required?: boolean
  placeholder?: string
  options: { value: string; label: string }[]
}) {
  const { field, fieldState } = useController({ name, control })
  return (
    <FormField
      id={name}
      label={label}
      required={required}
      error={fieldState.error?.message}
    >
      <Select onValueChange={field.onChange} value={field.value ?? ''}>
        <SelectTrigger id={name}>
          <SelectValue placeholder={placeholder}>
            {options.find(o => o.value === field.value)?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  )
}

export function DatePickerField<
  T extends FieldValues = FieldValues,
  TTransformedValues extends FieldValues | undefined = undefined,
  TName extends FieldPath<T> = FieldPath<T>
>({
  name,
  control,
  label,
  required,
  placeholder = 'Pick a date'
}: {
  name: TName
  control: Control<T, unknown, TTransformedValues>
  label: string
  required?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const { field, fieldState } = useController({ name, control })

  const selectedDate = field.value
    ? new Date((field.value as string) + 'T00:00:00')
    : undefined

  const displayValue = selectedDate ? formatDate(selectedDate) : null

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const yyyy = date.getFullYear()
      const mm = String(date.getMonth() + 1).padStart(2, '0')
      const dd = String(date.getDate()).padStart(2, '0')
      field.onChange(`${yyyy}-${mm}-${dd}`)
    } else {
      field.onChange('')
    }
    setOpen(false)
  }

  return (
    <FormField
      id={name}
      label={label}
      required={required}
      error={fieldState.error?.message}
    >
      <Popover open={open} onOpenChange={o => setOpen(o)}>
        <PopoverTrigger asChild>
          <Button
            id={name}
            type="button"
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !field.value && 'text-muted-foreground'
            )}
          >
            <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
            {displayValue ?? placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
          />
        </PopoverContent>
      </Popover>
    </FormField>
  )
}

export function TextareaField<
  T extends FieldValues = FieldValues,
  TTransformedValues extends FieldValues | undefined = undefined,
  TName extends FieldPath<T> = FieldPath<T>
>({
  name,
  control,
  label,
  required,
  rows = 4,
  placeholder,
  disabled
}: {
  name: TName
  control: Control<T, unknown, TTransformedValues>
  label: string
  required?: boolean
  rows?: number
  placeholder?: string
  disabled?: boolean
}) {
  const { field, fieldState } = useController({ name, control })
  return (
    <FormField
      id={name}
      label={label}
      required={required}
      error={fieldState.error?.message}
    >
      <Textarea
        id={name}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        {...field}
        value={field.value ?? ''}
      />
    </FormField>
  )
}
