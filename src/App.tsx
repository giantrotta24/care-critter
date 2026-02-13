import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { HoldToConfirmButton } from './components/HoldToConfirmButton';
import { Meter } from './components/Meter';
import { Modal } from './components/Modal';
import { CAPS, GAME_LOOP } from './game/constants';
import { applyTimeDecay } from './game/engine';
import { gameReducer } from './game/reducer';
import { loadState, saveState } from './game/storage';
import { canSleepNow, toIsoDate } from './game/time';
import type { ActionType, GameState, ParentSettings } from './game/types';

const TAB_ORDER = ['feed', 'play', 'learn', 'sleep', 'status'] as const;
type Tab = (typeof TAB_ORDER)[number];
type Intent = 'feedMeal' | 'feedSnack' | 'play' | 'learn' | 'sleep';
type Side = 'left' | 'right';

interface ParentChallenge {
  a: number;
  b: number;
}

interface LearnRound {
  target: string;
  choices: string[];
  expiresAt: number;
}

interface PlayRound {
  target: Side;
  expiresAt: number;
}

function initGameState(): GameState {
  const nowTs = Date.now();
  const loaded = loadState(undefined, nowTs);
  const deltaMinutes = Math.max(0, (nowTs - loaded.lastUpdateTs) / 60000);
  const hydrated = applyTimeDecay(loaded, deltaMinutes, nowTs);
  saveState(hydrated);
  return hydrated;
}

function stageEmoji(state: GameState): string {
  if (state.dead) {
    return '🕊️';
  }

  if (state.stage === 'egg') {
    return '🥚';
  }

  if (state.stage === 'baby') {
    return state.sickness ? '🤒' : '🐣';
  }

  if (state.stage === 'child') {
    return state.sickness ? '🤒' : '🐥';
  }

  if (state.stage === 'teen') {
    return state.sickness ? '🤒' : '🐱';
  }

  if (state.adultVariant === 'A') {
    return state.sickness ? '🤒' : '🦊';
  }

  if (state.adultVariant === 'B') {
    return state.sickness ? '🤒' : '🐶';
  }

  return state.sickness ? '🤒' : '🐼';
}

function stageLabel(state: GameState): string {
  const core = state.stage[0].toUpperCase() + state.stage.slice(1);
  if (state.stage === 'adult') {
    return `${core} (${state.adultVariant})`;
  }
  return core;
}

function randomSide(): Side {
  return Math.random() > 0.5 ? 'left' : 'right';
}

function randomChallenge(): ParentChallenge {
  const a = Math.floor(Math.random() * 8) + 1;
  const b = Math.floor(Math.random() * 8) + 1;
  return { a, b };
}

function makeLearnRound(): LearnRound {
  const pool = ['A', 'B', 'C'];
  const target = pool[Math.floor(Math.random() * pool.length)];
  const choices = [...pool].sort(() => Math.random() - 0.5);
  return {
    target,
    choices,
    expiresAt: Date.now() + 20000
  };
}

