import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/game/engine';
import { gameReducer } from '../src/game/reducer';
import type { ParentSettings } from '../src/game/types';

describe('gameReducer restart', () => {
  it('fully resets gameplay stats and returns to egg selection', () => {
    const start = new Date('2026-02-10T10:00:00').getTime();
    const base = createInitialState(start, undefined, () => 0.5);

    const progressed = {
      ...base,
      hunger: 8,
      happiness: 14,
      training: 91,
      weight: 17,
      eggStyle: 'leaf' as const,
      critterVariant: 'forest' as const,
      stage: 'teen' as const,
      ageDays: 9,
      poopCount: 6,
      snackCountToday: 3,
      starsToday: 5,
      totalStars: 33,
      successfulMirrorsToday: 7,
      bestDayRecord: 7,
      stageStartedTs: start - 2 * 24 * 60 * 60 * 1000,
      createdTs: start - 9 * 24 * 60 * 60 * 1000,
      dead: false
    };

    const restarted = gameReducer(progressed, {
      type: 'applyAction',
      actionType: 'restart',
      outcome: { preserveSettingsOnRestart: true },
      nowTs: start + 10_000
    });

    expect(restarted.stage).toBe('egg');
    expect(restarted.eggStyle).toBeNull();
    expect(restarted.critterVariant).toBeNull();
    expect(restarted.hunger).toBe(70);
    expect(restarted.happiness).toBe(70);
    expect(restarted.training).toBe(30);
    expect(restarted.weight).toBe(8);
    expect(restarted.ageDays).toBe(0);
    expect(restarted.poopCount).toBe(0);
    expect(restarted.snackCountToday).toBe(0);
    expect(restarted.starsToday).toBe(0);
    expect(restarted.totalStars).toBe(0);
    expect(restarted.successfulMirrorsToday).toBe(0);
    expect(restarted.bestDayRecord).toBe(0);
  });

  it('remains stable when restarting from legacy settings missing eggHatchSeconds', () => {
    const start = new Date('2026-02-10T10:00:00').getTime();
    const base = createInitialState(start, undefined, () => 0.5);

    const legacySettings = { ...base.settings } as Partial<ParentSettings>;
    delete (legacySettings as { eggHatchSeconds?: number }).eggHatchSeconds;

    const legacyState = {
      ...base,
      settings: legacySettings as ParentSettings,
      stage: 'adult' as const,
      eggStyle: 'speckled' as const,
      critterVariant: 'sunny' as const,
      hunger: 12,
      happiness: 22,
      training: 88
    };

    const restarted = gameReducer(legacyState, {
      type: 'applyAction',
      actionType: 'restart',
      outcome: { preserveSettingsOnRestart: true },
      nowTs: start + 10_000
    });

    expect(restarted.settings.eggHatchSeconds).toBe(300);

    const afterEggPick = gameReducer(restarted, {
      type: 'setEggStyle',
      eggStyle: 'star',
      nowTs: start + 20_000
    });

    expect(afterEggPick.stage).toBe('egg');
    expect(afterEggPick.ageDays).toBe(0);
    expect(afterEggPick.hunger).toBeGreaterThan(69);
  });
});
