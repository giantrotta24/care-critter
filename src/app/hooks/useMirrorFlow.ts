import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  CELEBRATION_DURATION_MS,
  MODELING_DURATION_MS,
  PHASE_SMOOTH_DELAY_MS,
  successCueForIntent,
  type Intent,
  type PromptSuccessCue
} from '../model';
import type { ParentSettings } from '../../game/types';

interface UseMirrorFlowParams {
  settings: ParentSettings;
  setCurrentPhase: (phase: 'idle' | 'modeling' | 'mirror' | 'celebrating') => void;
  recordMirrorSuccess: () => void;
  continueIntent: (intent: Intent, fromMirrorPrompt: boolean) => void;
  showMessage: (message: string) => void;
  modelAudioRef: MutableRefObject<HTMLAudioElement | null>;
  successAudioRef: MutableRefObject<HTMLAudioElement | null>;
  starAudioRef: MutableRefObject<HTMLAudioElement | null>;
}

interface UseMirrorFlowResult {
  activeIntent: Intent | null;
  timerWaiting: boolean;
  promptSuccessCue: PromptSuccessCue | null;
  startModelingFlow: (intent: Intent) => void;
  resolveMirrorDone: () => void;
  cancelMirror: () => void;
  resetMirrorFlow: () => void;
  onTimerReadyChange: (ready: boolean) => void;
}

export function useMirrorFlow({
  settings,
  setCurrentPhase,
  recordMirrorSuccess,
  continueIntent,
  showMessage,
  modelAudioRef,
  successAudioRef,
  starAudioRef
}: UseMirrorFlowParams): UseMirrorFlowResult {
  const phaseTimerRef = useRef<number | null>(null);
  const successCueTimerRef = useRef<number | null>(null);

  const [activeIntent, setActiveIntent] = useState<Intent | null>(null);
  const [timerWaiting, setTimerWaiting] = useState(false);
  const [promptSuccessCue, setPromptSuccessCue] = useState<PromptSuccessCue | null>(null);

  const clearPhaseTimer = (): void => {
    if (phaseTimerRef.current) {
      window.clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
  };

  const clearSuccessCueTimer = (): void => {
    if (successCueTimerRef.current) {
      window.clearTimeout(successCueTimerRef.current);
      successCueTimerRef.current = null;
    }
  };

  const playEffectSound = (audio: HTMLAudioElement | null): void => {
    if (!settings.hatchSoundEnabled || !audio) {
      return;
    }

    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Ignore autoplay/gesture restrictions.
    });
  };

  const showPromptSuccessCue = (intent: Intent): void => {
    clearSuccessCueTimer();
    setPromptSuccessCue(successCueForIntent(intent));
    successCueTimerRef.current = window.setTimeout(() => {
      setPromptSuccessCue(null);
      successCueTimerRef.current = null;
    }, 1250);
  };

  const resetMirrorFlow = (): void => {
    clearPhaseTimer();
    clearSuccessCueTimer();
    setPromptSuccessCue(null);
    setTimerWaiting(false);
    setActiveIntent(null);
    setCurrentPhase('idle');
  };

  const startModelingFlow = (intent: Intent): void => {
    setActiveIntent(intent);
    setTimerWaiting(settings.confirmMode === 'timer');
    setCurrentPhase('modeling');
    playEffectSound(modelAudioRef.current);
    clearPhaseTimer();
    phaseTimerRef.current = window.setTimeout(() => {
      setCurrentPhase('mirror');
      phaseTimerRef.current = null;
    }, MODELING_DURATION_MS + PHASE_SMOOTH_DELAY_MS);
  };

  const resolveMirrorDone = (): void => {
    if (!activeIntent) {
      return;
    }

    const intent = activeIntent;
    recordMirrorSuccess();
    playEffectSound(successAudioRef.current);
    playEffectSound(starAudioRef.current);
    showPromptSuccessCue(intent);
    setTimerWaiting(false);
    setCurrentPhase('celebrating');
    clearPhaseTimer();
    phaseTimerRef.current = window.setTimeout(() => {
      setCurrentPhase('idle');
      setActiveIntent(null);
      continueIntent(intent, true);
      phaseTimerRef.current = null;
    }, CELEBRATION_DURATION_MS + PHASE_SMOOTH_DELAY_MS);
  };

  const cancelMirror = (): void => {
    clearPhaseTimer();
    setTimerWaiting(false);
    setActiveIntent(null);
    setCurrentPhase('idle');
    showMessage('Okay, we can try again later.');
  };

  const onTimerReadyChange = (ready: boolean): void => {
    setTimerWaiting(!ready);
  };

  useEffect(() => {
    return () => {
      clearPhaseTimer();
      clearSuccessCueTimer();
    };
  }, []);

  return {
    activeIntent,
    timerWaiting,
    promptSuccessCue,
    startModelingFlow,
    resolveMirrorDone,
    cancelMirror,
    resetMirrorFlow,
    onTimerReadyChange
  };
}
