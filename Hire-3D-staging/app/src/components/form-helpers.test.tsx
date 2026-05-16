import { zodResolver } from '@hookform/resolvers/zod'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import {
  DatePickerField,
  FormField,
  FormSection,
  InputField,
  SelectField,
  TextareaField
} from './form-helpers'

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children
  }: {
    value: string
    onValueChange: (v: string) => void
    children: React.ReactNode
  }) => (
    <select
      data-testid="select-native"
      value={value}
      onChange={e => onValueChange(e.target.value)}
    >
      <option value="">--</option>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    value,
    children
  }: {
    value: string
    children: React.ReactNode
  }) => <option value={value}>{children}</option>
}))

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  )
}))

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({
    selected,
    onSelect
  }: {
    selected: Date | undefined
    onSelect: (date: Date | undefined) => void
  }) => (
    <div data-testid="calendar" data-selected={selected?.toISOString() ?? ''}>
      <button
        type="button"
        onClick={() => onSelect(new Date('2026-03-15T00:00:00'))}
      >
        pick-2026-03-15
      </button>
      <button type="button" onClick={() => onSelect(undefined)}>
        pick-undefined
      </button>
    </div>
  )
}))

afterEach(() => vi.clearAllMocks())

const schema = z.object({
  name: z.string({ error: 'Name is required' }).min(1, 'Name is required'),
  bio: z.string({ error: 'Bio is required' }).min(1, 'Bio is required'),
  status: z.enum(['ACTIVE', 'INACTIVE'], { error: 'Pick one' }),
  birthday: z.string({ error: 'Date is required' }).min(1, 'Date is required'),
  age: z.coerce.number().int().min(0, 'Must be 0+')
})

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

function Harness({
  onValid,
  defaultValues
}: {
  onValid?: (v: FormValues) => void
  defaultValues?: Partial<FormInput>
}) {
  const { control, handleSubmit } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues
  })

  return (
    <form onSubmit={handleSubmit(v => onValid?.(v))} noValidate>
      <FormSection title="Profile">
        <InputField
          name="name"
          control={control}
          label="Name"
          required
          placeholder="Type a name"
        />
        <InputField
          name="age"
          control={control}
          label="Age"
          type="number"
          min={0}
          step="1"
        />
        <TextareaField
          name="bio"
          control={control}
          label="Bio"
          required
          rows={3}
          placeholder="About"
        />
        <SelectField
          name="status"
          control={control}
          label="Status"
          required
          placeholder="Select status"
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' }
          ]}
        />
        <DatePickerField
          name="birthday"
          control={control}
          label="Birthday"
          required
        />
      </FormSection>
      <button type="submit">Submit</button>
    </form>
  )
}

describe('FormSection', () => {
  it('renders the title and children', () => {
    render(
      <FormSection title="Account">
        <span>child-node</span>
      </FormSection>
    )
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByText('child-node')).toBeInTheDocument()
  })
})

describe('FormField', () => {
  it('shows the required asterisk when required is true', () => {
    render(
      <FormField id="x" label="Email" required>
        <input id="x" />
      </FormField>
    )
    const label = screen.getByText('Email').closest('label')
    expect(label).not.toBeNull()
    expect(label!.textContent).toContain('*')
  })

  it('omits the asterisk when not required', () => {
    render(
      <FormField id="x" label="Optional">
        <input id="x" />
      </FormField>
    )
    expect(screen.getByText('Optional').textContent).not.toContain('*')
  })

  it('renders an error message when provided', () => {
    render(
      <FormField id="x" label="Email" error="Bad email">
        <input id="x" />
      </FormField>
    )
    expect(screen.getByText('Bad email')).toBeInTheDocument()
  })

  it('does not render an error paragraph when no error', () => {
    render(
      <FormField id="x" label="Email">
        <input id="x" />
      </FormField>
    )
    expect(screen.queryByText('Bad email')).not.toBeInTheDocument()
  })
})

describe('InputField', () => {
  it('passes type, min, step and placeholder to the input', () => {
    render(<Harness />)
    const age = screen.getByLabelText('Age') as HTMLInputElement
    expect(age.type).toBe('number')
    expect(age.min).toBe('0')
    expect(age.step).toBe('1')
    const name = screen.getByLabelText(/^Name/) as HTMLInputElement
    expect(name.placeholder).toBe('Type a name')
  })

  it('shows zod validation error after submit', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() =>
      expect(screen.getByText('Name is required')).toBeInTheDocument()
    )
  })

  it('renders empty string when field value is null/undefined', () => {
    render(<Harness defaultValues={{ name: undefined }} />)
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('')
  })

  it('writes the typed value back through the controller', async () => {
    const onValid = vi.fn()
    render(
      <Harness
        onValid={onValid}
        defaultValues={{
          name: 'A',
          bio: 'B',
          status: 'ACTIVE',
          birthday: '2026-01-01',
          age: '5' as unknown as number
        }}
      />
    )
    await userEvent.clear(screen.getByLabelText(/^Name/))
    await userEvent.type(screen.getByLabelText(/^Name/), 'Alice')
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onValid).toHaveBeenCalled())
    expect(onValid.mock.calls[0][0]).toMatchObject({ name: 'Alice' })
  })
})

