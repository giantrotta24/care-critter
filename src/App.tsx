import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { HoldToConfirmButton } from './components/HoldToConfirmButton';
import { Modal } from './components/Modal';
import {
  CAPS,
  DEFAULT_PROMPT_ICONS,
  EGG_STYLES,
  GAME_LOOP,
  PARENT_HINT_KEY
} from './game/constants';
import { applyTimeDecay } from './game/engine';
import { gameReducer } from './game/reducer';
import { loadState, saveState, type StorageAdapter } from './game/storage';
import { canSleepNow, toIsoDate } from './game/time';
import type {
  ActionType,
  CritterVariant,
  EggStyle,
  GameState,
  MirrorActionKey,
  ParentSettings,
  PromptIconKey
} from './game/types';

type Intent = 'feedMeal' | 'feedSnack' | 'play' | 'learn' | 'sleep';
type Side = 'left' | 'right';
type DockAction = 'feed' | 'play' | 'learn' | 'sleep' | 'status';
type ConfirmAction = 'restart' | 'hatchEarly' | null;
type DockIcon = PromptIconKey | 'status' | 'lock';

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

interface PromptSuccessCue {
  icon: DockIcon;
  text: string;
}

const PROMPT_KEY_BY_INTENT: Record<Intent, MirrorActionKey> = {
  feedMeal: 'feedMeal',
  feedSnack: 'feedSnack',
  play: 'play',
  learn: 'learn',
  sleep: 'sleep'
};

const PROMPT_ROWS: Array<{ key: MirrorActionKey; label: string }> = [
  { key: 'feedMeal', label: 'Feed meal' },
  { key: 'feedSnack', label: 'Feed snack' },
  { key: 'play', label: 'Play' },
  { key: 'learn', label: 'Learn' },
  { key: 'sleep', label: 'Sleep' }
];

const PROMPT_ICON_OPTIONS: PromptIconKey[] = ['meal', 'snack', 'play', 'learn', 'sleep'];

