import { describe, expect, it } from 'vitest';
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
});
