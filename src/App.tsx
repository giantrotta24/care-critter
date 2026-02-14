import { useEffect, useMemo, useReducer, useRef, useState, type JSX } from 'react';
import {
  EGG_META,
  MODEL_CLASS_BY_INTENT,
  PROMPT_KEY_BY_INTENT,
  STAR_ROW_BURST_MS,
  defaultPromptIconForIntent,
  initGameState,
  makeLearnRound,
  randomSide,
  stageLabel,
  type ConfirmAction,
  type CritterMood,
  type DockAction,
  type HatchPhase,
  type Intent,
  type LearnRound,
  type PlayRound,
  type Side
} from './app/model';
import { useCritterMotion } from './app/hooks/useCritterMotion';
import { useMirrorFlow } from './app/hooks/useMirrorFlow';
import { useParentGate } from './app/hooks/useParentGate';
import { GameShell } from './components/app/GameShell';
import {
  ConfirmActionModal,
  FeedModal,
  LearnModal,
  MirrorPromptModal,
  ParentChallengeModal,
  ParentPanelModal,
  PlayModal,
  StatusModal
} from './components/app/modals';
import { DeadScreen, EggSelectionScreen } from './components/app/screens';
import { CAPS, GAME_LOOP } from './game/constants';
import { gameReducer } from './game/reducer';
import { loadState, saveState, type StorageAdapter } from './game/storage';
import { canSleepNow, toIsoDate } from './game/time';
import type {
  ActionType,
  EggStyle,
  GameState,
  ParentSettings,
  PromptIconKey
} from './game/types';

