import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { NeedsAttention } from './needs-attention'

vi.mock('react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  )
}))

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

describe('NeedsAttention', () => {
  it('shows skeletons while loading', () => {
    const { container } = render(<NeedsAttention clients={[]} loading={true} />)
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(4)
  })

  it('renders empty state when no client needs attention', () => {
    render(
      <NeedsAttention
        clients={[client({ status: 'ACTIVE' })]}
        loading={false}
      />
    )
    expect(
      screen.getByText('All clear — nothing needs attention.')
    ).toBeInTheDocument()
    expect(screen.queryByText('View all clients')).not.toBeInTheDocument()
  })

  it('only includes follow-up due and audit-in-progress clients', () => {
    render(
      <NeedsAttention
        clients={[
          client({ id: '1', companyName: 'Active Co', status: 'ACTIVE' }),
          client({
            id: '2',
            companyName: 'Followup Co',
            status: 'FOLLOW_UP_DUE'
          }),
          client({
            id: '3',
            companyName: 'Audit Co',
            status: 'AUDIT_IN_PROGRESS'
          }),
          client({
            id: '4',
            companyName: 'Inactive Co',
            status: 'INACTIVE'
          })
        ]}
        loading={false}
      />
    )

    expect(screen.getByText('Followup Co')).toBeInTheDocument()
    expect(screen.getByText('Audit Co')).toBeInTheDocument()
    expect(screen.queryByText('Active Co')).not.toBeInTheDocument()
    expect(screen.queryByText('Inactive Co')).not.toBeInTheDocument()
  })

  it('prioritises follow-up due before audit-in-progress', () => {
    render(
      <NeedsAttention
        clients={[
          client({
            id: '1',
            companyName: 'Audit Co',
            status: 'AUDIT_IN_PROGRESS'
          }),
          client({
            id: '2',
            companyName: 'Followup Co',
            status: 'FOLLOW_UP_DUE'
          })
        ]}
        loading={false}
      />
    )

    const items = screen.getAllByRole('listitem')
    expect(within(items[0]).getByText('Followup Co')).toBeInTheDocument()
    expect(within(items[1]).getByText('Audit Co')).toBeInTheDocument()
  })

  it('caps the list at 5 items', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      client({
        id: `c${i}`,
        companyName: `Client ${i}`,
        status: 'FOLLOW_UP_DUE'
      })
    )
    render(<NeedsAttention clients={many} loading={false} />)
    expect(screen.getAllByRole('listitem').length).toBe(5)
  })

  it('links each row to the client detail page', () => {
    render(
      <NeedsAttention
        clients={[
          client({
            id: 'abc',
            companyName: 'Acme',
            status: 'FOLLOW_UP_DUE'
          })
        ]}
        loading={false}
      />
    )
    const link = screen
      .getAllByRole('link')
      .find(a => a.textContent?.includes('Acme'))
    expect(link).toHaveAttribute('href', '/clients/abc')
  })
})
