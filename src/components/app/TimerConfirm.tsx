import { useEffect, useState, type JSX } from 'react';

interface TimerConfirmProps {
  seconds: number;
  label: string;
  onConfirm: () => void;
  onReadyChange?: (ready: boolean) => void;
}

export function TimerConfirm({ seconds, label, onConfirm, onReadyChange }: TimerConfirmProps): JSX.Element {
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

  useEffect(() => {
    onReadyChange?.(ready);
  }, [ready, onReadyChange]);

  return (
    <button type="button" className="primary-btn" disabled={!ready} onClick={onConfirm}>
      {ready ? label : `Wait ${remaining}s`}
    </button>
  );
}
