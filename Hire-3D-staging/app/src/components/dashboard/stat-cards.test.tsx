import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatCards } from './stat-cards'

function client(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'c1',
    companyName: 'Acme',
    companiesHouseNumber: null,
    primaryContactName: 'Jane',
    primaryContactEmail: 'jane@acme.test',
    primaryContactPhone: null,
    sector: 'Technology',
    headcountAtEngagement: 10,
    currentHeadcount: 10,
    businessStage: 'EARLY',
    region: 'LONDON',
    assignedOperatorId: null,
    internalNotes: null,
    status: 'ACTIVE',
    ...over
  } as never
}

const CLIENTS = [
  client({ id: '1', status: 'ACTIVE' }),
  client({ id: '2', status: 'ACTIVE' }),
  client({ id: '3', status: 'AUDIT_IN_PROGRESS' }),
  client({ id: '4', status: 'AUDIT_IN_PROGRESS' }),
  client({ id: '5', status: 'AUDIT_IN_PROGRESS' }),
  client({ id: '6', status: 'FOLLOW_UP_DUE' }),
  client({ id: '7', status: 'REPORT_ISSUED' }),
  client({ id: '8', status: 'INACTIVE' })
]

describe('StatCards', () => {
  it('shows skeletons while loading', () => {
    const { container } = render(
      <StatCards clients={[]} loading={true} scoped={false} />
    )
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(4)
  })

  function cardOf(label: string): HTMLElement {
    return screen.getByText(label).closest('[data-slot="card"]') as HTMLElement
  }

  it('renders counts derived from clients', () => {
    render(<StatCards clients={CLIENTS} loading={false} scoped={false} />)
    expect(within(cardOf('Total Clients')).getByText('8')).toBeInTheDocument()
    expect(
      within(cardOf('Audits in Progress')).getByText('3')
    ).toBeInTheDocument()
    expect(within(cardOf('Follow-ups Due')).getByText('1')).toBeInTheDocument()
    expect(within(cardOf('Reports Issued')).getByText('1')).toBeInTheDocument()
  })

  it('uses "My Clients" label and assignment hint when scoped', () => {
    render(<StatCards clients={CLIENTS} loading={false} scoped={true} />)
    expect(screen.getByText('My Clients')).toBeInTheDocument()
    expect(screen.getByText('Assigned to you')).toBeInTheDocument()
    expect(screen.queryByText('Total Clients')).not.toBeInTheDocument()
  })

  it('handles empty clients gracefully', () => {
    render(<StatCards clients={[]} loading={false} scoped={false} />)
    expect(within(cardOf('Total Clients')).getByText('0')).toBeInTheDocument()
  })
})
