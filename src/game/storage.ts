import { STORAGE_KEY } from './constants';
import { createInitialState } from './engine';
import type { GameState } from './types';

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const localStorageAdapter: StorageAdapter = {
  getItem(key: string) {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore storage quota/permission errors in MVP.
    }
  }
};

export function saveState(state: GameState, adapter: StorageAdapter = localStorageAdapter): void {
  adapter.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}

export function loadState(
  adapter: StorageAdapter = localStorageAdapter,
  nowTs = Date.now()
): GameState {
  const raw = adapter.getItem(STORAGE_KEY);
  if (!raw) {
    return createInitialState(nowTs);
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return createInitialState(nowTs);
    }

    const base = createInitialState(nowTs);
    const merged = {
      ...base,
      ...parsed,
      settings: {
        ...base.settings,
        ...(isRecord(parsed.settings) ? parsed.settings : {}),
        perActionPrompts: {
          ...base.settings.perActionPrompts,
          ...(isRecord(parsed.settings) && isRecord(parsed.settings.perActionPrompts)
            ? parsed.settings.perActionPrompts
            : {})
        },
        sleepWindow: {
          ...base.settings.sleepWindow,
          ...(isRecord(parsed.settings) && isRecord(parsed.settings.sleepWindow)
            ? parsed.settings.sleepWindow
            : {})
        }
      }
    } as GameState;

    const adultVariant =
      merged.adultVariant === 'A' ||
      merged.adultVariant === 'B' ||
      merged.adultVariant === 'C'
        ? merged.adultVariant
        : 'C';

    return {
      ...merged,
      adultVariant
    };
  } catch {
    return createInitialState(nowTs);
  }
}
