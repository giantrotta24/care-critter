import type {
  CritterVariant,
  EggStyle,
  MirrorActionKey,
  ParentSettings,
  PromptIconKey,
  Stage
} from './types';

export const STORAGE_KEY = 'care-critter-state-v1';
export const PARENT_HINT_KEY = 'care-critter-parent-hint-v1';

export const EGG_STYLES: EggStyle[] = ['speckled', 'striped', 'star', 'leaf'];

export const EGG_TO_VARIANT: Record<EggStyle, CritterVariant> = {
  speckled: 'sunny',
  striped: 'stripe',
  star: 'astro',
  leaf: 'forest'
};

export const DEFAULT_PROMPT_ICONS: Record<MirrorActionKey, PromptIconKey> = {
  feedMeal: 'meal',
  feedSnack: 'snack',
  play: 'play',
  learn: 'learn',
  sleep: 'sleep'
};

export const DECAY = {
  hungerPerMinute: 0.4,
  happinessPerMinute: 0.15,
  trainingPerMinute: 0.02,
  asleepMultiplier: 0.4,
  poopHappinessPenaltyPerMinute: 0.07,
  sickHungerPenaltyPerMinute: 0.08,
  sickHappinessPenaltyPerMinute: 0.05
} as const;

export const SICKNESS = {
  poopRiskPerMinute: 0.004,
  lowNeedsRiskPerMinute: 0.005,
  lowNeedsThreshold: 20,
  criticalThreshold: 5,
  criticalMinutesToDeath: 180,
  maxUntreatedMinutes: 900
} as const;

export const POOP = {
  minMinutes: 60,
  maxMinutes: 120
} as const;

export const CAPS = {
  snackPerDay: 3,
  maxMeter: 100,
  minMeter: 0
} as const;

export const GAME_LOOP = {
  tickSeconds: 25,
  autosaveSeconds: 20,
  careSnapshotMinutes: 10
} as const;

export const EGG_HATCH = {
  defaultSeconds: 5 * 60,
  minSeconds: 15,
  maxSeconds: 60 * 60
} as const;

export const STAGE_DURATIONS_MS: Record<Stage, number> = {
  egg: EGG_HATCH.defaultSeconds * 1000,
  baby: 24 * 60 * 60 * 1000,
  child: 2 * 24 * 60 * 60 * 1000,
  teen: 2 * 24 * 60 * 60 * 1000,
  adult: Number.POSITIVE_INFINITY
};

export const STAGE_ORDER: Stage[] = ['egg', 'baby', 'child', 'teen', 'adult'];

export const REWARDS = {
  feedMeal: { hunger: 25, happiness: 2, training: 0, weight: 1 },
  feedSnack: { hunger: 8, happiness: 10, training: 0, weight: 2 },
  playWin: { hunger: 0, happiness: 10, training: 1, weight: 0 },
  playLoss: { hunger: 0, happiness: 5, training: 1, weight: 0 },
  learnCorrect: { hunger: 0, happiness: 2, training: 10, weight: 0 },
  learnWrong: { hunger: 0, happiness: 2, training: 5, weight: 0 },
  praise: { hunger: 0, happiness: 3, training: 3, weight: 0 }
} as const;

export const SCOLD = {
  needed: { training: 5, happiness: -2 },
  unnecessary: { training: 0, happiness: -5 }
} as const;

export const DEFAULT_SETTINGS: ParentSettings = {
  mirrorEnabled: true,
  hatchSoundEnabled: false,
  confirmMode: 'parent',
  timerSeconds: 10,
  eggHatchSeconds: EGG_HATCH.defaultSeconds,
  perActionPrompts: {
    feedMeal: {
      promptText: 'Take one bite at the table.',
      promptIcon: 'meal'
    },
    feedSnack: {
      promptText: 'Choose a healthy snack and take one bite.',
      promptIcon: 'snack'
    },
    play: {
      promptText: 'Move your body for 10 seconds.',
      promptIcon: 'play'
    },
    learn: {
      promptText: 'Say the letter out loud.',
      promptIcon: 'learn'
    },
    sleep: {
      promptText: 'Time for bedtime routine.',
      promptIcon: 'sleep'
    }
  },
  pauseDecay: false,
  sleepWindow: {
    start: '19:00',
    end: '07:00'
  },
  parentOverrideSleep: false
};

export const ADULT_VARIANT_THRESHOLDS = {
  A: 75,
  B: 50
} as const;

export const ATTENTION = {
  randomDemandChancePerMinute: 0.01,
  boredomThreshold: 40
} as const;
