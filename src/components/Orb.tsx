import React, { useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { AssistantState } from '../types';

interface OrbProps {
  state: AssistantState;
  audioLevel?: number; // 0.0 to 1.0 from mic or speech
  pitchHz?: number; // detected voice pitch frequency in Hz (e.g. 85 - 240 Hz)
  onClick?: () => void;
  size?: number;
}

interface NeuralParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  pulsePhase: number;
  orbitAngle: number;
  orbitSpeed: number;
  depth: number;
}

export const Orb: React.FC<OrbProps> = ({
  state,
  audioLevel = 0,
  pitchHz = 124,
  onClick,
  size = 280,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const audioLevelRef = useRef(audioLevel);
  const pitchHzRef = useRef(pitchHz);
  const sizeRef = useRef(size);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    audioLevelRef.current = audioLevel;
  }, [audioLevel]);

  useEffect(() => {
    pitchHzRef.current = pitchHz;
  }, [pitchHz]);

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  // Professional Multi-Wave Plasma, HUD Precision Optics & Neural Synapse Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let smoothedLevel = 0;
    let smoothedPitch = pitchHzRef.current || 124;
    let hudRotation = 0;
    const startTime = performance.now();
    const canvasMargin = 65;

    // Initialize 48 Neural Synaptic Nodes
    const numParticles = 48;
    const particles: NeuralParticle[] = [];
    for (let i = 0; i < numParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const rRatio = Math.sqrt(Math.random()) * 0.78;
      particles.push({
        x: Math.cos(angle) * rRatio,
        y: Math.sin(angle) * rRatio,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        baseRadius: Math.random() * 1.8 + 1.1,
        pulsePhase: Math.random() * Math.PI * 2,
        orbitAngle: angle,
        orbitSpeed: (0.1 + Math.random() * 0.25) * (Math.random() > 0.5 ? 1 : -1),
        depth: Math.random() * 0.6 + 0.6,
      });
    }

    const render = (now: number) => {
      animId = requestAnimationFrame(render);

      const currentState = stateRef.current;
      const targetLevel = audioLevelRef.current || 0;
      const targetPitch = pitchHzRef.current || 124;
      const currentSize = sizeRef.current;
      const canvasDim = currentSize + canvasMargin * 2;
      const center = canvasDim / 2;

      // Handle Retina / high-DPI razor sharpness
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetWidth = Math.round(canvasDim * dpr);
      const targetHeight = Math.round(canvasDim * dpr);
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, canvasDim, canvasDim);

      // Smooth attack/decay for audio metrics
      const lerpSpeed = targetLevel > smoothedLevel ? 0.32 : 0.14;
      smoothedLevel += (targetLevel - smoothedLevel) * lerpSpeed;
      smoothedPitch += (targetPitch - smoothedPitch) * 0.12;

      // Dynamic rotation acceleration - hyper-accelerated during neural thinking (millions of ops/sec)
      const rotSpeed = currentState === 'thinking' ? 0.088 : currentState === 'speaking' ? 0.018 : 0.008;
      hudRotation += rotSpeed;

      const normPitch = Math.max(0, Math.min(1, (smoothedPitch - 85) / 155));
      const elapsed = (now - startTime) / 1000;
      const isListening = currentState === 'listening';
      const isSpeaking = currentState === 'speaking';
      const isThinking = currentState === 'thinking';
      const isActiveVoice = isListening || isSpeaking;

      // Calculate dynamic orb scale
      let currentOrbScale = 1.0;
      if (isListening) {
        currentOrbScale = 1.0 + smoothedLevel * 0.22;
      } else if (isSpeaking) {
        currentOrbScale = 1.0 + Math.sin(elapsed * 7) * 0.06 + smoothedLevel * 0.14;
      } else if (isThinking) {
        currentOrbScale = 1.03;
      }

      const orbRadius = (currentSize / 2) * currentOrbScale;
      const innerRadius = orbRadius + 4;

      // Dynamic chromatic palette reacting to state and voice pitch:
      let rNode = 6, gNode = 182, bNode = 212; // Cyan default
      if (isThinking) {
        rNode = 16; gNode = 185; bNode = 129; // Emerald
      } else if (normPitch < 0.4) {
        const t = normPitch / 0.4;
        rNode = Math.round(59 * (1 - t) + 6 * t);
        gNode = Math.round(130 * (1 - t) + 182 * t);
        bNode = Math.round(246 * (1 - t) + 212 * t);
      } else if (normPitch < 0.75) {
        const t = (normPitch - 0.4) / 0.35;
        rNode = Math.round(6 * (1 - t) + 16 * t);
        gNode = Math.round(182 * (1 - t) + 185 * t);
        bNode = Math.round(212 * (1 - t) + 129 * t);
      } else {
        const t = (normPitch - 0.75) / 0.25;
        rNode = Math.round(16 * (1 - t) + 167 * t);
        gNode = Math.round(185 * (1 - t) + 243 * t);
        bNode = Math.round(129 * (1 - t) + 208 * t);
      }

      // -------------------------------------------------------------
      // 1. PRECISION HOLOGRAPHIC HUD RINGS & CARDINAL TICKS
      // -------------------------------------------------------------
      const hudRadius = orbRadius + 22 + (isActiveVoice ? smoothedLevel * 8 : 0);

      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(hudRotation);

      // Fine concentric dotted HUD ring
      ctx.beginPath();
      ctx.arc(0, 0, hudRadius, 0, Math.PI * 2);
      ctx.strokeStyle = isThinking
        ? 'rgba(52, 211, 153, 0.45)'
        : isActiveVoice
        ? `rgba(${rNode}, ${gNode}, ${bNode}, 0.5)`
        : 'rgba(6, 182, 212, 0.22)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 9]);
      ctx.stroke();
      ctx.setLineDash([]); // reset

      // 12 Precision Optical Caliper Ticks (every 30 degrees)
      for (let t = 0; t < 12; t++) {
        const angleTick = (t * Math.PI) / 6;
        const isCardinal = t % 3 === 0;
        const tickLength = isCardinal ? 7 : 4;
        const tickR1 = hudRadius - 1;
        const tickR2 = hudRadius + tickLength;

        ctx.beginPath();
        ctx.moveTo(Math.cos(angleTick) * tickR1, Math.sin(angleTick) * tickR1);
        ctx.lineTo(Math.cos(angleTick) * tickR2, Math.sin(angleTick) * tickR2);
        ctx.strokeStyle = isCardinal
          ? (isThinking ? 'rgba(52, 211, 153, 0.85)' : `rgba(${rNode}, ${gNode}, ${bNode}, 0.85)`)
          : 'rgba(255, 255, 255, 0.28)';
        ctx.lineWidth = isCardinal ? 1.5 : 0.9;
        ctx.stroke();
      }

      // Counter-rotating outer arc segments (Orbital Reticle)
      ctx.rotate(-hudRotation * 2.2);
      const arcCount = 3;
      const arcSpan = Math.PI / 4.5;
      for (let a = 0; a < arcCount; a++) {
        const arcStart = (a * Math.PI * 2) / arcCount;
        ctx.beginPath();
        ctx.arc(0, 0, hudRadius + 9, arcStart, arcStart + arcSpan);
        ctx.strokeStyle = isThinking
          ? 'rgba(16, 185, 129, 0.65)'
          : `rgba(${rNode}, ${gNode}, ${bNode}, ${0.35 + smoothedLevel * 0.4})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      ctx.restore();

      // -------------------------------------------------------------
      // 2. SIRI-STYLE FLUID CHROMATIC PLASMA WAVES (Oscillating Ribbons)
      // -------------------------------------------------------------
      const numWaves = 3;
      for (let w = 0; w < numWaves; w++) {
        const waveAngleOffset = (w * Math.PI * 2) / numWaves;
        const waveFreq = 3.5 + w * 1.2;
        const waveAmp = (6 + smoothedLevel * 18 + normPitch * 10) * (w % 2 === 0 ? 1 : -1);
        const waveSpeed = elapsed * (2.8 + w * 0.8);

        ctx.beginPath();
        const steps = 72;
        for (let s = 0; s <= steps; s++) {
          const theta = (s / steps) * Math.PI * 2;
          const radialDist =
            orbRadius * 0.94 +
            Math.sin(theta * waveFreq + waveSpeed + waveAngleOffset) * waveAmp * 0.45 +
            Math.cos(theta * 2 - waveSpeed * 0.5) * 3;
          const wx = center + Math.cos(theta) * radialDist;
          const wy = center + Math.sin(theta) * radialDist;
          if (s === 0) ctx.moveTo(wx, wy);
          else ctx.lineTo(wx, wy);
        }
        ctx.closePath();

        // Wave color palettes
        const waveAlpha = isActiveVoice ? 0.42 + smoothedLevel * 0.35 : 0.16;
        let waveStroke = `rgba(${rNode}, ${gNode}, ${bNode}, ${waveAlpha})`;
        if (w === 1) {
          waveStroke = isThinking
            ? `rgba(52, 211, 153, ${waveAlpha})`
            : `rgba(99, 102, 241, ${waveAlpha})`; // Indigo accent
        } else if (w === 2) {
          waveStroke = `rgba(34, 211, 238, ${waveAlpha * 0.9})`; // Cyan
        }

        ctx.strokeStyle = waveStroke;
        ctx.lineWidth = isActiveVoice ? 2.2 : 1.3;
        ctx.shadowBlur = isActiveVoice ? 8 + smoothedLevel * 10 : 0;
        ctx.shadowColor = waveStroke;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // -------------------------------------------------------------
      // 3. NEURAL PARTICLE SYNAPSE SYSTEM (Pitch Reactive Inside Orb)
      // Hyper-accelerated to millions of synaptic cycles per second during thinking
      // -------------------------------------------------------------
      const kineticMultiplier = isThinking ? 4.8 : 0.55 + normPitch * 1.6 + smoothedLevel * 2.5;
      const pitchVibration = isThinking
        ? Math.sin(elapsed * 24) * 1.8
        : isActiveVoice
        ? Math.sin(elapsed * (smoothedPitch * 0.15)) * (0.8 + normPitch * 1.5)
        : 0;
      const maxAllowedRadius = orbRadius * 0.85;

      for (let i = 0; i < numParticles; i++) {
        const p = particles[i];
        p.orbitAngle += p.orbitSpeed * kineticMultiplier * 0.016;

        p.x +=
          (p.vx * kineticMultiplier +
            Math.cos(p.orbitAngle) * 0.16 * kineticMultiplier +
            (Math.random() - 0.5) * pitchVibration * 0.22) *
          (currentSize * 0.0022);
        p.y +=
          (p.vy * kineticMultiplier +
            Math.sin(p.orbitAngle) * 0.16 * kineticMultiplier +
            (Math.random() - 0.5) * pitchVibration * 0.22) *
          (currentSize * 0.0022);

        const currentDist = Math.hypot(p.x, p.y);
        if (currentDist > maxAllowedRadius) {
          const boundAngle = Math.atan2(p.y, p.x);
          p.x = Math.cos(boundAngle) * maxAllowedRadius;
          p.y = Math.sin(boundAngle) * maxAllowedRadius;
          p.vx = -p.vx * 0.65 - Math.cos(boundAngle) * 0.25;
          p.vy = -p.vy * 0.65 - Math.sin(boundAngle) * 0.25;
        }
      }

      const maxSynapseDist = (38 + normPitch * 28 + smoothedLevel * 28 + (isThinking ? 18 : 0)) * (currentSize / 280);

      // Draw Synaptic Filaments
      for (let i = 0; i < numParticles; i++) {
        const p1 = particles[i];
        const px1 = center + p1.x;
        const py1 = center + p1.y;

        for (let j = i + 1; j < numParticles; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.hypot(dx, dy);

          if (dist < maxSynapseDist) {
            const proximity = 1 - dist / maxSynapseDist;
            const synapseAlpha = isThinking
              ? proximity * 0.72
              : proximity * (0.22 + smoothedLevel * 0.55 + normPitch * 0.25);

            ctx.beginPath();
            ctx.moveTo(px1, py1);
            ctx.lineTo(center + p2.x, center + p2.y);
            ctx.strokeStyle = `rgba(${rNode}, ${gNode}, ${bNode}, ${synapseAlpha})`;
            ctx.lineWidth = isThinking ? 1.6 : isActiveVoice ? 1.35 : 0.85;
            ctx.stroke();

            // Action potential sparks firing continuously during high-capacity thinking or active voice
            if ((isActiveVoice || isThinking) && dist > 12) {
              const impulseFreq = isThinking ? 6.5 : 1.6 + (smoothedPitch / 100) * 2.4;
              const sparkProgress = (elapsed * impulseFreq + (i + j) * 0.21) % 1;
              const sparkX = px1 + (center + p2.x - px1) * sparkProgress;
              const sparkY = py1 + (center + p2.y - py1) * sparkProgress;

              ctx.beginPath();
              ctx.arc(sparkX, sparkY, 1.2 + normPitch * 0.9, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.shadowBlur = 5 + normPitch * 7;
              ctx.shadowColor = `rgba(${rNode}, ${gNode}, ${bNode}, 0.95)`;
              ctx.fill();
              ctx.shadowBlur = 0;
            }
          }
        }
      }

      // Render Nodes with Soft Halos
      for (let i = 0; i < numParticles; i++) {
        const p = particles[i];
        const px = center + p.x;
        const py = center + p.y;
        const pulse = Math.sin(elapsed * (3.5 + normPitch * 5.0) + p.pulsePhase) * 0.35;
        const nodeRadius = p.baseRadius * (1 + pulse + smoothedLevel * 0.65 + normPitch * 0.4);

        ctx.beginPath();
        ctx.arc(px, py, nodeRadius * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rNode}, ${gNode}, ${bNode}, ${0.14 + smoothedLevel * 0.25 + normPitch * 0.15})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, nodeRadius, 0, Math.PI * 2);
        ctx.fillStyle = isActiveVoice
          ? `rgba(${Math.min(255, rNode + 60)}, ${Math.min(255, gNode + 60)}, ${Math.min(255, bNode + 60)}, 0.95)`
          : `rgba(${rNode}, ${gNode}, ${bNode}, 0.8)`;
        ctx.shadowBlur = 6 + normPitch * 6 + smoothedLevel * 8;
        ctx.shadowColor = `rgba(${rNode}, ${gNode}, ${bNode}, 0.9)`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // -------------------------------------------------------------
      // 4. RADIAL SOUNDWAVE SPECTRUM BARS (Harmonically Synchronized)
      // -------------------------------------------------------------
      const numBars = 68;

      for (let i = 0; i < numBars; i++) {
        const angle = (i / numBars) * Math.PI * 2 - Math.PI / 2;
        const normalizedAngle = (angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
        const freqNorm = 1 - Math.abs(normalizedAngle - Math.PI) / Math.PI;

        const bassWave =
          Math.sin(elapsed * 2.8 + i * 0.12) * 0.65 +
          Math.cos(elapsed * 1.6 + i * 0.08) * 0.35;

        const vocalWave =
          Math.sin(elapsed * 6.5 + i * 0.45) *
          Math.cos(elapsed * 4.2 - i * 0.3) * 0.8 +
          Math.sin(elapsed * 8.8 + i * 0.6) * 0.3;

        const trebleWave =
          (Math.sin(elapsed * 13.0 + i * 0.9) +
            Math.cos(elapsed * 19.5 + i * 1.3)) *
          0.5;

        let freqWave = 0;
        if (freqNorm < 0.35) {
          const t = freqNorm / 0.35;
          freqWave = bassWave * (1 - t) + vocalWave * t;
        } else if (freqNorm < 0.75) {
          const t = (freqNorm - 0.35) / 0.4;
          freqWave = vocalWave * (1 - t) + trebleWave * t;
        } else {
          freqWave = trebleWave;
        }

        const travelingWave = Math.sin(elapsed * 4.5 - angle * 3.5) * 0.28;
        const rawWave = (freqWave + travelingWave + 1.2) / 2.2;
        const normalizedWave = Math.max(0.05, Math.min(1.0, rawWave));

        let barHeight = 0;
        if (isActiveVoice) {
          const voiceBoost = isListening ? 1.25 : 1.0;
          const dynamicAmp = 0.22 + Math.min(1.0, smoothedLevel * voiceBoost) * 0.88;
          const minHeight = 6;
          const maxHeight = 38;
          barHeight = minHeight + normalizedWave * dynamicAmp * (maxHeight - minHeight);
        } else if (isThinking) {
          const thinkWave = Math.sin(elapsed * 4.8 + angle * 4) * 0.5 + 0.5;
          barHeight = 4 + thinkWave * 9;
        } else {
          const idleWave = Math.sin(elapsed * 2.2 + angle * 2) * 0.5 + 0.5;
          barHeight = 3.5 + idleWave * 4.5;
        }

        const outerRadius = innerRadius + barHeight;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const x1 = center + cosA * innerRadius;
        const y1 = center + sinA * innerRadius;
        const x2 = center + cosA * outerRadius;
        const y2 = center + sinA * outerRadius;

        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        if (isActiveVoice) {
          grad.addColorStop(0, `rgba(${rNode}, ${gNode}, ${bNode}, 0.38)`);
          grad.addColorStop(0.65, `rgba(${Math.min(255, rNode + 35)}, ${Math.min(255, gNode + 35)}, ${Math.min(255, bNode + 35)}, 0.88)`);
          grad.addColorStop(1, '#ffffff');
        } else if (isThinking) {
          grad.addColorStop(0, 'rgba(5, 150, 105, 0.35)');
          grad.addColorStop(1, 'rgba(52, 211, 153, 0.85)');
        } else {
          grad.addColorStop(0, 'rgba(6, 182, 212, 0.2)');
          grad.addColorStop(1, 'rgba(34, 211, 238, 0.55)');
        }

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = isActiveVoice ? 2.8 : 1.8;
        ctx.lineCap = 'round';
        ctx.strokeStyle = grad;
        ctx.stroke();

        if (isActiveVoice && barHeight > 8) {
          ctx.beginPath();
          ctx.arc(x2, y2, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = normPitch > 0.65 ? '#a7f3d0' : '#cffafe';
          ctx.shadowBlur = 6;
          ctx.shadowColor = `rgba(${rNode}, ${gNode}, ${bNode}, 0.9)`;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      ctx.restore();
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  // Calculate dynamic scale and glow based on state and audio level
  const dynamicScale = useMemo(() => {
    switch (state) {
      case 'listening':
        return 1.0 + audioLevel * 0.22;
      case 'thinking':
        return 1.04;
      case 'speaking':
        return 1.0 + Math.sin(Date.now() / 150) * 0.07 + audioLevel * 0.15;
      case 'idle':
      default:
        return 1.0;
    }
  }, [state, audioLevel]);

  return (
    <div
      id="rodex-orb-container"
      className="relative flex items-center justify-center cursor-pointer select-none"
      style={{ width: size, height: size }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`RODEX AI Orb - Status: ${state}`}
    >
      {/* Dynamic Multi-Wave & Frequency Equalizer Canvas */}
      <canvas
        id="rodex-soundwave-canvas"
        ref={canvasRef}
        className="absolute pointer-events-none z-10"
        style={{
          width: size + 130,
          height: size + 130,
          top: -65,
          left: -65,
        }}
      />

      {/* Atmospheric Aurora Aura Glow */}
      <div
        className={`absolute inset-0 rounded-full transition-all duration-700 pointer-events-none ${
          state === 'listening'
            ? 'opacity-85 scale-135 blur-3xl bg-cyan-500/35'
            : state === 'thinking'
            ? 'opacity-90 scale-120 blur-3xl bg-emerald-500/35 animate-pulse'
            : state === 'speaking'
            ? 'opacity-90 scale-130 blur-3xl bg-teal-500/35'
            : 'opacity-55 scale-105 blur-2xl bg-cyan-600/25'
        }`}
      />

      {/* Holographic Siri Fluid Ambient Ring */}
      <div
        className="absolute inset-[-18px] rounded-full pointer-events-none opacity-40 animate-siri-aurora"
        style={{
          background:
            state === 'thinking'
              ? 'conic-gradient(from 0deg, rgba(16,185,129,0.5), rgba(6,182,212,0.4), rgba(52,211,153,0.6), rgba(16,185,129,0.5))'
              : 'conic-gradient(from 0deg, rgba(6,182,212,0.6), rgba(99,102,241,0.5), rgba(20,184,166,0.6), rgba(6,182,212,0.6))',
          filter: 'blur(12px)',
        }}
      />

      {/* Listening State Expansion Ripples */}
      {state === 'listening' && (
        <>
          <span className="absolute w-full h-full rounded-full border border-cyan-400/50 animate-ripple-wave pointer-events-none" />
          <span
            className="absolute w-full h-full rounded-full border border-teal-400/40 animate-ripple-wave pointer-events-none"
            style={{ animationDelay: '0.6s' }}
          />
          <span
            className="absolute w-full h-full rounded-full border border-emerald-400/30 animate-ripple-wave pointer-events-none"
            style={{ animationDelay: '1.2s' }}
          />
        </>
      )}

      {/* Harmonic Acoustic Ring for Speaking State */}
      {state === 'speaking' && (
        <div
          className="absolute inset-[-14px] rounded-full border border-cyan-400/40 animate-pulse-ring pointer-events-none"
          style={{ animationDuration: '1.6s' }}
        />
      )}

      {/* Quantum Accelerator Ring for Thinking State */}
      {state === 'thinking' && (
        <div className="absolute inset-[-12px] rounded-full border-2 border-dashed border-emerald-400/50 animate-orb-spin-slow pointer-events-none" />
      )}

      {/* Main Animated Spherical Core */}
      <motion.div
        className="relative w-full h-full rounded-full overflow-hidden shadow-2xl flex items-center justify-center"
        animate={{
          scale: dynamicScale,
          y: state === 'idle' ? [0, -5, 0] : 0,
        }}
        transition={{
          y: {
            repeat: Infinity,
            duration: 5,
            ease: 'easeInOut',
          },
          scale: {
            type: 'spring',
            stiffness: 260,
            damping: 22,
          },
        }}
        style={{
          boxShadow:
            state === 'listening'
              ? '0 0 75px rgba(6, 182, 212, 0.65), inset 0 0 45px rgba(20, 184, 166, 0.65)'
              : state === 'thinking'
              ? '0 0 65px rgba(16, 185, 129, 0.65), inset 0 0 40px rgba(6, 182, 212, 0.55)'
              : state === 'speaking'
              ? '0 0 70px rgba(20, 184, 166, 0.65), inset 0 0 50px rgba(29, 78, 216, 0.55)'
              : '0 0 50px rgba(6, 182, 212, 0.4), inset 0 0 35px rgba(29, 78, 216, 0.45)',
        }}
      >
        {/* Layer 1: Core Iridescent Nebula (Cyan -> Turquoise -> Deep Sapphire) */}
        <div
          className="absolute inset-0 rounded-full animate-orb-spin-slow"
          style={{
            background:
              state === 'thinking'
                ? 'radial-gradient(circle at 35% 35%, #a7f3d0 0%, #10b981 25%, #059669 50%, #047857 72%, #064e3b 90%, #020617 100%)'
                : 'radial-gradient(circle at 35% 35%, #a5f3fc 0%, #06b6d4 22%, #14b8a6 45%, #0d9488 65%, #10b981 78%, #1d4ed8 92%, #020617 100%)',
            filter: 'contrast(1.18) brightness(1.06)',
          }}
        />

        {/* Layer 2: Swirling Apple Siri Fluid Nebula Mesh */}
        <div
          className="absolute inset-0 rounded-full mix-blend-color-dodge opacity-80 animate-orb-spin-reverse pointer-events-none"
          style={{
            background:
              state === 'thinking'
                ? 'conic-gradient(from 45deg, #10b981, #34d399, #059669, #06b6d4, #10b981)'
                : 'conic-gradient(from 45deg, #06b6d4, #6366f1, #14b8a6, #10b981, #06b6d4)',
            filter: 'blur(16px)',
          }}
        />

        {/* Layer 3: Internal Luminous Starburst Core */}
        <div
          className={`absolute rounded-full pointer-events-none transition-all duration-300 ${
            state === 'thinking'
              ? 'w-28 h-28 bg-emerald-300/70 blur-md animate-ping'
              : state === 'listening'
              ? 'w-30 h-30 bg-cyan-200/60 blur-lg scale-115'
              : state === 'speaking'
              ? 'w-28 h-28 bg-teal-200/60 blur-lg'
              : 'w-22 h-22 bg-cyan-300/45 blur-md'
          }`}
        />

        {/* Layer 4: Glass Surface Specular Reflection & Fresnel Arch */}
        <div
          className="absolute inset-2 rounded-full pointer-events-none opacity-50"
          style={{
            background:
              'linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.08) 45%, rgba(0, 0, 0, 0.45) 100%)',
          }}
        />

        {/* Layer 5: High-Precision Outer Rim Bezel */}
        <div className="absolute inset-0 rounded-full border border-cyan-300/40 pointer-events-none" />
      </motion.div>
    </div>
  );
};
