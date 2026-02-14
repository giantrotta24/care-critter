import { useEffect, useRef, useState } from 'react';
import { PARENT_HINT_KEY } from '../../game/constants';
import { randomChallenge, type ParentChallenge } from '../model';

interface UseParentGateParams {
  onUnlock: () => void;
  showMessage: (message: string) => void;
}

interface UseParentGateResult {
  parentHoldActive: boolean;
  parentHoldProgress: number;
  showParentHint: boolean;
  showParentChallenge: boolean;
  challenge: ParentChallenge;
  challengeAnswer: string;
  dismissParentHint: () => void;
  startParentGateHold: () => void;
  stopParentGateHold: () => void;
  setChallengeAnswer: (value: string) => void;
  closeParentChallenge: () => void;
  submitParentChallenge: () => void;
}

export function useParentGate({ onUnlock, showMessage }: UseParentGateParams): UseParentGateResult {
  const parentGateTimerRef = useRef<number | null>(null);
  const parentGateIntervalRef = useRef<number | null>(null);
  const parentHoldStartedAtRef = useRef<number>(0);

  const [parentHoldActive, setParentHoldActive] = useState(false);
  const [parentHoldProgress, setParentHoldProgress] = useState(0);
  const [showParentChallenge, setShowParentChallenge] = useState(false);
  const [challenge, setChallenge] = useState<ParentChallenge>(() => randomChallenge());
  const [challengeAnswer, setChallengeAnswer] = useState('');

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

  const closeParentChallenge = (): void => {
    setShowParentChallenge(false);
  };

  const submitParentChallenge = (): void => {
    const expected = challenge.a + challenge.b;
    const answer = Number(challengeAnswer);

    if (answer === expected) {
      setShowParentChallenge(false);
      onUnlock();
      showMessage('Parent mode unlocked.');
      return;
    }

    showMessage('Math check did not match.');
  };

  useEffect(() => {
    return () => {
      clearParentGateHold();
    };
  }, []);

  return {
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
  };
}
