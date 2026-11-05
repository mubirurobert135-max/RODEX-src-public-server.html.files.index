import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { AssistantState, AppMode, ThemeAccent } from '../types';
import { getCompanionMotion, getCompanionPose } from '../utils/companionBehavior';

/**
 * RODEX's animated character is the conversation interface, not a status monitor.
 * It uses real assistant state and speech-level signals without showing stage labels.
 * The distinctive white shell, black face, blue eyes, and floating body are retained.
 */
interface OrbProps {
  state: AssistantState;
  audioLevel?: number;
  pitchHz?: number;
  onClick?: () => void;
  size?: number;
  activeMode?: AppMode;
  isLive?: boolean;
  themeAccent?: ThemeAccent;
  utterance?: string;
}

const smooth = { type: 'spring' as const, stiffness: 120, damping: 19, mass: 0.9 };

const expressionPaths = {
  rest: ['M168 183 Q184 188 197 188', 'M222 188 Q238 185 251 181'],
  attend: ['M167 181 Q183 182 198 185', 'M221 185 Q238 183 253 180'],
  consider: ['M166 187 Q183 193 197 190', 'M222 188 Q236 179 252 185'],
  converse: ['M167 181 Q184 187 198 184', 'M222 184 Q238 188 253 181'],
  welcome: ['M169 189 Q182 171 197 190', 'M221 190 Q237 171 252 187'],
  present: ['M168 182 Q183 185 198 184', 'M221 185 Q237 186 252 181'],
  celebrate: ['M168 191 Q181 168 197 190', 'M222 190 Q236 168 252 188'],
  concern: ['M168 188 Q182 180 197 189', 'M222 189 Q237 180 252 188'],
  ask: ['M168 188 Q183 183 198 188', 'M222 185 Q238 176 252 184'],
} as const;

