import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { HatchPhase } from '../model';
import type { GameState } from '../../game/types';

interface UseCritterMotionParams {
  stage: GameState['stage'];
  dead: boolean;
  asleep: boolean;
  currentPhase: GameState['currentPhase'];
  hatchPhase: HatchPhase;
}

interface UseCritterMotionResult {
  critterX: number;
  critterFacing: 'left' | 'right';
  prefersReducedMotion: boolean;
  groundTapActive: boolean;
  groundTapFx: { x: number; tick: number } | null;
  handleHabitatTap: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export function useCritterMotion({
  stage,
  dead,
  asleep,
  currentPhase,
  hatchPhase
}: UseCritterMotionParams): UseCritterMotionResult {
  const groundTapTimerRef = useRef<number | null>(null);

  const [critterX, setCritterX] = useState(50);
  const [critterFacing, setCritterFacing] = useState<'left' | 'right'>('right');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [groundTapActive, setGroundTapActive] = useState(false);
  const [groundTapFx, setGroundTapFx] = useState<{ x: number; tick: number } | null>(null);

  const clearGroundTapTimer = (): void => {
    if (groundTapTimerRef.current) {
      window.clearTimeout(groundTapTimerRef.current);
      groundTapTimerRef.current = null;
    }
  };

  const handleHabitatTap = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (prefersReducedMotion) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest('.parent-lock')) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left) / bounds.width;
    const clamped = Math.max(8, Math.min(92, ratio * 100));
    const tick = Date.now();

    setGroundTapFx({ x: clamped, tick });
    setGroundTapActive(true);

    clearGroundTapTimer();
    groundTapTimerRef.current = window.setTimeout(() => {
      setGroundTapActive(false);
      groundTapTimerRef.current = null;
    }, 280);
  };

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
    if (prefersReducedMotion) {
      setCritterX(50);
      return;
    }

    if (stage === 'egg' || dead) {
      setCritterX(50);
      return;
    }

    const intervalId = window.setInterval(() => {
      if (asleep || hatchPhase !== 'idle' || currentPhase !== 'idle') {
        return;
      }

      const nextX = Math.floor(22 + Math.random() * 56);
      setCritterFacing(nextX >= critterX ? 'right' : 'left');
      setCritterX(nextX);
    }, 4200);

    return () => window.clearInterval(intervalId);
  }, [stage, dead, asleep, currentPhase, hatchPhase, prefersReducedMotion, critterX]);

  useEffect(() => {
    return () => {
      clearGroundTapTimer();
    };
  }, []);

  return {
    critterX,
    critterFacing,
    prefersReducedMotion,
    groundTapActive,
    groundTapFx,
    handleHabitatTap
  };
}
