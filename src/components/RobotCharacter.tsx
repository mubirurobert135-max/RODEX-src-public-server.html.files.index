import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'motion/react';
import type { AssistantState, TaskState } from '../types';
import './RobotCharacter.css';

type Expression = 'rest' | 'wake' | 'focus' | 'think' | 'speak' | 'act' | 'happy' | 'concerned';

interface RobotCharacterProps {
  state: AssistantState;
  audioLevel?: number;
  taskState?: TaskState;
  lastResponse?: string;
  onClick: () => void | Promise<void>;
}

/**
 * RODEX's original robot silhouette, redrawn as an infinitely scalable
 * dimensional vector. No bitmap crop, picture panel, CSS mask or iframe.
 * Every expression reacts to actual assistant state.
 */
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

export const RobotCharacter: React.FC<RobotCharacterProps> = ({
  state,
  audioLevel = 0,
  taskState,
  lastResponse = '',
  onClick,
}) => {
  const expression = resolveExpression(state, taskState);
  const reducedMotion = useReducedMotion();
  const [blink, setBlink] = useState(false);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [gestureBeat, setGestureBeat] = useState(0);
  const spinControls = useAnimationControls();
  const gazeFrame = useRef<number | null>(null);
  const safeAudio = Math.min(1, Math.max(0, audioLevel || 0));
  const actionReply = /\b(opened|opening|launched|launching|playing|searching|found|sent|navigating|youtube|browser)\b/i.test(lastResponse);
  const happy = expression === 'happy' || (expression === 'speak' && /thank|great|wonderful|welcome/i.test(lastResponse));
  const speaking = expression === 'speak';
  const focused = expression === 'focus' || expression === 'wake';
  const busy = expression === 'think' || expression === 'act';
  const concerned = expression === 'concerned';

  useEffect(() => {
    if (reducedMotion) { setBlink(false); return; }
    let blinkTimer: number | undefined;
    let reopenTimer: number | undefined;
    let cancelled = false;
    const next = () => {
      blinkTimer = window.setTimeout(() => {
        if (cancelled) return;
        if (document.visibilityState === 'visible' && expression !== 'speak') {
          setBlink(true);
          reopenTimer = window.setTimeout(() => setBlink(false), 140);
        }
        next();
      }, 2500 + Math.random() * 3800);
    };
    next();
    return () => {
      cancelled = true;
      window.clearTimeout(blinkTimer);
      window.clearTimeout(reopenTimer);
    };
  }, [reducedMotion, expression]);

  // The reference is used for motion language, never for character identity.
  // A full turn is a purposeful welcome or celebration, not an endless idle loop.
  // The outer HTML layer supplies perspective and spring-guided rotation;
  // the independent inner body/face/arms keep moving during the turn.
  useEffect(() => {
    let cancelled = false;
    spinControls.stop();

    if (reducedMotion || document.visibilityState === 'hidden') {
      spinControls.set({ rotateY: 0, rotateZ: 0, scale: 1 });
      return;
    }

    const play = async () => {
      if (expression === 'wake' || expression === 'happy') {
        spinControls.set({ rotateY: 0, rotateZ: 0, scale: 1 });
        await spinControls.start({
          rotateY: [0, -23, 83, 177, 270, 360],
          rotateZ: [0, -2.3, 0, 1.5, 0, 0],
          scale: [1, 1.025, 1.045, 1.015, 1.035, 1],
          transition: {
            duration: expression === 'wake' ? 1.65 : 1.85,
            times: [0, .15, .37, .59, .82, 1],
            ease: 'easeInOut',
          },
        });
        if (!cancelled) spinControls.set({ rotateY: 0, rotateZ: 0, scale: 1 });
      } else if (expression === 'act') {
        // Look toward the task, then naturally return to the user.
        await spinControls.start({
          rotateY: [0, -12, -34, -23, 0],
          rotateZ: [0, -.6, 1, 0, 0],
          transition: { duration: 1.7, ease: 'easeInOut' },
        });
      } else {
        await spinControls.start({
          rotateY: expression === 'think' ? -13 : expression === 'focus' ? 6 : 0,
          rotateZ: 0,
          scale: 1,
          transition: { type: 'spring', stiffness: 75, damping: 18 },
        });
      }
    };

    void play();
    return () => {
      cancelled = true;
      spinControls.stop();
    };
  }, [expression, reducedMotion, spinControls]);

  // Deliberately non-metronomic gestures. Mouth/noise labels never appear:
  // speaking is conveyed by face, head, arms and the output audio energy.
  useEffect(() => {
    if (reducedMotion || (!speaking && expression !== 'think' && expression !== 'focus')) {
      setGestureBeat(0);
      return;
    }
    let timer: number;
    let cancelled = false;
    const schedule = () => {
      timer = window.setTimeout(() => {
        if (cancelled) return;
        if (document.visibilityState === 'visible') setGestureBeat(beat => (beat + 1) % 8);
        schedule();
      }, speaking ? 480 + Math.random() * 490 : 1250 + Math.random() * 750);
    };
    schedule();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [speaking, expression, reducedMotion]);

  useEffect(() => () => {
    if (gazeFrame.current !== null) window.cancelAnimationFrame(gazeFrame.current);
  }, []);

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (reducedMotion || event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - .5) * 2));
    const y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - .5) * 2));
    if (gazeFrame.current !== null) return;
    gazeFrame.current = window.requestAnimationFrame(() => {
      setGaze({ x, y });
      gazeFrame.current = null;
    });
  };
  const resetGaze = () => {
    if (gazeFrame.current !== null) window.cancelAnimationFrame(gazeFrame.current);
    gazeFrame.current = null;
    setGaze({ x: 0, y: 0 });
  };

  const eyeSet = happy ? 'happy' : concerned ? 'concerned' : focused ? 'focus' : busy ? 'busy' : 'rest';
  const headTilt = concerned ? -5 : expression === 'think' ? -7 : expression === 'wake' ? 5 : 0;
  const rightGesture = expression === 'act' ? -28 : speaking && actionReply ? -25 : happy ? -19 : speaking ? -12 : expression === 'think' ? -9 : 0;
  const leftGesture = happy ? 16 : focused ? -8 : speaking ? (gestureBeat % 3 === 0 ? 17 : 5) : 0;
  const reactiveGesture = speaking ? [-4, -14, 2, -7, 8, -4, -12, 2][gestureBeat] : 0;

  return (
    <button
      type="button"
      className="rodex-robot-button"
      onClick={onClick}
      aria-label="Speak with RODEX"
      title="Speak with RODEX"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetGaze}
    >
      <span className="rodex-dimensional-atmosphere" aria-hidden="true" />
      <span className="rodex-holographic-floor" aria-hidden="true" />
      <motion.span className="rodex-robot-spin-shell" animate={spinControls} style={{ transformStyle: 'preserve-3d' }}>
        <svg
        className="rodex-robot-vector"
        viewBox="100 14 400 606"
        role="presentation"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="rdx-air" cx="50%" cy="52%" r="49%">
            <stop offset="0%" stopColor="#1366ac" stopOpacity=".22" />
            <stop offset="62%" stopColor="#08436d" stopOpacity=".08" />
            <stop offset="100%" stopColor="#030711" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="rdx-helmet" cx="26%" cy="17%" r="92%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="22%" stopColor="#f0fbff" />
            <stop offset="48%" stopColor="#c3e8fb" />
            <stop offset="78%" stopColor="#8cc3ea" />
            <stop offset="100%" stopColor="#356b9b" />
          </radialGradient>
          <radialGradient id="rdx-torso" cx="27%" cy="14%" r="98%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="35%" stopColor="#e3f7ff" />
            <stop offset="65%" stopColor="#a4d7f1" />
            <stop offset="88%" stopColor="#72acd5" />
            <stop offset="100%" stopColor="#306589" />
          </radialGradient>
          <linearGradient id="rdx-arm" x1="0%" y1="0%" x2="95%" y2="100%">
            <stop offset="0%" stopColor="#f7fdff" />
            <stop offset="38%" stopColor="#e5f6ff" />
            <stop offset="78%" stopColor="#91c5e9" />
            <stop offset="100%" stopColor="#417ab1" />
          </linearGradient>
          <linearGradient id="rdx-visor" x1="20%" y1="0%" x2="75%" y2="100%">
            <stop offset="0%" stopColor="#0c1c2b" />
            <stop offset="36%" stopColor="#000712" />
            <stop offset="100%" stopColor="#000107" />
          </linearGradient>
          <linearGradient id="rdx-eye" x1="0%" y1="0%" x2="90%" y2="100%">
            <stop offset="0%" stopColor="#58eaff" />
            <stop offset="48%" stopColor="#00d8ff" />
            <stop offset="100%" stopColor="#008dff" />
          </linearGradient>
          <radialGradient id="rdx-floor" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00c8ff" stopOpacity=".47" />
            <stop offset="45%" stopColor="#009bfa" stopOpacity=".18" />
            <stop offset="100%" stopColor="#0075ef" stopOpacity="0" />
          </radialGradient>
          <filter id="rdx-soft-glow" x="-90%" y="-160%" width="280%" height="420%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id="rdx-shadow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
        </defs>

        {/* Character geometry alone rotates; stage atmosphere stays anchored. */}
        <motion.g
          className="rodex-robot-model"
          style={{ transformOrigin: '50% 47%' }}
          animate={reducedMotion ? undefined : {
            y: speaking ? [0, -(7 + safeAudio * 7), 0] : busy ? [0, -9, 0] : [0, -14, 0],
            x: expression === 'think' ? [-3, 4, -3] : 0,
            rotateZ: expression === 'think' ? [0, -2.4, 0] : focused ? [0, 1.1, 0] : [0, .65, 0],
          }}
          transition={{
            y: { duration: speaking ? 1.8 : 4.1, repeat: Infinity, ease: 'easeInOut' },
            rotateZ: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' },
            x: { duration: 4.8, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          {/* The limbs are separate articulated elements; they never clip. */}
          <motion.g
            className="rodex-left-arm"
            style={{ transformOrigin: '192px 310px' }}
            animate={reducedMotion ? undefined : { rotate: leftGesture, y: focused ? -3 : 0 }}
            transition={{ type: 'spring', stiffness: 110, damping: 17 }}
          >
            <path d="M193 309 C176 303 158 320 151 346 C143 373 144 426 153 448 C161 469 178 467 190 450 C210 423 214 357 210 331 C207 321 202 313 193 309Z"
              fill="url(#rdx-arm)" stroke="#b7ddfa" strokeWidth="2" />
            <path d="M159 358 C158 332 172 319 185 320" fill="none" stroke="#fff" strokeWidth="11" strokeLinecap="round" opacity=".32" />
          </motion.g>
          <motion.g
            className="rodex-right-arm"
            style={{ transformOrigin: '402px 313px' }}
            animate={reducedMotion ? undefined : { rotate: rightGesture + reactiveGesture, y: speaking ? [0, -4 - safeAudio * 3, 0] : 0 }}
            transition={{
              rotate: { type: 'spring', stiffness: 105, damping: 15 },
              y: { repeat: speaking ? Infinity : 0, duration: .78, ease: 'easeInOut' },
            }}
          >
            <path d="M398 310 C417 303 438 326 446 351 C460 391 453 440 438 453 C424 468 410 458 401 442 C390 421 384 357 389 329 C391 318 394 314 398 310Z"
              fill="url(#rdx-arm)" stroke="#b5dbf8" strokeWidth="2" />
            <path d="M404 321 C426 325 436 349 437 375" fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" opacity=".27" />
          </motion.g>

          {/* Rounded tapered, pearlescent body with real depth cues. */}
          <path d="M228 290 C252 275 342 276 368 297 C398 325 390 426 350 494 C333 525 314 545 301 550 C284 548 261 524 245 497 C208 436 200 339 228 290Z"
            fill="#2d6a9f" opacity=".43" transform="translate(0 7)" />
          <path d="M228 290 C252 275 342 276 368 297 C398 325 390 426 350 494 C333 525 314 545 301 550 C284 548 261 524 245 497 C208 436 200 339 228 290Z"
            fill="url(#rdx-torso)" stroke="#d9f6ff" strokeWidth="1.5" />
          <path d="M245 306 C231 343 245 414 272 476" stroke="#fff" strokeWidth="17" strokeLinecap="round" fill="none" opacity=".17" />
          <path d="M354 311 C367 367 348 457 315 509" stroke="#3379a5" strokeWidth="17" strokeLinecap="round" fill="none" opacity=".15" />
          <ellipse cx="299" cy="314" rx="57" ry="11" fill="#ffffff" opacity=".16" />

          {/* Large floating helmet, dark glass visor and luminous eyes. */}
          <motion.g
            style={{ transformOrigin: '300px 207px' }}
            animate={reducedMotion ? undefined : {
              rotate: headTilt + gaze.x * 3 + (speaking ? [-2, 1.7, 3, -1, 1, -2, 2, 0][gestureBeat] : 0),
              x: gaze.x * 3,
              y: gaze.y * 2 + (speaking ? Math.max(-4, -safeAudio * 6) : 0),
            }}
            transition={{ type: 'spring', stiffness: 95, damping: 17 }}
          >
            <path d="M181 190 C176 116 228 67 306 66 C388 64 427 124 420 204 C415 259 367 306 301 308 C234 307 185 257 181 190Z"
              fill="url(#rdx-helmet)" stroke="#d3efff" strokeWidth="2.5" />
            <path d="M211 125 C229 86 268 76 299 77" stroke="#fff" strokeWidth="21" strokeLinecap="round" opacity=".40" fill="none" />
            <path d="M196 188 C194 167 199 149 206 132" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".33" fill="none" />
            <path d="M205 210 C221 175 261 162 311 164 C369 165 401 186 407 220 C415 258 376 289 309 293 C257 291 216 275 205 247 C200 233 200 221 205 210Z"
              fill="url(#rdx-visor)" stroke="#152a41" strokeWidth="3" />
            <path d="M216 209 C237 178 277 172 322 172" fill="none" stroke="#69b9ee" strokeWidth="3.5" strokeLinecap="round" opacity=".17" />
            <path d="M217 242 C234 278 278 284 307 284" fill="none" stroke="#00528c" strokeWidth="3" strokeLinecap="round" opacity=".14" />

            <motion.g
              className="rodex-eye-pair"
              animate={reducedMotion ? undefined : {
                scaleY: blink ? .07 : 1,
                x: gaze.x * 2.5,
                y: gaze.y * 1.6,
                opacity: expression === 'think' ? [.75, 1, .75] : 1,
              }}
              style={{ transformOrigin: '300px 232px' }}
              transition={{ scaleY: { duration: .10 }, x: { duration: .2 }, y: { duration: .2 }, opacity: { duration: 1.4, repeat: Infinity } }}
            >
              {eyeSet === 'happy' ? (
                <>
                  <path d="M236 238 Q258 203 280 237 M330 237 Q350 201 375 234" fill="none" stroke="#00aaff" strokeWidth="18" strokeLinecap="round" opacity=".7" filter="url(#rdx-soft-glow)" />
                  <path d="M236 238 Q258 203 280 237 M330 237 Q350 201 375 234" fill="none" stroke="url(#rdx-eye)" strokeWidth="8" strokeLinecap="round" />
                </>
              ) : eyeSet === 'concerned' ? (
                <>
                  <path d="M237 234 L277 228 M335 228 L374 234" fill="none" stroke="#00baff" strokeWidth="17" strokeLinecap="round" opacity=".7" filter="url(#rdx-soft-glow)" />
                  <path d="M237 234 L277 228 M335 228 L374 234" fill="none" stroke="url(#rdx-eye)" strokeWidth="7" strokeLinecap="round" />
                </>
              ) : eyeSet === 'focus' ? (
                <>
                  <ellipse cx="259" cy="230" rx="22" ry="9" fill="#00bbff" filter="url(#rdx-soft-glow)" />
                  <ellipse cx="351" cy="230" rx="22" ry="9" fill="#00bbff" filter="url(#rdx-soft-glow)" />
                  <ellipse cx="259" cy="230" rx="19" ry="7" fill="url(#rdx-eye)" />
                  <ellipse cx="351" cy="230" rx="19" ry="7" fill="url(#rdx-eye)" />
                </>
              ) : (
                <>
                  <path d="M239 223 Q260 225 280 239 M332 237 Q351 222 373 220" fill="none" stroke="#00afff" strokeWidth="19" strokeLinecap="round" opacity={speaking ? '.95' : '.8'} filter="url(#rdx-soft-glow)" />
                  <path d="M239 223 Q260 225 280 239 M332 237 Q351 222 373 220" fill="none" stroke="url(#rdx-eye)" strokeWidth={speaking ? '10' : '8'} strokeLinecap="round" />
                </>
              )}
            </motion.g>
            <ellipse cx="296" cy="107" rx="37" ry="12" fill="#fff" opacity=".10" transform="rotate(-19 296 107)" />
          </motion.g>
          <motion.ellipse
            cx="299" cy="391" rx="17" ry="18"
            fill="#3ddaff" opacity=".12"
            animate={reducedMotion ? undefined : { opacity: speaking ? [.08, .32, .08] : [.07, .15, .07], scale: [1, 1.08, 1] }}
            transition={{ duration: speaking ? .55 : 3.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.g>
        </svg>
      </motion.span>
      <span className="rodex-character-aura" aria-hidden="true" />
    </button>
  );
};
