import { useEffect, useRef, useState } from 'react';

interface HoldToConfirmButtonProps {
  label: string;
  holdMs?: number;
  onConfirm: () => void;
  className?: string;
  helperText?: string;
}

const TICK_MS = 40;
const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function HoldToConfirmButton({
  label,
  holdMs = 2000,
  onConfirm,
  className,
  helperText
}: HoldToConfirmButtonProps): JSX.Element {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  const clearTimer = (): void => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProgress(0);
  };

  useEffect(() => clearTimer, []);

  const start = (): void => {
    if (intervalRef.current) {
      return;
    }

    startedAtRef.current = Date.now();
    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const nextProgress = Math.min(100, Math.round((elapsed / holdMs) * 100));
      setProgress(nextProgress);

      if (elapsed >= holdMs) {
        clearTimer();
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(30);
        }
        onConfirm();
      }
    }, TICK_MS);
  };

  return (
    <button
      type="button"
      className={`hold-btn ${className ?? ''}`}
      onPointerDown={start}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
    >
      <span className="hold-ring" aria-hidden="true">
        <svg viewBox="0 0 64 64" role="presentation">
          <circle className="hold-ring-track" cx="32" cy="32" r={RING_RADIUS} />
          <circle
            className="hold-ring-progress"
            cx="32"
            cy="32"
            r={RING_RADIUS}
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE - (progress / 100) * RING_CIRCUMFERENCE}
          />
        </svg>
      </span>
      <span className="hold-text-wrap">
        <strong>{label}</strong>
        {helperText ? <small>{helperText}</small> : null}
      </span>
    </button>
  );
}
