import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { AssistantState, TaskState } from '../types';
import { ROBOT_FRAMES } from './robotFrames';
import './RobotCharacter.css';

type Expression =
  | 'rest' | 'wake' | 'focus' | 'think' | 'speak' | 'act'
  | 'happy' | 'concerned';

interface RobotCharacterProps {
  state: AssistantState;
  audioLevel?: number;
  taskState?: TaskState;
  lastResponse?: string;
  onClick: () => void | Promise<void>;
}

/** The RODEX robot is the interface itself, not a separate status display. */
function resolveExpression(state: AssistantState, taskState?: TaskState): Expression {
  if (state === 'error' || taskState === 'FAILED') return 'concerned';
  if (state === 'warning' || state === 'permission_required') return 'concerned';
  if (state === 'success' || taskState === 'COMPLETED') return 'happy';
  if (state === 'executing' || state === 'executing_tool' || taskState === 'EXECUTING') return 'act';
  if (state === 'speaking') return 'speak';
  if (state === 'thinking' || state === 'processing' || state === 'planning' || taskState === 'PLANNING') return 'think';
  if (state === 'listening' || state === 'input_detected') return 'focus';
  if (state === 'wake_detected' || state === 'wake_listening') return 'wake';
  return 'rest';
}

const INITIAL_POSE: Record<Expression, number> = {
  rest: 0,
  wake: 2,
  focus: 6,
  think: 7,
  speak: 3,
  act: 10,
  happy: 12,
  concerned: 8,
};

export const RobotCharacter: React.FC<RobotCharacterProps> = ({
  state,
  audioLevel = 0,
  taskState,
  lastResponse = '',
  onClick,
}) => {
  const expression = resolveExpression(state, taskState);
  const reducedMotion = useReducedMotion();
  const [pose, setPose] = useState(INITIAL_POSE[expression]);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const levelRef = useRef(audioLevel);
  levelRef.current = audioLevel;

  // Human-like changes of attention: brief greeting, blink, consideration,
  // speech gestures, task acknowledgement and relaxed return to neutral.
  // These expressions are driven by real voice and task state, never by demo timers.
  useEffect(() => {
    setPose(INITIAL_POSE[expression]);
    if (reducedMotion) return;
    const timers: number[] = [];
    let interval: number | undefined;
    const after = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    if (expression === 'wake') {
      after(620, () => setPose(3));
    } else if (expression === 'rest') {
      interval = window.setInterval(() => {
        setPose(1); // small friendly blink
        after(220, () => setPose(0));
      }, 4400);
    } else if (expression === 'focus') {
      interval = window.setInterval(() => {
        setPose(levelRef.current > 0.13 ? 6 : 5);
        after(420, () => setPose(6));
      }, 1600);
    } else if (expression === 'think') {
      interval = window.setInterval(() => {
        setPose(p => p === 7 ? 8 : 7);
      }, 1750);
    } else if (expression === 'speak') {
      // Delivering an action/result calls for a different hand gesture than a
      // conversational reply; voice energy controls the pace without flashing.
      const isActionReply = /\b(open|launch|playing|search|send|found|youtube|browser|navigate)\b/i.test(lastResponse);
      let beat = 0;
      interval = window.setInterval(() => {
        beat++;
        const animated = levelRef.current > 0.09;
        setPose(isActionReply ? (beat % 3 === 0 ? 4 : 9) : (animated ? (beat % 2 ? 3 : 13) : 14));
      }, 710);
    } else if (expression === 'act') {
      interval = window.setInterval(() => setPose(p => p === 10 ? 11 : 10), 1250);
    } else if (expression === 'happy') {
      after(820, () => setPose(13));
    } else if (expression === 'concerned') {
      after(1100, () => setPose(15));
    }

    return () => {
      if (interval !== undefined) window.clearInterval(interval);
      timers.forEach(window.clearTimeout);
    };
  }, [expression, lastResponse, reducedMotion]);

  return (
    <button
      type="button"
      className="rodex-robot-button"
      onClick={onClick}
      aria-label="Speak with RODEX"
      title="Speak with RODEX"
      onPointerMove={(event) => {
        if (reducedMotion || event.pointerType !== 'mouse') return;
        const box = event.currentTarget.getBoundingClientRect();
        setGaze({
          x: Math.max(-1, Math.min(1, (event.clientX - box.left - box.width / 2) / (box.width / 2))),
          y: Math.max(-1, Math.min(1, (event.clientY - box.top - box.height / 2) / (box.height / 2))),
        });
      }}
      onPointerLeave={() => setGaze({ x: 0, y: 0 })}
    >
      <span className="rodex-robot-ambient" aria-hidden="true" />
      <span className="rodex-robot-scale" aria-hidden="true">
        <motion.span
          className="rodex-robot-floating"
          animate={reducedMotion ? {} : {
            y: expression === 'act' ? [0, -9, 0] : [0, -7, 0],
            rotateY: gaze.x * 5,
            rotateX: -gaze.y * 3,
            rotateZ: expression === 'think' ? [-1.4, 1.4, -1.4] : [0, 0.6, 0],
          }}
          transition={{
            y: { repeat: Infinity, duration: expression === 'act' ? 2.1 : 3.7, ease: 'easeInOut' },
            rotateZ: { repeat: Infinity, duration: 4, ease: 'easeInOut' },
            rotateX: { duration: 0.23 }, rotateY: { duration: 0.23 },
          }}
        >
          <span className="rodex-robot-viewport">
            <AnimatePresence initial={false}>
              <motion.img
                key={pose}
                src={ROBOT_FRAMES[pose]}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="rodex-robot-pose"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.25, ease: 'easeInOut' }}
              />
            </AnimatePresence>
          </span>
        </motion.span>
      </span>
      <span className="rodex-robot-light-ring" aria-hidden="true" />
      <span className="rodex-robot-ground-glow" aria-hidden="true" />
    </button>
  );
};
