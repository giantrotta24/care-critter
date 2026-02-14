import type { JSX, MutableRefObject, PointerEvent as ReactPointerEvent } from 'react';
import type {
  CritterMood,
  DockAction,
  HatchPhase,
  PromptSuccessCue
} from '../../app/model';
import { isNight } from '../../app/model';
import type { EggStyle, GameState } from '../../game/types';
import {
  ActionGlyph,
  AmbientParticles,
  CompactMeter,
  CritterSprite,
  DockButton,
  EggSprite,
  SparkleBurst
} from './visuals';

interface GameShellProps {
  state: GameState;
  clockTs: number;
  clockLabel: string;
  stageDisplayLabel: string;
  actionFlowBusy: boolean;
  showFeedSheet: boolean;
  parentHoldActive: boolean;
  parentHoldProgress: number;
  hatchPhase: HatchPhase;
  hatchEggStyle: EggStyle;
  promptSuccessCue: PromptSuccessCue | null;
  starRowBurst: boolean;
  starsFilled: number;
  groundTapActive: boolean;
  groundTapFx: { x: number; tick: number } | null;
  critterX: number;
  critterFacing: 'left' | 'right';
  critterMood: CritterMood;
  isCelebrating: boolean;
  isCurious: boolean;
  isModeling: boolean;
  modelClass: string;
  showParentHint: boolean;
  toast: string;
  hatchAudioRef: MutableRefObject<HTMLAudioElement | null>;
  modelAudioRef: MutableRefObject<HTMLAudioElement | null>;
  successAudioRef: MutableRefObject<HTMLAudioElement | null>;
  starAudioRef: MutableRefObject<HTMLAudioElement | null>;
  sleepAudioRef: MutableRefObject<HTMLAudioElement | null>;
  onShowStatusSheet: () => void;
  onHabitatTap: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onStartParentGateHold: () => void;
  onStopParentGateHold: () => void;
  onDockAction: (action: DockAction) => void;
  onDismissParentHint: () => void;
}

