'use strict';

const { computeProgress } = require('../../src/services/phase1Service');

describe('computeProgress', () => {
  test('all not_provided → 0%', () => {
    const rows = [
      { status: 'not_provided' },
      { status: 'not_provided' },
    ];
    const p = computeProgress(rows, 2);
    expect(p.percentageComplete).toBe(0);
    expect(p.notProvided).toBe(2);
    expect(p.seen).toBe(0);
  });

  test('all seen → 100%', () => {
    const rows = [{ status: 'seen' }, { status: 'seen' }];
    const p = computeProgress(rows, 2);
    expect(p.percentageComplete).toBe(100);
    expect(p.seen).toBe(2);
  });

  test('partial counts as complete for progress', () => {
    const rows = [{ status: 'seen' }, { status: 'partial' }];
    const p = computeProgress(rows, 2);
    expect(p.percentageComplete).toBe(100);
  });

  test('requested does NOT count as complete', () => {
    const rows = [{ status: 'seen' }, { status: 'requested' }];
    const p = computeProgress(rows, 2);
    expect(p.percentageComplete).toBe(50);
    expect(p.requested).toBe(1);
  });

  test('mixed → correct counts', () => {
    const rows = [
      { status: 'seen' },
      { status: 'partial' },
      { status: 'requested' },
      { status: 'not_provided' },
    ];
    const p = computeProgress(rows, 4);
    expect(p.seen).toBe(1);
    expect(p.partial).toBe(1);
    expect(p.requested).toBe(1);
    expect(p.notProvided).toBe(1);
    expect(p.percentageComplete).toBe(50); // 2/4
    expect(p.total).toBe(4);
  });

  test('no evidence rows (before Phase 1 started) → 0%', () => {
    const p = computeProgress([], 5);
    expect(p.percentageComplete).toBe(0);
    expect(p.total).toBe(5);
    expect(p.notProvided).toBe(0);
  });

  test('zero controls → 0%', () => {
    const p = computeProgress([], 0);
    expect(p.percentageComplete).toBe(0);
    expect(p.total).toBe(0);
  });
});
