import React from 'react';
import { Maximize2 } from 'lucide-react';
import type { AssistantState, TaskState } from '../types';
import './HumanoidPresence.css';

/**
 * RODEX Human Presence — reference-preserving 2.5D character renderer.
 * The local portrait is the approved, front-facing pearl-white / titanium
 * humanoid. Motion is driven by real voice/task states, not a fake timer
 * pretending microphone or network activity has been detected.
 *
 * This is intentionally not marketed as a rigged 3D/lip-sync system.
 * The 3D rig and accurate visemes require their own authored animation assets.
 */
interface HumanoidPresenceProps {
  state: AssistantState;
  audioLevel: number;
  taskState?: TaskState;
  compact?: boolean;
  onInteract: () => void | Promise<void>;
  onExpand?: () => void;
}
export const HumanoidPresence: React.FC<HumanoidPresenceProps> = ({
  state, audioLevel, taskState, compact = false, onInteract, onExpand,
}) => {
  const speaking = state === 'speaking';
  const attentive = state === 'listening' || state === 'input_detected' || state === 'wake_detected';
  const engaged = attentive || speaking || state === 'thinking' || state === 'processing';
  const hasError = state === 'error' || state === 'warning' || taskState === 'FAILED';
  const level = Math.min(1, Math.max(0, Number.isFinite(audioLevel) ? audioLevel : 0));
  const motionStrength = speaking ? Math.min(1, level * 1.6) : 0;
  return (
    <div
      className={`rodex-human-presence ${compact ? 'rodex-human-presence--compact' : ''}`}
      data-expression={hasError ? 'concerned' : speaking ? 'speaking' : attentive ? 'attentive' : engaged ? 'engaged' : 'relaxed'}
      style={{ '--rodex-speech-level': String(motionStrength) } as React.CSSProperties}
    >
      <button
        type="button"
        className="rodex-human-portrait-button"
        onClick={onInteract}
        aria-label={compact ? 'Speak with RODEX floating companion' : 'Talk to RODEX'}
        title={compact ? 'Speak with RODEX' : 'Talk to RODEX'}
      >
        <img
          className="rodex-human-portrait"
          src="/assets/rodex-humanoid.webp"
          alt=""
          draggable={false}
          decoding="async"
          loading={compact ? 'lazy' : 'eager'}
        />
        {/* A very small, audio-driven mouth texture displacement preserves
            the user's portrait without drawing an unrelated cartoon mouth. */}
        {speaking && (
          <img
            className="rodex-human-mouth-motion"
            src="/assets/rodex-humanoid.webp"
            alt=""
            draggable={false}
            aria-hidden="true"
          />
        )}
      </button>
      {compact && onExpand && (
        <button
          type="button"
          className="rodex-human-expand"
          onClick={onExpand}
          aria-label="Expand RODEX companion to full view"
          title="Expand RODEX"
        >
          <Maximize2 aria-hidden="true" size={17}/>
        </button>
      )}
    </div>
  );
};
