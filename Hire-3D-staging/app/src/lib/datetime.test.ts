import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  formatDate,
  formatDateTime,
  formatLongDate,
  formatRelative
} from './datetime'

afterEach(() => vi.restoreAllMocks())

describe('formatDate', () => {
  it('formats a date-only ISO string in en-GB short form', () => {
    expect(formatDate('2026-05-02')).toBe('2 May 2026')
  })

  it('formats a Date instance the same way', () => {
    expect(formatDate(new Date(2026, 4, 2))).toBe('2 May 2026')
  })

  it('treats date-only input as local midnight (no TZ rollback)', () => {
    // If we parsed '2026-05-02' as UTC, negative-offset zones would render
    // the previous day. The local-midnight workaround keeps the input date.
    expect(formatDate('2026-05-02')).toBe('2 May 2026')
  })
})

describe('formatLongDate', () => {
  it('includes the weekday in long form', () => {
    expect(formatLongDate('2026-05-02')).toBe('Saturday, 2 May 2026')
  })
})

describe('formatDateTime', () => {
  it('includes hour and minute with AM/PM', () => {
    expect(formatDateTime('2026-05-02T08:36:00Z')).toMatch(
      /^2 May 2026, \d{1,2}:\d{2} (AM|PM)$/
    )
  })
})

describe('formatRelative', () => {
  it('returns "just now" for sub-minute differences', () => {
    vi.spyOn(Date, 'now').mockReturnValue(
      new Date('2026-05-02T10:00:30Z').getTime()
    )
    expect(formatRelative('2026-05-02T10:00:00Z')).toBe('just now')
  })

  it('returns minutes when under an hour', () => {
    vi.spyOn(Date, 'now').mockReturnValue(
      new Date('2026-05-02T10:30:00Z').getTime()
    )
    expect(formatRelative('2026-05-02T10:00:00Z')).toBe('30m ago')
  })

  it('returns hours when under a day', () => {
    vi.spyOn(Date, 'now').mockReturnValue(
      new Date('2026-05-02T12:00:00Z').getTime()
    )
    expect(formatRelative('2026-05-02T10:00:00Z')).toBe('2h ago')
  })

  it('returns days when under a week', () => {
    vi.spyOn(Date, 'now').mockReturnValue(
      new Date('2026-05-04T10:00:00Z').getTime()
    )
    expect(formatRelative('2026-05-02T10:00:00Z')).toBe('2d ago')
  })

  it('falls back to absolute date past one week', () => {
    vi.spyOn(Date, 'now').mockReturnValue(
      new Date('2026-05-20T10:00:00Z').getTime()
    )
    expect(formatRelative('2026-05-02T10:00:00Z')).toBe('2 May 2026')
  })
})