describe('TextareaField', () => {
  it('forwards rows and placeholder', () => {
    render(<Harness />)
    const bio = screen.getByLabelText(/^Bio/) as HTMLTextAreaElement
    expect(bio.rows).toBe(3)
    expect(bio.placeholder).toBe('About')
  })

  it('renders empty string when field value is undefined', () => {
    render(<Harness defaultValues={{ bio: undefined }} />)
    expect((screen.getByLabelText(/^Bio/) as HTMLTextAreaElement).value).toBe(
      ''
    )
  })

  it('shows zod validation error on empty submit', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() =>
      expect(screen.getByText('Bio is required')).toBeInTheDocument()
    )
  })
})

describe('SelectField', () => {
  it('shows zod validation error when no option chosen', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() =>
      expect(screen.getByText('Pick one')).toBeInTheDocument()
    )
  })

  it('writes the selected value back through the controller', async () => {
    const onValid = vi.fn()
    render(
      <Harness
        onValid={onValid}
        defaultValues={{
          name: 'A',
          bio: 'B',
          birthday: '2026-01-01',
          age: '5' as unknown as number
        }}
      />
    )
    const selects = screen.getAllByTestId(
      'select-native'
    ) as HTMLSelectElement[]
    await userEvent.selectOptions(selects[0], 'INACTIVE')
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onValid).toHaveBeenCalled())
    expect(onValid.mock.calls[0][0]).toMatchObject({ status: 'INACTIVE' })
  })
})

describe('DatePickerField', () => {
  it('formats and emits ISO yyyy-mm-dd when a date is picked', async () => {
    const onValid = vi.fn()
    render(
      <Harness
        onValid={onValid}
        defaultValues={{
          name: 'A',
          bio: 'B',
          status: 'ACTIVE',
          age: '5' as unknown as number
        }}
      />
    )
    await userEvent.click(screen.getByText('pick-2026-03-15'))
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onValid).toHaveBeenCalled())
    expect(onValid.mock.calls[0][0]).toMatchObject({ birthday: '2026-03-15' })
  })

  it('clears the field when undefined date is selected', async () => {
    render(
      <Harness
        defaultValues={{
          name: 'A',
          bio: 'B',
          status: 'ACTIVE',
          age: '5' as unknown as number,
          birthday: '2026-01-01'
        }}
      />
    )
    expect(screen.getByText('1 Jan 2026')).toBeInTheDocument()
    await userEvent.click(screen.getByText('pick-undefined'))
    await waitFor(() =>
      expect(screen.queryByText('1 Jan 2026')).not.toBeInTheDocument()
    )
    expect(screen.getByText('Pick a date')).toBeInTheDocument()
  })

  it('uses a custom placeholder when no date is picked', () => {
    function Custom() {
      const { control } = useForm<{ d: string }>({ defaultValues: { d: '' } })
      return (
        <DatePickerField
          name="d"
          control={control}
          label="Day"
          placeholder="Choose a day"
        />
      )
    }
    render(<Custom />)
    expect(screen.getByText('Choose a day')).toBeInTheDocument()
  })

  it('shows zod validation error when required and empty', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() =>
      expect(screen.getByText('Date is required')).toBeInTheDocument()
    )
  })

  it('renders an existing yyyy-mm-dd value as a localized label', async () => {
    render(
      <Harness
        defaultValues={{
          name: 'A',
          bio: 'B',
          status: 'ACTIVE',
          age: '5' as unknown as number,
          birthday: '2026-12-31'
        }}
      />
    )
    await waitFor(() =>
      expect(screen.getByText('31 Dec 2026')).toBeInTheDocument()
    )
  })
})

describe('full submit', () => {
  it('produces all transformed values when valid', async () => {
    const onValid = vi.fn()
    render(<Harness onValid={onValid} />)
    await userEvent.type(screen.getByLabelText(/^Name/), 'Alice')
    await userEvent.type(screen.getByLabelText(/^Bio/), 'Bio text')
    const selects = screen.getAllByTestId(
      'select-native'
    ) as HTMLSelectElement[]
    await userEvent.selectOptions(selects[0], 'ACTIVE')
    await userEvent.click(screen.getByText('pick-2026-03-15'))
    await userEvent.clear(screen.getByLabelText('Age'))
    await userEvent.type(screen.getByLabelText('Age'), '42')
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onValid).toHaveBeenCalled())
    expect(onValid.mock.calls[0][0]).toEqual({
      name: 'Alice',
      bio: 'Bio text',
      status: 'ACTIVE',
      birthday: '2026-03-15',
      age: 42
    })
  })
})
