import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { AssistantState } from '../types';

interface RodexSpeechWaveProps {
  state: AssistantState;
  audioLevel: number;
}

/**
 * Non-interactive visual representation of the real speech portal.
 * Deliberately no microphone icon or button; users speak to the robot
 * using its existing voice engine, wake word, and click-to-start path.
 */
export const RodexSpeechWave: React.FC<RodexSpeechWaveProps> = ({ state, audioLevel }) => {
  const reduceMotion = useReducedMotion();
  const active = state === 'speaking' || state === 'listening' || state === 'input_detected';
  const level = Math.max(0, Math.min(1, audioLevel || 0));
  const waves = useMemo(() => [0, .58, 1.17].map((phase, index) => {
    const amplitude = (active ? 15 + 19 * level : 12) * (1 - index * .22);
    const yOffset = (index - 1) * 1.5;
    const pts = Array.from({ length: 161 }, (_, i) => {
      const t = i / 160;
      const envelope = Math.pow(Math.sin(Math.PI * t), 1.9);
      const y = 60 + yOffset + Math.sin(t * Math.PI * 10.5 + phase) * amplitude * envelope;
      return `${i === 0 ? 'M' : 'L'}${(t * 960).toFixed(2)},${y.toFixed(2)}`;
    });
    return pts.join(' ');
  }), [active, level]);

  return (
    <div className="rodex-quiet-wave" data-voice-active={active} aria-hidden="true">
      <svg viewBox="0 0 960 120" preserveAspectRatio="none" className="rodex-speech-wave-svg">
        <defs>
          <linearGradient id="rodex-portal-wave" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#0e73e6" stopOpacity=".05" />
            <stop offset="22%" stopColor="#04a8ff" stopOpacity=".63" />
            <stop offset="50%" stopColor="#7ff7ff" stopOpacity="1" />
            <stop offset="78%" stopColor="#04a8ff" stopOpacity=".63" />
            <stop offset="100%" stopColor="#0e73e6" stopOpacity=".05" />
          </linearGradient>
          <filter id="rodex-wave-light" x="-20%" y="-200%" width="140%" height="500%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        {waves.map((d, i) => (
          <React.Fragment key={i}>
            <motion.path
              d={d}
              fill="none"
              stroke="url(#rodex-portal-wave)"
              strokeWidth={i === 0 ? 5 : 3}
              strokeLinecap="round"
              filter="url(#rodex-wave-light)"
              opacity=".6"
              animate={reduceMotion ? undefined : { opacity: active ? [.4, .84, .4] : [.16, .35, .16] }}
              transition={{ duration: active ? 1.05 + i * .1 : 3.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.path
              d={d}
              fill="none"
              stroke="url(#rodex-portal-wave)"
              strokeWidth={i === 0 ? 1.9 : 1.3}
              strokeLinecap="round"
              animate={reduceMotion ? undefined : { opacity: active ? [.7, 1, .7] : [.32, .68, .32] }}
              transition={{ duration: active ? 1.1 + i * .12 : 3.7, repeat: Infinity, ease: 'easeInOut' }}
            />
          </React.Fragment>
        ))}
      </svg>
    </div>
  );
};
