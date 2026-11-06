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
  const [ambientLook, setAmbientLook] = useState({ x: 0, y: 0 });
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
      // Shallow volumetric gestures preserve a real, forward-facing face.
      // A 360-degree planar SVG flip made the character appear like a card.
      if (expression === 'wake' || expression === 'happy') {
        await spinControls.start({
          rotateY: [0, -9, 12, 0],
          rotateZ: [0, -1.2, 1.5, 0],
          scale: [1, 1.025, 1.045, 1],
          transition: { duration: 1.45, ease: 'easeInOut' },
        });
      } else if (expression === 'act') {
        await spinControls.start({
          rotateY: [0, -8, -16, 0],
          rotateZ: [0, -1.1, 0.9, 0],
          transition: { duration: 1.55, ease: 'easeInOut' },
        });
      } else {
        await spinControls.start({
          rotateY: expression === 'think' ? -8 : expression === 'focus' ? 4 : 0,
          rotateZ: 0,
          scale: 1,
          transition: { type: 'spring', stiffness: 78, damping: 19 },
        });
      }
    };

    void play();
    return () => {
      cancelled = true;
      spinControls.stop();
    };
  }, [expression, reducedMotion, spinControls]);

  // Gentle, irregular idle glances, without overriding direct eye contact.
  useEffect(() => {
    if (reducedMotion || (expression !== 'rest' && expression !== 'think')) {
      setAmbientLook({ x: 0, y: 0 });
      return;
    }
    let cancelled = false;
    let timer: number;
    const look = () => {
      timer = window.setTimeout(() => {
        if (cancelled) return;
        if (document.visibilityState === 'visible') {
          const options = [
            { x: -.65, y: -.1 }, { x: 0, y: 0 },
            { x: .75, y: -.12 }, { x: 0, y: 0 },
            { x: -.2, y: .38 }, { x: 0, y: 0 },
          ];
          setAmbientLook(options[Math.floor(Math.random() * options.length)]);
        }
        look();
      }, 2300 + Math.random() * 3400);
    };
    look();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [expression, reducedMotion]);

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
  const rightGesture = expression === 'act' ? -42 : speaking && actionReply ? -39 : happy ? -44 : speaking ? -28 : expression === 'think' ? -10 : -6;
  const leftGesture = happy ? -72 : focused ? -58 : speaking ? (gestureBeat % 3 === 0 ? -74 : -65) : expression === 'think' ? -61 : -57;
  const reactiveGesture = speaking ? [-4, -14, 2, -7, 8, -4, -12, 2][gestureBeat] : 0;

  return (
    <button
      type="button"
      className="rodex-robot-button"
      data-expression={expression}
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
          viewBox="75 20 450 590"
          role="presentation"
          aria-hidden="true"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="rodex-shell" x1="8%" y1="5%" x2="90%" y2="96%">
              <stop offset="0" stopColor="#fafdff"/>
              <stop offset=".19" stopColor="#ffffff"/>
              <stop offset=".46" stopColor="#dceefa"/>
              <stop offset=".70" stopColor="#a7cbe9"/>
              <stop offset=".88" stopColor="#628fba"/>
              <stop offset="1" stopColor="#284968"/>
            </linearGradient>
            <radialGradient id="rodex-pearl" cx="26%" cy="14%" r="94%">
              <stop offset="0" stopColor="#fff"/>
              <stop offset=".3" stopColor="#f3fbff"/>
              <stop offset=".55" stopColor="#c8e1f6"/>
              <stop offset=".78" stopColor="#81afd4"/>
              <stop offset="1" stopColor="#2f5478"/>
            </radialGradient>
            <linearGradient id="rodex-armor" x1="0%" y1="4%" x2="94%" y2="89%">
              <stop offset="0" stopColor="#fff"/>
              <stop offset=".34" stopColor="#dff2ff"/>
              <stop offset=".65" stopColor="#a1c8e5"/>
              <stop offset=".85" stopColor="#5a92c3"/>
              <stop offset="1" stopColor="#1e456e"/>
            </linearGradient>
            <linearGradient id="rodex-dark-seam" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0" stopColor="#173f5b"/>
              <stop offset=".5" stopColor="#06192a"/>
              <stop offset="1" stopColor="#1d5479"/>
            </linearGradient>
            <radialGradient id="rodex-visor" cx="42%" cy="24%" r="92%">
              <stop offset="0" stopColor="#132a42"/>
              <stop offset=".34" stopColor="#081321"/>
              <stop offset=".76" stopColor="#03070e"/>
              <stop offset="1" stopColor="#000309"/>
            </radialGradient>
            <linearGradient id="rodex-visor-glint" x1="12%" y1="0%" x2="77%" y2="100%">
              <stop offset="0" stopColor="#b9f4ff" stopOpacity=".22"/>
              <stop offset=".42" stopColor="#74cfff" stopOpacity=".045"/>
              <stop offset="1" stopColor="#00294b" stopOpacity="0"/>
            </linearGradient>
            <radialGradient id="rodex-energy" cx="40%" cy="28%" r="68%">
              <stop offset="0" stopColor="#ebffff"/>
              <stop offset=".24" stopColor="#78f8ff"/>
              <stop offset=".54" stopColor="#00c3ff"/>
              <stop offset=".82" stopColor="#1261f9"/>
              <stop offset="1" stopColor="#09234d"/>
            </radialGradient>
            <linearGradient id="rodex-eye" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0" stopColor="#c6ffff"/>
              <stop offset=".4" stopColor="#38f0ff"/>
              <stop offset="1" stopColor="#008aff"/>
            </linearGradient>
            <linearGradient id="rodex-hand" x1="0%" y1="0%" x2="90%" y2="100%">
              <stop offset="0" stopColor="#fff"/>
              <stop offset=".45" stopColor="#d8effd"/>
              <stop offset="1" stopColor="#619ac7"/>
            </linearGradient>
            <radialGradient id="rodex-underlight" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#20daff" stopOpacity=".67"/>
              <stop offset=".47" stopColor="#008ded" stopOpacity=".22"/>
              <stop offset="1" stopColor="#02448d" stopOpacity="0"/>
            </radialGradient>
            <filter id="rodex-neon" x="-115%" y="-150%" width="330%" height="400%">
              <feGaussianBlur stdDeviation="5"/>
            </filter>
            <filter id="rodex-shadow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="9"/>
            </filter>
            <filter id="rodex-small-neon" x="-80%" y="-100%" width="260%" height="300%">
              <feGaussianBlur stdDeviation="2.8"/>
            </filter>
          </defs>

          <ellipse cx="301" cy="557" rx="124" ry="17" fill="url(#rodex-underlight)" opacity=".7"/>
          <motion.g
            className="rodex-robot-model"
            style={{ transformOrigin: '300px 293px' }}
            animate={reducedMotion ? undefined : {
              y: speaking ? [0, -5 - safeAudio * 3, 0] : busy ? [0, -5, 0] : [0, -10, 0],
              rotateZ: concerned ? [-1, -2, -1] : focused ? [0, .65, 0] : [0, 1.15, 0],
            }}
            transition={{
              y: { duration: speaking ? 1.5 : 4.3, ease: 'easeInOut', repeat: Infinity },
              rotateZ: { duration: 5.8, ease: 'easeInOut', repeat: Infinity },
            }}
          >
            {/* Rear armor and neck give the face physical depth instead of an image plane. */}
            <path d="M254 270 Q299 253 347 271 L360 307 Q300 322 240 305Z" fill="#112d47" opacity=".66"/>
            <path d="M278 269 L323 268 L326 310 Q301 327 274 307Z" fill="url(#rodex-dark-seam)" stroke="#5085ac" strokeWidth="2.4"/>
            <path d="M282 287 Q301 297 320 286" fill="none" stroke="#54c4ef" strokeOpacity=".65" strokeWidth="2"/>
            <path d="M288 304 L311 304" stroke="#90eaff" strokeWidth="2.5" strokeLinecap="round" opacity=".56"/>

            {/* Left shoulder and articulated arm: separate joints track conversational motion. */}
            <g>
              <ellipse cx="219" cy="320" rx="31" ry="29" fill="#122d49" opacity=".65"/>
              <ellipse cx="219" cy="318" rx="24" ry="22" fill="url(#rodex-armor)" stroke="#9bc9e9" strokeWidth="2"/>
              <circle cx="219" cy="320" r="10" fill="url(#rodex-dark-seam)" stroke="#4d9bd1" strokeWidth="2"/>
              <circle cx="219" cy="320" r="5" fill="#08bfff" opacity=".8"/>
            </g>
            {/* Right arm opens naturally on actions and is never an inert cutout. */}
            <g>
              <ellipse cx="383" cy="318" rx="30" ry="29" fill="#0c2a4a" opacity=".7"/>
              <ellipse cx="383" cy="316" rx="25" ry="23" fill="url(#rodex-armor)" stroke="#b4def8" strokeWidth="2"/>
              <circle cx="383" cy="318" r="10" fill="url(#rodex-dark-seam)" stroke="#51aee4" strokeWidth="2"/>
              <circle cx="383" cy="318" r="5" fill="#0bcaff"/>
            </g>
            <motion.g
              className="rodex-right-arm"
              style={{ transformOrigin: '382px 317px' }}
              animate={reducedMotion ? undefined : {
                rotate: rightGesture + reactiveGesture,
                y: speaking ? [0, -3 - safeAudio * 2, 0] : 0,
              }}
              transition={{
                rotate: { type: 'spring', stiffness: 96, damping: 19 },
                y: { duration: .9, repeat: speaking ? Infinity : 0, ease: 'easeInOut' },
              }}
            >
              <path d="M392 315 C415 310 436 333 444 361 C453 395 440 427 422 439 C407 445 389 421 382 392 C373 360 378 325 392 315Z" fill="#0e304f" opacity=".7" transform="translate(3 5)"/>
              <path d="M392 311 C415 307 437 332 443 362 C449 397 439 422 422 435 C407 439 390 420 382 389 C375 360 379 323 392 311Z" fill="url(#rodex-armor)" stroke="#c4e8fd" strokeWidth="2.4"/>
              <path d="M398 326 Q432 335 431 381" fill="none" stroke="white" strokeOpacity=".43" strokeWidth="9" strokeLinecap="round"/>
              <path d="M422 414 Q433 424 430 437" fill="none" stroke="#478ebb" strokeWidth="3" opacity=".43"/>
              <ellipse cx="426" cy="434" rx="17" ry="14" fill="url(#rodex-dark-seam)" stroke="#8fd3f2" strokeWidth="2"/>
              <path d="M414 433 Q428 446 438 432" fill="none" stroke="#17c7ff" strokeWidth="3" opacity=".78"/>
              <g>
                <path d="M415 436 Q401 438 396 446 L395 457 Q396 465 404 464 L414 457 L407 469 Q407 476 415 477 Q422 478 425 468 L427 463 L425 477 Q426 484 433 482 Q440 482 439 472 L437 462 L443 476 Q449 480 453 473 Q455 468 448 455 L456 462 Q463 465 465 458 Q465 450 450 442 Q430 427 415 436Z" fill="url(#rodex-hand)" stroke="#c8edff" strokeWidth="2.2" strokeLinejoin="round"/>
                <path d="M423 449 L416 467 M432 451 L431 470 M443 451 L449 465" fill="none" stroke="#4785b4" strokeOpacity=".6" strokeWidth="2"/>
                <path d="M403 447 C407 440 415 440 420 440" fill="none" stroke="white" strokeOpacity=".7" strokeWidth="3" strokeLinecap="round"/>
              </g>
            </motion.g>

            {/* A layered pearlescent body with recessed mechanical flanks and a clean tapered silhouette. */}
            <path d="M235 303 C255 288 344 287 367 305 C400 339 396 438 349 501 Q321 539 300 549 Q278 538 248 500 C201 434 203 340 235 303Z" fill="#05203c" opacity=".52" transform="translate(2 7)"/>
            <path d="M232 297 C255 284 345 282 368 299 C402 334 394 433 351 496 C335 523 311 541 300 547 C287 541 265 525 247 496 C205 429 200 335 232 297Z" fill="url(#rodex-dark-seam)" stroke="#447eaa" strokeWidth="3"/>
            <path d="M239 297 C257 286 342 285 361 298 C386 328 377 419 343 481 Q322 523 300 535 Q274 521 258 486 C222 417 217 330 239 297Z" fill="url(#rodex-shell)" stroke="#e4f7ff" strokeWidth="2.7"/>
            <path d="M245 314 Q230 365 254 437 Q269 486 286 504" fill="none" stroke="white" strokeWidth="16" strokeLinecap="round" opacity=".28"/>
            <path d="M353 312 Q374 356 352 438 Q336 487 317 515" fill="none" stroke="#275e92" strokeWidth="15" strokeLinecap="round" opacity=".13"/>
            <path d="M234 319 Q218 373 251 462" fill="none" stroke="#5ddaff" strokeOpacity=".34" strokeWidth="2.2"/>
            <path d="M366 319 Q382 368 348 461" fill="none" stroke="#1f78bc" strokeOpacity=".53" strokeWidth="2.2"/>
            <path d="M247 311 Q299 328 352 308" fill="none" stroke="#346e9c" strokeWidth="2.8"/>
            <path d="M248 319 Q299 338 353 317" fill="none" stroke="#9de9ff" strokeOpacity=".58" strokeWidth="1.5"/>
            {/* Shoulder collar and floating breastplate are integrated with body geometry. */}
            <path d="M250 304 Q269 286 298 294 Q326 288 352 303 L335 337 Q298 347 266 335Z" fill="url(#rodex-armor)" stroke="#e6f7ff" strokeWidth="2"/>
            <path d="M251 307 Q296 324 350 305" fill="none" stroke="white" strokeOpacity=".42" strokeWidth="5"/>
            <path d="M265 342 Q300 353 335 342" stroke="#5ba2d0" strokeWidth="2" strokeOpacity=".45" fill="none"/>
            <path d="M262 464 Q300 479 338 462" stroke="#72d5f2" strokeOpacity=".35" strokeWidth="1.8" fill="none"/>
            <path d="M283 505 Q301 519 317 505" stroke="#2e78a4" strokeOpacity=".4" strokeWidth="2" fill="none"/>
            {/* A restrained power core: metallic bezel, deep recess and real audio-reactive light. */}
            <circle cx="301" cy="383" r="30" fill="#2d618b" opacity=".42" filter="url(#rodex-shadow)"/>
            <circle cx="301" cy="379" r="27" fill="url(#rodex-dark-seam)" stroke="#a5d9f7" strokeWidth="2.4"/>
            <circle cx="301" cy="379" r="22" fill="#051727" stroke="#5095be" strokeWidth="3"/>
            <motion.circle cx="301" cy="379" r="17" fill="url(#rodex-energy)" opacity={reducedMotion ? .74 : 1}
              animate={reducedMotion ? undefined : { opacity: speaking ? [.58, .85 + safeAudio * .15, .58] : busy ? [.38,.72,.38] : [.42,.60,.42] }}
              transition={{ duration: speaking ? .8 : 3.1, repeat: Infinity, ease: 'easeInOut' }}/>
            <circle cx="301" cy="379" r="10" fill="#e3ffff" opacity=".65" filter="url(#rodex-neon)"/>
            <circle cx="301" cy="379" r="8" fill="#0e5bb2" stroke="#71f6ff" strokeWidth="1.8"/>
            <circle cx="301" cy="379" r="3.3" fill="#ceffff"/>

            {/* Foreground hand and forearm rest across the breastplate, rather
                than disappearing behind the torso during a natural gesture. */}
            <motion.g
              className="rodex-left-arm"
              style={{ transformOrigin: '220px 319px' }}
              animate={reducedMotion ? undefined : {
                rotate: leftGesture + (expression === 'wake' ? -10 : 0),
                y: speaking ? [-1, 2, -1] : 0,
              }}
              transition={{ rotate: { type: 'spring', stiffness: 95, damping: 17 }, y: { duration: 2.1, repeat: speaking ? Infinity : 0 } }}
            >
              <path d="M211 317 C185 308 165 336 160 364 C154 399 164 436 181 442 C197 446 211 420 220 390 C227 362 226 328 211 317Z" fill="#0b2b49" opacity=".6" transform="translate(3 5)"/>
              <path d="M211 313 C185 305 164 333 158 363 C150 400 162 434 181 438 C197 441 212 413 220 386 C228 357 226 325 211 313Z" fill="url(#rodex-armor)" stroke="#c0e7fa" strokeWidth="2.4"/>
              <path d="M182 328 C169 352 167 381 174 398" fill="none" stroke="white" strokeOpacity=".50" strokeWidth="9" strokeLinecap="round"/>
              <path d="M191 328 C208 319 217 329 218 349" fill="none" stroke="#4c8ab8" strokeOpacity=".25" strokeWidth="7" strokeLinecap="round"/>
              <ellipse cx="181" cy="436" rx="17" ry="13" fill="url(#rodex-dark-seam)" stroke="#8dc6ea" strokeWidth="2"/>
              <path d="M169 435 Q180 448 194 434" fill="none" stroke="#48d9ff" strokeWidth="2.5" opacity=".75"/>
              <g transform="translate(-2 0)">
                <path d="M167 442 C156 448 151 457 156 468 C158 472 165 472 169 467 L176 460 C171 470 175 477 181 476 C187 476 187 462 189 457 C188 470 194 475 198 470 Q204 463 195 446 L188 437Z" fill="url(#rodex-hand)" stroke="#c9ebfd" strokeWidth="2.2"/>
                <path d="M163 451 Q166 447 171 445" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" opacity=".62"/>
              </g>
            </motion.g>

            {/* Expressive floating head: pivot independent from body, visor and eyelids. */}
            <motion.g className="rodex-robot-head"
              style={{ transformOrigin: '300px 197px' }}
              animate={reducedMotion ? undefined : {
                rotate: headTilt + gaze.x * 4 + ambientLook.x * 2 + (speaking ? [-1, 1.5, 2, -1, 0, -1, 1.2, 0][gestureBeat] : 0),
                x: gaze.x * 3.2 + ambientLook.x * 3,
                y: gaze.y * 2.2 + ambientLook.y * 2 + (speaking ? -safeAudio * 4 : 0),
              }}
              transition={{ type: 'spring', stiffness: 85, damping: 17 }}
            >
              {/* Recessed ear ports behind helmet rim. */}
              <ellipse cx="181" cy="218" rx="23" ry="36" fill="#061728" opacity=".77" transform="translate(-3 5)"/>
              <ellipse cx="182" cy="218" rx="23" ry="35" fill="url(#rodex-dark-seam)" stroke="#96cdee" strokeWidth="3"/>
              <ellipse cx="182" cy="218" rx="16" ry="28" fill="#061628" stroke="#19d7ff" strokeWidth="3.1"/>
              <ellipse cx="182" cy="218" rx="9" ry="20" fill="#052547"/>
              <ellipse cx="418" cy="218" rx="23" ry="35" fill="url(#rodex-dark-seam)" stroke="#9bd6f4" strokeWidth="3"/>
              <ellipse cx="418" cy="218" rx="15" ry="28" fill="#07172a" stroke="#15d9ff" strokeWidth="3"/>
              <ellipse cx="418" cy="218" rx="8" ry="20" fill="#0b3256"/>
              <motion.ellipse cx="182" cy="218" rx="17" ry="28" stroke="#11d8ff" fill="none" strokeWidth="2.5"
                animate={reducedMotion ? undefined : { opacity: focused ? [.65,1,.65] : [.15,.45,.15] }}
                transition={{ duration: focused ? .8 : 4, repeat: Infinity }}/>
              <motion.ellipse cx="418" cy="218" rx="17" ry="28" stroke="#13d5ff" fill="none" strokeWidth="2.5"
                animate={reducedMotion ? undefined : { opacity: focused ? [.65,1,.65] : [.15,.45,.15] }}
                transition={{ duration: focused ? .8 : 4, repeat: Infinity }}/>

              {/* Helmet shell combines distinct rim, main pearl body and specular flare. */}
              <path d="M177 192 C171 126 218 67 287 63 C364 55 417 104 424 177 C431 233 405 277 352 295 C310 312 264 309 222 284 C196 265 180 231 177 192Z"
                fill="#06192b" stroke="#336f99" strokeWidth="4" transform="translate(0 5)" opacity=".60"/>
              <path d="M176 191 C170 127 213 66 287 62 C365 55 420 108 424 178 C428 233 398 282 347 298 Q300 315 252 298 C204 280 180 240 176 191Z"
                fill="url(#rodex-pearl)" stroke="#e2f5ff" strokeWidth="3.8"/>
              <path d="M197 154 C209 105 249 83 291 79" stroke="#fff" strokeOpacity=".62" strokeWidth="18" strokeLinecap="round" fill="none"/>
              <path d="M203 119 Q232 79 275 78" stroke="#d0f1ff" strokeOpacity=".78" strokeWidth="5" strokeLinecap="round" fill="none"/>
              <path d="M378 96 C403 122 414 155 412 180" stroke="#215d8f" strokeOpacity=".22" strokeWidth="17" strokeLinecap="round" fill="none"/>
              <path d="M198 201 C190 244 215 273 248 289" stroke="#fff" strokeOpacity=".32" strokeWidth="6" strokeLinecap="round" fill="none"/>
              {/* Forehead segmentation catches light but avoids a cartoon outline. */}
              <path d="M244 91 Q306 64 362 91" fill="none" stroke="#e6f9ff" strokeOpacity=".37" strokeWidth="2"/>
              <path d="M253 294 Q300 315 347 294" fill="none" stroke="#6499c6" strokeOpacity=".5" strokeWidth="2.5"/>

              {/* Full-glass visor, dramatically wider than the previous cartoon mask. */}
              <path d="M200 184 C220 156 257 145 301 145 C346 145 388 157 405 183 C416 204 415 237 397 257 C373 283 339 293 299 293 C260 293 227 283 206 259 C190 243 188 207 200 184Z"
                fill="#07223a" stroke="#7abde1" strokeWidth="5"/>
              <path d="M207 185 C227 161 265 153 302 153 C348 152 383 165 400 188 C411 207 407 234 389 252 C368 276 336 285 300 285 C260 285 232 275 212 253 C195 236 196 205 207 185Z"
                fill="url(#rodex-visor)" stroke="#02070e" strokeWidth="3"/>
              <path d="M214 185 Q253 156 324 158 C344 159 365 165 381 172"
                fill="none" stroke="url(#rodex-visor-glint)" strokeWidth="14" strokeLinecap="round"/>
              <path d="M207 219 Q212 193 224 187" fill="none" stroke="#b6edff" strokeOpacity=".14" strokeWidth="5" strokeLinecap="round"/>
              <path d="M226 258 Q299 303 379 254" fill="none" stroke="#048ce0" strokeOpacity=".17" strokeWidth="3"/>

              <motion.g className="rodex-eye-pair"
                style={{ transformOrigin: '300px 223px' }}
                animate={reducedMotion ? undefined : {
                  scaleY: blink ? .085 : 1,
                  x: gaze.x * 4,
                  y: gaze.y * 2,
                  opacity: expression === 'think' ? [.7, 1, .7] : 1,
                }}
                transition={{ scaleY: { duration: .10 }, x: { duration: .20 }, y: { duration: .20 }, opacity: { duration: 1.6, repeat: Infinity } }}
              >
                {eyeSet === 'happy' || (speaking && happy) ? (
                  <>
                    <path d="M239 233 Q259 205 277 232 M326 233 Q346 205 364 231" fill="none" stroke="#00baff" strokeWidth="21" strokeLinecap="round" opacity=".65" filter="url(#rodex-neon)"/>
                    <path d="M239 233 Q259 205 277 232 M326 233 Q346 205 364 231" fill="none" stroke="url(#rodex-eye)" strokeWidth="8.6" strokeLinecap="round"/>
                  </>
                ) : concerned ? (
                  <>
                    <path d="M236 220 L277 233 M324 233 L364 220" fill="none" stroke="#05b8ff" strokeWidth="19" opacity=".65" filter="url(#rodex-neon)"/>
                    <path d="M236 220 L277 233 M324 233 L364 220" fill="none" stroke="url(#rodex-eye)" strokeWidth="7.5" strokeLinecap="round"/>
                  </>
                ) : focused ? (
                  <>
                    <ellipse cx="257" cy="226" rx="20" ry="10" fill="#00bfff" opacity=".7" filter="url(#rodex-neon)"/>
                    <ellipse cx="345" cy="226" rx="20" ry="10" fill="#00bfff" opacity=".7" filter="url(#rodex-neon)"/>
                    <ellipse cx="257" cy="226" rx="18" ry="7" fill="url(#rodex-eye)"/>
                    <ellipse cx="345" cy="226" rx="18" ry="7" fill="url(#rodex-eye)"/>
                    <ellipse cx="252" cy="224" rx="5" ry="2" fill="#fff" opacity=".72"/>
                    <ellipse cx="340" cy="224" rx="5" ry="2" fill="#fff" opacity=".72"/>
                  </>
                ) : busy ? (
                  <>
                    <path d="M239 222 Q259 229 278 226 M324 226 Q346 229 366 222" fill="none" stroke="#00b8ff" strokeWidth="20" strokeLinecap="round" opacity=".68" filter="url(#rodex-neon)"/>
                    <path d="M239 222 Q259 229 278 226 M324 226 Q346 229 366 222" fill="none" stroke="url(#rodex-eye)" strokeWidth="8" strokeLinecap="round"/>
                  </>
                ) : (
                  <>
                    <path d="M238 230 Q254 211 278 227 M324 227 Q347 210 366 230" fill="none" stroke="#00bfff" strokeWidth="19" strokeLinecap="round" opacity=".62" filter="url(#rodex-neon)"/>
                    <path d="M238 230 Q254 211 278 227 M324 227 Q347 210 366 230" fill="none" stroke="url(#rodex-eye)" strokeWidth={speaking ? 10 : 8} strokeLinecap="round"/>
                  </>
                )}
              </motion.g>

              {/* A subtle equalizer inside the face while talking, never a status word. */}
              {speaking && (
                <motion.g className="rodex-face-voice" opacity=".7">
                  {[0, 1, 2, 3, 4].map((bar) => (
                    <motion.rect key={bar} x={282 + bar * 8} y={250} width="3.2" rx="1.6" height={3 + safeAudio * (bar % 2 ? 9 : 6)}
                      fill="#28dcff"
                      animate={reducedMotion ? undefined : { height: [3, 7 + safeAudio * 13, 3], y: [250, 248 - safeAudio * 5, 250] }}
                      transition={{ duration: .32 + bar * .055, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  ))}
                </motion.g>
              )}
              <path d="M223 264 Q299 303 378 263" fill="none" stroke="#9aeaff" strokeOpacity=".11" strokeWidth="2"/>
            </motion.g>
            <motion.circle cx="301" cy="379" r="24" fill="none" stroke="#0dc9ff" strokeWidth="3" opacity=".3" filter="url(#rodex-small-neon)"
              animate={reducedMotion ? undefined : { opacity: speaking ? [.17,.53,.17] : [.09,.22,.09], scale: [1,1.08,1] }}
              transition={{ duration: speaking ? .8 : 3.5, repeat: Infinity }}/>
          </motion.g>
        </svg>
      </motion.span>
      <span className="rodex-character-aura" aria-hidden="true" />
    </button>
  );
};
