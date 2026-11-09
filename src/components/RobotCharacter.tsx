import React, { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { AssistantState, TaskState } from '../types';
import './RobotCharacter.css';

type Expression = 'idle' | 'wake' | 'listening' | 'thinking' | 'speaking' | 'acting' | 'happy' | 'concerned';

interface RobotCharacterProps {
  state: AssistantState;
  audioLevel?: number;
  taskState?: TaskState;
  lastResponse?: string;
  onClick: () => void | Promise<void>;
}

function expressionFor(state: AssistantState, taskState?: TaskState): Expression {
  if (state === 'error' || state === 'warning' || state === 'permission_required' || taskState === 'FAILED') return 'concerned';
  if (state === 'success' || taskState === 'COMPLETED') return 'happy';
  if (state === 'executing' || state === 'executing_tool' || taskState === 'EXECUTING') return 'acting';
  if (state === 'speaking') return 'speaking';
  if (state === 'thinking' || state === 'processing' || state === 'planning' || taskState === 'PLANNING') return 'thinking';
  if (state === 'listening' || state === 'input_detected') return 'listening';
  if (state === 'wake_detected' || state === 'wake_listening') return 'wake';
  return 'idle';
}

/**
 * RODEX AURORA — an articulated SVG character, not a displayed PNG.
 *
 * Head, eyes, hands, arms, torso and core are independent vector layers. The
 * character's movement follows actual voice and assistant state and falls
 * back to a gentle idle animation when nothing is being processed.
 */
export const RobotCharacter: React.FC<RobotCharacterProps> = ({
  state,
  audioLevel = 0,
  taskState,
  lastResponse = '',
  onClick,
}) => {
  const expression = expressionFor(state, taskState);
  const reducedMotion = useReducedMotion();
  const id = useId().replace(/:/g, '');
  const paint = (name: string) => `url(#${id}-${name})`;
  const [blink, setBlink] = useState(false);
  const [gesture, setGesture] = useState(0);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const gazeFrame = useRef<number | null>(null);
  const speaking = expression === 'speaking';
  const listening = expression === 'listening' || expression === 'wake';
  const thinking = expression === 'thinking';
  const active = listening || speaking || thinking || expression === 'acting';
  const happy = expression === 'happy' || (speaking && /thank|great|wonderful|welcome|excellent/i.test(lastResponse));
  const concerned = expression === 'concerned';
  const action = expression === 'acting' || (speaking && /opening|showing|playing|found|launched/i.test(lastResponse));
  const energy = Math.max(0, Math.min(1, Number.isFinite(audioLevel) ? audioLevel : 0));

  useEffect(() => {
    if (reducedMotion) return;
    let blinkTimer: number | undefined;
    let reopenTimer: number | undefined;
    let cancelled = false;
    const schedule = () => {
      blinkTimer = window.setTimeout(() => {
        if (cancelled) return;
        if (document.visibilityState === 'visible') {
          setBlink(true);
          reopenTimer = window.setTimeout(() => setBlink(false), 125);
        }
        schedule();
      }, 3100 + Math.random() * 3300);
    };
    schedule();
    return () => {
      cancelled = true;
      window.clearTimeout(blinkTimer);
      window.clearTimeout(reopenTimer);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion || !speaking) { setGesture(0); return; }
    let timer: number | undefined;
    let cancelled = false;
    const schedule = () => {
      timer = window.setTimeout(() => {
        if (!cancelled && document.visibilityState === 'visible') setGesture(value => (value + 1) % 6);
        if (!cancelled) schedule();
      }, 470 + Math.random() * 410);
    };
    schedule();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [speaking, reducedMotion]);

  useEffect(() => () => {
    if (gazeFrame.current !== null) window.cancelAnimationFrame(gazeFrame.current);
  }, []);

  const moveEyes = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (reducedMotion || event.pointerType !== 'mouse' || gazeFrame.current !== null) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - rect.left - rect.width / 2) / (rect.width * .5)));
    const y = Math.max(-1, Math.min(1, (event.clientY - rect.top - rect.height / 2) / (rect.height * .5)));
    gazeFrame.current = window.requestAnimationFrame(() => {
      setGaze({ x, y });
      gazeFrame.current = null;
    });
  };
  const resetEyes = () => {
    if (gazeFrame.current !== null) window.cancelAnimationFrame(gazeFrame.current);
    gazeFrame.current = null;
    setGaze({ x: 0, y: 0 });
  };

  const rightAngle = expression === 'acting' ? -13 : happy ? -8 : speaking ? -4 + (gesture % 2) * 5 : listening ? -4 : 0;
  const leftAngle = happy ? -6 : speaking ? [-2, 2, -3, 1, -2, 1][gesture] : thinking ? 2 : 0;
  const headAngle = concerned ? -6 : thinking ? -6 : listening ? 3 : happy ? 5 : speaking ? [-2, 0, 2, 0, -1, 1][gesture] : 0;

  const fingerPaths = [
    'M631 318 C625 299 622 283 628 271 C633 259 646 261 649 272 L648 301',
    'M649 315 C651 296 664 277 673 276 C684 276 688 287 683 297 L673 313',
    'M671 326 C681 310 699 296 708 300 C719 305 715 314 706 325 L691 340',
    'M686 342 C700 332 716 325 725 332 C733 340 723 350 705 357',
  ];

  return (
    <button
      type="button"
      className="rodex-robot-button rodex-aurora-character"
      aria-label={listening ? 'RODEX is listening. Tap to focus the conversation.' : speaking ? 'RODEX is speaking. Tap to interrupt.' : 'Tap RODEX to start talking'}
      aria-pressed={listening}
      style={{ '--rodex-energy': energy } as React.CSSProperties}
      onClick={onClick}
      onPointerMove={moveEyes}
      onPointerLeave={resetEyes}
      onBlur={resetEyes}
      data-expression={expression}
    >
      <span className="rodex-dimensional-atmosphere" aria-hidden="true" />
      <motion.svg
        className="rodex-aurora-svg"
        viewBox="0 17 790 760"
        preserveAspectRatio="xMidYMid meet"
        role="presentation"
        aria-hidden="true"
      >
        <defs>
          {/* Multi-coat ceramic shell and brushed titanium trim, illuminated by a studio softbox. */}
          <linearGradient id={`${id}-ceramicLight`} x1="13%" y1="0%" x2="89%" y2="94%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity=".72"/>
            <stop offset="27%" stopColor="#f5fcff" stopOpacity=".16"/>
            <stop offset="58%" stopColor="#d4e7f7" stopOpacity=".03"/>
            <stop offset="100%" stopColor="#122b4d" stopOpacity=".25"/>
          </linearGradient>
          <linearGradient id={`${id}-titanium`} x1="0%" y1="13%" x2="100%" y2="84%">
            <stop offset="0%" stopColor="#ecf8ff"/>
            <stop offset="22%" stopColor="#7496ad"/>
            <stop offset="45%" stopColor="#dcecf6"/>
            <stop offset="74%" stopColor="#466b89"/>
            <stop offset="100%" stopColor="#d0e9f7"/>
          </linearGradient>
          <linearGradient id={`${id}-helmet`} x1="12%" y1="3%" x2="85%" y2="98%">
            <stop offset="0%" stopColor="#ffffff"/>
            <stop offset="17%" stopColor="#f8fcff"/>
            <stop offset="38%" stopColor="#e1f0fc"/>
            <stop offset="56%" stopColor="#b7d5ec"/>
            <stop offset="72%" stopColor="#8ebad9"/>
            <stop offset="87%" stopColor="#466d94"/>
            <stop offset="100%" stopColor="#102c4f"/>
          </linearGradient>
          <radialGradient id={`${id}-pearl`} cx="26%" cy="18%" r="97%">
            <stop offset="0%" stopColor="#ffffff"/>
            <stop offset="28%" stopColor="#f9fdff"/>
            <stop offset="54%" stopColor="#cfe7fc"/>
            <stop offset="78%" stopColor="#78afd9"/>
            <stop offset="100%" stopColor="#244a79"/>
          </radialGradient>
          <linearGradient id={`${id}-side`} x1="0%" y1="9%" x2="99%" y2="95%">
            <stop offset="0%" stopColor="#f8fcff"/>
            <stop offset="30%" stopColor="#d9f1ff"/>
            <stop offset="57%" stopColor="#81b4dc"/>
            <stop offset="83%" stopColor="#3775a9"/>
            <stop offset="100%" stopColor="#10274b"/>
          </linearGradient>
          <linearGradient id={`${id}-dark`} x1="7%" y1="0%" x2="90%" y2="100%">
            <stop offset="0%" stopColor="#315674"/>
            <stop offset="31%" stopColor="#122b4e"/>
            <stop offset="75%" stopColor="#061226"/>
            <stop offset="100%" stopColor="#0b2a50"/>
          </linearGradient>
          {/* Sapphire-tinted optical coating with controlled studio reflections. */}
          <linearGradient id={`${id}-visorSheen`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ecfcff" stopOpacity=".42"/>
            <stop offset="23%" stopColor="#a7e1fa" stopOpacity=".18"/>
            <stop offset="49%" stopColor="#bfeaff" stopOpacity=".018"/>
            <stop offset="74%" stopColor="#417aa9" stopOpacity=".04"/>
            <stop offset="100%" stopColor="#80dbf5" stopOpacity=".14"/>
          </linearGradient>
          <linearGradient id={`${id}-machinedRim`} x1="10%" y1="0%" x2="95%" y2="100%">
            <stop offset="0%" stopColor="#ffffff"/>
            <stop offset="27%" stopColor="#b4d8e9"/>
            <stop offset="55%" stopColor="#3a7a9e"/>
            <stop offset="73%" stopColor="#e7f6fb"/>
            <stop offset="100%" stopColor="#316585"/>
          </linearGradient>
          <radialGradient id={`${id}-visor`} cx="42%" cy="20%" r="94%">
            <stop offset="0%" stopColor="#18314c"/>
            <stop offset="30%" stopColor="#07182d"/>
            <stop offset="68%" stopColor="#010715"/>
            <stop offset="100%" stopColor="#00030b"/>
          </radialGradient>
          <linearGradient id={`${id}-glass`} x1="15%" y1="0%" x2="86%" y2="100%">
            <stop offset="0%" stopColor="#d1f8ff" stopOpacity=".34"/>
            <stop offset="33%" stopColor="#6bbdf1" stopOpacity=".07"/>
            <stop offset="61%" stopColor="#dafbff" stopOpacity=".025"/>
            <stop offset="100%" stopColor="#124782" stopOpacity=".1"/>
          </linearGradient>
          <radialGradient id={`${id}-blue`} cx="40%" cy="24%" r="75%">
            <stop offset="0%" stopColor="#e9ffff"/>
            <stop offset="25%" stopColor="#69f8ff"/>
            <stop offset="47%" stopColor="#00d8ff"/>
            <stop offset="73%" stopColor="#0384fa"/>
            <stop offset="100%" stopColor="#143c96"/>
          </radialGradient>
          <linearGradient id={`${id}-eye`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#b8ffff"/>
            <stop offset="40%" stopColor="#20e5ff"/>
            <stop offset="100%" stopColor="#087cff"/>
          </linearGradient>
          <radialGradient id={`${id}-floor`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#73faff" stopOpacity=".66"/>
            <stop offset="40%" stopColor="#0b98fb" stopOpacity=".23"/>
            <stop offset="100%" stopColor="#0345bc" stopOpacity="0"/>
          </radialGradient>
          <filter id={`${id}-glow`} x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="8"/>
          </filter>
          <filter id={`${id}-soft`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3"/>
          </filter>
          <filter id={`${id}-shadow`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="16"/>
          </filter>
          <clipPath id={`${id}-visorClip`}>
            <path d="M252 198 C282 175 333 167 385 170 C439 167 483 181 505 206 C526 233 513 284 484 304 C454 329 312 332 269 308 C234 288 232 225 252 198Z"/>
          </clipPath>
        </defs>

        {/* Orbital light stays in world space while the character moves. */}
        <ellipse cx="388" cy="701" rx="295" ry="36" fill={paint('floor')} opacity=".9"/>
        <ellipse cx="388" cy="703" rx="293" ry="44" fill="none" stroke="#038cfa" strokeWidth="8" opacity=".48" filter={paint('glow')}/>
        <ellipse cx="388" cy="699" rx="265" ry="34" fill="none" stroke="#5df7ff" strokeWidth="3.8" opacity=".93"/>
        <ellipse cx="388" cy="700" rx="208" ry="24" fill="none" stroke="#098bfc" strokeWidth="3.8" opacity=".7"/>
        <ellipse cx="388" cy="701" rx="151" ry="15" fill="none" stroke="#6bf7ff" strokeWidth="2.8" opacity=".8"/>
        <ellipse cx="388" cy="702" rx="94" ry="7" fill="#4af5ff" opacity=".38" filter={paint('glow')}/>
        <path d="M113 663 Q388 625 664 660" fill="none" stroke="#0a7fff" strokeWidth="1.7" opacity=".28"/>
        <motion.ellipse cx="388" cy="698" rx="162" ry="18" stroke="#19d9ff" strokeWidth="2" fill="none"
          animate={reducedMotion ? undefined : { opacity: [.25,.84,.25], scaleX: [1,1.1,1] }}
          transition={{ duration: 3.1, ease: 'easeInOut', repeat: Infinity }}/>
        {[0,1,2,3,4,5,6,7,8,9,10,11].map(index => (
          <circle key={index} cx={388+245*Math.cos(index*Math.PI/6)} cy={700+28*Math.sin(index*Math.PI/6)} r={index%3===0 ? 3 : 1.8} fill="#5feaff" opacity=".78"/>
        ))}

        <motion.g
          className="rodex-aurora-body"
          style={{ transformOrigin: '384px 382px' }}
          animate={reducedMotion ? undefined : { y: speaking ? [0,-7-energy*5,0] : [0,-10,0], rotate: concerned ? [-1.5,-2,-1.5] : [0,.6,0] }}
          transition={{ y: { duration: speaking ? 1.8 : 4.5, ease: 'easeInOut', repeat: Infinity }, rotate: { duration: 6, ease: 'easeInOut', repeat: Infinity } }}
        >
          {/* Internal shoulder machinery and narrow mobile neck. */}
          <path d="M335 337 L445 338 L449 387 L334 388Z" fill={paint('dark')} stroke="#1d577b" strokeWidth="5"/>
          <path d="M343 351 L438 351 L432 385 L351 386Z" fill="#06172a"/>
          <path d="M349 374 L430 374" stroke="#59d8ff" strokeWidth="2.5" opacity=".6"/>
          <path d="M352 345 L355 369 M425 345 L422 369" stroke="#b9f4ff" strokeWidth="3" opacity=".38"/>

          {/* Mechanical upper limbs behind the articulated forward hands. */}
          <motion.g className="rodex-aurora-left-arm" style={{ transformOrigin: '283px 403px' }}
            animate={reducedMotion ? undefined : { rotate: leftAngle, x: speaking ? [0,-2,0] : 0 }}
            transition={{ rotate: { type: 'spring', stiffness: 88, damping: 18 }, x: { duration: 1.7, repeat: speaking ? Infinity : 0 } }}>
            <ellipse cx="273" cy="404" rx="44" ry="46" fill="#031527" stroke="#1a567e" strokeWidth="7"/>
            <ellipse cx="269" cy="403" rx="32" ry="36" fill={paint('side')} stroke="#c1eaff" strokeWidth="3"/>
            <path d="M242 403 C218 413 190 443 178 479 C170 505 189 531 214 527 C237 521 266 485 279 443 C287 418 270 395 242 403Z"
              fill={paint('side')} stroke="#a7dfff" strokeWidth="3.5"/>
            <path d="M190 486 C205 455 228 425 248 421" stroke="#fff" strokeWidth="12" strokeOpacity=".35" strokeLinecap="round" fill="none"/>
            <path d="M183 491 C196 508 210 516 230 505" stroke="#118bdf" strokeWidth="2.6" opacity=".7" fill="none"/>
            <ellipse cx="214" cy="513" rx="25" ry="22" fill="#071a31" stroke="#65dfff" strokeWidth="3"/>
            <ellipse cx="214" cy="513" rx="12" ry="11" fill={paint('blue')}/>
            <path d="M224 497 C248 490 275 483 308 465 C330 453 346 459 351 475 C355 487 340 501 316 508 C282 520 251 533 230 529 C211 521 211 507 224 497Z"
              fill={paint('pearl')} stroke="#bce8ff" strokeWidth="3.1"/>
            <path d="M233 500 Q271 499 311 474" fill="none" stroke="white" strokeWidth="9" strokeOpacity=".39" strokeLinecap="round"/>
            <path d="M226 524 L235 529" stroke="#29ccff" strokeWidth="3.5" strokeLinecap="round"/>
            <ellipse cx="332" cy="478" rx="19" ry="21" fill={paint('dark')} stroke="#91d8f4" strokeWidth="3"/>
          </motion.g>

          <motion.g className="rodex-aurora-right-arm" style={{ transformOrigin: '477px 400px' }}
            animate={reducedMotion ? undefined : { rotate: rightAngle, y: speaking ? [0,-4-energy*3,0] : 0 }}
            transition={{ rotate: { type: 'spring', stiffness: 91, damping: 18 }, y: { duration: 1.1, repeat: speaking ? Infinity : 0 } }}>
            <ellipse cx="476" cy="398" rx="40" ry="43" fill="#041326" stroke="#217baa" strokeWidth="7"/>
            <ellipse cx="476" cy="395" rx="32" ry="36" fill={paint('pearl')} stroke="#d1efff" strokeWidth="3"/>
            <path d="M492 381 C526 375 548 404 559 431 C569 457 564 475 548 488 C529 497 509 482 499 464 L475 418 C466 400 473 384 492 381Z"
              fill={paint('side')} stroke="#c9edff" strokeWidth="3.5"/>
            <path d="M506 397 Q540 410 547 453" fill="none" stroke="white" strokeOpacity=".35" strokeWidth="10" strokeLinecap="round"/>
            <ellipse cx="548" cy="468" rx="25" ry="25" fill="#041327" stroke="#54b7e9" strokeWidth="4"/>
            <ellipse cx="548" cy="468" rx="13" ry="13" fill={paint('blue')} opacity=".92"/>
            <path d="M540 449 C553 426 578 383 600 346 C613 322 636 323 649 343 C659 357 648 379 635 402 C612 443 585 486 562 495 C544 501 530 474 540 449Z"
              fill={paint('side')} stroke="#c4ebff" strokeWidth="3.5"/>
            <path d="M559 457 C578 424 610 358 630 345" stroke="#fff" strokeOpacity=".4" strokeWidth="10" strokeLinecap="round" fill="none"/>
            <path d="M561 483 Q594 461 610 426" stroke="#14a2f4" strokeOpacity=".42" strokeWidth="2.5" fill="none"/>
            <ellipse cx="638" cy="347" rx="24" ry="23" fill={paint('dark')} stroke="#95e5ff" strokeWidth="3"/>
            <ellipse cx="638" cy="347" rx="13" ry="13" fill={paint('blue')} opacity=".8"/>
            {/* Palm, knuckles and four individually surfaced fingers. */}
            <motion.g className="rodex-aurora-hand" style={{ transformOrigin: '639px 341px' }}
              animate={reducedMotion ? undefined : { rotate: action ? -11 : happy ? -8 : speaking ? [-3,2,-1,3,-2,0][gesture] : 0 }}
              transition={{ type: 'spring', stiffness: 98, damping: 18 }}>
              <path d="M624 340 C626 319 638 309 657 305 L688 319 C700 328 712 338 710 354 C707 371 692 382 672 382 C650 384 637 370 624 358Z"
                fill={paint('pearl')} stroke="#c7efff" strokeWidth="3.2"/>
              <path d="M633 344 C649 321 672 321 694 338" stroke="white" strokeOpacity=".53" strokeWidth="9" fill="none" strokeLinecap="round"/>
              {fingerPaths.map((path, index) => (
                <g key={index}>
                  <path d={path} fill="none" stroke="#071b36" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" opacity=".95"/>
                  <path d={path} fill="none" stroke="#c5edff" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d={path} fill="none" stroke="#ffffff" strokeWidth="6" strokeOpacity=".5" strokeLinecap="round"/>
                  <path d={path} fill="none" stroke="#0ccaff" strokeWidth="1.5" strokeOpacity=".7" strokeDasharray="13 10" strokeLinecap="round"/>
                </g>
              ))}
              <path d="M629 335 C612 334 599 317 607 305 C614 294 629 307 640 320" fill="none" stroke="#133757" strokeWidth="21" strokeLinecap="round"/>
              <path d="M629 335 C612 333 601 316 608 305 C614 300 630 308 639 319" fill="none" stroke="#e6f6ff" strokeWidth="16" strokeLinecap="round"/>
              <path d="M636 347 C650 351 665 350 677 344" fill="none" stroke="#5ea7d0" strokeWidth="2" opacity=".66"/>
            </motion.g>
          </motion.g>

          {/* Floating sculpted torso: pearlescent front with mechanical ribs and vents. */}
          <path d="M293 378 C328 354 449 349 491 388 C513 412 505 472 486 524 C464 584 427 628 393 648 C374 660 342 621 313 580 C284 539 267 467 275 421 C279 401 284 389 293 378Z"
            fill="#07172e" stroke="#236397" strokeWidth="7" opacity=".86" transform="translate(0 7)"/>
          <path d="M293 379 C325 351 448 350 486 391 C506 416 501 472 481 524 C458 583 424 623 389 646 C367 649 332 603 309 569 C286 534 270 460 280 419 C283 400 286 387 293 379Z"
            fill={paint('pearl')} stroke="#e2f5ff" strokeWidth="4"/>
          <path d="M280 428 C289 397 302 387 320 383 C317 444 330 531 377 610 Q350 595 326 565 C292 519 274 470 280 428Z"
            fill="#64a0d0" opacity=".19"/>
          <path d="M451 380 C482 393 497 424 487 471 C480 514 462 551 445 580 C467 531 467 471 452 413Z"
            fill="#0a2f67" opacity=".28"/>
          <path d="M314 394 C347 372 426 369 456 396" fill="none" stroke="#ffffff" strokeWidth="9" strokeOpacity=".5" strokeLinecap="round"/>
          {/* Fine automotive-style metal seams and inset structural panels. */}
          <path d="M303 413 C310 390 332 382 355 379 M424 378 C457 383 476 395 483 417"
            fill="none" stroke={paint('machinedRim')} strokeWidth="2.2" strokeOpacity=".75" strokeLinecap="round"/>
          <path d="M333 531 C345 570 365 603 389 624 C420 593 440 556 449 524"
            fill="none" stroke="#f4fdff" strokeOpacity=".36" strokeWidth="2.4"/>
          <path d="M342 535 C353 565 367 586 383 604"
            fill="none" stroke="#0b5688" strokeOpacity=".26" strokeWidth="1.6"/>
          <ellipse cx="391" cy="596" rx="5" ry="2" fill="#9bd4e5" opacity=".6"/>
          <path d="M380 600 H401" fill="none" stroke="#153c61" strokeOpacity=".38" strokeWidth="1.3"/>
          <path d="M300 452 C300 497 318 546 349 589" fill="none" stroke="#d5f6ff" strokeOpacity=".28" strokeWidth="6"/>
          <path d="M467 445 Q475 498 432 581" fill="none" stroke="#295a8a" strokeOpacity=".46" strokeWidth="4"/>
          <path d="M311 465 C324 518 340 550 368 587" fill="none" stroke="#056dc9" strokeOpacity=".23" strokeWidth="3"/>
          <path d="M442 553 L420 600 L390 631" fill="none" stroke="#9feeff" strokeOpacity=".25" strokeWidth="3"/>
          {/* Recessed lateral ventilation and layered side armor. */}
          <path d="M296 440 L309 432 L326 532 L316 527Z" fill={paint('dark')} opacity=".55"/>
          <path d="M469 434 L456 427 L443 524 L452 528Z" fill={paint('dark')} opacity=".6"/>
          {[0,1,2,3].map(i => (
            <g key={i} opacity=".75">
              <path d={`M298 ${448 + i*16} L313 ${443+i*16}`} stroke="#72dafa" strokeWidth="2.2" strokeLinecap="round"/>
              <path d={`M456 ${446 + i*16} L470 ${451+i*16}`} stroke="#72dafa" strokeWidth="2.2" strokeLinecap="round"/>
            </g>
          ))}
          {/* Dark chest's negative space isolates the bright circular core. */}
          <ellipse cx="391" cy="450" rx="49" ry="54" fill="#b7e6ff" opacity=".2" filter={paint('glow')}/>
          <circle cx="391" cy="450" r="48" fill="none" stroke={paint('machinedRim')} strokeWidth="3.4" opacity=".9"/>
          <circle cx="391" cy="450" r="43" fill={paint('dark')} stroke="#88caef" strokeWidth="6"/>
          {[0,1,2,3,4,5,6,7].map(index => (
            <path key={index} d="M391 404 L391 410" transform={`rotate(${index*45} 391 450)`}
              stroke="#b9edf7" strokeWidth="2" strokeLinecap="round" opacity=".75"/>
          ))}
          <circle cx="391" cy="450" r="34" fill="#02132b" stroke="#0e9be8" strokeWidth="5"/>
          <motion.circle cx="391" cy="450" r="24" fill="none" stroke="#00baff" strokeWidth={7 + energy*3}
            animate={reducedMotion ? undefined : { opacity: active ? [.78,1,.78] : [.62,.85,.62] }}
            transition={{ duration: speaking ? .75 : 3, repeat: Infinity }}/>
          <circle cx="391" cy="450" r="14" fill={paint('blue')}/>
          <circle cx="386" cy="445" r="7" fill="#dcffff" opacity=".64"/>
          <path d="M354 412 Q391 399 428 412" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="3"/>
          <path d="M361 494 Q393 501 423 491" stroke="#0c7de0" strokeOpacity=".42" strokeWidth="2.5" fill="none"/>
          <motion.circle cx="391" cy="450" r="56" fill="none" stroke="#2bcfff" strokeWidth="2" filter={paint('soft')}
            animate={reducedMotion ? undefined : { opacity: active ? [.25,.72,.25] : [.12,.28,.12], scale: active ? [1,1.09,1] : [1,1.03,1] }}
            transition={{ duration: active ? 1.25 : 4.3, repeat: Infinity }}/>

          {/* Left hand layered over chest, with articulated finger pads. */}
          <motion.g style={{ transformOrigin: '336px 468px' }}
            animate={reducedMotion ? undefined : { rotate: speaking ? [-2,0,3,1,-1,2][gesture] : happy ? -4 : 0 }}
            transition={{ type: 'spring', stiffness: 108, damping: 19 }}>
            <path d="M315 472 C317 452 329 436 346 432 L359 435 C372 438 378 447 373 459 C365 473 354 489 341 492 C329 495 317 487 315 472Z"
              fill={paint('pearl')} stroke="#a8dfff" strokeWidth="2.8"/>
            {[
              'M333 442 L332 411 Q331 401 340 400 Q349 399 351 411 L351 447',
              'M349 445 L350 406 Q350 395 359 394 Q369 395 369 406 L366 450',
              'M365 449 L372 417 Q375 407 384 411 Q392 414 388 426 L379 455',
            ].map((finger,index) => (
              <g key={index}>
                <path d={finger} fill="none" stroke="#123d61" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/>
                <path d={finger} fill="none" stroke="#ecfaff" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round"/>
                <path d={finger} fill="none" stroke="#23ccff" strokeWidth="2" strokeDasharray="14 9" strokeLinecap="round" opacity=".7"/>
              </g>
            ))}
            <path d="M324 469 C315 455 302 456 298 464 C294 473 309 486 324 488" fill={paint('side')} stroke="#bfe9ff" strokeWidth="2.6"/>
            <path d="M318 476 L338 485" fill="none" stroke="#fff" strokeOpacity=".65" strokeWidth="4" strokeLinecap="round"/>
          </motion.g>

          {/* Independent head assembly: visor, helmets, optics and ear rings. */}
          <motion.g
            className="rodex-aurora-head"
            style={{ transformOrigin: '377px 319px' }}
            animate={reducedMotion ? undefined : {
              rotate: headAngle + gaze.x*3.6,
              x: gaze.x*4.3,
              y: gaze.y*2.8 + (speaking ? -energy*3.5 : 0),
            }}
            transition={{ type: 'spring', stiffness: 88, damping: 17 }}
          >
            {/* Headphone ring backs behind helmet. */}
            <ellipse cx="210" cy="245" rx="32" ry="65" fill="#030d1e" stroke="#214b78" strokeWidth="8"/>
            <ellipse cx="539" cy="245" rx="32" ry="64" fill="#030f21" stroke="#225785" strokeWidth="8"/>
            {/* Double-bodied helmet with substantial rim depth. */}
            <path d="M203 235 C198 143 264 86 359 81 C469 74 543 136 543 230 C545 291 508 340 453 365 C410 387 331 379 277 357 C222 332 206 280 203 235Z"
              fill={paint('dark')} opacity=".75" transform="translate(0 6)"/>
            <path d="M207 233 C204 139 264 80 361 75 C470 67 539 137 540 225 C542 292 510 338 452 359 C399 377 331 368 278 349 C228 330 210 280 207 233Z"
              fill={paint('helmet')} stroke="#e5f7ff" strokeWidth="5.6"/>
            <path d="M222 199 C237 118 297 87 362 83 C451 78 503 130 525 204"
              fill="none" stroke="#ffffff" strokeOpacity=".34" strokeWidth="2.6" strokeLinecap="round"/>
            <path d="M231 184 C245 133 290 106 350 94 C415 81 473 107 504 156 C457 125 410 120 365 124 C308 130 267 149 231 184Z"
              fill={paint('ceramicLight')} opacity=".5"/>
            {/* CNC-machined helmet joints and a recessed shadow groove give the
              pearl shell real thickness instead of a flat cartoon outline. */}
          <path d="M230 187 C247 123 297 93 366 89 C452 82 504 125 523 184"
            fill="none" stroke="#193958" strokeOpacity=".27" strokeWidth="5.5" strokeLinecap="round"/>
          <path d="M220 233 C218 286 247 332 302 353" fill="none"
            stroke="#f0fdff" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round"/>
          <path d="M506 300 C521 281 526 256 527 236" fill="none"
            stroke="#071b36" strokeOpacity=".52" strokeWidth="4" strokeLinecap="round"/>
          <path d="M254 328 C315 368 440 373 497 321" fill="none" stroke={paint('titanium')}
              strokeWidth="3" strokeLinecap="round" opacity=".48"/>
            <path d="M231 299 C249 340 302 358 371 363 C449 366 499 334 516 296"
              fill="none" stroke="#133a62" strokeOpacity=".32" strokeWidth="3"/>
            <path d="M238 141 C255 106 293 90 337 89" stroke="white" strokeOpacity=".83" strokeWidth="17" strokeLinecap="round" fill="none"/>
            <path d="M234 171 C236 139 250 117 273 104" stroke="white" strokeOpacity=".35" strokeWidth="8" fill="none" strokeLinecap="round"/>
            <path d="M481 123 C515 164 529 202 521 250" stroke="#3979ad" strokeOpacity=".45" strokeWidth="12" strokeLinecap="round" fill="none"/>
            <path d="M277 338 C334 370 427 370 481 332" fill="none" stroke="#0d5791" strokeWidth="6" opacity=".35"/>
            {/* Top helmet segmentation creates a designed mechanical face frame. */}
            <path d="M257 111 Q360 50 459 109 L469 143 Q386 160 290 140Z" fill={paint('pearl')} stroke="#72a6cc" strokeWidth="3.4"/>
            <path d="M287 139 Q380 158 460 138" fill="none" stroke="#f7ffff" strokeOpacity=".45" strokeWidth="4"/>
            <path d="M335 96 Q380 91 421 103" stroke="#fff" strokeOpacity=".65" strokeWidth="4" fill="none"/>
            <path d="M337 91 Q391 88 421 100" stroke="#0b5e9c" strokeOpacity=".27" strokeWidth="2.2" fill="none"/>
            <path d="M271 150 L258 173 M484 156 L493 179" stroke="#133e66" strokeWidth="5" strokeLinecap="round" opacity=".68"/>
            {[ [289,119],[469,137],[263,178],[499,185] ].map(([cx,cy],idx) => (
              <g key={idx}>
                <circle cx={cx} cy={cy} r="6" fill="#0d4470" stroke="#d9f9ff" strokeWidth="1.5"/>
                <circle cx={cx-1} cy={cy-1} r="1.7" fill="#26daff"/>
              </g>
            ))}

            {/* The approved wide glossy, curved glass mask. */}
            <path d="M245 197 C278 172 329 161 388 163 C450 160 492 175 513 204 C539 240 523 295 491 317 C458 341 307 343 263 319 C228 297 220 235 245 197Z"
              fill="#04213c" stroke="#91d7f6" strokeWidth="8"/>
            <path d="M252 198 C282 175 333 167 385 170 C439 167 483 181 505 206 C526 233 513 284 484 304 C454 329 312 332 269 308 C234 288 232 225 252 198Z"
              fill={paint('visor')} stroke="#020c1d" strokeWidth="3.4"/>
            <path d="M245 197 C278 172 329 161 388 163 C450 160 492 175 513 204"
              fill="none" stroke={paint('machinedRim')} strokeWidth="4" strokeOpacity=".84" strokeLinecap="round"/>
            <path d="M263 315 C306 340 458 343 492 316"
              fill="none" stroke="#a1d1e1" strokeWidth="2.5" opacity=".62"/>
            <g clipPath={paint('visorClip')}>
              <path d="M242 206 C280 170 356 167 419 179 C462 188 490 209 506 227 L510 198 Q469 146 348 159 Q271 158 240 191Z"
                fill={paint('glass')}/>
              <path d="M251 201 C310 173 375 176 444 189" fill="none" stroke="#8defff" strokeOpacity=".13" strokeWidth="17" strokeLinecap="round"/>
              <path d="M255 198 C305 176 360 176 399 182 C439 188 475 208 500 234 L506 249 C485 216 443 195 387 190 C329 184 285 190 255 211Z"
                fill={paint('visorSheen')}/>
              <path d="M263 217 C301 194 355 192 401 197" fill="none"
                stroke="#eaffff" strokeOpacity=".085" strokeWidth="3" strokeLinecap="round"/>
              {/* Curved glass reflection tracks the actual visor geometry, never a flat photo. */}
              <path d="M280 203 C325 185 393 184 452 207 C429 199 369 206 329 217 Q299 222 280 236Z"
                fill={paint('ceramicLight')} opacity=".17"/>
              <path d="M276 298 Q377 324 476 294" stroke="#b7eaff" strokeWidth="1.3"
                strokeOpacity=".15" fill="none"/>
              <path d="M470 286 L493 267" stroke="#def7ff" strokeOpacity=".1" strokeWidth="6" strokeLinecap="round"/>
              <path d="M265 308 C328 336 439 333 490 303" fill="none" stroke="#057dc4" strokeWidth="4" opacity=".19"/>
              {/* Asymmetric studio strip-light, visor edge reflections and coated-glass optics. */}
              <path d="M273 207 C312 181 365 173 419 180 C368 183 323 198 287 220Z"
                fill="#ecfbff" opacity=".11"/>
              <path d="M472 211 C498 237 503 260 492 284"
                fill="none" stroke="#d5f7ff" strokeWidth="4.5" strokeLinecap="round" opacity=".12"/>
              <ellipse cx="321" cy="184" rx="92" ry="18" fill="#9bdfff" opacity=".09" filter={paint('soft')}/>
              <ellipse cx="488" cy="259" rx="16" ry="57" fill="#9bdfff" opacity=".08" filter={paint('soft')}/>
            </g>
            {/* Layered headphone assemblies, with luminous toroidal ring optics. */}
            <g>
              <ellipse cx="204" cy="245" rx="31" ry="56" fill={paint('side')} stroke="#e3f9ff" strokeWidth="4"/>
              <ellipse cx="203" cy="244" rx="27" ry="47" fill={paint('dark')} stroke="#279dde" strokeWidth="4"/>
              <ellipse cx="202" cy="244" rx="21" ry="38" fill="#07152a" stroke="#02c9ff" strokeWidth="6"/>
              <ellipse cx="203" cy="245" rx="10" ry="21" fill="#0b4772"/>
              <ellipse cx="539" cy="245" rx="29" ry="54" fill={paint('side')} stroke="#ecfaff" strokeWidth="4"/>
              <ellipse cx="540" cy="245" rx="25" ry="45" fill={paint('dark')} stroke="#24a8ef" strokeWidth="4"/>
              <ellipse cx="541" cy="245" rx="20" ry="36" fill="#06162a" stroke="#00d7ff" strokeWidth="6"/>
              <ellipse cx="541" cy="245" rx="10" ry="20" fill="#0a5288"/>
              <motion.ellipse cx="202" cy="245" rx="21" ry="39" fill="none" stroke="#60eeff" strokeWidth="3" filter={paint('soft')}
                animate={reducedMotion ? undefined : { opacity: active ? [.35,1,.35] : [.16,.36,.16] }}
                transition={{ repeat: Infinity, duration: active ? 1 : 3.8 }}/>
              <motion.ellipse cx="540" cy="245" rx="19" ry="36" fill="none" stroke="#60eeff" strokeWidth="3" filter={paint('soft')}
                animate={reducedMotion ? undefined : { opacity: active ? [.35,1,.35] : [.16,.36,.16] }}
                transition={{ repeat: Infinity, duration: active ? 1 : 3.8 }}/>
            </g>

            {/* Internal soft optical bloom beneath the expressive OLED eye traces. */}
            <g opacity={listening ? .47 : speaking ? .4 : .19} filter={paint('soft')}>
              <ellipse cx="324" cy="257" rx="38" ry="25" fill="#009fdc"/>
              <ellipse cx="438" cy="257" rx="38" ry="25" fill="#009fdc"/>
            </g>
            <motion.g className="rodex-aurora-eyes" style={{ transformOrigin: '378px 259px' }}
              animate={reducedMotion ? undefined : { scaleY: blink ? .06 : 1, x: gaze.x * 5, y: gaze.y * 3, opacity: thinking ? [.65,1,.65] : 1 }}
              transition={{ scaleY: { duration: .105 }, x: { duration: .18 }, y: { duration: .18 }, opacity: { duration: 1.3, repeat: thinking ? Infinity : 0 } }}>
              {concerned ? (
                <>
                  <path d="M297 251 L347 268 M414 267 L459 248" stroke="#00baff" strokeWidth="23" strokeLinecap="round" filter={paint('glow')} opacity=".74"/>
                  <path d="M297 251 L347 268 M414 267 L459 248" stroke={paint('eye')} strokeWidth="10.5" strokeLinecap="round"/>
                </>
              ) : listening ? (
                <>
                  <ellipse cx="326" cy="259" rx="21" ry="10" fill="#00d0ff" filter={paint('glow')} opacity=".9"/>
                  <ellipse cx="432" cy="259" rx="21" ry="10" fill="#00d0ff" filter={paint('glow')} opacity=".9"/>
                  <ellipse cx="326" cy="259" rx="20" ry="8.5" fill={paint('eye')}/>
                  <ellipse cx="432" cy="259" rx="20" ry="8.5" fill={paint('eye')}/>
                  <circle cx="322" cy="255" r="3" fill="#fff" opacity=".7"/>
                  <circle cx="428" cy="255" r="3" fill="#fff" opacity=".7"/>
                </>
              ) : thinking ? (
                <>
                  <path d="M297 258 Q323 253 351 260 M411 260 Q437 253 463 258" stroke="#00c7ff" strokeWidth="22" strokeLinecap="round" filter={paint('glow')} opacity=".8"/>
                  <path d="M297 258 Q323 253 351 260 M411 260 Q437 253 463 258" stroke={paint('eye')} strokeWidth="10" strokeLinecap="round"/>
                </>
              ) : (
                <>
                  <path d={happy ? "M297 262 Q325 223 352 260 M410 260 Q439 223 466 262" : "M297 259 Q321 225 351 256 M411 256 Q440 224 466 259"}
                    stroke="#00aaff" strokeWidth="25" strokeLinecap="round" fill="none" filter={paint('glow')} opacity=".8"/>
                  <path d={happy ? "M297 262 Q325 223 352 260 M410 260 Q439 223 466 262" : "M297 259 Q321 225 351 256 M411 256 Q440 224 466 259"}
                    stroke={paint('eye')} strokeWidth={speaking ? 12 : 10.5} strokeLinecap="round" fill="none"/>
                  <path d="M301 250 L306 244 M416 249 L421 243" stroke="#eaffff" strokeWidth="2.6" strokeLinecap="round" opacity=".65"/>
                </>
              )}
            </motion.g>
            {speaking && (
              <g>
                {[0,1,2,3,4].map((value) => (
                  <motion.rect key={value} x={362+value*9} y={288} width="4" rx="2"
                    fill="#38eaff" height={4+energy*16}
                    animate={reducedMotion ? undefined : { scaleY: [.3,1+energy,.35] }}
                    style={{ transformOrigin: `${364+value*9}px 296px` }}
                    transition={{ duration: .38+value*.07, ease: 'easeInOut', repeat: Infinity }}/>
                ))}
              </g>
            )}
            <path d="M285 313 Q387 342 473 314" stroke="#5ccfff" strokeWidth="2" fill="none" opacity=".18"/>
          </motion.g>
          <motion.circle cx="391" cy="450" r="68" fill="none" stroke="#19ccff" strokeWidth="1.6"
            animate={reducedMotion ? undefined : { opacity: active ? [0,.34,0] : [0,.1,0], scale: [0.95,1.18,1.33] }}
            transition={{ duration: active ? 1.7 : 5, repeat: Infinity }}/>
        </motion.g>
      </motion.svg>
      <span className="rodex-character-aura" aria-hidden="true"/>
    </button>
  );
};
