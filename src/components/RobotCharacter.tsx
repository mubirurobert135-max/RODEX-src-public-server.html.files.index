import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { AssistantState, TaskState } from '../types';
import { ROBOT_FRAMES } from './robotFrames';
import { isolateRobotFrame } from './robotCutout';
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

  // Remove the demo panels and their rectangular background from all 16
  // original robot poses. Decoding is local; no network call or AI request.
  const [preparedFrames, setPreparedFrames] = useState<(string | undefined)[]>([]);
  useEffect(() => {
    let active = true;
    const ownedUrls: string[] = [];
    ROBOT_FRAMES.forEach((frame, index) => {
      isolateRobotFrame(frame).then(url => {
        if (!active) {
          if (url.startsWith('blob:')) URL.revokeObjectURL(url);
          return;
        }
        if (url.startsWith('blob:')) ownedUrls.push(url);
        setPreparedFrames(previous => {
          const next = [...previous];
          next[index] = url;
          return next;
        });
      }).catch(error => {
        console.warn('[RODEX character] Unable to prepare animation frame', index, error);
      });
    });
    return () => {
      active = false;
      ownedUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  // Behaviour is triggered by genuine assistant and voice state. Short,
  // imperfectly-spaced micro-gestures feel more natural than fixed loops.
  // Speech still moves the face when a browser TTS engine supplies no output
  // meter, which is normal in Chrome's speechSynthesis implementation.
  useEffect(() => {
    const neutralPose = INITIAL_POSE[expression];
    setPose(neutralPose);
    if (reducedMotion) return;

    const timers = new Set<number>();
    let beat = 0;
    const schedule = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        if (!document.hidden) fn();
      }, ms);
      timers.add(id);
    };
    const clearScheduled = () => {
      timers.forEach(id => window.clearTimeout(id));
      timers.clear();
    };
    const next = () => {
      beat += 1;
      switch (expression) {
        case 'rest': {
          setPose(1); // a blink; no on-screen indicator
          schedule(145 + Math.random() * 90, () => setPose(0));
          schedule(3200 + Math.random() * 3700, next);
          break;
        }
        case 'wake': {
          setPose(3); // acknowledges the human, without announcing a state
          break;
        }
        case 'focus': {
          // An attentive tilt responds to actual incoming voice energy.
          setPose(levelRef.current > 0.10 ? 6 : (beat % 3 === 0 ? 5 : 6));
          schedule(680 + Math.random() * 330, next);
          break;
        }
        case 'think': {
          setPose(beat % 3 === 0 ? 8 : 7);
          schedule(1150 + Math.random() * 730, next);
          break;
        }
        case 'speak': {
          const actionReply = /\b(opened|opening|launched|launching|playing|searching|found|sent|navigating|youtube|browser)\b/i.test(lastResponse);
          const sequence = actionReply ? [3, 4, 9, 13, 4] : [3, 13, 14, 3, 9, 13];
          setPose(sequence[beat % sequence.length]);
          // Measured output makes gestures slightly faster, but is optional.
          const energetic = levelRef.current > 0.10;
          schedule((energetic ? 420 : 590) + Math.random() * 180, next);
          break;
        }
        case 'act': {
          setPose(beat % 2 ? 10 : 11);
          schedule(960 + Math.random() * 370, next);
          break;
        }
        case 'happy': {
          setPose(13);
          break;
        }
        case 'concerned': {
          setPose(15);
          break;
        }
      }
    };

    const initialDelay = expression === 'wake' ? 480
      : expression === 'happy' ? 620
      : expression === 'concerned' ? 880
      : expression === 'rest' ? 3100
      : 470;

    const visibilityChanged = () => {
      clearScheduled();
      setPose(neutralPose);
      if (!document.hidden) schedule(initialDelay, next);
    };
    document.addEventListener('visibilitychange', visibilityChanged);
    if (!document.hidden) schedule(initialDelay, next);
    return () => {
      clearScheduled();
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [expression, lastResponse, reducedMotion]);

  const gazeFrame = useRef<number | null>(null);
  const gazeTarget = useRef({ x: 0, y: 0 });
  useEffect(() => () => {
    if (gazeFrame.current !== null) window.cancelAnimationFrame(gazeFrame.current);
  }, []);

  const moveGaze = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (reducedMotion || event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    gazeTarget.current = {
      x: Math.max(-1, Math.min(1, (event.clientX - rect.left - rect.width / 2) / (rect.width / 2))),
      y: Math.max(-1, Math.min(1, (event.clientY - rect.top - rect.height / 2) / (rect.height / 2))),
    };
    // Pointer events may arrive faster than the display can paint.
    if (gazeFrame.current === null) {
      gazeFrame.current = window.requestAnimationFrame(() => {
        setGaze(gazeTarget.current);
        gazeFrame.current = null;
      });
    }
  };
  const resetGaze = () => {
    if (gazeFrame.current !== null) window.cancelAnimationFrame(gazeFrame.current);
    gazeFrame.current = null;
    gazeTarget.current = { x: 0, y: 0 };
    setGaze({ x: 0, y: 0 });
  };

  return (
    <button
      type="button"
      className="rodex-robot-button"
      onClick={onClick}
      aria-label="Speak with RODEX"
      title="Speak with RODEX"
      onPointerMove={moveGaze}
      onPointerLeave={resetGaze}
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
            {preparedFrames[pose] || preparedFrames[0] ? (
              <AnimatePresence initial={false}>
                <motion.img
                  key={pose}
                  src={preparedFrames[pose] || preparedFrames[0]}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="rodex-robot-pose"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.20, ease: 'easeInOut' }}
                />
              </AnimatePresence>
            ) : (
              <span className="rodex-robot-boot" aria-hidden="true" />
            )}
          </span>
        </motion.span>
      </span>
      <span className="rodex-robot-light-ring" aria-hidden="true" />
      <span className="rodex-robot-ground-glow" aria-hidden="true" />
    </button>
  );
};
