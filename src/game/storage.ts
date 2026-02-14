import { DEFAULT_PROMPT_ICONS, EGG_TO_VARIANT, EGG_STYLES, STORAGE_KEY } from './constants';
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

const PROMPT_KEYS = ['feedMeal', 'feedSnack', 'play', 'learn', 'sleep'] as const;
const PROMPT_ICON_KEYS = ['meal', 'snack', 'play', 'learn', 'sleep'] as const;

function isPromptIcon(value: unknown): value is (typeof PROMPT_ICON_KEYS)[number] {
  return typeof value === 'string' && PROMPT_ICON_KEYS.includes(value as (typeof PROMPT_ICON_KEYS)[number]);
}

function normalizePromptEntry(
  baseText: string,
  baseIcon: (typeof PROMPT_ICON_KEYS)[number],
  incoming: unknown
): { promptText: string; promptIcon: (typeof PROMPT_ICON_KEYS)[number] } {
  if (typeof incoming === 'string') {
    return {
      promptText: incoming,
      promptIcon: baseIcon
    };
  }

  if (!isRecord(incoming)) {
    return {
      promptText: baseText,
      promptIcon: baseIcon
    };
  }

  return {
    promptText: typeof incoming.promptText === 'string' ? incoming.promptText : baseText,
    promptIcon: isPromptIcon(incoming.promptIcon) ? incoming.promptIcon : baseIcon
  };
}

function normalizePerActionPrompts(
  base: GameState['settings']['perActionPrompts'],
  incoming: unknown
): GameState['settings']['perActionPrompts'] {
  const source = isRecord(incoming) ? incoming : {};
  const next = { ...base };

  for (const key of PROMPT_KEYS) {
    const baseEntry = base[key];
    next[key] = normalizePromptEntry(
      baseEntry.promptText,
      baseEntry.promptIcon ?? DEFAULT_PROMPT_ICONS[key],
      source[key]
    );
  }

  return next;
}

function isEggStyle(value: unknown): value is (typeof EGG_STYLES)[number] {
  return typeof value === 'string' && EGG_STYLES.includes(value as (typeof EGG_STYLES)[number]);
}

function isCritterVariant(value: unknown): value is GameState['critterVariant'] {
  return value === 'sunny' || value === 'stripe' || value === 'astro' || value === 'forest';
}

function normalizeCount(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(0, Math.round(value));
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
        perActionPrompts: normalizePerActionPrompts(
          base.settings.perActionPrompts,
          isRecord(parsed.settings) ? parsed.settings.perActionPrompts : undefined
        ),
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

    const hasEggStyle = Object.prototype.hasOwnProperty.call(parsed, 'eggStyle');
    const eggStyle = hasEggStyle
      ? merged.eggStyle === null
        ? null
        : isEggStyle(merged.eggStyle)
          ? merged.eggStyle
          : 'speckled'
      : 'speckled';

    const critterVariant =
      eggStyle === null
        ? null
        : isCritterVariant(merged.critterVariant)
          ? merged.critterVariant
          : EGG_TO_VARIANT[eggStyle];

    const successfulMirrorsToday = normalizeCount(merged.successfulMirrorsToday, 0);
    const bestDayRecord = Math.max(
      normalizeCount(merged.bestDayRecord, 0),
      successfulMirrorsToday
    );

    return {
      ...merged,
      adultVariant,
      eggStyle,
      critterVariant,
      starsToday: Math.min(5, normalizeCount(merged.starsToday, 0)),
      totalStars: normalizeCount(merged.totalStars, 0),
      successfulMirrorsToday,
      bestDayRecord,
      currentPhase: 'idle'
    };
  } catch {
    return createInitialState(nowTs);
  }
}