export default function App(): JSX.Element {
  const [state, dispatch] = useReducer(gameReducer, undefined, initGameState);
  const stateRef = useRef(state);
  const previousStageRef = useRef(state.stage);
  const hatchTimersRef = useRef<number[]>([]);
  const hatchAudioRef = useRef<HTMLAudioElement | null>(null);
  const modelAudioRef = useRef<HTMLAudioElement | null>(null);
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const starAudioRef = useRef<HTMLAudioElement | null>(null);
  const sleepAudioRef = useRef<HTMLAudioElement | null>(null);
  const starRowTimerRef = useRef<number | null>(null);

  const [showFeedSheet, setShowFeedSheet] = useState(false);
  const [showStatusSheet, setShowStatusSheet] = useState(false);
  const [toast, setToast] = useState('');

  const [playRound, setPlayRound] = useState<PlayRound | null>(null);
  const [learnRound, setLearnRound] = useState<LearnRound | null>(null);

  const [showParentPanel, setShowParentPanel] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [settingsDraft, setSettingsDraft] = useState<ParentSettings>(state.settings);
  const [exportText, setExportText] = useState('');
  const [importText, setImportText] = useState('');

  const [clockTs, setClockTs] = useState(Date.now());
  const [hatchPhase, setHatchPhase] = useState<HatchPhase>('idle');
  const [hatchEggStyle, setHatchEggStyle] = useState<EggStyle>('speckled');
  const [starRowBurst, setStarRowBurst] = useState(false);

  const clearHatchTimers = (): void => {
    hatchTimersRef.current.forEach((id) => window.clearTimeout(id));
    hatchTimersRef.current = [];
  };

  const clearStarRowTimer = (): void => {
    if (starRowTimerRef.current) {
      window.clearTimeout(starRowTimerRef.current);
      starRowTimerRef.current = null;
    }
  };

  const setCurrentPhase = (phase: GameState['currentPhase']): void => {
    dispatch({ type: 'setCurrentPhase', phase });
  };

  const playEffectSound = (audio: HTMLAudioElement | null): void => {
    if (!state.settings.hatchSoundEnabled || !audio) {
      return;
    }

    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Ignore autoplay/gesture restrictions.
    });
  };

  const playHatchSound = (): void => {
    playEffectSound(hatchAudioRef.current);
  };

  const showMessage = (message: string): void => {
    setToast(message);
  };

  const snacksUsedToday = state.lastSnackResetDate === toIsoDate(Date.now()) ? state.snackCountToday : 0;
  const snacksRemaining = Math.max(0, CAPS.snackPerDay - snacksUsedToday);

  const doAction = (actionType: ActionType): void => {
    dispatch({ type: 'applyAction', actionType, nowTs: Date.now() });
  };

  const continueIntent = (intent: Intent, fromMirrorPrompt = false): void => {
    if (intent === 'feedMeal') {
      doAction('feedMeal');
      setShowFeedSheet(false);
      if (!fromMirrorPrompt) {
        showMessage('Meal complete. Great care!');
      }
      return;
    }

    if (intent === 'feedSnack') {
      if (snacksRemaining <= 0) {
        showMessage('Too many snacks today. Try Play or Learn.');
        return;
      }

      doAction('feedSnack');
      setShowFeedSheet(false);
      if (!fromMirrorPrompt) {
        showMessage('Snack time complete.');
      }
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
      playEffectSound(sleepAudioRef.current);
      if (!fromMirrorPrompt) {
        showMessage('Bedtime started.');
      }
    }
  };

  const {
    activeIntent,
    timerWaiting,
    promptSuccessCue,
    startModelingFlow,
    resolveMirrorDone,
    cancelMirror,
    resetMirrorFlow,
    onTimerReadyChange
  } = useMirrorFlow({
    settings: state.settings,
    setCurrentPhase,
    recordMirrorSuccess: () => {
      dispatch({ type: 'recordMirrorSuccess', nowTs: Date.now() });
    },
    continueIntent,
    showMessage,
    modelAudioRef,
    successAudioRef,
    starAudioRef
  });

  const {
    parentHoldActive,
    parentHoldProgress,
    showParentHint,
    showParentChallenge,
    challenge,
    challengeAnswer,
    dismissParentHint,
    startParentGateHold,
    stopParentGateHold,
    setChallengeAnswer,
    closeParentChallenge,
    submitParentChallenge
  } = useParentGate({
    onUnlock: () => setShowParentPanel(true),
    showMessage
  });

  const {
    critterX,
    critterFacing,
    prefersReducedMotion,
    groundTapActive,
    groundTapFx,
    handleHabitatTap
  } = useCritterMotion({
    stage: state.stage,
    dead: state.dead,
    asleep: state.asleep,
    currentPhase: state.currentPhase,
    hatchPhase
  });

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
      clearHatchTimers();
      clearStarRowTimer();
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
    const mirrorImages = [
      '/prompt-cues/feed-meal.jpeg',
      '/prompt-cues/feed-snack.jpeg',
      '/prompt-cues/play-action.jpeg',
      '/prompt-cues/sleep-action.jpeg'
    ];

    mirrorImages.forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }, []);

  useEffect(() => {
    [hatchAudioRef.current, modelAudioRef.current, successAudioRef.current, starAudioRef.current, sleepAudioRef.current]
      .filter((audio): audio is HTMLAudioElement => audio !== null)
      .forEach((audio) => {
        audio.load();
      });
  }, []);

  useEffect(() => {
    if (showParentPanel) {
      setSettingsDraft(state.settings);
    }
  }, [showParentPanel, state.settings]);

  const playSecondsLeft = playRound ? Math.max(0, Math.ceil((playRound.expiresAt - clockTs) / 1000)) : 0;
  const learnSecondsLeft = learnRound ? Math.max(0, Math.ceil((learnRound.expiresAt - clockTs) / 1000)) : 0;

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

  useEffect(() => {
    if (state.starsToday < 5 || starRowBurst) {
      return;
    }

    setStarRowBurst(true);
    playEffectSound(successAudioRef.current);
    clearStarRowTimer();
    starRowTimerRef.current = window.setTimeout(() => {
      dispatch({ type: 'resetStarsToday' });
      setStarRowBurst(false);
      starRowTimerRef.current = null;
    }, STAR_ROW_BURST_MS);
  }, [state.starsToday, starRowBurst]);

  const mirrorPrompt = useMemo(() => {
    if (!activeIntent) {
      return {
        promptText: '',
        promptIcon: 'meal' as PromptIconKey
      };
    }

    const promptKey = PROMPT_KEY_BY_INTENT[activeIntent];
    const configured = state.settings.perActionPrompts[promptKey];

    return {
      promptText: configured.promptText,
      promptIcon: configured.promptIcon ?? defaultPromptIconForIntent(activeIntent)
    };
  }, [activeIntent, state.settings.perActionPrompts]);

  const isModeling = state.currentPhase === 'modeling' && Boolean(activeIntent);
  const isMirrorPhase = state.currentPhase === 'mirror' && Boolean(activeIntent);
  const isCelebrating = state.currentPhase === 'celebrating';
  const isCurious = isMirrorPhase && timerWaiting;
  const critterMood: CritterMood = isCelebrating
    ? 'celebrating'
    : isModeling
      ? 'modeling'
      : isCurious
        ? 'curious'
        : 'neutral';
  const modelClass = activeIntent ? MODEL_CLASS_BY_INTENT[activeIntent] : '';
  const starsFilled = Math.max(0, Math.min(5, state.starsToday));
  const actionFlowBusy = state.currentPhase !== 'idle';

  const needsEggSelection = state.stage === 'egg' && state.eggStyle === null;

  const clockLabel = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(clockTs);

  const stageDisplayLabel = stageLabel(state);

  const requestIntent = (intent: Intent): void => {
    if (state.dead) {
      showMessage('Your pet is resting. Restart to play again.');
      return;
    }

    if (needsEggSelection) {
      showMessage('Pick an egg first.');
      return;
    }

    if (intent === 'feedSnack' && snacksRemaining <= 0) {
      setShowFeedSheet(false);
      showMessage('Too many snacks today. Try Play or Learn.');
      return;
    }

    if (actionFlowBusy) {
      showMessage('Finish this listening step first.');
      return;
    }

    if (intent === 'feedMeal' || intent === 'feedSnack') {
      setShowFeedSheet(false);
    }

    if (state.settings.mirrorEnabled) {
      startModelingFlow(intent);
      return;
    }

    continueIntent(intent);
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
      resetMirrorFlow();
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
    resetMirrorFlow();
    setStarRowBurst(false);
    clearStarRowTimer();
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
    if (actionFlowBusy) {
      showMessage('Finish this listening step first.');
      return;
    }

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
    }
  };

  if (state.dead) {
    return <DeadScreen onRestart={restartGame} />;
  }

  if (needsEggSelection) {
    return <EggSelectionScreen toast={toast} onSelectEggStyle={chooseEggStyle} />;
  }

  return (
    <>
      <GameShell
        state={state}
        clockTs={clockTs}
        clockLabel={clockLabel}
        stageDisplayLabel={stageDisplayLabel}
        actionFlowBusy={actionFlowBusy}
        showFeedSheet={showFeedSheet}
        parentHoldActive={parentHoldActive}
        parentHoldProgress={parentHoldProgress}
        hatchPhase={hatchPhase}
        hatchEggStyle={hatchEggStyle}
        promptSuccessCue={promptSuccessCue}
        starRowBurst={starRowBurst}
        starsFilled={starsFilled}
        groundTapActive={groundTapActive}
        groundTapFx={groundTapFx}
        critterX={critterX}
        critterFacing={critterFacing}
        critterMood={critterMood}
        isCelebrating={isCelebrating}
        isCurious={isCurious}
        isModeling={isModeling}
        modelClass={modelClass}
        showParentHint={showParentHint && !showParentPanel}
        toast={toast}
        hatchAudioRef={hatchAudioRef}
        modelAudioRef={modelAudioRef}
        successAudioRef={successAudioRef}
        starAudioRef={starAudioRef}
        sleepAudioRef={sleepAudioRef}
        onShowStatusSheet={() => setShowStatusSheet(true)}
        onHabitatTap={handleHabitatTap}
        onStartParentGateHold={startParentGateHold}
        onStopParentGateHold={stopParentGateHold}
        onDockAction={handleDockAction}
        onDismissParentHint={dismissParentHint}
      />

      <FeedModal
        open={showFeedSheet}
        snacksRemaining={snacksRemaining}
        onClose={() => setShowFeedSheet(false)}
        onRequestIntent={requestIntent}
      />

      <StatusModal
        open={showStatusSheet}
        state={state}
        onClose={() => setShowStatusSheet(false)}
        onDoAction={doAction}
        onShowMessage={showMessage}
      />

      <MirrorPromptModal
        open={isMirrorPhase}
        promptIcon={mirrorPrompt.promptIcon}
        promptText={mirrorPrompt.promptText}
        confirmMode={state.settings.confirmMode}
        timerSeconds={state.settings.timerSeconds}
        onResolveMirrorDone={resolveMirrorDone}
        onCancelMirror={cancelMirror}
        onTimerReadyChange={onTimerReadyChange}
      />

      <PlayModal
        playRound={playRound}
        playSecondsLeft={playSecondsLeft}
        onClose={() => setPlayRound(null)}
        onChooseSide={handlePlayChoice}
      />

      <LearnModal
        learnRound={learnRound}
        learnSecondsLeft={learnSecondsLeft}
        onClose={() => setLearnRound(null)}
        onChooseLetter={handleLearnChoice}
      />

      <ParentChallengeModal
        open={showParentChallenge}
        challengeA={challenge.a}
        challengeB={challenge.b}
        challengeAnswer={challengeAnswer}
        onClose={closeParentChallenge}
        onChallengeAnswerChange={setChallengeAnswer}
        onSubmit={submitParentChallenge}
      />

      <ParentPanelModal
        open={showParentPanel}
        state={state}
        settingsDraft={settingsDraft}
        setSettingsDraft={setSettingsDraft}
        exportText={exportText}
        importText={importText}
        onClose={() => setShowParentPanel(false)}
        onApplySettings={applySettings}
        onSetConfirmAction={setConfirmAction}
        onExportSave={exportSave}
        onImportSave={importSave}
        onImportTextChange={setImportText}
      />

      <ConfirmActionModal
        confirmAction={confirmAction}
        onClose={() => setConfirmAction(null)}
        onRestart={restartGame}
        onHatchEarly={hatchEarly}
      />
    </>
  );
}
