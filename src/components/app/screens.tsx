import type { JSX } from 'react';
import { EGG_STYLES } from '../../game/constants';
import type { EggStyle } from '../../game/types';
import { EGG_META } from '../../app/model';
import { EggSprite } from './visuals';

interface DeadScreenProps {
  onRestart: () => void;
}

export function DeadScreen({ onRestart }: DeadScreenProps): JSX.Element {
  return (
    <div className="app-shell dead-screen">
      <div className="dead-content pixel-card">
        <p className="pet dead">🕊️</p>
        <h1>Your pet went to rest</h1>
        <p>Start a new egg when you are ready.</p>
        <button type="button" className="primary-btn" onClick={onRestart}>
          Restart
        </button>
      </div>
    </div>
  );
}

interface EggSelectionScreenProps {
  toast: string;
  onSelectEggStyle: (eggStyle: EggStyle) => void;
}

export function EggSelectionScreen({ toast, onSelectEggStyle }: EggSelectionScreenProps): JSX.Element {
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
              onClick={() => onSelectEggStyle(eggStyle)}
            >
              <EggSprite eggStyle={eggStyle} size="medium" />
              <strong>{EGG_META[eggStyle].name}</strong>
              <span>{EGG_META[eggStyle].blurb}</span>
              <small>Variant: {EGG_META[eggStyle].variant}</small>
            </button>
          ))}
        </div>
      </section>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