export const Orb: React.FC<OrbProps> = ({
  state,
  audioLevel = 0,
  onClick,
  size = 280,
  utterance = '',
}) => {
  const reduceMotion = useReducedMotion();
  const pose = useMemo(() => getCompanionPose(state, utterance), [state, utterance]);
  const movement = getCompanionMotion(pose);
  const voiceEnergy = Math.max(0, Math.min(1, Number.isFinite(audioLevel) ? audioLevel : 0));
  const awake = pose !== 'rest';
  const eyes = expressionPaths[pose];
  const verticalDrift = reduceMotion ? 0 : awake ? -3 : -8;

  const eyeTransition = { duration: 0.38, ease: 'easeOut' as const };
  const faceLight = Math.min(1, 0.66 * movement.brightness + (pose === 'converse' ? voiceEnergy * 0.26 : 0));

  const activate = () => onClick?.();
  const onKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate();
    }
  };

  return (
    <div
      id="rodex-orb-container"
      role="button"
      tabIndex={0}
      aria-label="Talk with RODEX AI"
      aria-keyshortcuts="Enter Space"
      onClick={activate}
      onKeyDown={onKeyboard}
      className="relative isolate flex shrink-0 cursor-pointer touch-manipulation select-none items-center justify-center outline-none focus-visible:rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400"
      style={{ width: Math.max(238, size + 42), height: Math.max(315, Math.round(size * 1.46)) }}
    >
      {/* Soft physical ground shadow: the character, rather than an on-screen label, responds. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[2%] left-1/2 h-6 w-[46%] -translate-x-1/2 rounded-full bg-black/70 blur-xl"
        animate={reduceMotion ? {} : { scaleX: awake ? 0.94 : [1, 0.88, 1], opacity: [0.7, 0.53, 0.7] }}
        transition={{ duration: 5.6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[5%] left-1/2 h-[2px] w-[34%] -translate-x-1/2 rounded-full bg-sky-400/70 blur-[3px]"
        animate={reduceMotion ? {} : { opacity: awake ? [0.25, 0.74, 0.25] : 0.22, scaleX: awake ? [0.85, 1.12, 0.85] : 0.8 }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox="0 0 340 475"
        preserveAspectRatio="xMidYMid meet"
        className="pointer-events-none relative z-10 overflow-visible"
        initial={false}
        animate={reduceMotion ? {} : { y: [0, verticalDrift, 0], rotate: movement.lean }}
        transition={{
          y: { repeat: Infinity, duration: awake ? 3.8 : 5.5, ease: 'easeInOut' },
          rotate: smooth,
        }}
      >
        <defs>
          <linearGradient id="rodex-pearl" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset=".30" stopColor="#E4F1F9" />
            <stop offset=".63" stopColor="#F8FCFF" />
            <stop offset="1" stopColor="#8AA1B5" />
          </linearGradient>
          <radialGradient id="rodex-helmet" cx=".67" cy=".2" r=".83">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset=".49" stopColor="#F5FAFF" />
            <stop offset=".8" stopColor="#C4D5E0" />
            <stop offset="1" stopColor="#7A929F" />
          </radialGradient>
          <linearGradient id="rodex-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FCFEFF" />
            <stop offset=".31" stopColor="#D1E4EF" />
            <stop offset=".66" stopColor="#F6FBFF" />
            <stop offset="1" stopColor="#99B3C5" />
          </linearGradient>
          <radialGradient id="rodex-visor" cx=".43" cy=".40" r=".86">
            <stop offset="0" stopColor="#0B1722" />
            <stop offset=".73" stopColor="#02060B" />
            <stop offset="1" stopColor="#000000" />
          </radialGradient>
          <linearGradient id="rodex-neck" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7592A5" />
            <stop offset="1" stopColor="#EFF7FD" />
          </linearGradient>
          <filter id="rodex-soft-shadow" x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="9" stdDeviation="10" floodColor="#01060D" floodOpacity=".48" />
          </filter>
          <filter id="rodex-eye-glow" x="-100%" y="-200%" width="300%" height="500%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g filter="url(#rodex-soft-shadow)">
          {/* Rear arm */}
          <motion.g
            style={{ transformOrigin: '103px 228px' }}
            initial={false}
            animate={{ rotate: reduceMotion ? 0 : movement.leftArm }}
            transition={smooth}
          >
            <path d="M106 213 C88 198 73 214 65 242 C48 296 41 341 53 359 C68 380 83 343 100 300 C116 258 128 225 106 213 Z" fill="url(#rodex-pearl)" stroke="#A9C3D3" strokeWidth="1.1" />
            <path d="M81 221 C74 235 65 273 59 303" fill="none" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" opacity=".38" />
          </motion.g>

          {/* Exact character silhouette: compact floating tapered shell, without legs. */}
          <path d="M116 216 C144 202 213 201 239 219 C254 244 257 286 248 328 C240 379 210 427 176 438 C154 441 137 421 121 392 C99 347 94 289 102 250 C106 232 111 222 116 216 Z"
            fill="url(#rodex-body)" stroke="#B5CADA" strokeWidth="1.2" />
          <path d="M137 227 C118 283 133 368 159 411" stroke="#FFFFFF" strokeWidth="14" opacity=".30" strokeLinecap="round" fill="none" />
          <path d="M126 217 Q173 238 242 222 L240 240 Q173 261 117 235 Z" fill="url(#rodex-neck)" opacity=".82" />

          {/* The right hand can welcome, present, celebrate or hold steady naturally. */}
          <motion.g
            initial={false}
            style={{ transformOrigin: '242px 227px' }}
            animate={{ rotate: reduceMotion ? 0 : movement.rightArm }}
            transition={smooth}
          >
            <path d="M245 215 C264 202 277 224 288 248 C298 274 311 305 308 330 C304 352 286 357 271 347 C250 333 239 306 229 275 C219 243 227 220 245 215 Z" fill="url(#rodex-pearl)" stroke="#C9D9E3" strokeWidth="1.3" />
            <path d="M242 225 C248 250 259 282 272 306" stroke="#FFFFFF" strokeWidth="9" opacity=".42" strokeLinecap="round" fill="none" />
          </motion.g>

          {/* Head animated independently; retained rounded white helmet and black oval visor. */}
          <motion.g
            initial={false}
            style={{ transformOrigin: '177px 216px' }}
            animate={{ rotate: reduceMotion ? 0 : movement.head }}
            transition={smooth}
          >
            <path d="M67 147 C69 90 108 48 171 40 C231 31 277 60 294 119 C309 173 291 217 250 237 C209 254 133 242 99 216 C78 199 65 177 67 147 Z"
              fill="url(#rodex-helmet)" stroke="#E6F1F7" strokeWidth="1.2" />
            <path d="M91 129 C100 90 131 64 164 58" stroke="#FFFFFF" strokeWidth="11" strokeLinecap="round" opacity=".49" fill="none" />
            <path d="M152 167 C174 146 234 142 263 153 C288 163 290 193 279 211 C262 240 202 243 164 229 C137 219 129 193 141 179 C145 174 149 170 152 167 Z"
              fill="url(#rodex-visor)" stroke="#172330" strokeWidth="1.2" />
            <path d="M164 165 Q208 149 249 162" fill="none" stroke="#486273" opacity=".12" strokeWidth="3" />
            {/* No words on the face or in the UI. Eyes alone convey attention and emotion. */}
            <motion.g
              style={{ transformOrigin: '208px 186px' }}
              animate={reduceMotion ? {} : { scaleY: [1, 1, 1, 0.08, 1] }}
              transition={{ duration: awake ? 4.7 : 6.1, repeat: Infinity, ease: 'easeInOut', times: [0, 0.58, 0.82, 0.85, 1] }}
            >
              <motion.path
                d={eyes[0]}
                fill="none"
                stroke="#03B9FF"
                strokeWidth={pose === 'attend' ? 5.5 : 4.8}
                strokeLinecap="round"
                filter="url(#rodex-eye-glow)"
                animate={{ d: eyes[0], opacity: faceLight }}
                transition={eyeTransition}
              />
              <motion.path
                d={eyes[1]}
                fill="none"
                stroke="#03B9FF"
                strokeWidth={pose === 'attend' ? 5.5 : 4.8}
                strokeLinecap="round"
                filter="url(#rodex-eye-glow)"
                animate={{ d: eyes[1], opacity: faceLight }}
                transition={eyeTransition}
              />
            </motion.g>
          </motion.g>
        </g>
      </motion.svg>
    </div>
  );
};