export default function App(): JSX.Element {
  const [state, dispatch] = useReducer(gameReducer, undefined, initGameState);
  const stateRef = useRef(state);

  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [pendingIntent, setPendingIntent] = useState<Intent | null>(null);
  const [toast, setToast] = useState<string>('');

  const [playRound, setPlayRound] = useState<PlayRound | null>(null);
  const [learnRound, setLearnRound] = useState<LearnRound | null>(null);

  const [parentHoldActive, setParentHoldActive] = useState(false);
  const parentGateTimerRef = useRef<number | null>(null);
  const [showParentChallenge, setShowParentChallenge] = useState(false);
  const [challenge, setChallenge] = useState<ParentChallenge>(() => randomChallenge());
  const [challengeAnswer, setChallengeAnswer] = useState('');

  const [showParentPanel, setShowParentPanel] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<ParentSettings>(state.settings);
  const [exportText, setExportText] = useState('');
  const [importText, setImportText] = useState('');

  const [clockTs, setClockTs] = useState(Date.now());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const tickId = window.setInterval(() => {
      dispatch({ type: 'tick', nowTs: Date.now() });
    }, GAME_LOOP.tickSeconds * 1000);

    return () => {
      window.clearInterval(tickId);
    };
  }, []);

  useEffect(() => {
    const saveId = window.setInterval(() => {
      saveState(stateRef.current);
    }, GAME_LOOP.autosaveSeconds * 1000);

    return () => {
      window.clearInterval(saveId);
    };
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const clockId = window.setInterval(() => {
      setClockTs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(clockId);
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const id = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (showParentPanel) {
      setSettingsDraft(state.settings);
    }
  }, [showParentPanel, state.settings]);

  const playSecondsLeft = playRound
    ? Math.max(0, Math.ceil((playRound.expiresAt - clockTs) / 1000))
    : 0;
  const learnSecondsLeft = learnRound
    ? Math.max(0, Math.ceil((learnRound.expiresAt - clockTs) / 1000))
    : 0;

  useEffect(() => {
    if (playRound && playSecondsLeft <= 0) {
      dispatch({ type: 'applyAction', actionType: 'playLoss', nowTs: Date.now() });
      setPlayRound(null);
      setToast('Play round timed out. Nice try!');
    }
  }, [playRound, playSecondsLeft]);

  useEffect(() => {
    if (learnRound && learnSecondsLeft <= 0) {
      dispatch({ type: 'applyAction', actionType: 'learnWrong', nowTs: Date.now() });
      setLearnRound(null);
      setToast('Learning round timed out. Keep practicing!');
    }
  }, [learnRound, learnSecondsLeft]);

  const snacksUsedToday =
    state.lastSnackResetDate === toIsoDate(Date.now()) ? state.snackCountToday : 0;
  const snacksRemaining = Math.max(0, CAPS.snackPerDay - snacksUsedToday);

  const mirrorPromptText = useMemo(() => {
    if (!pendingIntent) {
      return '';
    }

    switch (pendingIntent) {
      case 'feedMeal':
        return state.settings.perActionPrompts.feedMeal;
      case 'feedSnack':
        return state.settings.perActionPrompts.feedSnack;
      case 'play':
        return state.settings.perActionPrompts.play;
      case 'learn':
        return state.settings.perActionPrompts.learn;
      case 'sleep':
        return state.settings.perActionPrompts.sleep;
      default:
        return '';
    }
  }, [pendingIntent, state.settings.perActionPrompts]);

  const startParentGateHold = (): void => {
    setParentHoldActive(true);
    if (parentGateTimerRef.current) {
      window.clearTimeout(parentGateTimerRef.current);
    }

    parentGateTimerRef.current = window.setTimeout(() => {
      setChallenge(randomChallenge());
      setChallengeAnswer('');
      setShowParentChallenge(true);
      setParentHoldActive(false);
    }, 2000);
  };

  const stopParentGateHold = (): void => {
    setParentHoldActive(false);
    if (parentGateTimerRef.current) {
      window.clearTimeout(parentGateTimerRef.current);
      parentGateTimerRef.current = null;
    }
  };

  const showMessage = (message: string): void => {
    setToast(message);
  };

  const doAction = (actionType: ActionType): void => {
    dispatch({ type: 'applyAction', actionType, nowTs: Date.now() });
  };

  const continueIntent = (intent: Intent): void => {
    if (intent === 'feedMeal') {
      doAction('feedMeal');
      showMessage('Meal complete. Great care!');
      return;
    }

    if (intent === 'feedSnack') {
      if (snacksRemaining <= 0) {
        showMessage('Too many snacks today. Try Play or Learn.');
        return;
      }

      doAction('feedSnack');
      showMessage('Snack time complete.');
      return;
    }

    if (intent === 'play') {
      setPlayRound({
        target: randomSide(),
        expiresAt: Date.now() + 15000
      });
      return;
    }

    if (intent === 'learn') {
      setLearnRound(makeLearnRound());
      return;
    }

    if (intent === 'sleep') {
      if (state.asleep) {
        doAction('wake');
        showMessage('Your pet woke up.');
        return;
      }

      const allowed = canSleepNow(
        Date.now(),
        state.settings.sleepWindow,
        state.settings.parentOverrideSleep
      );

      if (!allowed) {
        showMessage('Sleep is outside the current sleep window.');
        return;
      }

      dispatch({
        type: 'applyAction',
        actionType: 'sleep',
        nowTs: Date.now(),
        outcome: { allowSleep: true }
      });
      showMessage('Bedtime started.');
    }
  };

  const requestIntent = (intent: Intent): void => {
    if (state.dead) {
      showMessage('Your pet is resting. Restart to play again.');
      return;
    }

    if (state.settings.mirrorEnabled) {
      setPendingIntent(intent);
      return;
    }

    continueIntent(intent);
  };

  const resolveMirrorDone = (): void => {
    if (!pendingIntent) {
      return;
    }

    const intent = pendingIntent;
    setPendingIntent(null);
    continueIntent(intent);
  };

  const cancelMirror = (): void => {
    setPendingIntent(null);
    showMessage('No worries. You can try again later.');
  };

  const submitParentChallenge = (): void => {
    const expected = challenge.a + challenge.b;
    const answer = Number(challengeAnswer);

    if (answer === expected) {
      setShowParentChallenge(false);
      setShowParentPanel(true);
      showMessage('Parent mode unlocked.');
      return;
    }

    showMessage('Math check did not match.');
  };

  const applySettings = (): void => {
    dispatch({ type: 'setSettings', settings: settingsDraft, nowTs: Date.now() });
    showMessage('Parent settings saved.');
  };

  const exportSave = (): void => {
    setExportText(JSON.stringify(state, null, 2));
    showMessage('Save exported below.');
  };

  const importSave = (): void => {
    try {
      const parsed = JSON.parse(importText) as GameState;
      dispatch({ type: 'importState', state: parsed, nowTs: Date.now() });
      setShowParentPanel(false);
      showMessage('Save imported.');
    } catch {
      showMessage('Import failed. Please paste valid JSON.');
    }
  };

  const restartGame = (): void => {
    dispatch({
      type: 'applyAction',
      actionType: 'restart',
      nowTs: Date.now(),
      outcome: { preserveSettingsOnRestart: true }
    });
    showMessage('New egg started.');
  };

  const handlePlayChoice = (side: Side): void => {
    if (!playRound) {
      return;
    }

    const won = side === playRound.target;
    dispatch({
      type: 'applyAction',
      actionType: won ? 'playWin' : 'playLoss',
      nowTs: Date.now()
    });
    setPlayRound(null);
    showMessage(won ? 'Nice! You caught the star.' : 'Missed this round, but good effort.');
  };

  const handleLearnChoice = (choice: string): void => {
    if (!learnRound) {
      return;
    }

    const correct = choice === learnRound.target;
    dispatch({
      type: 'applyAction',
      actionType: correct ? 'learnCorrect' : 'learnWrong',
      nowTs: Date.now()
    });
    setLearnRound(null);
    showMessage(correct ? 'Great learning!' : 'Good try, keep practicing.');
  };

  const clockLabel = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(clockTs);

  if (state.dead) {
    return (
      <div className="app-shell dead-screen">
        <div className="dead-content">
          <p className="pet dead">🕊️</p>
          <h1>Your pet went to rest</h1>
          <p>Let’s start a new egg when you’re ready.</p>
          <button type="button" className="primary-btn" onClick={restartGame}>
            Restart
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          type="button"
          className={`parent-gate ${parentHoldActive ? 'holding' : ''}`}
          aria-label="Open parent mode"
          onPointerDown={startParentGateHold}
          onPointerUp={stopParentGateHold}
          onPointerLeave={stopParentGateHold}
          onPointerCancel={stopParentGateHold}
        >
          •
        </button>
        <div className="top-meta">
          <span className="chip">Stage: {stageLabel(state)}</span>
          <span className="chip">Clock: {clockLabel}</span>
        </div>
      </header>

      <main className="main-view">
        <section className="pet-panel">
          <div className={`pet ${state.asleep ? 'asleep' : ''}`} aria-live="polite">
            {stageEmoji(state)}
          </div>
          {state.asleep && <p className="status-note">Sleeping... zZz</p>}
          {state.sickness && <p className="status-note warning">Feeling sick</p>}
          {state.attentionDemand.active && <p className="status-note attention">Needs attention!</p>}
          <div className="stats-strip">
            <span>Age: {state.ageDays} day(s)</span>
            <span>Weight: {state.weight}</span>
            <span>Poop: {state.poopCount}</span>
          </div>
        </section>

        <section className="meters">
          <Meter label="Hunger" value={state.hunger} accentClass="meter-hunger" />
          <Meter label="Happiness" value={state.happiness} accentClass="meter-happy" />
          <Meter label="Training" value={state.training} accentClass="meter-training" />
        </section>

        <section className="action-panel">
          {activeTab === 'feed' && (
            <div className="action-grid">
              <button type="button" className="primary-btn" onClick={() => requestIntent('feedMeal')}>
                Meal
              </button>
              <button type="button" className="secondary-btn" onClick={() => requestIntent('feedSnack')}>
                Snack ({snacksRemaining} left)
              </button>
              <p className="helper-text">Meals are stronger. Snacks are capped at 3 per day.</p>
            </div>
          )}

          {activeTab === 'play' && (
            <div className="action-grid">
              <button type="button" className="primary-btn" onClick={() => requestIntent('play')}>
                Start Star Guess
              </button>
              <p className="helper-text">Mirror prompt comes first, then 15 seconds to guess left or right.</p>
            </div>
          )}

          {activeTab === 'learn' && (
            <div className="action-grid">
              <button type="button" className="primary-btn" onClick={() => requestIntent('learn')}>
                Start Letter Game
              </button>
              <p className="helper-text">Find the target letter before the timer ends.</p>
            </div>
          )}

          {activeTab === 'sleep' && (
            <div className="action-grid">
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  if (state.asleep) {
                    doAction('wake');
                    showMessage('Your pet woke up.');
                  } else {
                    requestIntent('sleep');
                  }
                }}
              >
                {state.asleep ? 'Wake' : 'Sleep'}
              </button>
              <p className="helper-text">
                Sleep window: {state.settings.sleepWindow.start} - {state.settings.sleepWindow.end}
              </p>
            </div>
          )}

          {activeTab === 'status' && (
            <div className="action-grid status-grid">
              <button type="button" className="secondary-btn" onClick={() => doAction('clean')}>
                Clean
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  doAction('medicine');
                  showMessage('Medicine given.');
                }}
              >
                Medicine
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  doAction('praise');
                  showMessage('Praise shared.');
                }}
              >
                Praise
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  doAction('scold');
                  showMessage('Scold used.');
                }}
              >
                Scold
              </button>
            </div>
          )}
        </section>
      </main>

      <nav className="bottom-nav" aria-label="Main actions">
        <button
          type="button"
          className={activeTab === 'feed' ? 'nav-btn active' : 'nav-btn'}
          onClick={() => setActiveTab('feed')}
        >
          Feed
        </button>
        <button
          type="button"
          className={activeTab === 'play' ? 'nav-btn active' : 'nav-btn'}
          onClick={() => setActiveTab('play')}
        >
          Play
        </button>
        <button
          type="button"
          className={activeTab === 'learn' ? 'nav-btn active' : 'nav-btn'}
          onClick={() => setActiveTab('learn')}
        >
          Learn
        </button>
        <button
          type="button"
          className={activeTab === 'sleep' ? 'nav-btn active' : 'nav-btn'}
          onClick={() => setActiveTab('sleep')}
        >
          Sleep
        </button>
        <button
          type="button"
          className={activeTab === 'status' ? 'nav-btn active' : 'nav-btn'}
          onClick={() => setActiveTab('status')}
        >
          Status
        </button>
      </nav>

      {toast && <div className="toast">{toast}</div>}

      <Modal open={Boolean(pendingIntent)} title="Mirror Prompt" onClose={cancelMirror}>
        <div className="mirror-body">
          <p>{mirrorPromptText}</p>
          {state.settings.confirmMode === 'parent' ? (
            <HoldToConfirmButton label="Hold 2s for Done" onConfirm={resolveMirrorDone} />
          ) : (
            <TimerConfirm
              seconds={state.settings.timerSeconds}
              onConfirm={resolveMirrorDone}
              label="Done"
            />
          )}
          <button type="button" className="secondary-btn" onClick={cancelMirror}>
            Not now
          </button>
        </div>
      </Modal>

      <Modal open={Boolean(playRound)} title="Play: Catch the Star" onClose={() => setPlayRound(null)}>
        <div className="minigame">
          <p>Pick where the star hides. Time left: {playSecondsLeft}s</p>
          <div className="choice-row">
            <button type="button" className="primary-btn" onClick={() => handlePlayChoice('left')}>
              Left ⭐
            </button>
            <button type="button" className="primary-btn" onClick={() => handlePlayChoice('right')}>
              Right ⭐
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(learnRound)} title="Learn: Find the Letter" onClose={() => setLearnRound(null)}>
        <div className="minigame">
          {learnRound && (
            <>
              <p>
                Tap <strong>{learnRound.target}</strong>. Time left: {learnSecondsLeft}s
              </p>
              <div className="choice-row">
                {learnRound.choices.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    className="primary-btn"
                    onClick={() => handleLearnChoice(choice)}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={showParentChallenge}
        title="Parent Check"
        onClose={() => setShowParentChallenge(false)}
      >
        <div className="parent-gate-form">
          <p>Solve: {challenge.a} + {challenge.b}</p>
          <input
            className="text-input"
            inputMode="numeric"
            value={challengeAnswer}
            onChange={(event) => setChallengeAnswer(event.target.value)}
            placeholder="Answer"
          />
          <button type="button" className="primary-btn" onClick={submitParentChallenge}>
            Open Parent Mode
          </button>
        </div>
      </Modal>

      <Modal open={showParentPanel} title="Parent Mode" onClose={() => setShowParentPanel(false)}>
        <div className="parent-panel">
          <label className="switch-row">
            <span>Mirror Prompts</span>
            <input
              type="checkbox"
              checked={settingsDraft.mirrorEnabled}
              onChange={(event) =>
                setSettingsDraft({
                  ...settingsDraft,
                  mirrorEnabled: event.target.checked
                })
              }
            />
          </label>

          <label className="switch-row">
            <span>Pause Decay</span>
            <input
              type="checkbox"
              checked={settingsDraft.pauseDecay}
              onChange={(event) =>
                setSettingsDraft({
                  ...settingsDraft,
                  pauseDecay: event.target.checked
                })
              }
            />
          </label>

          <label className="switch-row">
            <span>Sleep Override</span>
            <input
              type="checkbox"
              checked={settingsDraft.parentOverrideSleep}
              onChange={(event) =>
                setSettingsDraft({
                  ...settingsDraft,
                  parentOverrideSleep: event.target.checked
                })
              }
            />
          </label>

          <label className="field-label">
            Confirm Mode
            <select
              className="text-input"
              value={settingsDraft.confirmMode}
              onChange={(event) =>
                setSettingsDraft({
                  ...settingsDraft,
                  confirmMode: event.target.value as ParentSettings['confirmMode']
                })
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
                  setSettingsDraft({
                    ...settingsDraft,
                    timerSeconds: Math.max(3, Math.min(60, Number(event.target.value) || 10))
                  })
                }
              />
            </label>
          )}

          <div className="field-row">
            <label className="field-label">
              Sleep start
              <input
                className="text-input"
                type="time"
                value={settingsDraft.sleepWindow.start}
                onChange={(event) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    sleepWindow: {
                      ...settingsDraft.sleepWindow,
                      start: event.target.value
                    }
                  })
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
                  setSettingsDraft({
                    ...settingsDraft,
                    sleepWindow: {
                      ...settingsDraft.sleepWindow,
                      end: event.target.value
                    }
                  })
                }
              />
            </label>
          </div>

          <label className="field-label">
            Feed meal prompt
            <textarea
              className="text-input"
              value={settingsDraft.perActionPrompts.feedMeal}
              onChange={(event) =>
                setSettingsDraft({
                  ...settingsDraft,
                  perActionPrompts: {
                    ...settingsDraft.perActionPrompts,
                    feedMeal: event.target.value
                  }
                })
              }
            />
          </label>

          <label className="field-label">
            Feed snack prompt
            <textarea
              className="text-input"
              value={settingsDraft.perActionPrompts.feedSnack}
              onChange={(event) =>
                setSettingsDraft({
                  ...settingsDraft,
                  perActionPrompts: {
                    ...settingsDraft.perActionPrompts,
                    feedSnack: event.target.value
                  }
                })
              }
            />
          </label>

          <label className="field-label">
            Play prompt
            <textarea
              className="text-input"
              value={settingsDraft.perActionPrompts.play}
              onChange={(event) =>
                setSettingsDraft({
                  ...settingsDraft,
                  perActionPrompts: {
                    ...settingsDraft.perActionPrompts,
                    play: event.target.value
                  }
                })
              }
            />
          </label>

          <label className="field-label">
            Learn prompt
            <textarea
              className="text-input"
              value={settingsDraft.perActionPrompts.learn}
              onChange={(event) =>
                setSettingsDraft({
                  ...settingsDraft,
                  perActionPrompts: {
                    ...settingsDraft.perActionPrompts,
                    learn: event.target.value
                  }
                })
              }
            />
          </label>

          <label className="field-label">
            Sleep prompt
            <textarea
              className="text-input"
              value={settingsDraft.perActionPrompts.sleep}
              onChange={(event) =>
                setSettingsDraft({
                  ...settingsDraft,
                  perActionPrompts: {
                    ...settingsDraft.perActionPrompts,
                    sleep: event.target.value
                  }
                })
              }
            />
          </label>

          <div className="button-row">
            <button type="button" className="primary-btn" onClick={applySettings}>
              Save Settings
            </button>
            <button type="button" className="secondary-btn" onClick={restartGame}>
              Reset Game
            </button>
          </div>

          <div className="button-row">
            <button type="button" className="secondary-btn" onClick={exportSave}>
              Export JSON
            </button>
            <button type="button" className="secondary-btn" onClick={importSave}>
              Import JSON
            </button>
          </div>

          <label className="field-label">
            Export data
            <textarea className="text-input" value={exportText} readOnly rows={5} />
          </label>

          <label className="field-label">
            Paste JSON to import
            <textarea
              className="text-input"
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              rows={5}
            />
          </label>

          <div className="debug-box">
            <p>lastUpdateTs: {state.lastUpdateTs}</p>
            <p>snackCountToday: {state.snackCountToday}</p>
            <p>lastSnackResetDate: {state.lastSnackResetDate}</p>
            <p>poopCount: {state.poopCount}</p>
            <p>sickMinutes: {Math.round(state.sickMinutes)}</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface TimerConfirmProps {
  seconds: number;
  label: string;
  onConfirm: () => void;
}

function TimerConfirm({ seconds, label, onConfirm }: TimerConfirmProps): JSX.Element {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
    const id = window.setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearInterval(id);
    };
  }, [seconds]);

  const ready = remaining <= 0;

  return (
    <button type="button" className="primary-btn" disabled={!ready} onClick={onConfirm}>
      {ready ? label : `Wait ${remaining}s`}
    </button>
  );
}
