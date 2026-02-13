import {
  ADULT_VARIANT_THRESHOLDS,
  ATTENTION,
  CAPS,
  DECAY,
  DEFAULT_SETTINGS,
  EGG_TO_VARIANT,
  GAME_LOOP,
  POOP,
  REWARDS,
  SCOLD,
  SICKNESS,
  STAGE_DURATIONS_MS,
  STAGE_ORDER
} from './constants';
import { calculateAgeDays, canSleepNow, isWithinSleepWindow, toIsoDate } from './time';
import type {
  ActionOutcome,
  ActionType,
  AdultVariant,
  CareScoreSnapshot,
  CritterVariant,
  GameState,
  ParentSettings,
  Stage
} from './types';

function clamp(value: number, min = CAPS.minMeter, max = CAPS.maxMeter): number {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min: number, max: number, rng: () => number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function scoreOf(state: GameState): number {
  return (state.hunger + state.happiness + state.training) / 3;
}

function trimHistory(history: CareScoreSnapshot[], nowTs: number): CareScoreSnapshot[] {
  const cutoff = nowTs - 24 * 60 * 60 * 1000;
  return history.filter((entry) => entry.ts >= cutoff);
}

function rollChance(chance: number, rng: () => number): boolean {
  if (chance <= 0) {
    return false;
  }
  return rng() < Math.min(1, chance);
}

function resolveAdultVariant(careScore: number): AdultVariant {
  if (careScore >= ADULT_VARIANT_THRESHOLDS.A) {
    return 'A';
  }
  if (careScore >= ADULT_VARIANT_THRESHOLDS.B) {
    return 'B';
  }
  return 'C';
}

function averageCareScore(history: CareScoreSnapshot[]): number {
  if (history.length === 0) {
    return 50;
  }

  const total = history.reduce((sum, item) => sum + item.score, 0);
  return total / history.length;
}

function nextStage(current: Stage): Stage | null {
  const index = STAGE_ORDER.indexOf(current);
  if (index < 0 || index >= STAGE_ORDER.length - 1) {
    return null;
  }
  return STAGE_ORDER[index + 1];
}

function resolveCritterVariant(state: GameState): CritterVariant {
  if (state.critterVariant) {
    return state.critterVariant;
  }

  if (state.eggStyle) {
    return EGG_TO_VARIANT[state.eggStyle];
  }

  return 'sunny';
}

function withSnapshot(state: GameState, nowTs: number): GameState {
  if (nowTs - state.lastCareSnapshotTs < GAME_LOOP.careSnapshotMinutes * 60000) {
    return state;
  }

  const nextHistory = trimHistory(
    [...state.careScoreHistory, { ts: nowTs, score: scoreOf(state) }],
    nowTs
  );

  return {
    ...state,
    careScoreHistory: nextHistory,
    lastCareSnapshotTs: nowTs
  };
}

function withDailyResets(state: GameState, nowTs: number): GameState {
  const today = toIsoDate(nowTs);
  if (state.lastSnackResetDate === today) {
    return state;
  }

  return {
    ...state,
    snackCountToday: 0,
    lastSnackResetDate: today
  };
}

function scaledGain(amount: number, sickness: boolean): number {
  if (amount <= 0) {
    return amount;
  }
  return sickness ? amount * 0.7 : amount;
}

export function createInitialState(
  nowTs = Date.now(),
  settings: ParentSettings = DEFAULT_SETTINGS,
  rng: () => number = Math.random
): GameState {
  const baseDate = toIsoDate(nowTs);

  return {
    hunger: 70,
    happiness: 70,
    training: 30,
    weight: 8,
    eggStyle: null,
    critterVariant: null,
    stage: 'egg',
    ageDays: 0,
    asleep: false,
    sickness: false,
    poopCount: 0,
    snackCountToday: 0,
    lastSnackResetDate: baseDate,
    lastUpdateTs: nowTs,
    careScoreHistory: [{ ts: nowTs, score: 56.67 }],
    adultVariant: 'C',
    attentionDemand: { active: false, reason: null, ts: nowTs },
    settings,
    stageStartedTs: nowTs,
    createdTs: nowTs,
    poopProgressMinutes: 0,
    nextPoopInMinutes: randomBetween(POOP.minMinutes, POOP.maxMinutes, rng),
    sickMinutes: 0,
    criticalMinutes: 0,
    medicineStepsRemaining: 0,
    dead: false,
    lastCareSnapshotTs: nowTs
  };
}

export function advanceStageIfNeeded(state: GameState, nowTs: number): GameState {
  let next = state;

  while (true) {
    const duration = STAGE_DURATIONS_MS[next.stage];
    if (duration === Number.POSITIVE_INFINITY) {
      break;
    }

    if (nowTs - next.stageStartedTs < duration) {
      break;
    }

    const upcoming = nextStage(next.stage);
    if (!upcoming) {
      break;
    }

    next = {
      ...next,
      stage: upcoming,
      stageStartedTs: next.stageStartedTs + duration
    };

    if (upcoming === 'baby') {
      next = {
        ...next,
        critterVariant: resolveCritterVariant(next)
      };
    }

    if (upcoming === 'adult') {
      const history = trimHistory(next.careScoreHistory, nowTs);
      const careScore = averageCareScore(history);
      next = {
        ...next,
        adultVariant: resolveAdultVariant(careScore)
      };
    }
  }

  return next;
}

export function maybeSpawnPoop(
  state: GameState,
  deltaMinutes: number,
  rng: () => number = Math.random
): GameState {
  if (state.dead || state.asleep || deltaMinutes <= 0) {
    return state;
  }

  let progress = state.poopProgressMinutes + deltaMinutes;
  let poopCount = state.poopCount;
  let threshold = state.nextPoopInMinutes;

  while (progress >= threshold) {
    poopCount += 1;
    progress -= threshold;
    threshold = randomBetween(POOP.minMinutes, POOP.maxMinutes, rng);
  }

  return {
    ...state,
    poopCount,
    poopProgressMinutes: progress,
    nextPoopInMinutes: threshold
  };
}

export function updateSickness(
  state: GameState,
  deltaMinutes: number,
  nowTs: number,
  rng: () => number = Math.random
): GameState {
  if (state.dead || deltaMinutes <= 0) {
    return state;
  }

  let next = { ...state };

  const lowNeeds =
    next.hunger <= SICKNESS.lowNeedsThreshold ||
    next.happiness <= SICKNESS.lowNeedsThreshold;

  if (!next.sickness) {
    const poopChance = next.poopCount > 0 ? SICKNESS.poopRiskPerMinute * deltaMinutes : 0;
    const lowNeedsChance = lowNeeds ? SICKNESS.lowNeedsRiskPerMinute * deltaMinutes : 0;

    if (rollChance(poopChance + lowNeedsChance, rng)) {
      next.sickness = true;
      next.sickMinutes = 0;
      next.medicineStepsRemaining = randomBetween(1, 2, rng);
    }
  }

  if (next.sickness) {
    next.sickMinutes += deltaMinutes;
  }

  const critical =
    next.hunger <= SICKNESS.criticalThreshold || next.happiness <= SICKNESS.criticalThreshold;

  if (critical && next.sickness) {
    next.criticalMinutes += deltaMinutes;
  } else {
    next.criticalMinutes = Math.max(0, next.criticalMinutes - deltaMinutes * 0.5);
  }

  const shouldDie =
    next.criticalMinutes >= SICKNESS.criticalMinutesToDeath ||
    (next.sickMinutes >= SICKNESS.maxUntreatedMinutes && critical);

  if (shouldDie) {
    next.dead = true;
    next.asleep = false;
    next.attentionDemand = {
      active: false,
      reason: null,
      ts: nowTs
    };
  }

  return next;
}

function maybeUpdateAttention(state: GameState, deltaMinutes: number, nowTs: number): GameState {
  if (state.dead || state.attentionDemand.active || deltaMinutes <= 0) {
    return state;
  }

  const bored = state.happiness < ATTENTION.boredomThreshold;
  const chance = ATTENTION.randomDemandChancePerMinute * deltaMinutes;
  if (!rollChance(chance, Math.random) && !bored) {
    return state;
  }

  return {
    ...state,
    attentionDemand: {
      active: true,
      reason: bored ? 'bored' : 'random',
      ts: nowTs
    }
  };
}

export function applyTimeDecay(
  state: GameState,
  deltaMinutes: number,
  nowTs = Date.now(),
  rng: () => number = Math.random
): GameState {
  const normalizedDelta = Math.max(0, deltaMinutes);
  let next = withDailyResets(state, nowTs);

  if (normalizedDelta <= 0) {
    return {
      ...next,
      ageDays: calculateAgeDays(next.createdTs, nowTs),
      lastUpdateTs: nowTs
    };
  }

  if (next.dead) {
    return {
      ...next,
      ageDays: calculateAgeDays(next.createdTs, nowTs),
      lastUpdateTs: nowTs
    };
  }

  if (next.settings.pauseDecay) {
    return {
      ...next,
      ageDays: calculateAgeDays(next.createdTs, nowTs),
      lastUpdateTs: nowTs
    };
  }

  const multiplier = next.asleep ? DECAY.asleepMultiplier : 1;
  const hungerDecay = DECAY.hungerPerMinute * normalizedDelta * multiplier;
  const happinessDecay = DECAY.happinessPerMinute * normalizedDelta * multiplier;
  const trainingDecay = DECAY.trainingPerMinute * normalizedDelta * multiplier;

  let happinessPenalty = 0;
  if (next.poopCount > 0) {
    happinessPenalty += DECAY.poopHappinessPenaltyPerMinute * normalizedDelta;
  }

  if (next.sickness) {
    happinessPenalty += DECAY.sickHappinessPenaltyPerMinute * normalizedDelta;
  }

  next = {
    ...next,
    hunger: clamp(next.hunger - hungerDecay - (next.sickness ? DECAY.sickHungerPenaltyPerMinute * normalizedDelta : 0)),
    happiness: clamp(next.happiness - happinessDecay - happinessPenalty),
    training: clamp(next.training - trainingDecay)
  };

  next = maybeSpawnPoop(next, normalizedDelta, rng);

  if (next.asleep && !isWithinSleepWindow(nowTs, next.settings.sleepWindow)) {
    next = {
      ...next,
      asleep: false
    };
  }

  next = updateSickness(next, normalizedDelta, nowTs, rng);
  next = maybeUpdateAttention(next, normalizedDelta, nowTs);
  next = withSnapshot(next, nowTs);
  next = advanceStageIfNeeded(next, nowTs);

  return {
    ...next,
    ageDays: calculateAgeDays(next.createdTs, nowTs),
    careScoreHistory: trimHistory(next.careScoreHistory, nowTs),
    lastUpdateTs: nowTs
  };
}

export function applyActionReward(
  state: GameState,
  actionType: ActionType,
  outcome: ActionOutcome = {},
  nowTs = Date.now(),
  rng: () => number = Math.random
): GameState {
  const ready = withDailyResets(state, nowTs);

  if (actionType !== 'restart' && ready.dead) {
    return {
      ...ready,
      lastUpdateTs: nowTs
    };
  }

  if (actionType === 'restart') {
    const settings = outcome.preserveSettingsOnRestart ? ready.settings : DEFAULT_SETTINGS;
    return createInitialState(nowTs, settings, rng);
  }

  let next = { ...ready };

  const gainFrom = (reward: { hunger: number; happiness: number; training: number; weight: number }) => {
    next = {
      ...next,
      hunger: clamp(next.hunger + scaledGain(reward.hunger, next.sickness)),
      happiness: clamp(next.happiness + scaledGain(reward.happiness, next.sickness)),
      training: clamp(next.training + scaledGain(reward.training, next.sickness)),
      weight: Math.max(1, Math.round(next.weight + reward.weight))
    };
  };

  switch (actionType) {
    case 'feedMeal': {
      gainFrom(REWARDS.feedMeal);
      next.attentionDemand = { active: false, reason: null, ts: nowTs };
      break;
    }
    case 'feedSnack': {
      if (next.snackCountToday >= CAPS.snackPerDay) {
        break;
      }
      gainFrom(REWARDS.feedSnack);
      next.snackCountToday += 1;
      next.attentionDemand = { active: false, reason: null, ts: nowTs };
      break;
    }
    case 'playWin': {
      gainFrom(REWARDS.playWin);
      next.attentionDemand = { active: false, reason: null, ts: nowTs };
      break;
    }
    case 'playLoss': {
      gainFrom(REWARDS.playLoss);
      next.attentionDemand = { active: false, reason: null, ts: nowTs };
      break;
    }
    case 'learnCorrect': {
      gainFrom(REWARDS.learnCorrect);
      break;
    }
    case 'learnWrong': {
      gainFrom(REWARDS.learnWrong);
      break;
    }
    case 'sleep': {
      const allowed =
        outcome.allowSleep ??
        canSleepNow(nowTs, next.settings.sleepWindow, next.settings.parentOverrideSleep);

      if (allowed) {
        next.asleep = true;
      }
      break;
    }
    case 'wake': {
      next.asleep = false;
      break;
    }
    case 'clean': {
      next.poopCount = 0;
      break;
    }
    case 'medicine': {
      if (!next.sickness) {
        break;
      }

      if (next.medicineStepsRemaining > 1) {
        next.medicineStepsRemaining -= 1;
      } else if (next.medicineStepsRemaining === 1 || rollChance(0.55, rng)) {
        next.sickness = false;
        next.sickMinutes = 0;
        next.criticalMinutes = 0;
        next.medicineStepsRemaining = 0;
      }
      break;
    }
    case 'praise': {
      gainFrom(REWARDS.praise);
      next.attentionDemand = { active: false, reason: null, ts: nowTs };
      break;
    }
    case 'scold': {
      if (next.attentionDemand.active) {
        next = {
          ...next,
          training: clamp(next.training + SCOLD.needed.training),
          happiness: clamp(next.happiness + SCOLD.needed.happiness),
          attentionDemand: { active: false, reason: null, ts: nowTs }
        };
      } else {
        next = {
          ...next,
          happiness: clamp(next.happiness + SCOLD.unnecessary.happiness)
        };
      }
      break;
    }
    case 'hatchEarly': {
      if (next.stage === 'adult') {
        break;
      }

      const upcoming = next.stage === 'egg' ? 'baby' : nextStage(next.stage);
      if (!upcoming) {
        break;
      }

      next = {
        ...next,
        stage: upcoming,
        stageStartedTs: nowTs
      };

      if (upcoming === 'baby') {
        next = {
          ...next,
          critterVariant: resolveCritterVariant(next)
        };
      }

      if (upcoming === 'adult') {
        const history = trimHistory(next.careScoreHistory, nowTs);
        const careScore = averageCareScore(history);
        next = {
          ...next,
          adultVariant: resolveAdultVariant(careScore)
        };
      }
      break;
    }
    default:
      break;
  }

  next = withSnapshot(next, nowTs);
  next = advanceStageIfNeeded(next, nowTs);

  return {
    ...next,
    ageDays: calculateAgeDays(next.createdTs, nowTs),
    careScoreHistory: trimHistory(next.careScoreHistory, nowTs),
    lastUpdateTs: nowTs
  };
}
