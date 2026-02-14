import type { Dispatch, JSX, SetStateAction } from 'react';
import { HoldToConfirmButton } from '../HoldToConfirmButton';
import { Modal } from '../Modal';
import {
  PROMPT_ICON_OPTIONS,
  PROMPT_ROWS,
  getConfirmBody,
  getConfirmTitle,
  type ConfirmAction,
  type Intent,
  type LearnRound,
  type PlayRound,
  type Side
} from '../../app/model';
import { DEFAULT_PROMPT_ICONS, EGG_HATCH } from '../../game/constants';
import type { ActionType, GameState, ParentSettings, PromptIconKey } from '../../game/types';
import { LearnTargetCard, MirrorCueArt } from './visuals';
import { TimerConfirm } from './TimerConfirm';

interface FeedModalProps {
  open: boolean;
  snacksRemaining: number;
  onClose: () => void;
  onRequestIntent: (intent: Intent) => void;
}

export function FeedModal({ open, snacksRemaining, onClose, onRequestIntent }: FeedModalProps): JSX.Element {
  return (
    <Modal open={open} title="Feed" onClose={onClose}>
      <div className="sheet-body">
        <button type="button" className="primary-btn" onClick={() => onRequestIntent('feedMeal')}>
          Meal
        </button>
        <button type="button" className="secondary-btn" onClick={() => onRequestIntent('feedSnack')}>
          Snack ({snacksRemaining} left)
        </button>
        <p className="helper-text">Meals fill more. Snacks are capped at 3 per day.</p>
      </div>
    </Modal>
  );
}

interface StatusModalProps {
  open: boolean;
  state: GameState;
  onClose: () => void;
  onDoAction: (actionType: ActionType) => void;
  onShowMessage: (message: string) => void;
}

export function StatusModal({
  open,
  state,
  onClose,
  onDoAction,
  onShowMessage
}: StatusModalProps): JSX.Element {
  return (
    <Modal open={open} title="Status" onClose={onClose}>
      <div className="sheet-body">
        <div className="status-stat-grid">
          <div className="status-stat-card">
            <span>📅</span>
            <strong>{state.ageDays} day(s)</strong>
            <small>Age</small>
          </div>
          <div className="status-stat-card">
            <span>⚖️</span>
            <strong>{state.weight}</strong>
            <small>Weight</small>
          </div>
          <div className="status-stat-card">
            <span>💩</span>
            <strong>{state.poopCount}</strong>
            <small>Poop</small>
          </div>
        </div>

        <div className="status-lines">
          <p>
            Sleep window: {state.settings.sleepWindow.start} - {state.settings.sleepWindow.end}
          </p>
          <p>Variant: {state.critterVariant ? state.critterVariant : 'Unknown'}</p>
        </div>

        <div className="status-actions-grid">
          <button type="button" className="secondary-btn" onClick={() => onDoAction('clean')}>
            Clean
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              onDoAction('medicine');
              onShowMessage('Medicine given.');
            }}
          >
            Medicine
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              onDoAction('praise');
              onShowMessage('Praise shared.');
            }}
          >
            Praise
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              onDoAction('scold');
              onShowMessage('Scold used.');
            }}
          >
            Scold
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface MirrorPromptModalProps {
  open: boolean;
  promptIcon: PromptIconKey;
  promptText: string;
  confirmMode: ParentSettings['confirmMode'];
  timerSeconds: number;
  onResolveMirrorDone: () => void;
  onCancelMirror: () => void;
  onTimerReadyChange: (ready: boolean) => void;
}

export function MirrorPromptModal({
  open,
  promptIcon,
  promptText,
  confirmMode,
  timerSeconds,
  onResolveMirrorDone,
  onCancelMirror,
  onTimerReadyChange
}: MirrorPromptModalProps): JSX.Element {
  return (
    <Modal open={open} title="Mirror Prompt" onClose={onCancelMirror} className="mirror-modal">
      <div className="mirror-body">
        <div className="mirror-icon">
          <MirrorCueArt icon={promptIcon} />
        </div>
        <p className="mirror-text">{promptText}</p>
        {confirmMode === 'parent' ? (
          <HoldToConfirmButton
            label="Hold to finish"
            helperText="Grown-up holds for 2 seconds"
            onConfirm={onResolveMirrorDone}
          />
        ) : (
          <TimerConfirm
            seconds={timerSeconds}
            onConfirm={onResolveMirrorDone}
            label="Done"
            onReadyChange={onTimerReadyChange}
          />
        )}
        <button type="button" className="secondary-btn" onClick={onCancelMirror}>
          Not now
        </button>
      </div>
    </Modal>
  );
}

interface PlayModalProps {
  playRound: PlayRound | null;
  playSecondsLeft: number;
  onClose: () => void;
  onChooseSide: (side: Side) => void;
}

