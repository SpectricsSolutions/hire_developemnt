'use strict';

const {
  computeControlStatus,
  computeCanClose,
} = require('../../src/services/evidenceService');

// ── computeControlStatus ──────────────────────────────────────────────────────

describe('computeControlStatus', () => {
  test('empty items → null (not blocked)', () => {
    expect(computeControlStatus([])).toBeNull();
  });

  test('all seen → seen', () => {
    const items = [{ status: 'seen' }, { status: 'seen' }];
    expect(computeControlStatus(items)).toBe('seen');
  });

  test('one requested among seen → requested', () => {
    const items = [{ status: 'seen' }, { status: 'requested' }, { status: 'seen' }];
    expect(computeControlStatus(items)).toBe('requested');
  });

  test('all requested → requested', () => {
    const items = [{ status: 'requested' }, { status: 'requested' }];
    expect(computeControlStatus(items)).toBe('requested');
  });

  test('mix partial/not_provided/seen (no requested) → not_provided (highest priority)', () => {
    const items = [
      { status: 'seen' },
      { status: 'partial' },
      { status: 'not_provided' },
    ];
    expect(computeControlStatus(items)).toBe('not_provided');
  });

  test('mix partial/seen (no requested) → partial', () => {
    const items = [{ status: 'seen' }, { status: 'partial' }];
    expect(computeControlStatus(items)).toBe('partial');
  });

  test('single not_provided → not_provided', () => {
    expect(computeControlStatus([{ status: 'not_provided' }])).toBe('not_provided');
  });

  test('single partial → partial', () => {
    expect(computeControlStatus([{ status: 'partial' }])).toBe('partial');
  });

  test('requested beats not_provided', () => {
    const items = [{ status: 'not_provided' }, { status: 'requested' }];
    expect(computeControlStatus(items)).toBe('requested');
  });

  test('requested beats partial', () => {
    const items = [{ status: 'partial' }, { status: 'requested' }];
    expect(computeControlStatus(items)).toBe('requested');
  });
});

// ── computeCanClose ───────────────────────────────────────────────────────────

describe('computeCanClose', () => {
  test('no controls → not blocked', () => {
    const result = computeCanClose([]);
    expect(result.blocked).toBe(false);
    expect(result.blockingControls).toHaveLength(0);
  });

  test('all controls seen → not blocked', () => {
    const result = computeCanClose([
      { controlId: 'ctrl-1', status: 'seen' },
      { controlId: 'ctrl-2', status: 'seen' },
    ]);
    expect(result.blocked).toBe(false);
    expect(result.blockingControls).toHaveLength(0);
  });

  test('one control requested → blocked with that controlId', () => {
    const result = computeCanClose([
      { controlId: 'ctrl-1', status: 'seen' },
      { controlId: 'ctrl-2', status: 'requested' },
    ]);
    expect(result.blocked).toBe(true);
    expect(result.blockingControls).toEqual(['ctrl-2']);
  });

  test('multiple controls requested → blocked with all their ids', () => {
    const result = computeCanClose([
      { controlId: 'ctrl-1', status: 'requested' },
      { controlId: 'ctrl-2', status: 'seen' },
      { controlId: 'ctrl-3', status: 'requested' },
    ]);
    expect(result.blocked).toBe(true);
    expect(result.blockingControls).toEqual(expect.arrayContaining(['ctrl-1', 'ctrl-3']));
    expect(result.blockingControls).toHaveLength(2);
  });

  test('mix partial/not_provided/seen (none requested) → not blocked', () => {
    const result = computeCanClose([
      { controlId: 'ctrl-1', status: 'partial' },
      { controlId: 'ctrl-2', status: 'not_provided' },
      { controlId: 'ctrl-3', status: 'seen' },
    ]);
    expect(result.blocked).toBe(false);
    expect(result.blockingControls).toHaveLength(0);
  });

  test('null status (empty control) → not blocked', () => {
    const result = computeCanClose([{ controlId: 'ctrl-1', status: null }]);
    expect(result.blocked).toBe(false);
  });
});

// ── Acceptance criteria scenarios ─────────────────────────────────────────────
// Verbatim from the task spec.

describe('Acceptance criteria scenarios', () => {
  test('AC1: all Seen → not blocked', () => {
    const items = [{ status: 'seen' }, { status: 'seen' }, { status: 'seen' }];
    expect(computeControlStatus(items)).not.toBe('requested');
    const { blocked } = computeCanClose([{ controlId: 'c1', status: computeControlStatus(items) }]);
    expect(blocked).toBe(false);
  });

  test('AC2: one Requested → blocked', () => {
    const items = [{ status: 'seen' }, { status: 'requested' }];
    expect(computeControlStatus(items)).toBe('requested');
    const { blocked } = computeCanClose([{ controlId: 'c1', status: 'requested' }]);
    expect(blocked).toBe(true);
  });

  test('AC3: mix Partial/Not Provided/Seen (no Requested) → not blocked', () => {
    const status = computeControlStatus([
      { status: 'partial' },
      { status: 'not_provided' },
      { status: 'seen' },
    ]);
    expect(status).not.toBe('requested');
    const { blocked } = computeCanClose([{ controlId: 'c1', status }]);
    expect(blocked).toBe(false);
  });

  test('AC4: empty control → not blocked', () => {
    const status = computeControlStatus([]);
    expect(status).toBeNull();
    const { blocked } = computeCanClose([{ controlId: 'c1', status }]);
    expect(blocked).toBe(false);
  });
});
