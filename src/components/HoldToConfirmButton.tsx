import { useEffect, useRef, useState } from 'react';

interface HoldToConfirmButtonProps {
  label: string;
  holdMs?: number;
  onConfirm: () => void;
  className?: string;
}

const TICK_MS = 40;

export function HoldToConfirmButton({
  label,
  holdMs = 2000,
  onConfirm,
  className
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
      <span>{label}</span>
      <span className="hold-progress" style={{ width: `${progress}%` }} />
    </button>
  );
}
