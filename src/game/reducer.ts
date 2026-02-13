import { applyActionReward, applyTimeDecay } from './engine';
import type { ActionOutcome, ActionType, GameState, ParentSettings } from './types';

export type GameReducerAction =
  | { type: 'tick'; nowTs: number }
  | { type: 'applyAction'; actionType: ActionType; outcome?: ActionOutcome; nowTs: number }
  | { type: 'setSettings'; settings: ParentSettings; nowTs: number }
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
