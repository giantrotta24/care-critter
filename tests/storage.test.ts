import { describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '../src/game/constants';
import { createInitialState } from '../src/game/engine';
import { loadState, saveState, type StorageAdapter } from '../src/game/storage';

function memoryAdapter(): StorageAdapter {
  const map = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      map.set(key, value);
    }
  };
}

describe('storage round-trip', () => {
  it('saves and reloads game state without loss', () => {
    const nowTs = new Date('2026-02-10T10:00:00').getTime();
    const adapter = memoryAdapter();

    const state = createInitialState(nowTs, undefined, () => 0.5);
    saveState(state, adapter);

    const loaded = loadState(adapter, nowTs + 1000);

    expect(loaded).toEqual(state);
  });

  it('migrates legacy prompt strings and adds egg defaults', () => {
    const nowTs = new Date('2026-02-10T10:00:00').getTime();
    const adapter = memoryAdapter();
    const state = createInitialState(nowTs, undefined, () => 0.5);

    const legacyPayload = {
      ...state,
      settings: {
        ...state.settings,
        perActionPrompts: {
          feedMeal: 'Take one bite.',
          feedSnack: 'One healthy snack bite.',
          play: 'Jump five times.',
          learn: 'Say one letter.',
          sleep: 'Pajamas and bed.'
        }
      }
    } as Record<string, unknown>;

    delete legacyPayload.eggStyle;
    delete legacyPayload.critterVariant;

    adapter.setItem(STORAGE_KEY, JSON.stringify(legacyPayload));

    const loaded = loadState(adapter, nowTs + 1000);

    expect(loaded.eggStyle).toBe('speckled');
    expect(loaded.critterVariant).toBe('sunny');
    expect(loaded.settings.perActionPrompts.feedMeal.promptText).toBe('Take one bite.');
    expect(loaded.settings.perActionPrompts.feedMeal.promptIcon).toBe('meal');
  });

  it('adds V2 reward defaults and resets persisted phase to idle', () => {
    const nowTs = new Date('2026-02-10T10:00:00').getTime();
    const adapter = memoryAdapter();
    const state = createInitialState(nowTs, undefined, () => 0.5);

    const legacyPayload = {
      ...state,
      starsToday: 9,
      totalStars: 28,
      successfulMirrorsToday: 6,
      bestDayRecord: 2,
      currentPhase: 'mirror'
    };

    adapter.setItem(STORAGE_KEY, JSON.stringify(legacyPayload));

    const loaded = loadState(adapter, nowTs + 1000);

    expect(loaded.starsToday).toBe(5);
    expect(loaded.totalStars).toBe(28);
    expect(loaded.successfulMirrorsToday).toBe(6);
    expect(loaded.bestDayRecord).toBe(6);
    expect(loaded.currentPhase).toBe('idle');
  });
});
