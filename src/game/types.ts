export type Stage = 'egg' | 'baby' | 'child' | 'teen' | 'adult';
export type AdultVariant = 'A' | 'B' | 'C';
export type EggStyle = 'speckled' | 'striped' | 'star' | 'leaf';
export type CritterVariant = 'sunny' | 'stripe' | 'astro' | 'forest';
export type PromptIconKey = 'meal' | 'snack' | 'play' | 'learn' | 'sleep';
export type MirrorActionKey = 'feedMeal' | 'feedSnack' | 'play' | 'learn' | 'sleep';
export type ConfirmMode = 'parent' | 'timer';
export type AttentionReason = 'bored' | 'random' | null;

export interface AttentionDemand {
  active: boolean;
  reason: AttentionReason;
  ts: number;
}

export interface MirrorPromptConfig {
  promptText: string;
  promptIcon?: PromptIconKey;
}

export type PerActionPromptMap = Record<MirrorActionKey, MirrorPromptConfig>;

export interface ParentSettings {
  mirrorEnabled: boolean;
  hatchSoundEnabled: boolean;
  confirmMode: ConfirmMode;
  timerSeconds: number;
  perActionPrompts: PerActionPromptMap;
  pauseDecay: boolean;
  sleepWindow: {
    start: string;
    end: string;
  };
  parentOverrideSleep: boolean;
}

export interface CareScoreSnapshot {
  ts: number;
  score: number;
}

export interface GameState {
  hunger: number;
  happiness: number;
  training: number;
  weight: number;
  eggStyle: EggStyle | null;
  critterVariant: CritterVariant | null;
  stage: Stage;
  ageDays: number;
  asleep: boolean;
  sickness: boolean;
  poopCount: number;
  snackCountToday: number;
  lastSnackResetDate: string;
  lastUpdateTs: number;
  careScoreHistory: CareScoreSnapshot[];
  adultVariant: AdultVariant;
  attentionDemand: AttentionDemand;
  settings: ParentSettings;
  stageStartedTs: number;
  createdTs: number;
  poopProgressMinutes: number;
  nextPoopInMinutes: number;
  sickMinutes: number;
  criticalMinutes: number;
  medicineStepsRemaining: number;
  dead: boolean;
  lastCareSnapshotTs: number;
}

export interface SleepWindow {
  start: string;
  end: string;
}

export type ActionType =
  | 'feedMeal'
  | 'feedSnack'
  | 'playWin'
  | 'playLoss'
  | 'learnCorrect'
  | 'learnWrong'
  | 'sleep'
  | 'wake'
  | 'clean'
  | 'medicine'
  | 'praise'
  | 'scold'
  | 'hatchEarly'
  | 'restart';

export interface ActionOutcome {
  allowSleep?: boolean;
  preserveSettingsOnRestart?: boolean;
}
