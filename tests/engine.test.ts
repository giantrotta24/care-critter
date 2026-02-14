import { describe, expect, it } from 'vitest';
import { applyActionReward, applyTimeDecay, createInitialState } from '../src/game/engine';
import { toIsoDate } from '../src/game/time';

describe('applyTimeDecay', () => {
  it('starts new saves in egg selection state', () => {
    const start = new Date('2026-02-10T10:00:00').getTime();
    const state = createInitialState(start, undefined, () => 0.5);

    expect(state.eggStyle).toBeNull();
    expect(state.critterVariant).toBeNull();
  });

  it('decreases hunger and happiness with awake decay', () => {
    const start = new Date('2026-02-10T10:00:00').getTime();
    const state = createInitialState(start, undefined, () => 0.5);

    const next = applyTimeDecay(state, 10, start + 10 * 60 * 1000, () => 0.5);

    expect(next.hunger).toBeCloseTo(66, 5);
    expect(next.happiness).toBeCloseTo(68.5, 5);
  });

  it('uses slower decay while asleep', () => {
    const start = new Date('2026-02-10T22:00:00').getTime();
    const state = {
      ...createInitialState(start, undefined, () => 0.5),
      asleep: true,
      settings: {
        ...createInitialState(start).settings,
        sleepWindow: { start: '00:00', end: '23:59' }
      }
    };

    const next = applyTimeDecay(state, 10, start + 10 * 60 * 1000, () => 0.5);

    expect(next.hunger).toBeCloseTo(68.4, 5);
    expect(next.happiness).toBeCloseTo(69.4, 5);
  });

  it('does not decay when pauseDecay is enabled', () => {
    const start = new Date('2026-02-10T10:00:00').getTime();
    const state = {
      ...createInitialState(start, undefined, () => 0.5),
      settings: {
        ...createInitialState(start).settings,
        pauseDecay: true
      }
    };

    const next = applyTimeDecay(state, 30, start + 30 * 60 * 1000, () => 0.5);

    expect(next.hunger).toBe(state.hunger);
    expect(next.happiness).toBe(state.happiness);
    expect(next.training).toBe(state.training);
  });
});

describe('snack daily reset', () => {
  it('resets snack cap and daily listening counters on a new date', () => {
    const dayOne = new Date('2026-02-10T18:00:00').getTime();
    const dayTwo = new Date('2026-02-11T09:00:00').getTime();

    const state = {
      ...createInitialState(dayOne, undefined, () => 0.5),
      snackCountToday: 3,
      starsToday: 4,
      successfulMirrorsToday: 4,
      totalStars: 9,
      lastSnackResetDate: toIsoDate(dayOne)
    };

    const next = applyActionReward(state, 'feedSnack', {}, dayTwo, () => 0.5);

    expect(next.snackCountToday).toBe(1);
    expect(next.starsToday).toBe(0);
    expect(next.successfulMirrorsToday).toBe(0);
    expect(next.totalStars).toBe(9);
  });
});

describe('stage progression', () => {
  it('supports hatchEarly from egg and derives variant from egg style', () => {
    const start = new Date('2026-02-10T10:00:00').getTime();
    const state = {
      ...createInitialState(start, undefined, () => 0.5),
      eggStyle: 'leaf' as const
    };

    const next = applyActionReward(state, 'hatchEarly', {}, start + 1_000, () => 0.5);

    expect(next.stage).toBe('baby');
    expect(next.critterVariant).toBe('forest');
  });

  it('advances from egg to adult with enough elapsed time', () => {
    const start = new Date('2026-02-10T10:00:00').getTime();
    const state = {
      ...createInitialState(start, undefined, () => 0.5),
      eggStyle: 'speckled' as const
    };

    const totalMinutes = 5 + 24 * 60 + 2 * 24 * 60 + 2 * 24 * 60 + 1;
    const endTs = start + totalMinutes * 60 * 1000;

    const next = applyTimeDecay(state, totalMinutes, endTs, () => 0.5);

    expect(next.stage).toBe('adult');
    expect(['A', 'B', 'C']).toContain(next.adultVariant);
  });
});
