import React, { useCallback, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import type { AssistantState, TaskState } from '../types';
import { RODEX3DScene } from './RODEX3DScene';
import { RODEX_APPROVED_PORTRAIT } from './approvedAvatar';
import './HumanoidPresence.css';

interface HumanoidPresenceProps {
  state: AssistantState;
  audioLevel: number;
  taskState?: TaskState;
  compact?: boolean;
  onInteract: () => void | Promise<void>;
  onExpand?: () => void;
}

/** RODEX is a single character across Home, Workspace and floating tools.
 * The approved portrait is the texture of the real 3D face; only unsupported
 * WebGL2 devices fall back to its original 2D cutout. */
export const HumanoidPresence: React.FC<HumanoidPresenceProps> = ({
  state, audioLevel, taskState, compact = false, onInteract, onExpand,
}) => {
  const [unavailable, setUnavailable] = useState(false);
  const onUnavailable = useCallback(() => setUnavailable(true), []);
  const speaking = state === 'speaking';
  const attentive = state === 'listening' || state === 'input_detected' ||
    state === 'wake_detected' || state === 'wake_listening';
  const hasError = state === 'error' || state === 'warning' || taskState === 'FAILED';

  return (
    <div className={'rodex-human-presence' + (compact ? ' rodex-human-presence--compact' : '')}
      data-renderer={unavailable ? 'portrait-fallback' : 'webgl3d'}
      data-expression={hasError ? 'concerned' : speaking ? 'speaking' :
        attentive ? 'attentive' : 'relaxed'}>
      {unavailable ? (
        <img className="rodex-human-portrait" src={RODEX_APPROVED_PORTRAIT}
          alt="" draggable={false} decoding="async"/>
      ) : (
        <RODEX3DScene compact={compact} onUnavailable={onUnavailable}
          signal={{ state, taskState, audioLevel }}/>
      )}
      <button type="button" className="rodex-human-interact"
        onClick={onInteract}
        aria-label={compact ? 'Speak with RODEX floating companion' : 'Talk to RODEX'}
        title={compact ? 'Talk to RODEX' : 'Talk to RODEX'}>
        <span className="sr-only">Talk to RODEX</span>
      </button>
      {compact && onExpand && (
        <button type="button" className="rodex-human-expand"
          onClick={onExpand} aria-label="Expand RODEX companion to full view"
          title="Expand RODEX">
          <Maximize2 aria-hidden="true" size={17}/>
        </button>
      )}
    </div>
  );
};
