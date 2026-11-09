import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minus, X } from 'lucide-react';
import type { AssistantState, TaskState } from '../types';
import { HumanoidPresence } from './HumanoidPresence';
import './RODEXFloatingCompanion.css';

interface RODEXFloatingCompanionProps {
  active: boolean;
  state: AssistantState;
  taskState?: TaskState;
  audioLevel: number;
  onSpeak: () => void | Promise<void>;
  onExpand: () => void;
}

export const RODEXFloatingCompanion: React.FC<RODEXFloatingCompanionProps> = ({
  active, state, taskState, audioLevel, onSpeak, onExpand,
}) => {
  const [minimized, setMinimized] = useState(false);
  const [hidden, setHidden] = useState(false);

  React.useEffect(() => {
    if (!active) {
      setMinimized(false);
      setHidden(false);
    }
  }, [active]);

  if (!active || hidden || typeof document === 'undefined') return null;
  return createPortal(
    <aside className={`rodex-floating-companion ${minimized ? 'rodex-floating-companion--min' : ''}`}
      aria-label="RODEX companion while working">
      <header className="rodex-floating-header">
        <span>RODEX</span>
        <div className="rodex-floating-actions">
          <button type="button" onClick={() => setMinimized(m => !m)}
            title={minimized ? 'Show RODEX' : 'Minimize RODEX'}
            aria-label={minimized ? 'Show RODEX companion' : 'Minimize RODEX companion'}>
            <Minus size={15} aria-hidden="true"/>
          </button>
          <button type="button" onClick={onExpand}
            title="Return to full RODEX conversation" aria-label="Return to full RODEX companion">
            <Maximize2 size={15} aria-hidden="true"/>
          </button>
          <button type="button" onClick={() => setHidden(true)}
            title="Hide floating companion" aria-label="Hide floating RODEX companion">
            <X size={15} aria-hidden="true"/>
          </button>
        </div>
      </header>
      {!minimized && (
        <div className="rodex-floating-image">
          <HumanoidPresence compact state={state} audioLevel={audioLevel}
            taskState={taskState} onInteract={onSpeak} onExpand={onExpand}/>
        </div>
      )}
    </aside>,
    document.body
  );
};
