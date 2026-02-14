import { DEFAULT_PROMPT_ICONS } from '../game/constants';
import { applyTimeDecay } from '../game/engine';
import { loadState, saveState } from '../game/storage';
import type { EggStyle, GameState, MirrorActionKey, PromptIconKey } from '../game/types';

export type Intent = 'feedMeal' | 'feedSnack' | 'play' | 'learn' | 'sleep';
export type Side = 'left' | 'right';
export type DockAction = 'feed' | 'play' | 'learn' | 'sleep';
export type ConfirmAction = 'restart' | 'hatchEarly' | null;
export type DockIcon = PromptIconKey | 'lock';
export type CritterMood = 'neutral' | 'modeling' | 'curious' | 'celebrating';
export type HatchPhase = 'idle' | 'shake' | 'crack' | 'pop';
export type TickleTone = 'playful' | 'grumpy';

export interface ParentChallenge {
  a: number;
  b: number;
}

export interface LearnRound {
  target: string;
  choices: string[];
  expiresAt: number;
}

export interface PlayRound {
  target: Side;
  expiresAt: number;
}

export interface PromptSuccessCue {
  icon: PromptIconKey;
  text: string;
}

export interface TickleCue {
  tone: TickleTone;
  text: string;
  subText: string;
  tick: number;
}

export const MODELING_DURATION_MS = 920;
export const CELEBRATION_DURATION_MS = 920;
export const PHASE_SMOOTH_DELAY_MS = 140;
export const STAR_ROW_BURST_MS = 960;

export const PROMPT_KEY_BY_INTENT: Record<Intent, MirrorActionKey> = {
  feedMeal: 'feedMeal',
  feedSnack: 'feedSnack',
  play: 'play',
  learn: 'learn',
  sleep: 'sleep'
};

export const MODEL_CLASS_BY_INTENT: Record<Intent, string> = {
  feedMeal: 'model-feed',
  feedSnack: 'model-feed',
  play: 'model-play',
  learn: 'model-learn',
  sleep: 'model-sleep'
};

export const PROMPT_ROWS: Array<{ key: MirrorActionKey; label: string }> = [
  { key: 'feedMeal', label: 'Feed meal' },
  { key: 'feedSnack', label: 'Feed snack' },
  { key: 'play', label: 'Play' },
  { key: 'learn', label: 'Learn' },
  { key: 'sleep', label: 'Sleep' }
];

export const PROMPT_ICON_OPTIONS: PromptIconKey[] = ['meal', 'snack', 'play', 'learn', 'sleep'];

export const EGG_META: Record<EggStyle, { name: string; blurb: string; variant: string }> = {
  speckled: {
    name: 'Speckled Egg',
    blurb: 'Warm and sunny friend',
    variant: 'Sunny'
  },
  striped: {
    name: 'Striped Egg',
    blurb: 'Bold and playful friend',
    variant: 'Stripe'
  },
  star: {
    name: 'Star Egg',
    blurb: 'Dreamy space friend',
    variant: 'Astro'
  },
  leaf: {
    name: 'Leaf Egg',
    blurb: 'Calm nature friend',
    variant: 'Forest'
  }
};

export function initGameState(): GameState {
  const nowTs = Date.now();
  const loaded = loadState(undefined, nowTs);
  const deltaMinutes = Math.max(0, (nowTs - loaded.lastUpdateTs) / 60000);
  const hydrated = applyTimeDecay(loaded, deltaMinutes, nowTs);
  saveState(hydrated);
  return hydrated;
}

export function stageLabel(state: GameState): string {
  const stageCore = state.stage[0].toUpperCase() + state.stage.slice(1);

  if (state.stage === 'adult') {
    return `${stageCore} ${state.adultVariant}`;
  }

  if (state.stage === 'egg' && state.eggStyle) {
    return `${stageCore} (${EGG_META[state.eggStyle].name})`;
  }

  return stageCore;
}

export function randomSide(): Side {
  return Math.random() > 0.5 ? 'left' : 'right';
}

export function randomChallenge(): ParentChallenge {
  const a = Math.floor(Math.random() * 8) + 1;
  const b = Math.floor(Math.random() * 8) + 1;
  return { a, b };
}

export function makeLearnRound(): LearnRound {
  const pool = ['A', 'B', 'C'];
  const target = pool[Math.floor(Math.random() * pool.length)];
  const choices = [...pool].sort(() => Math.random() - 0.5);

  return {
    target,
    choices,
    expiresAt: Date.now() + 20000
  };
}

export function isNight(clockTs: number): boolean {
  const hour = new Date(clockTs).getHours();
  return hour >= 19 || hour < 6;
}

export function defaultPromptIconForIntent(intent: Intent): PromptIconKey {
  return DEFAULT_PROMPT_ICONS[PROMPT_KEY_BY_INTENT[intent]];
}

export function successCueForIntent(intent: Intent): PromptSuccessCue {
  if (intent === 'feedMeal') {
    return { icon: 'meal', text: 'Yum! Great job!' };
  }

  if (intent === 'feedSnack') {
    return { icon: 'snack', text: 'Nice snack choice!' };
  }

  if (intent === 'play') {
    return { icon: 'play', text: 'Awesome play time!' };
  }

  if (intent === 'learn') {
    return { icon: 'learn', text: 'Great learning!' };
  }

  return { icon: 'sleep', text: 'Bedtime win!' };
}

export function getConfirmTitle(confirmAction: ConfirmAction): string {
  if (confirmAction === 'restart') {
    return 'Restart Pet?';
  }

  if (confirmAction === 'hatchEarly') {
    return 'Hatch Early?';
  }

  return '';
}

export function getConfirmBody(confirmAction: ConfirmAction): string {
  if (confirmAction === 'restart') {
    return 'This clears the current pet and returns to egg selection.';
  }

  return 'This moves your pet to the next stage immediately.';
}