export function GameShell({
  state,
  clockTs,
  clockLabel,
  stageDisplayLabel,
  actionFlowBusy,
  showFeedSheet,
  parentHoldActive,
  parentHoldProgress,
  hatchPhase,
  hatchEggStyle,
  promptSuccessCue,
  starRowBurst,
  starsFilled,
  groundTapActive,
  groundTapFx,
  critterX,
  critterFacing,
  critterMood,
  isCelebrating,
  isCurious,
  isModeling,
  modelClass,
  showParentHint,
  toast,
  hatchAudioRef,
  modelAudioRef,
  successAudioRef,
  starAudioRef,
  sleepAudioRef,
  onShowStatusSheet,
  onHabitatTap,
  onStartParentGateHold,
  onStopParentGateHold,
  onDockAction,
  onDismissParentHint
}: GameShellProps): JSX.Element {
  return (
    <div className="app-shell">
      <main className="main-view">
        <section className="habitat-wrapper">
          <div className={`habitat-bezel ${isNight(clockTs) ? 'night' : 'day'}`}>
            <audio ref={hatchAudioRef} preload="auto">
              <source src="/sounds/hatch.wav" type="audio/wav" />
            </audio>
            <audio ref={modelAudioRef} preload="auto">
              <source src="/sounds/model-ok.wav" type="audio/wav" />
            </audio>
            <audio ref={successAudioRef} preload="auto">
              <source src="/sounds/success.wav" type="audio/wav" />
            </audio>
            <audio ref={starAudioRef} preload="auto">
              <source src="/sounds/star.wav" type="audio/wav" />
            </audio>
            <audio ref={sleepAudioRef} preload="auto">
              <source src="/sounds/sleep.wav" type="audio/wav" />
            </audio>

            <div className="habitat-hud">
              <div className="hud-chip-row">
                <span className="hud-chip">{stageDisplayLabel}</span>
                <span className="hud-chip">{clockLabel}</span>
              </div>

              <div className="hud-actions">
                <button
                  type="button"
                  className="hud-chip hud-chip-btn"
                  disabled={actionFlowBusy}
                  onClick={onShowStatusSheet}
                >
                  Care
                </button>
              </div>

              <div className="meter-row">
                <CompactMeter label="Hunger" value={state.hunger} tone="hunger" />
                <CompactMeter label="Happy" value={state.happiness} tone="happy" />
                <CompactMeter label="Learn" value={state.training} tone="training" />
              </div>
            </div>

            <div className={`habitat-screen ${groundTapActive ? 'ground-tapped' : ''}`} onPointerDown={onHabitatTap}>
              <div className="day-night-glow" aria-hidden="true" />
              <AmbientParticles />
              <div className="pixel-grid" aria-hidden="true" />
              <div className="ground-line" aria-hidden="true" />
              {groundTapFx && (
                <span
                  key={groundTapFx.tick}
                  className="ground-spark"
                  style={{ left: `${groundTapFx.x}%` }}
                  aria-hidden="true"
                >
                  ✦
                </span>
              )}
              <div className="decor decor-plant" aria-hidden="true">
                ✿
              </div>
              <div className="decor decor-sky" aria-hidden="true">
                {isNight(clockTs) ? '✦ ✦ ✧' : '☁ ☀'}
              </div>
              <button
                type="button"
                className={`parent-lock ${parentHoldActive ? 'holding' : ''}`}
                aria-label="Open parent mode"
                onPointerDown={onStartParentGateHold}
                onPointerUp={onStopParentGateHold}
                onPointerLeave={onStopParentGateHold}
                onPointerCancel={onStopParentGateHold}
              >
                <ActionGlyph icon="lock" />
                <span className="lock-progress-track" aria-hidden="true">
                  <span style={{ width: `${parentHoldProgress}%` }} />
                </span>
              </button>
              {hatchPhase !== 'idle' && (
                <div className={`hatch-overlay phase-${hatchPhase}`} aria-hidden="true">
                  {(hatchPhase === 'shake' || hatchPhase === 'crack') && (
                    <>
                      <div className={`hatch-egg ${hatchPhase === 'shake' ? 'shake' : ''}`}>
                        <EggSprite eggStyle={hatchEggStyle} size="large" />
                      </div>
                      {hatchPhase === 'crack' && (
                        <>
                          <div className="hatch-crack-line hatch-crack-a" />
                          <div className="hatch-crack-line hatch-crack-b" />
                          <div className="hatch-flash" />
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              <div
                className={`critter-zone ${state.asleep ? 'asleep' : ''} ${hatchPhase === 'pop' ? 'hatch-pop' : ''} ${isCelebrating ? 'celebrate' : ''} ${isCurious ? 'curious' : ''} ${isModeling ? `modeling ${modelClass}` : ''}`}
                style={{ left: `${critterX}%` }}
                aria-live="polite"
              >
                {isModeling && (
                  <div className="critter-speech modeling" role="status" aria-live="polite">
                    <p className="critter-speech-main">Okay!</p>
                    <p className="critter-speech-sub">I can listen first.</p>
                  </div>
                )}
                {promptSuccessCue && (
                  <div className="critter-speech" role="status" aria-live="polite">
                    <p className="critter-speech-main">
                      <span className="critter-speech-icon" aria-hidden="true">
                        <ActionGlyph icon={promptSuccessCue.icon} />
                      </span>
                      {promptSuccessCue.text}
                    </p>
                    <p className="critter-speech-sub">You did it!</p>
                  </div>
                )}
                {isCelebrating && <SparkleBurst large={starRowBurst} />}
                {state.stage === 'egg' ? (
                  <EggSprite eggStyle={state.eggStyle ?? 'speckled'} size="large" />
                ) : (
                  <div
                    className={`${critterFacing === 'left' ? 'critter-face-left' : ''} ${isModeling ? 'critter-listening' : ''}`}
                  >
                    <CritterSprite
                      variant={state.critterVariant}
                      stage={state.stage}
                      asleep={state.asleep}
                      sickness={state.sickness}
                      mood={critterMood}
                    />
                  </div>
                )}
              </div>

              <div className="status-flags">
                {state.asleep && <p>Sleeping... zZz</p>}
                {state.sickness && <p className="warning">Feeling sick</p>}
                {state.attentionDemand.active && <p className="attention">Needs attention</p>}
              </div>
            </div>
          </div>
          <div className={`star-meter ${starRowBurst ? 'burst' : ''}`}>
            <p className="star-meter-label">Stars</p>
            <div className="star-row" aria-label={`${starsFilled} of 5 stars`}>
              {Array.from({ length: 5 }).map((_, index) => (
                <span
                  key={`star-${index}`}
                  className={`star-slot ${index < starsFilled ? 'filled' : ''}`}
                  aria-hidden="true"
                >
                  ★
                </span>
              ))}
            </div>
            <p className="star-meter-count">
              {starRowBurst ? 'Yay!' : `Today: ${state.successfulMirrorsToday} listens`}
            </p>
          </div>
        </section>
      </main>

      <nav className="action-dock" aria-label="Main actions">
        <DockButton
          label="Feed"
          icon="meal"
          active={showFeedSheet}
          disabled={actionFlowBusy}
          onClick={() => onDockAction('feed')}
        />
        <DockButton
          label="Play"
          icon="play"
          disabled={actionFlowBusy}
          onClick={() => onDockAction('play')}
        />
        <DockButton
          label="Learn"
          icon="learn"
          disabled={actionFlowBusy}
          onClick={() => onDockAction('learn')}
        />
        <DockButton
          label={state.asleep ? 'Wake' : 'Sleep'}
          icon="sleep"
          disabled={actionFlowBusy}
          onClick={() => onDockAction('sleep')}
        />
      </nav>

      {showParentHint && (
        <div className="hint-overlay" role="status">
          <div className="hint-card pixel-card">
            <p>Grown-ups: hold the lock for 2 seconds to open Parent Mode.</p>
            <button type="button" className="primary-btn" onClick={onDismissParentHint}>
              Got It
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
