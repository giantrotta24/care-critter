import { EGG_TO_VARIANT } from './constants';
import { applyActionReward, applyTimeDecay } from './engine';
import type {
  ActionOutcome,
  ActionType,
  CurrentPhase,
  EggStyle,
  GameState,
  ParentSettings
} from './types';

export type GameReducerAction =
  | { type: 'tick'; nowTs: number }
  | { type: 'applyAction'; actionType: ActionType; outcome?: ActionOutcome; nowTs: number }
  | { type: 'setEggStyle'; eggStyle: EggStyle; nowTs: number }
  | { type: 'setSettings'; settings: ParentSettings; nowTs: number }
  | { type: 'setCurrentPhase'; phase: CurrentPhase }
  | { type: 'recordMirrorSuccess'; nowTs: number }
  | { type: 'resetStarsToday' }
  | { type: 'importState'; state: GameState; nowTs: number };

function elapsedMinutes(lastTs: number, nowTs: number): number {
  return Math.max(0, (nowTs - lastTs) / 60000);
}

export function gameReducer(state: GameState, action: GameReducerAction): GameState {
  switch (action.type) {
    case 'tick': {
      const delta = elapsedMinutes(state.lastUpdateTs, action.nowTs);
      return applyTimeDecay(state, delta, action.nowTs);
    }
    case 'applyAction': {
      const delta = elapsedMinutes(state.lastUpdateTs, action.nowTs);
      const decayed = applyTimeDecay(state, delta, action.nowTs);
      return applyActionReward(
        decayed,
        action.actionType,
        action.outcome ?? {},
        action.nowTs
      );
    }
    case 'setSettings': {
      const delta = elapsedMinutes(state.lastUpdateTs, action.nowTs);
      const decayed = applyTimeDecay(state, delta, action.nowTs);
      return {
        ...decayed,
        settings: action.settings,
        lastUpdateTs: action.nowTs
      };
    }
    case 'setEggStyle': {
      const delta = elapsedMinutes(state.lastUpdateTs, action.nowTs);
      const decayed = applyTimeDecay(state, delta, action.nowTs);
      return {
        ...decayed,
        eggStyle: action.eggStyle,
        critterVariant: EGG_TO_VARIANT[action.eggStyle],
        lastUpdateTs: action.nowTs
      };
    }
    case 'setCurrentPhase': {
      return {
        ...state,
        currentPhase: action.phase
      };
    }
    case 'recordMirrorSuccess': {
      const delta = elapsedMinutes(state.lastUpdateTs, action.nowTs);
      const decayed = applyTimeDecay(state, delta, action.nowTs);
      const successfulMirrorsToday = decayed.successfulMirrorsToday + 1;
      return {
        ...decayed,
        starsToday: Math.min(5, decayed.starsToday + 1),
        totalStars: decayed.totalStars + 1,
        successfulMirrorsToday,
        bestDayRecord: Math.max(decayed.bestDayRecord, successfulMirrorsToday),
        lastUpdateTs: action.nowTs
      };
    }
    case 'resetStarsToday': {
      return {
        ...state,
        starsToday: 0
      };
    }
    case 'importState': {
      return {
        ...action.state,
        lastUpdateTs: action.nowTs
      };
    }
    default:
      return state;
  }
}
