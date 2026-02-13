interface MeterProps {
  label: string;
  value: number;
  accentClass: string;
}

export function Meter({ label, value, accentClass }: MeterProps): JSX.Element {
  const safe = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="meter-card">
      <div className="meter-meta">
        <span>{label}</span>
        <strong>{safe}</strong>
      </div>
      <div className="meter-track">
        <div className={`meter-fill ${accentClass}`} style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}