export function PlayModal({
  playRound,
  playSecondsLeft,
  onClose,
  onChooseSide
}: PlayModalProps): JSX.Element {
  return (
    <Modal open={Boolean(playRound)} title="Play: Catch the Star" onClose={onClose}>
      <div className="minigame">
        <p>Pick where the star hides. Time left: {playSecondsLeft}s</p>
        <div className="choice-row">
          <button type="button" className="primary-btn" onClick={() => onChooseSide('left')}>
            Left ⭐
          </button>
          <button type="button" className="primary-btn" onClick={() => onChooseSide('right')}>
            Right ⭐
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface LearnModalProps {
  learnRound: LearnRound | null;
  learnSecondsLeft: number;
  onClose: () => void;
  onChooseLetter: (letter: string) => void;
}

export function LearnModal({
  learnRound,
  learnSecondsLeft,
  onClose,
  onChooseLetter
}: LearnModalProps): JSX.Element {
  return (
    <Modal open={Boolean(learnRound)} title="Learn: Find the Letter" onClose={onClose}>
      <div className="minigame">
        {learnRound && (
          <>
            <p>
              Tap <strong>{learnRound.target}</strong>. Time left: {learnSecondsLeft}s
            </p>
            <LearnTargetCard letter={learnRound.target} />
            <div className="choice-row">
              {learnRound.choices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className="primary-btn"
                  onClick={() => onChooseLetter(choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

interface ParentChallengeModalProps {
  open: boolean;
  challengeA: number;
  challengeB: number;
  challengeAnswer: string;
  onClose: () => void;
  onChallengeAnswerChange: (nextValue: string) => void;
  onSubmit: () => void;
}

export function ParentChallengeModal({
  open,
  challengeA,
  challengeB,
  challengeAnswer,
  onClose,
  onChallengeAnswerChange,
  onSubmit
}: ParentChallengeModalProps): JSX.Element {
  return (
    <Modal open={open} title="Parent Check" onClose={onClose}>
      <div className="parent-gate-form">
        <p>
          Solve: {challengeA} + {challengeB}
        </p>
        <input
          className="text-input"
          inputMode="numeric"
          value={challengeAnswer}
          onChange={(event) => onChallengeAnswerChange(event.target.value)}
          placeholder="Answer"
        />
        <button type="button" className="primary-btn" onClick={onSubmit}>
          Open Parent Mode
        </button>
      </div>
    </Modal>
  );
}

interface ParentPanelModalProps {
  open: boolean;
  state: GameState;
  settingsDraft: ParentSettings;
  setSettingsDraft: Dispatch<SetStateAction<ParentSettings>>;
  exportText: string;
  importText: string;
  onClose: () => void;
  onApplySettings: () => void;
  onSetConfirmAction: (action: 'restart' | 'hatchEarly') => void;
  onExportSave: () => void;
  onImportSave: () => void;
  onImportTextChange: (text: string) => void;
}

export function ParentPanelModal({
  open,
  state,
  settingsDraft,
  setSettingsDraft,
  exportText,
  importText,
  onClose,
  onApplySettings,
  onSetConfirmAction,
  onExportSave,
  onImportSave,
  onImportTextChange
}: ParentPanelModalProps): JSX.Element {
  return (
    <Modal open={open} title="Parent Mode" onClose={onClose}>
      <div className="parent-panel">
        <label className="switch-row">
          <span>Mirror Prompts</span>
          <input
            type="checkbox"
            checked={settingsDraft.mirrorEnabled}
            onChange={(event) =>
              setSettingsDraft((current) => ({
                ...current,
                mirrorEnabled: event.target.checked
              }))
            }
          />
        </label>

        <label className="switch-row">
          <span>Sound Effects</span>
          <input
            type="checkbox"
            checked={settingsDraft.hatchSoundEnabled}
            onChange={(event) =>
              setSettingsDraft((current) => ({
                ...current,
                hatchSoundEnabled: event.target.checked
              }))
            }
          />
        </label>

        <label className="switch-row">
          <span>Pause Decay</span>
          <input
            type="checkbox"
            checked={settingsDraft.pauseDecay}
            onChange={(event) =>
              setSettingsDraft((current) => ({
                ...current,
                pauseDecay: event.target.checked
              }))
            }
          />
        </label>

        <label className="switch-row">
          <span>Sleep Override</span>
          <input
            type="checkbox"
            checked={settingsDraft.parentOverrideSleep}
            onChange={(event) =>
              setSettingsDraft((current) => ({
                ...current,
                parentOverrideSleep: event.target.checked
              }))
            }
          />
        </label>

        <label className="field-label">
          Confirm Mode
          <select
            className="text-input"
            value={settingsDraft.confirmMode}
            onChange={(event) =>
              setSettingsDraft((current) => ({
                ...current,
                confirmMode: event.target.value as ParentSettings['confirmMode']
              }))
            }
          >
            <option value="parent">Parent hold-to-confirm</option>
            <option value="timer">Timer confirmation</option>
          </select>
        </label>

        {settingsDraft.confirmMode === 'timer' && (
          <label className="field-label">
            Timer seconds
            <input
              className="text-input"
              type="number"
              min={3}
              max={60}
              value={settingsDraft.timerSeconds}
              onChange={(event) =>
                setSettingsDraft((current) => ({
                  ...current,
                  timerSeconds: Math.max(3, Math.min(60, Number(event.target.value) || 10))
                }))
              }
            />
          </label>
        )}

        <label className="field-label">
          Egg hatch seconds
          <input
            className="text-input"
            type="number"
            min={EGG_HATCH.minSeconds}
            max={EGG_HATCH.maxSeconds}
            value={settingsDraft.eggHatchSeconds}
            onChange={(event) =>
              setSettingsDraft((current) => ({
                ...current,
                eggHatchSeconds: Math.max(
                  EGG_HATCH.minSeconds,
                  Math.min(EGG_HATCH.maxSeconds, Number(event.target.value) || EGG_HATCH.defaultSeconds)
                )
              }))
            }
          />
          <small>Set how long the egg stage lasts (for example 60 = 1 minute).</small>
        </label>

        <div className="listening-summary">
          <p>Great listening today: {state.successfulMirrorsToday} times</p>
          <p>Best day record: {state.bestDayRecord} times</p>
          <p>Total stars earned: {state.totalStars}</p>
        </div>

        <div className="field-row">
          <label className="field-label">
            Sleep start
            <input
              className="text-input"
              type="time"
              value={settingsDraft.sleepWindow.start}
              onChange={(event) =>
                setSettingsDraft((current) => ({
                  ...current,
                  sleepWindow: {
                    ...current.sleepWindow,
                    start: event.target.value
                  }
                }))
              }
            />
          </label>
          <label className="field-label">
            Sleep end
            <input
              className="text-input"
              type="time"
              value={settingsDraft.sleepWindow.end}
              onChange={(event) =>
                setSettingsDraft((current) => ({
                  ...current,
                  sleepWindow: {
                    ...current.sleepWindow,
                    end: event.target.value
                  }
                }))
              }
            />
          </label>
        </div>

        {PROMPT_ROWS.map((row) => (
          <div key={row.key} className="prompt-edit-card">
            <label className="field-label">
              {row.label} prompt
              <textarea
                className="text-input"
                value={settingsDraft.perActionPrompts[row.key].promptText}
                onChange={(event) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    perActionPrompts: {
                      ...current.perActionPrompts,
                      [row.key]: {
                        ...current.perActionPrompts[row.key],
                        promptText: event.target.value
                      }
                    }
                  }))
                }
              />
            </label>

            <label className="field-label">
              Prompt icon
              <select
                className="text-input"
                value={settingsDraft.perActionPrompts[row.key].promptIcon ?? DEFAULT_PROMPT_ICONS[row.key]}
                onChange={(event) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    perActionPrompts: {
                      ...current.perActionPrompts,
                      [row.key]: {
                        ...current.perActionPrompts[row.key],
                        promptIcon: event.target.value as PromptIconKey
                      }
                    }
                  }))
                }
              >
                {PROMPT_ICON_OPTIONS.map((iconOption) => (
                  <option key={iconOption} value={iconOption}>
                    {iconOption}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}

        <div className="button-row">
          <button type="button" className="primary-btn" onClick={onApplySettings}>
            Save Settings
          </button>
          <button type="button" className="secondary-btn" onClick={() => onSetConfirmAction('hatchEarly')}>
            Hatch Early
          </button>
        </div>

        <div className="button-row">
          <button type="button" className="secondary-btn" onClick={() => onSetConfirmAction('restart')}>
            Restart Pet
          </button>
          <button type="button" className="secondary-btn" onClick={onExportSave}>
            Export JSON
          </button>
        </div>

        <button type="button" className="secondary-btn" onClick={onImportSave}>
          Import JSON
        </button>

        <label className="field-label">
          Export data
          <textarea className="text-input" value={exportText} readOnly rows={5} />
        </label>

        <label className="field-label">
          Paste JSON to import
          <textarea
            className="text-input"
            value={importText}
            onChange={(event) => onImportTextChange(event.target.value)}
            rows={5}
          />
        </label>
      </div>
    </Modal>
  );
}

interface ConfirmActionModalProps {
  confirmAction: ConfirmAction;
  onClose: () => void;
  onRestart: () => void;
  onHatchEarly: () => void;
}

export function ConfirmActionModal({
  confirmAction,
  onClose,
  onRestart,
  onHatchEarly
}: ConfirmActionModalProps): JSX.Element {
  return (
    <Modal open={Boolean(confirmAction)} title={getConfirmTitle(confirmAction)} onClose={onClose}>
      <div className="sheet-body">
        <p>{getConfirmBody(confirmAction)}</p>
        <div className="button-row">
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              if (confirmAction === 'restart') {
                onRestart();
              }

              if (confirmAction === 'hatchEarly') {
                onHatchEarly();
              }
            }}
          >
            Yes, continue
          </button>
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