const EGG_META: Record<EggStyle, { name: string; blurb: string; variant: string }> = {
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

function initGameState(): GameState {
  const nowTs = Date.now();
  const loaded = loadState(undefined, nowTs);
  const deltaMinutes = Math.max(0, (nowTs - loaded.lastUpdateTs) / 60000);
  const hydrated = applyTimeDecay(loaded, deltaMinutes, nowTs);
  saveState(hydrated);
  return hydrated;
}

function stageLabel(state: GameState): string {
  const stageCore = state.stage[0].toUpperCase() + state.stage.slice(1);

  if (state.stage === 'adult') {
    return `${stageCore} ${state.adultVariant}`;
  }

  if (state.stage === 'egg' && state.eggStyle) {
    return `${stageCore} (${EGG_META[state.eggStyle].name})`;
  }

  return stageCore;
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

function isNight(clockTs: number): boolean {
  const hour = new Date(clockTs).getHours();
  return hour >= 19 || hour < 6;
}

function defaultPromptIconForIntent(intent: Intent): PromptIconKey {
  return DEFAULT_PROMPT_ICONS[PROMPT_KEY_BY_INTENT[intent]];
}

function successCueForIntent(intent: Intent): PromptSuccessCue {
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

function getConfirmTitle(confirmAction: ConfirmAction): string {
  if (confirmAction === 'restart') {
    return 'Restart Pet?';
  }

  if (confirmAction === 'hatchEarly') {
    return 'Hatch Early?';
  }

  return '';
}

function getConfirmBody(confirmAction: ConfirmAction): string {
  if (confirmAction === 'restart') {
    return 'This clears the current pet and returns to egg selection.';
  }

  return 'This moves your pet to the next stage immediately.';
}

export default function App(): JSX.Element {
  const [state, dispatch] = useReducer(gameReducer, undefined, initGameState);
  const stateRef = useRef(state);
  const previousStageRef = useRef(state.stage);
  const hatchTimersRef = useRef<number[]>([]);
  const hatchAudioRef = useRef<HTMLAudioElement | null>(null);
  const successCueTimerRef = useRef<number | null>(null);

  const [pendingIntent, setPendingIntent] = useState<Intent | null>(null);
  const [showFeedSheet, setShowFeedSheet] = useState(false);
  const [showStatusSheet, setShowStatusSheet] = useState(false);
  const [toast, setToast] = useState('');

  const [playRound, setPlayRound] = useState<PlayRound | null>(null);
  const [learnRound, setLearnRound] = useState<LearnRound | null>(null);

  const [parentHoldActive, setParentHoldActive] = useState(false);
  const [parentHoldProgress, setParentHoldProgress] = useState(0);
  const parentGateTimerRef = useRef<number | null>(null);
  const parentGateIntervalRef = useRef<number | null>(null);
  const parentHoldStartedAtRef = useRef<number>(0);

  const [showParentChallenge, setShowParentChallenge] = useState(false);
  const [challenge, setChallenge] = useState<ParentChallenge>(() => randomChallenge());
  const [challengeAnswer, setChallengeAnswer] = useState('');

  const [showParentPanel, setShowParentPanel] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [settingsDraft, setSettingsDraft] = useState<ParentSettings>(state.settings);
  const [exportText, setExportText] = useState('');
  const [importText, setImportText] = useState('');

  const [clockTs, setClockTs] = useState(Date.now());
  const [hatchPhase, setHatchPhase] = useState<'idle' | 'shake' | 'crack' | 'pop'>('idle');
  const [hatchEggStyle, setHatchEggStyle] = useState<EggStyle>('speckled');
  const [promptSuccessCue, setPromptSuccessCue] = useState<PromptSuccessCue | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [showParentHint, setShowParentHint] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      return window.localStorage.getItem(PARENT_HINT_KEY) !== 'dismissed';
    } catch {
      return true;
    }
  });

  const clearParentGateHold = (): void => {
    if (parentGateTimerRef.current) {
      window.clearTimeout(parentGateTimerRef.current);
      parentGateTimerRef.current = null;
    }

    if (parentGateIntervalRef.current) {
      window.clearInterval(parentGateIntervalRef.current);
      parentGateIntervalRef.current = null;
    }

    setParentHoldActive(false);
    setParentHoldProgress(0);
  };

  const clearHatchTimers = (): void => {
    hatchTimersRef.current.forEach((id) => window.clearTimeout(id));
    hatchTimersRef.current = [];
  };

  const clearSuccessCueTimer = (): void => {
    if (successCueTimerRef.current) {
      window.clearTimeout(successCueTimerRef.current);
      successCueTimerRef.current = null;
    }
  };

  const showPromptSuccessCue = (intent: Intent): void => {
    clearSuccessCueTimer();
    setPromptSuccessCue(successCueForIntent(intent));
    successCueTimerRef.current = window.setTimeout(() => {
      setPromptSuccessCue(null);
      successCueTimerRef.current = null;
    }, 1250);
  };

  const playHatchSound = (): void => {
    if (!state.settings.hatchSoundEnabled || !hatchAudioRef.current) {
      return;
    }

    hatchAudioRef.current.currentTime = 0;
    void hatchAudioRef.current.play().catch(() => {
      // Ignore autoplay/gesture restrictions.
    });
  };

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
    return () => {
      clearParentGateHold();
      clearHatchTimers();
      clearSuccessCueTimer();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = (): void => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);

    return () => media.removeEventListener('change', update);
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
      setToast('Time is up. Great try!');
    }
  }, [playRound, playSecondsLeft]);

  useEffect(() => {
    if (learnRound && learnSecondsLeft <= 0) {
      dispatch({ type: 'applyAction', actionType: 'learnWrong', nowTs: Date.now() });
      setLearnRound(null);
      setToast('Time is up. Let us try another letter!');
    }
  }, [learnRound, learnSecondsLeft]);

  useEffect(() => {
    const previousStage = previousStageRef.current;

    if (previousStage === 'egg' && state.stage === 'baby') {
      setHatchEggStyle(state.eggStyle ?? 'speckled');
      clearHatchTimers();
      playHatchSound();

      if (prefersReducedMotion) {
        setHatchPhase('pop');
        const end = window.setTimeout(() => setHatchPhase('idle'), 260);
        hatchTimersRef.current = [end];
      } else {
        setHatchPhase('shake');
        const crack = window.setTimeout(() => setHatchPhase('crack'), 420);
        const pop = window.setTimeout(() => setHatchPhase('pop'), 760);
        const end = window.setTimeout(() => setHatchPhase('idle'), 1080);
        hatchTimersRef.current = [crack, pop, end];
      }
    }

    previousStageRef.current = state.stage;
  }, [state.stage, state.eggStyle, prefersReducedMotion, state.settings.hatchSoundEnabled]);

  const snacksUsedToday =
    state.lastSnackResetDate === toIsoDate(Date.now()) ? state.snackCountToday : 0;
  const snacksRemaining = Math.max(0, CAPS.snackPerDay - snacksUsedToday);

  const mirrorPrompt = useMemo(() => {
    if (!pendingIntent) {
      return {
        promptText: '',
        promptIcon: 'meal' as PromptIconKey
      };
    }

    const promptKey = PROMPT_KEY_BY_INTENT[pendingIntent];
    const configured = state.settings.perActionPrompts[promptKey];

    return {
      promptText: configured.promptText,
      promptIcon: configured.promptIcon ?? defaultPromptIconForIntent(pendingIntent)
    };
  }, [pendingIntent, state.settings.perActionPrompts]);

  const needsEggSelection = state.stage === 'egg' && state.eggStyle === null;

  const clockLabel = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(clockTs);

  const showMessage = (message: string): void => {
    setToast(message);
  };

  const doAction = (actionType: ActionType): void => {
    dispatch({ type: 'applyAction', actionType, nowTs: Date.now() });
  };

  const continueIntent = (intent: Intent): void => {
    if (intent === 'feedMeal') {
      doAction('feedMeal');
      setShowFeedSheet(false);
      showMessage('Meal complete. Great care!');
      return;
    }

    if (intent === 'feedSnack') {
      if (snacksRemaining <= 0) {
        showMessage('Too many snacks today. Try Play or Learn.');
        return;
      }

      doAction('feedSnack');
      setShowFeedSheet(false);
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

    if (needsEggSelection) {
      showMessage('Pick an egg first.');
      return;
    }

    if (state.settings.mirrorEnabled) {
      setPendingIntent(intent);
      return;
    }

    continueIntent(intent);
  };

  const dismissParentHint = (): void => {
    setShowParentHint(false);
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(PARENT_HINT_KEY, 'dismissed');
    } catch {
      // Ignore quota and privacy mode issues.
    }
  };

  const startParentGateHold = (): void => {
    clearParentGateHold();
    parentHoldStartedAtRef.current = Date.now();
    setParentHoldActive(true);

    parentGateIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - parentHoldStartedAtRef.current;
      const progress = Math.min(100, Math.round((elapsed / 2000) * 100));
      setParentHoldProgress(progress);
    }, 40);

    parentGateTimerRef.current = window.setTimeout(() => {
      clearParentGateHold();
      setChallenge(randomChallenge());
      setChallengeAnswer('');
      setShowParentChallenge(true);
      dismissParentHint();
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(25);
      }
    }, 2000);
  };

  const stopParentGateHold = (): void => {
    clearParentGateHold();
  };

  const resolveMirrorDone = (): void => {
    if (!pendingIntent) {
      return;
    }

    const intent = pendingIntent;
    showPromptSuccessCue(intent);
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
      const parsed = JSON.parse(importText) as unknown;
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Invalid save shape');
      }
      const importAdapter: StorageAdapter = {
        getItem() {
          return JSON.stringify(parsed);
        },
        setItem() {
          // no-op
        }
      };

      const normalized = loadState(importAdapter, Date.now());
      dispatch({ type: 'importState', state: normalized, nowTs: Date.now() });
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

    setShowParentPanel(false);
    setShowStatusSheet(false);
    setShowFeedSheet(false);
    setPendingIntent(null);
    setConfirmAction(null);
    showMessage('New egg started. Pick a style to hatch your pet.');
  };

  const hatchEarly = (): void => {
    if (state.stage === 'adult') {
      showMessage('Your pet is already an adult.');
      return;
    }

    if (state.stage === 'egg' && !state.eggStyle) {
      showMessage('Pick an egg style first.');
      return;
    }

    doAction('hatchEarly');
    setConfirmAction(null);
    showMessage(state.stage === 'egg' ? 'Egg hatched early!' : 'Stage advanced early.');
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
    showMessage(correct ? 'You did it. Great learning!' : 'Almost! Try again.');
  };

  const chooseEggStyle = (eggStyle: EggStyle): void => {
    dispatch({ type: 'setEggStyle', eggStyle, nowTs: Date.now() });
    showMessage(`${EGG_META[eggStyle].name} selected.`);
  };

  const handleDockAction = (action: DockAction): void => {
    if (action === 'feed') {
      setShowFeedSheet(true);
      return;
    }

    if (action === 'play') {
      requestIntent('play');
      return;
    }

    if (action === 'learn') {
      requestIntent('learn');
      return;
    }

    if (action === 'sleep') {
      if (state.asleep) {
        doAction('wake');
        showMessage('Your pet woke up.');
      } else {
        requestIntent('sleep');
      }
      return;
    }

    setShowStatusSheet(true);
  };

  if (state.dead) {
    return (
      <div className="app-shell dead-screen">
        <div className="dead-content pixel-card">
          <p className="pet dead">🕊️</p>
          <h1>Your pet went to rest</h1>
          <p>Start a new egg when you are ready.</p>
          <button type="button" className="primary-btn" onClick={restartGame}>
            Restart
          </button>
        </div>
      </div>
    );
  }

  if (needsEggSelection) {
    return (
      <div className="app-shell egg-select-shell">
        <section className="egg-picker pixel-card">
          <h1>Pick an Egg</h1>
          <p className="helper-text">Each egg grows into a different critter friend.</p>

          <div className="egg-grid">
            {EGG_STYLES.map((eggStyle) => (
              <button
                key={eggStyle}
                type="button"
                className="egg-option"
                onClick={() => chooseEggStyle(eggStyle)}
              >
                <EggSprite eggStyle={eggStyle} size="medium" />
                <strong>{EGG_META[eggStyle].name}</strong>
                <span>{EGG_META[eggStyle].blurb}</span>
                <small>Variant: {EGG_META[eggStyle].variant}</small>
              </button>
            ))}
          </div>

          <p className="helper-text">Grown-ups: hold the lock icon for 2 seconds to open Parent Mode.</p>
        </section>
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <main className="main-view">
        <section className="habitat-wrapper">
          <div className={`habitat-bezel ${isNight(clockTs) ? 'night' : 'day'}`}>
            <audio ref={hatchAudioRef} preload="auto">
              <source src="/sounds/hatch.wav" type="audio/wav" />
            </audio>
            <button
              type="button"
              className={`parent-lock ${parentHoldActive ? 'holding' : ''}`}
              aria-label="Open parent mode"
              onPointerDown={startParentGateHold}
              onPointerUp={stopParentGateHold}
              onPointerLeave={stopParentGateHold}
              onPointerCancel={stopParentGateHold}
            >
              <ActionGlyph icon="lock" />
              <span className="lock-progress-track" aria-hidden="true">
                <span style={{ width: `${parentHoldProgress}%` }} />
              </span>
            </button>
            <span className="parent-lock-note">Grown-ups</span>

            <div className="habitat-hud">
              <div className="hud-chip-row">
                <span className="hud-chip">{stageLabel(state)}</span>
                <span className="hud-chip">{clockLabel}</span>
              </div>

              <div className="meter-row">
                <CompactMeter label="Hunger" value={state.hunger} tone="hunger" />
                <CompactMeter label="Happy" value={state.happiness} tone="happy" />
                <CompactMeter label="Learn" value={state.training} tone="training" />
              </div>
            </div>

            <div className="habitat-screen">
              <div className="pixel-grid" aria-hidden="true" />
              <div className="ground-line" aria-hidden="true" />
              <div className="decor decor-plant" aria-hidden="true">✿</div>
              <div className="decor decor-sky" aria-hidden="true">
                {isNight(clockTs) ? '✦ ✦ ✧' : '☁ ☀'}
              </div>
              {promptSuccessCue && (
                <div className="prompt-success" role="status" aria-live="polite">
                  <p className="prompt-success-icon" aria-hidden="true">
                    <ActionGlyph icon={promptSuccessCue.icon} />
                  </p>
                  <p className="prompt-success-text">{promptSuccessCue.text}</p>
                  <p className="prompt-success-sub">You did it!</p>
                </div>
              )}
              {hatchPhase !== 'idle' && (
                <div className={`hatch-overlay phase-${hatchPhase}`} aria-hidden="true">
                  {(hatchPhase === 'shake' || hatchPhase === 'crack') && (
                    <>
                      <div className={`hatch-egg ${hatchPhase === 'shake' ? 'shake' : ''}`}>
                        <EggSprite eggStyle={hatchEggStyle} size="large" />
                      </div>
                      {hatchPhase === 'crack' && (
                        <>
                          <div className="hatch-crack-line hatch-crack-a" />
                          <div className="hatch-crack-line hatch-crack-b" />
                          <div className="hatch-flash" />
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              <div
                className={`critter-zone ${state.asleep ? 'asleep' : ''} ${hatchPhase === 'pop' ? 'hatch-pop' : ''}`}
                aria-live="polite"
              >
                {state.stage === 'egg' ? (
                  <EggSprite eggStyle={state.eggStyle ?? 'speckled'} size="large" />
                ) : (
                  <CritterSprite
                    variant={state.critterVariant}
                    stage={state.stage}
                    asleep={state.asleep}
                    sickness={state.sickness}
                  />
                )}
              </div>

              <div className="status-flags">
                {state.asleep && <p>Sleeping... zZz</p>}
                {state.sickness && <p className="warning">Feeling sick</p>}
                {state.attentionDemand.active && <p className="attention">Needs attention</p>}
              </div>
            </div>
          </div>
        </section>
      </main>

      <nav className="action-dock" aria-label="Main actions">
        <DockButton
          label="Feed"
          icon="meal"
          active={showFeedSheet}
          onClick={() => handleDockAction('feed')}
        />
        <DockButton label="Play" icon="play" onClick={() => handleDockAction('play')} />
        <DockButton label="Learn" icon="learn" onClick={() => handleDockAction('learn')} />
        <DockButton
          label={state.asleep ? 'Wake' : 'Sleep'}
          icon="sleep"
          onClick={() => handleDockAction('sleep')}
        />
        <DockButton
          label="Status"
          icon="status"
          active={showStatusSheet}
          onClick={() => handleDockAction('status')}
        />
      </nav>

      {showParentHint && !showParentPanel && (
        <div className="hint-overlay" role="status">
          <div className="hint-card pixel-card">
            <p>Grown-ups: hold the lock for 2 seconds to open Parent Mode.</p>
            <button type="button" className="primary-btn" onClick={dismissParentHint}>
              Got It
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      <Modal open={showFeedSheet} title="Feed" onClose={() => setShowFeedSheet(false)}>
        <div className="sheet-body">
          <button type="button" className="primary-btn" onClick={() => requestIntent('feedMeal')}>
            Meal
          </button>
          <button type="button" className="secondary-btn" onClick={() => requestIntent('feedSnack')}>
            Snack ({snacksRemaining} left)
          </button>
          <p className="helper-text">Meals fill more. Snacks are capped at 3 per day.</p>
        </div>
      </Modal>

      <Modal open={showStatusSheet} title="Status" onClose={() => setShowStatusSheet(false)}>
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
            <p>Sleep window: {state.settings.sleepWindow.start} - {state.settings.sleepWindow.end}</p>
            <p>Variant: {state.critterVariant ? state.critterVariant : 'Unknown'}</p>
          </div>

          <div className="status-actions-grid">
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
        </div>
      </Modal>

      <Modal open={Boolean(pendingIntent)} title="Mirror Prompt" onClose={cancelMirror}>
        <div className="mirror-body">
          <div className="mirror-icon">
            <MirrorCueArt icon={mirrorPrompt.promptIcon} />
          </div>
          <p className="mirror-text">{mirrorPrompt.promptText}</p>
          {state.settings.confirmMode === 'parent' ? (
            <HoldToConfirmButton
              label="Hold to finish"
              helperText="Grown-up holds for 2 seconds"
              onConfirm={resolveMirrorDone}
            />
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
              <LearnTargetCard letter={learnRound.target} />
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
            <span>Hatch Sound</span>
            <input
              type="checkbox"
              checked={settingsDraft.hatchSoundEnabled}
              onChange={(event) =>
                setSettingsDraft({
                  ...settingsDraft,
                  hatchSoundEnabled: event.target.checked
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

          {PROMPT_ROWS.map((row) => (
            <div key={row.key} className="prompt-edit-card">
              <label className="field-label">
                {row.label} prompt
                <textarea
                  className="text-input"
                  value={settingsDraft.perActionPrompts[row.key].promptText}
                  onChange={(event) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      perActionPrompts: {
                        ...settingsDraft.perActionPrompts,
                        [row.key]: {
                          ...settingsDraft.perActionPrompts[row.key],
                          promptText: event.target.value
                        }
                      }
                    })
                  }
                />
              </label>

              <label className="field-label">
                Prompt icon
                <select
                  className="text-input"
                  value={
                    settingsDraft.perActionPrompts[row.key].promptIcon ?? DEFAULT_PROMPT_ICONS[row.key]
                  }
                  onChange={(event) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      perActionPrompts: {
                        ...settingsDraft.perActionPrompts,
                        [row.key]: {
                          ...settingsDraft.perActionPrompts[row.key],
                          promptIcon: event.target.value as PromptIconKey
                        }
                      }
                    })
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
            <button type="button" className="primary-btn" onClick={applySettings}>
              Save Settings
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => setConfirmAction('hatchEarly')}
            >
              Hatch Early
            </button>
          </div>

          <div className="button-row">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => setConfirmAction('restart')}
            >
              Restart Pet
            </button>
            <button type="button" className="secondary-btn" onClick={exportSave}>
              Export JSON
            </button>
          </div>

          <button type="button" className="secondary-btn" onClick={importSave}>
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
              onChange={(event) => setImportText(event.target.value)}
              rows={5}
            />
          </label>
        </div>
      </Modal>

      <Modal open={Boolean(confirmAction)} title={getConfirmTitle(confirmAction)} onClose={() => setConfirmAction(null)}>
        <div className="sheet-body">
          <p>{getConfirmBody(confirmAction)}</p>
          <div className="button-row">
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                if (confirmAction === 'restart') {
                  restartGame();
                }

                if (confirmAction === 'hatchEarly') {
                  hatchEarly();
                }
              }}
            >
              Yes, continue
            </button>
            <button type="button" className="secondary-btn" onClick={() => setConfirmAction(null)}>
              Cancel
            </button>
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

interface DockButtonProps {
  label: string;
  icon: DockIcon;
  onClick: () => void;
  active?: boolean;
}

function DockButton({ label, icon, onClick, active = false }: DockButtonProps): JSX.Element {
  return (
    <button type="button" className={`dock-btn ${active ? 'active' : ''}`} onClick={onClick}>
      <ActionGlyph icon={icon} />
      <span>{label}</span>
    </button>
  );
}

interface CompactMeterProps {
  label: string;
  value: number;
  tone: 'hunger' | 'happy' | 'training';
}

function CompactMeter({ label, value, tone }: CompactMeterProps): JSX.Element {
  const safe = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="compact-meter">
      <div className="compact-meter-meta">
        <span>{label}</span>
        <strong>{safe}</strong>
      </div>
      <div className="compact-meter-track">
        <span className={`compact-meter-fill ${tone}`} style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

interface ActionGlyphProps {
  icon: DockIcon;
  large?: boolean;
}

function ActionGlyph({ icon, large = false }: ActionGlyphProps): JSX.Element {
  const symbols: Record<DockIcon, string> = {
    meal: '🍽️',
    snack: '🍎',
    play: '⚽',
    learn: '📘',
    sleep: '🛌',
    status: '📊',
    lock: '🔒'
  };

  return <span className={`action-glyph ${large ? 'large' : ''}`}>{symbols[icon]}</span>;
}

interface MirrorCueArtProps {
  icon: PromptIconKey;
}

function MirrorCueArt({ icon }: MirrorCueArtProps): JSX.Element {
  if (icon === 'meal') {
    return (
      <img
        className="mirror-illustration"
        src="/prompt-cues/feed-meal.jpeg"
        alt="Child taking a bite from a meal"
        loading="lazy"
        decoding="async"
        width={640}
        height={427}
      />
    );
  }

  if (icon === 'snack') {
    return (
      <img
        className="mirror-illustration"
        src="/prompt-cues/feed-snack.jpeg"
        alt="Child eating a healthy snack"
        loading="lazy"
        decoding="async"
        width={640}
        height={427}
      />
    );
  }

  if (icon === 'play') {
    return (
      <img
        className="mirror-illustration"
        src="/prompt-cues/play-action.jpeg"
        alt="Child jumping and playing"
        loading="lazy"
        decoding="async"
        width={640}
        height={427}
      />
    );
  }

  if (icon === 'learn') {
    return (
      <svg className="mirror-illustration" viewBox="0 0 120 120" role="img" aria-label="big letters">
        <rect x="6" y="6" width="108" height="108" rx="16" fill="#f4ecff" />
        <rect x="18" y="18" width="84" height="84" rx="12" fill="#fff" />
        <text x="34" y="73" fontSize="42" fontFamily="Verdana, sans-serif" fontWeight="700" fill="#ff7f50">
          A
        </text>
        <text x="58" y="65" fontSize="30" fontFamily="Verdana, sans-serif" fontWeight="700" fill="#4e9de6">
          B
        </text>
        <text x="74" y="84" fontSize="28" fontFamily="Verdana, sans-serif" fontWeight="700" fill="#49a85c">
          C
        </text>
      </svg>
    );
  }

  if (icon === 'sleep') {
    return (
      <img
        className="mirror-illustration"
        src="/prompt-cues/sleep-action.jpeg"
        alt="Child sleeping in bed"
        loading="lazy"
        decoding="async"
        width={640}
        height={427}
      />
    );
  }

  return (
    <img
      className="mirror-illustration"
      src="/prompt-cues/feed-meal.jpeg"
      alt="Child taking a bite from a meal"
      loading="lazy"
      decoding="async"
      width={640}
      height={427}
    />
  );
}

interface LearnTargetCardProps {
  letter: string;
}

function LearnTargetCard({ letter }: LearnTargetCardProps): JSX.Element {
  return (
    <div className="learn-target-card" aria-label={`Target letter ${letter}`}>
      <svg viewBox="0 0 220 120" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="learnBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff8d6" />
            <stop offset="100%" stopColor="#ffe1b7" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="212" height="112" rx="18" fill="url(#learnBg)" stroke="#1f2329" strokeWidth="4" />
        <circle cx="36" cy="30" r="8" fill="#4e9de6" />
        <circle cx="186" cy="92" r="10" fill="#ff8f53" />
        <text
          x="110"
          y="82"
          textAnchor="middle"
          fontFamily="Verdana, sans-serif"
          fontSize="72"
          fontWeight="700"
          fill="#5f5be2"
        >
          {letter}
        </text>
      </svg>
    </div>
  );
}

interface EggSpriteProps {
  eggStyle: EggStyle;
  size: 'medium' | 'large';
}

function EggSprite({ eggStyle, size }: EggSpriteProps): JSX.Element {
  return (
    <svg
      className={`egg-sprite ${size}`}
      viewBox="0 0 42 48"
      role="img"
      aria-label={`${eggStyle} egg`}
      shapeRendering="crispEdges"
    >
      <ellipse cx="21" cy="25" rx="14" ry="18" fill="#f6f1e3" />
      <ellipse cx="21" cy="31" rx="13" ry="10" fill="#e7dcc7" opacity="0.75" />
      <ellipse cx="15" cy="16" rx="3" ry="4" fill="#ffffff" opacity="0.7" />
      {eggStyle === 'speckled' && (
        <>
          <circle cx="13" cy="27" r="2" fill="#9d724e" />
          <circle cx="20" cy="20" r="2" fill="#9d724e" />
          <circle cx="25" cy="30" r="1.5" fill="#9d724e" />
          <circle cx="30" cy="22" r="2" fill="#9d724e" />
        </>
      )}
      {eggStyle === 'striped' && (
        <>
          <rect x="11" y="18" width="20" height="3" fill="#4a7ca4" />
          <rect x="9" y="25" width="24" height="3" fill="#4a7ca4" />
          <rect x="11" y="32" width="20" height="3" fill="#4a7ca4" />
        </>
      )}
      {eggStyle === 'star' && (
        <>
          <polygon points="20,16 22,20 26,20 23,23 24,27 20,25 16,27 17,23 14,20 18,20" fill="#c98b1a" />
          <circle cx="28" cy="30" r="2" fill="#c98b1a" />
          <circle cx="14" cy="30" r="2" fill="#c98b1a" />
        </>
      )}
      {eggStyle === 'leaf' && (
        <>
          <path d="M17 18c4-3 8-2 10 2-4 3-8 2-10-2Z" fill="#4d8f58" />
          <path d="M14 30c4-3 8-2 10 2-4 3-8 2-10-2Z" fill="#4d8f58" />
          <path d="M22 24c4-3 8-2 10 2-4 3-8 2-10-2Z" fill="#4d8f58" />
        </>
      )}
    </svg>
  );
}

interface CritterSpriteProps {
  variant: CritterVariant | null;
  stage: GameState['stage'];
  asleep: boolean;
  sickness: boolean;
}

function CritterSprite({ variant, stage, asleep, sickness }: CritterSpriteProps): JSX.Element {
  const paletteByVariant: Record<CritterVariant, { body: string; accent: string; shadow: string }> = {
    sunny: { body: '#f0b84c', accent: '#f8e98f', shadow: '#cd8d2f' },
    stripe: { body: '#5fa0de', accent: '#e9f2ff', shadow: '#2f73af' },
    astro: { body: '#b98ee8', accent: '#ffe680', shadow: '#8456bc' },
    forest: { body: '#79b265', accent: '#d7f2ad', shadow: '#4e8344' }
  };

  const activeVariant = variant ?? 'sunny';
  const palette = paletteByVariant[activeVariant];

  const stageClass =
    stage === 'baby'
      ? 'baby'
      : stage === 'child'
        ? 'child'
        : stage === 'teen'
          ? 'teen'
          : 'adult';

  return (
    <svg
      className={`critter-sprite ${stageClass}`}
      viewBox="0 0 24 24"
      role="img"
      aria-label="critter"
      shapeRendering="crispEdges"
    >
      <rect x="6" y="5" width="3" height="3" fill={palette.shadow} />
      <rect x="15" y="5" width="3" height="3" fill={palette.shadow} />
      <rect x="5" y="8" width="14" height="12" fill={palette.body} />
      <rect x="7" y="10" width="10" height="8" fill={palette.accent} opacity="0.5" />
      <rect x="8" y="19" width="2" height="2" fill={palette.shadow} />
      <rect x="14" y="19" width="2" height="2" fill={palette.shadow} />

      {activeVariant === 'stripe' && (
        <>
          <rect x="7" y="9" width="1" height="8" fill={palette.shadow} />
          <rect x="16" y="9" width="1" height="8" fill={palette.shadow} />
        </>
      )}

      {activeVariant === 'astro' && (
        <polygon
          points="12,3 13,5 15,5 13.5,6.5 14,8.5 12,7.3 10,8.5 10.5,6.5 9,5 11,5"
          fill="#ffe680"
        />
      )}

      {activeVariant === 'forest' && (
        <path d="M9 4c1.5-1.7 3.5-2.3 6-.8-1.2 2.2-3.3 3-6 .8Z" fill="#4a8542" />
      )}

      {activeVariant === 'sunny' && <rect x="10" y="3" width="4" height="2" fill="#f8e98f" />}

      {!asleep && !sickness && (
        <>
          <rect x="9" y="12" width="2" height="2" fill="#222" />
          <rect x="13" y="12" width="2" height="2" fill="#222" />
          <rect x="11" y="15" width="2" height="1" fill="#222" />
        </>
      )}

      {asleep && (
        <>
          <rect x="8" y="12" width="3" height="1" fill="#222" />
          <rect x="13" y="12" width="3" height="1" fill="#222" />
          <rect x="10" y="15" width="4" height="1" fill="#222" />
        </>
      )}

      {sickness && (
        <>
          <rect x="9" y="12" width="2" height="1" fill="#222" />
          <rect x="9" y="13" width="2" height="1" fill="#222" />
          <rect x="13" y="12" width="2" height="1" fill="#222" />
          <rect x="13" y="13" width="2" height="1" fill="#222" />
          <rect x="10" y="16" width="4" height="1" fill="#a33" />
        </>
      )}
    </svg>
  );
}
