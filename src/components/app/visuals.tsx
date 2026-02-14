import type { JSX } from 'react';
import type { CritterMood, DockIcon } from '../../app/model';
import type { CritterVariant, EggStyle, GameState, PromptIconKey } from '../../game/types';

interface ActionGlyphProps {
  icon: DockIcon;
  large?: boolean;
}

export function ActionGlyph({ icon, large = false }: ActionGlyphProps): JSX.Element {
  const symbols: Record<DockIcon, string> = {
    meal: '🍽️',
    snack: '🍎',
    play: '⚽',
    learn: '📘',
    sleep: '🛌',
    lock: '🔒'
  };

  return <span className={`action-glyph ${large ? 'large' : ''}`}>{symbols[icon]}</span>;
}

interface DockButtonProps {
  label: string;
  icon: DockIcon;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

export function DockButton({
  label,
  icon,
  onClick,
  active = false,
  disabled = false
}: DockButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={`dock-btn ${active ? 'active' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
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

export function CompactMeter({ label, value, tone }: CompactMeterProps): JSX.Element {
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

interface SparkleBurstProps {
  large?: boolean;
}

export function SparkleBurst({ large = false }: SparkleBurstProps): JSX.Element {
  const positions = ['sparkle-a', 'sparkle-b', 'sparkle-c', 'sparkle-d', 'sparkle-e', 'sparkle-f'];

  return (
    <div className={`sparkle-burst ${large ? 'large' : ''}`} aria-hidden="true">
      {positions.map((sparkle) => (
        <span key={sparkle} className={`sparkle ${sparkle}`}>
          ✦
        </span>
      ))}
    </div>
  );
}

export function AmbientParticles(): JSX.Element {
  return (
    <div className="ambient-particles" aria-hidden="true">
      <span className="ambient-particle particle-1" />
      <span className="ambient-particle particle-2" />
      <span className="ambient-particle particle-3" />
      <span className="ambient-particle particle-4" />
      <span className="ambient-particle particle-5" />
      <span className="ambient-particle particle-6" />
      <span className="ambient-particle particle-7" />
      <span className="ambient-particle particle-8" />
    </div>
  );
}

interface MirrorCueArtProps {
  icon: PromptIconKey;
}

export function MirrorCueArt({ icon }: MirrorCueArtProps): JSX.Element {
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

export function LearnTargetCard({ letter }: LearnTargetCardProps): JSX.Element {
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

export function EggSprite({ eggStyle, size }: EggSpriteProps): JSX.Element {
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
  mood: CritterMood;
}

export function CritterSprite({ variant, stage, asleep, sickness, mood }: CritterSpriteProps): JSX.Element {
  const paletteByVariant: Record<CritterVariant, { body: string; accent: string; shadow: string }> = {
    sunny: { body: '#f0b84c', accent: '#f8e98f', shadow: '#cd8d2f' },
    stripe: { body: '#5fa0de', accent: '#e9f2ff', shadow: '#2f73af' },
    astro: { body: '#b98ee8', accent: '#ffe680', shadow: '#8456bc' },
    forest: { body: '#79b265', accent: '#d7f2ad', shadow: '#4e8344' }
  };

  const activeVariant = variant ?? 'sunny';
  const palette = paletteByVariant[activeVariant];

  const stageClass =
    stage === 'baby' ? 'baby' : stage === 'child' ? 'child' : stage === 'teen' ? 'teen' : 'adult';

  return (
    <svg
      className={`critter-sprite ${stageClass} mood-${mood}`}
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

      {activeVariant === 'forest' && <path d="M9 4c1.5-1.7 3.5-2.3 6-.8-1.2 2.2-3.3 3-6 .8Z" fill="#4a8542" />}

      {activeVariant === 'sunny' && <rect x="10" y="3" width="4" height="2" fill="#f8e98f" />}

      {!asleep && !sickness && mood === 'celebrating' && (
        <>
          <g className="critter-eyes">
            <rect x="8" y="11" width="3" height="2" fill="#222" />
            <rect x="13" y="11" width="3" height="2" fill="#222" />
          </g>
          <rect x="10" y="15" width="4" height="1" fill="#222" />
          <rect x="9" y="16" width="6" height="1" fill="#222" />
        </>
      )}

      {!asleep && !sickness && mood === 'modeling' && (
        <>
          <g className="critter-eyes">
            <rect x="9" y="11" width="2" height="3" fill="#222" />
            <rect x="13" y="11" width="2" height="3" fill="#222" />
          </g>
          <rect x="10" y="15" width="4" height="1" fill="#222" />
        </>
      )}

      {!asleep && !sickness && mood === 'curious' && (
        <>
          <g className="critter-eyes">
            <rect x="8" y="11" width="3" height="1" fill="#222" />
            <rect x="13" y="12" width="3" height="1" fill="#222" />
          </g>
          <rect x="10" y="15" width="4" height="1" fill="#222" />
          <rect x="12" y="16" width="2" height="1" fill="#222" />
        </>
      )}

      {!asleep && !sickness && mood === 'neutral' && (
        <>
          <g className="critter-eyes">
            <rect x="9" y="12" width="2" height="2" fill="#222" />
            <rect x="13" y="12" width="2" height="2" fill="#222" />
          </g>
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
