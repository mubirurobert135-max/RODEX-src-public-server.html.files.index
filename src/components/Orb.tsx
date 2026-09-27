import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { AssistantState, AppMode, ThemeAccent } from '../types';
import { getActiveOrbTheme, OrbGlowTheme } from '../utils/orbTheme';

interface OrbProps {
  state: AssistantState;
  audioLevel?: number; // 0.0 to 1.0 from mic or speech
  pitchHz?: number; // detected voice pitch frequency in Hz (e.g. 85 - 240 Hz)
  onClick?: () => void;
  size?: number;
  activeMode?: AppMode;
  isLive?: boolean;
  themeAccent?: ThemeAccent;
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

// Utility to generate precision SVG arc paths
function describeSvgArc(
  cx: number,
  cy: number,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const startRad = ((startAngleDeg - 90) * Math.PI) / 180.0;
  const endRad = ((endAngleDeg - 90) * Math.PI) / 180.0;

  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);

  const largeArcFlag = endAngleDeg - startAngleDeg <= 180 ? '0' : '1';

  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${largeArcFlag} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export const Orb: React.FC<OrbProps> = ({
  state,
  audioLevel = 0,
  pitchHz = 124,
  onClick,
  size = 280,
  activeMode = 'home' as AppMode,
  isLive = false,
  themeAccent = 'auto' as ThemeAccent,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const audioLevelRef = useRef(audioLevel);
  const pitchHzRef = useRef(pitchHz);
  const sizeRef = useRef(size);

  // Theme-aware dynamic glow color system
  const activeTheme: OrbGlowTheme = useMemo(() => {
    return getActiveOrbTheme({ state, isLive, activeMode, themeAccent });
  }, [state, isLive, activeMode, themeAccent]);

  const themeRef = useRef<OrbGlowTheme>(activeTheme);

  // Memoize SVG path geometries based on Orb size to eliminate GC churn and CPU overhead
  const memoizedSvgPaths = useMemo(() => {
    const center = (size + 130) / 2;
    const outerRadius = size / 2 + 18;
    const caliperRadius = size / 2 + 28;
    const reticleRadius = size / 2 + 38;

    // 1. Segmented orbital arcs (3 symmetric arc segments)
    const orbitalArcs = [
      describeSvgArc(center, center, outerRadius, 15, 75),
      describeSvgArc(center, center, outerRadius, 135, 195),
      describeSvgArc(center, center, outerRadius, 255, 315),
    ];

    // 2. Counter-rotating outer reticle arcs (4 quadrants)
    const counterArcs = [
      describeSvgArc(center, center, reticleRadius, 0, 45),
      describeSvgArc(center, center, reticleRadius, 90, 135),
      describeSvgArc(center, center, reticleRadius, 180, 225),
      describeSvgArc(center, center, reticleRadius, 270, 315),
    ];

    // 3. Precision optical caliper corner ticks (12 points at 30 deg)
    let caliperTicksPath = '';
    for (let t = 0; t < 12; t++) {
      const angleRad = (t * Math.PI) / 6;
      const isCardinal = t % 3 === 0;
      const len = isCardinal ? 7 : 4;
      const r1 = caliperRadius - 1;
      const r2 = caliperRadius + len;
      const x1 = center + Math.cos(angleRad) * r1;
      const y1 = center + Math.sin(angleRad) * r1;
      const x2 = center + Math.cos(angleRad) * r2;
      const y2 = center + Math.sin(angleRad) * r2;
      caliperTicksPath += `M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)} `;
    }

    // 4. Optical Corner HUD brackets
    const bracketOffset = size / 2 + 30;
    const bSize = 9;
    const cornerBracketsPath = [
      `M ${center - bracketOffset + bSize} ${center - bracketOffset} L ${center - bracketOffset} ${center - bracketOffset} L ${center - bracketOffset} ${center - bracketOffset + bSize}`,
      `M ${center + bracketOffset - bSize} ${center - bracketOffset} L ${center + bracketOffset} ${center - bracketOffset} L ${center + bracketOffset} ${center - bracketOffset + bSize}`,
      `M ${center - bracketOffset + bSize} ${center + bracketOffset} L ${center - bracketOffset} ${center + bracketOffset} L ${center - bracketOffset} ${center + bracketOffset - bSize}`,
      `M ${center + bracketOffset - bSize} ${center + bracketOffset} L ${center + bracketOffset} ${center + bracketOffset} L ${center + bracketOffset} ${center + bracketOffset - bSize}`,
    ].join(' ');

    // 5. Cardinal alignment crosshairs
    const crosshairLen = 12;
    const crosshairGap = size / 2 + 10;
    const crosshairsPath = `
      M ${center - crosshairGap - crosshairLen} ${center} L ${center - crosshairGap} ${center}
      M ${center + crosshairGap} ${center} L ${center + crosshairGap + crosshairLen} ${center}
      M ${center} ${center - crosshairGap - crosshairLen} L ${center} ${center - crosshairGap}
      M ${center} ${center + crosshairGap} L ${center} ${center + crosshairGap + crosshairLen}
    `;

    return {
      orbitalArcs,
      counterArcs,
      caliperTicksPath,
      cornerBracketsPath,
      crosshairsPath,
      center,
      outerRadius,
      caliperRadius,
      reticleRadius,
    };
  }, [size]);

  // Interactive 3D tilt and pointer-tracking physics
  const [pointerCoord, setPointerCoord] = useState<{ x: number; y: number; isHovered: boolean }>({
    x: 0,
    y: 0,
    isHovered: false,
  });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const normX = Math.max(-1, Math.min(1, (e.clientX - centerX) / (rect.width / 2)));
    const normY = Math.max(-1, Math.min(1, (e.clientY - centerY) / (rect.height / 2)));
    setPointerCoord({ x: normX, y: normY, isHovered: true });
  };

  const handlePointerLeave = () => {
    setPointerCoord({ x: 0, y: 0, isHovered: false });
  };

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

  useEffect(() => {
    themeRef.current = activeTheme;
  }, [activeTheme]);

  // Professional Multi-Wave Plasma, HUD Precision Optics & Neural Synapse Canvas with Theme-Aware Glow
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

    // 60 FPS requestAnimationFrame throttling & delta-time synchronization
    const TARGET_FPS = 60;
    const FRAME_INTERVAL = 1000 / TARGET_FPS; // ~16.67ms
    let lastFrameTime = performance.now();

    // Smoothed RGB color channels for smooth organic transition between themes
    let smoothedR = themeRef.current.primaryRGB[0];
    let smoothedG = themeRef.current.primaryRGB[1];
    let smoothedB = themeRef.current.primaryRGB[2];

    let smoothedR2 = themeRef.current.secondaryRGB[0];
    let smoothedG2 = themeRef.current.secondaryRGB[1];
    let smoothedB2 = themeRef.current.secondaryRGB[2];

    let smoothedR3 = themeRef.current.accentRGB[0];
    let smoothedG3 = themeRef.current.accentRGB[1];
    let smoothedB3 = themeRef.current.accentRGB[2];

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

      // Skip CPU/GPU rendering cycles when tab is hidden
      if (document.hidden) {
        return;
      }

      // Throttle to 60 FPS: drop redundant frames on 120Hz/144Hz displays
      const elapsedSinceLast = now - lastFrameTime;
      if (elapsedSinceLast < FRAME_INTERVAL - 1.0) {
        return;
      }
      lastFrameTime = now - (elapsedSinceLast % FRAME_INTERVAL);

      const currentState = stateRef.current;
      const currentTheme = themeRef.current;
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

      // Dynamic rotation acceleration - hyper-accelerated during neural thinking
      const rotSpeed =
        currentState === 'thinking'
          ? 0.088
          : currentState === 'speaking'
          ? 0.018
          : 0.008;
      hudRotation += rotSpeed;

      const normPitch = Math.max(0, Math.min(1, (smoothedPitch - 85) / 155));
      const elapsed = (now - startTime) / 1000;
      const isListening = currentState === 'listening';
      const isSpeaking = currentState === 'speaking';
      const isThinking = currentState === 'thinking';
      const isActiveVoice = isListening || isSpeaking;

      // Calculate dynamic orb scale
      let currentOrbScale = 1.0;
      if (currentState === 'wake_detected') {
        currentOrbScale = 1.08 + Math.sin(elapsed * 18) * 0.06;
      } else if (isListening) {
        currentOrbScale = 1.0 + smoothedLevel * 0.22;
      } else if (isSpeaking) {
        currentOrbScale = 1.0 + Math.sin(elapsed * 7) * 0.06 + smoothedLevel * 0.14;
      } else if (isThinking) {
        currentOrbScale = 1.03;
      }

      const orbRadius = (currentSize / 2) * currentOrbScale;
      const innerRadius = orbRadius + 4;

      // Smooth organic RGB transitions towards active theme colors (e.g. Gold, Cyan, Ruby)
      const colorTransitionSpeed = 0.12;
      smoothedR += (currentTheme.primaryRGB[0] - smoothedR) * colorTransitionSpeed;
      smoothedG += (currentTheme.primaryRGB[1] - smoothedG) * colorTransitionSpeed;
      smoothedB += (currentTheme.primaryRGB[2] - smoothedB) * colorTransitionSpeed;

      smoothedR2 += (currentTheme.secondaryRGB[0] - smoothedR2) * colorTransitionSpeed;
      smoothedG2 += (currentTheme.secondaryRGB[1] - smoothedG2) * colorTransitionSpeed;
      smoothedB2 += (currentTheme.secondaryRGB[2] - smoothedB2) * colorTransitionSpeed;

      smoothedR3 += (currentTheme.accentRGB[0] - smoothedR3) * colorTransitionSpeed;
      smoothedG3 += (currentTheme.accentRGB[1] - smoothedG3) * colorTransitionSpeed;
      smoothedB3 += (currentTheme.accentRGB[2] - smoothedB3) * colorTransitionSpeed;

      const rNode = Math.round(smoothedR);
      const gNode = Math.round(smoothedG);
      const bNode = Math.round(smoothedB);

      const rNode2 = Math.round(smoothedR2);
      const gNode2 = Math.round(smoothedG2);
      const bNode2 = Math.round(smoothedB2);

      const rNode3 = Math.round(smoothedR3);
      const gNode3 = Math.round(smoothedR3);
      const bNode3 = Math.round(smoothedB3);

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
        ? `rgba(${rNode2}, ${gNode2}, ${bNode2}, 0.65)`
        : isActiveVoice
        ? `rgba(${rNode}, ${gNode}, ${bNode}, 0.6)`
        : `rgba(${rNode}, ${gNode}, ${bNode}, 0.28)`;
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
          ? `rgba(${rNode2}, ${gNode2}, ${bNode2}, 0.9)`
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
          ? `rgba(${rNode}, ${gNode}, ${bNode}, 0.8)`
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

        // Wave color palettes derived from theme
        const waveAlpha = isActiveVoice ? 0.45 + smoothedLevel * 0.35 : 0.2;
        let waveStroke = `rgba(${rNode}, ${gNode}, ${bNode}, ${waveAlpha})`;
        if (w === 1) {
          waveStroke = `rgba(${rNode2}, ${gNode2}, ${bNode2}, ${waveAlpha * 0.95})`;
        } else if (w === 2) {
          waveStroke = `rgba(${rNode3}, ${gNode3}, ${bNode3}, ${waveAlpha * 0.85})`;
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
      // Hyper-accelerated during neural thinking
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

      const maxSynapseDist =
        (38 + normPitch * 28 + smoothedLevel * 28 + (isThinking ? 18 : 0)) *
        (currentSize / 280);
      const maxSynapseDistSq = maxSynapseDist * maxSynapseDist;

      // Draw Synaptic Filaments with squared-distance pre-culling
      for (let i = 0; i < numParticles; i++) {
        const p1 = particles[i];
        const px1 = center + p1.x;
        const py1 = center + p1.y;

        for (let j = i + 1; j < numParticles; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxSynapseDistSq) {
            const dist = Math.sqrt(distSq);
            const proximity = 1 - dist / maxSynapseDist;
            const synapseAlpha = isThinking
              ? proximity * 0.78
              : proximity * (0.24 + smoothedLevel * 0.55 + normPitch * 0.25);

            ctx.beginPath();
            ctx.moveTo(px1, py1);
            ctx.lineTo(center + p2.x, center + p2.y);
            ctx.strokeStyle = `rgba(${rNode}, ${gNode}, ${bNode}, ${synapseAlpha})`;
            ctx.lineWidth = isThinking ? 1.6 : isActiveVoice ? 1.35 : 0.85;
            ctx.stroke();

            // Action potential sparks firing continuously during thinking or active voice
            if ((isActiveVoice || isThinking) && dist > 12) {
              const impulseFreq = isThinking ? 6.5 : 1.6 + (smoothedPitch / 100) * 2.4;
              const sparkProgress = (elapsed * impulseFreq + (i + j) * 0.21) % 1;
              const sparkX = px1 + (center + p2.x - px1) * sparkProgress;
              const sparkY = py1 + (center + p2.y - py1) * sparkProgress;

              ctx.beginPath();
              ctx.arc(sparkX, sparkY, 1.2 + normPitch * 0.9, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.shadowBlur = 6 + normPitch * 7;
              ctx.shadowColor = `rgba(${rNode2}, ${gNode2}, ${bNode2}, 0.95)`;
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
        const nodeRadius =
          p.baseRadius * (1 + pulse + smoothedLevel * 0.65 + normPitch * 0.4);

        ctx.beginPath();
        ctx.arc(px, py, nodeRadius * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rNode}, ${gNode}, ${bNode}, ${
          0.14 + smoothedLevel * 0.25 + normPitch * 0.15
        })`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, nodeRadius, 0, Math.PI * 2);
        ctx.fillStyle = isActiveVoice
          ? `rgba(${Math.min(255, rNode + 45)}, ${Math.min(255, gNode + 45)}, ${Math.min(
              255,
              bNode + 45
            )}, 0.95)`
          : `rgba(${rNode}, ${gNode}, ${bNode}, 0.85)`;
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
          grad.addColorStop(
            0.65,
            `rgba(${rNode2}, ${gNode2}, ${bNode2}, 0.88)`
          );
          grad.addColorStop(1, '#ffffff');
        } else if (isThinking) {
          grad.addColorStop(0, `rgba(${rNode}, ${gNode}, ${bNode}, 0.35)`);
          grad.addColorStop(1, `rgba(${rNode2}, ${gNode2}, ${bNode2}, 0.9)`);
        } else {
          grad.addColorStop(0, `rgba(${rNode}, ${gNode}, ${bNode}, 0.22)`);
          grad.addColorStop(1, `rgba(${rNode2}, ${gNode2}, ${bNode2}, 0.6)`);
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
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 6;
          ctx.shadowColor = `rgba(${rNode2}, ${gNode2}, ${bNode2}, 0.95)`;
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

  // Calculate dynamic scale based on state and audio level
  const dynamicScale = useMemo(() => {
    switch (state) {
      case 'wake_detected':
        return 1.12;
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
      className="relative flex items-center justify-center cursor-pointer select-none transition-transform duration-300 aspect-square rounded-full shrink-0 overflow-visible"
      style={{
        width: size,
        height: size,
        aspectRatio: '1 / 1',
        borderRadius: '50%',
        perspective: 900,
      }}
      onClick={onClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      role="button"
      tabIndex={0}
      aria-label={`RODEX AI Orb - Status: ${state} - Theme: ${activeTheme.name}`}
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

      {/* Memoized High-Precision Vector HUD & Optical Reticle SVG Overlay */}
      <svg
        className="absolute pointer-events-none z-15"
        style={{
          width: size + 130,
          height: size + 130,
          top: -65,
          left: -65,
        }}
        viewBox={`0 0 ${size + 130} ${size + 130}`}
      >
        <g
          style={{
            transformOrigin: `${memoizedSvgPaths.center}px ${memoizedSvgPaths.center}px`,
          }}
        >
          {/* Caliper Ticks */}
          <path
            d={memoizedSvgPaths.caliperTicksPath}
            stroke={`rgba(${activeTheme.secondaryRGB.join(',')}, ${
              state === 'thinking' ? 0.85 : state === 'listening' || state === 'speaking' ? 0.7 : 0.4
            })`}
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* Corner HUD Brackets */}
          <path
            d={memoizedSvgPaths.cornerBracketsPath}
            stroke={`rgba(${activeTheme.primaryRGB.join(',')}, ${
              state === 'thinking' ? 0.65 : 0.35
            })`}
            strokeWidth="1"
            fill="none"
          />

          {/* Cardinal Alignment Crosshairs */}
          <path
            d={memoizedSvgPaths.crosshairsPath}
            stroke={`rgba(${activeTheme.primaryRGB.join(',')}, 0.28)`}
            strokeWidth="0.9"
            strokeDasharray="2, 4"
          />

          {/* Segmented Orbital Reticle Arcs */}
          {memoizedSvgPaths.orbitalArcs.map((arcD, idx) => (
            <path
              key={`orbit-arc-${idx}`}
              d={arcD}
              stroke={`rgba(${activeTheme.primaryRGB.join(',')}, ${
                state === 'thinking' ? 0.85 : state === 'listening' || state === 'speaking' ? 0.55 : 0.3
              })`}
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
            />
          ))}

          {/* Counter-rotating outer arcs */}
          {memoizedSvgPaths.counterArcs.map((arcD, idx) => (
            <path
              key={`counter-arc-${idx}`}
              d={arcD}
              stroke={`rgba(${activeTheme.accentRGB.join(',')}, ${
                state === 'thinking' ? 0.75 : 0.25
              })`}
              strokeWidth="1.1"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="4, 6"
            />
          ))}
        </g>
      </svg>

      {/* Atmospheric Aurora Aura Glow - Color shifts with theme & mode */}
      <div
        className={`absolute inset-0 rounded-full transition-all duration-700 pointer-events-none blur-3xl ${
          state === 'listening'
            ? 'opacity-90 scale-135'
            : state === 'thinking'
            ? 'opacity-95 scale-125 animate-pulse'
            : state === 'speaking'
            ? 'opacity-90 scale-130'
            : 'opacity-55 scale-105'
        }`}
        style={{
          backgroundColor: activeTheme.glowHex,
          boxShadow: `0 0 85px ${activeTheme.glowHex}`,
        }}
      />

      {/* Holographic Siri Fluid Ambient Ring */}
      <div
        className="absolute inset-[-18px] rounded-full pointer-events-none opacity-45 animate-siri-aurora transition-all duration-700"
        style={{
          background: `conic-gradient(from 0deg, rgba(${activeTheme.primaryRGB.join(
            ','
          )},0.6), rgba(${activeTheme.secondaryRGB.join(
            ','
          )},0.5), rgba(${activeTheme.accentRGB.join(
            ','
          )},0.6), rgba(${activeTheme.primaryRGB.join(',')},0.6))`,
          filter: 'blur(14px)',
        }}
      />

      {/* Wake Detected Instantaneous Rhythmic Pulse Aura Ring */}
      {state === 'wake_detected' && (
        <>
          <div
            className="absolute inset-[-22px] rounded-full border-2 animate-ping pointer-events-none transition-colors duration-200"
            style={{ borderColor: activeTheme.ringBorderColor, animationDuration: '0.6s' }}
          />
          <div
            className="absolute inset-[-10px] rounded-full border-2 animate-pulse pointer-events-none shadow-[0_0_35px_rgba(34,211,238,0.95)]"
            style={{ borderColor: activeTheme.ringBorderColor, animationDuration: '0.4s' }}
          />
        </>
      )}

      {/* Listening State Expansion Ripples */}
      {state === 'listening' && (
        <>
          <span
            className="absolute w-full h-full rounded-full border animate-ripple-wave pointer-events-none transition-colors duration-500"
            style={{ borderColor: activeTheme.ringBorderColor }}
          />
          <span
            className="absolute w-full h-full rounded-full border animate-ripple-wave pointer-events-none transition-colors duration-500"
            style={{
              borderColor: activeTheme.ringBorderColor,
              animationDelay: '0.6s',
            }}
          />
          <span
            className="absolute w-full h-full rounded-full border animate-ripple-wave pointer-events-none transition-colors duration-500"
            style={{
              borderColor: activeTheme.ringBorderColor,
              animationDelay: '1.2s',
            }}
          />
        </>
      )}

      {/* Harmonic Acoustic Ring for Speaking State */}
      {state === 'speaking' && (
        <div
          className="absolute inset-[-14px] rounded-full border animate-pulse-ring pointer-events-none transition-colors duration-500"
          style={{
            borderColor: activeTheme.ringBorderColor,
            animationDuration: '1.6s',
          }}
        />
      )}

      {/* Quantum Accelerator Ring for Thinking / Processing State */}
      {(state === 'thinking' || state === 'processing') && (
        <div
          className="absolute inset-[-12px] rounded-full border-2 border-dashed animate-orb-spin-slow pointer-events-none transition-colors duration-500"
          style={{ borderColor: activeTheme.ringBorderColor }}
        />
      )}

      {/* Cyber Accelerator Ring for Tool Execution State */}
      {state === 'executing_tool' && (
        <>
          <div
            className="absolute inset-[-14px] rounded-full border-2 border-dashed animate-orb-spin-reverse pointer-events-none transition-colors duration-500"
            style={{ borderColor: activeTheme.ringBorderColor }}
          />
          <div
            className="absolute inset-[-6px] rounded-full border animate-ping opacity-60 pointer-events-none transition-colors duration-500"
            style={{ borderColor: activeTheme.ringBorderColor, animationDuration: '2s' }}
          />
        </>
      )}

      {/* High-Security Shield Ring for Permission Required */}
      {state === 'permission_required' && (
        <div
          className="absolute inset-[-10px] rounded-full border-2 border-amber-500/80 animate-pulse pointer-events-none shadow-[0_0_20px_rgba(245,158,11,0.5)]"
        />
      )}

      {/* Alert Warning Ring for Error State */}
      {state === 'error' && (
        <div
          className="absolute inset-[-12px] rounded-full border-2 border-red-500/90 animate-pulse pointer-events-none shadow-[0_0_25px_rgba(239,68,68,0.6)]"
        />
      )}

      {/* Main Animated Spherical Core with 3D Tilt and Tactile Responsiveness */}
      <motion.div
        className="relative w-full h-full rounded-full overflow-hidden shadow-2xl flex items-center justify-center transition-[box-shadow] duration-700"
        animate={{
          scale: dynamicScale,
          y: state === 'idle' ? [0, -5, 0] : 0,
          rotateX: pointerCoord.isHovered ? pointerCoord.y * -14 : 0,
          rotateY: pointerCoord.isHovered ? pointerCoord.x * 14 : 0,
        }}
        whileHover={{
          scale: dynamicScale * 1.035,
        }}
        whileTap={{
          scale: dynamicScale * 0.95,
        }}
        transition={{
          y: {
            repeat: Infinity,
            duration: 5,
            ease: 'easeInOut',
          },
          scale: {
            type: 'spring',
            stiffness: 280,
            damping: 22,
          },
          rotateX: { type: 'spring', stiffness: 300, damping: 25 },
          rotateY: { type: 'spring', stiffness: 300, damping: 25 },
        }}
        style={{
          boxShadow: activeTheme.boxShadow(state, audioLevel),
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Layer 1: Core Iridescent Nebula with embedded rotating greeting text */}
        <div
          className="absolute inset-0 rounded-full animate-orb-spin-slow transition-all duration-700 flex flex-col items-center justify-center p-4 text-center select-none pointer-events-none overflow-hidden"
          style={{
            background: activeTheme.coreGradient,
            filter: 'contrast(1.18) brightness(1.06)',
          }}
        >
          {/* Integrated Typography rotating synchronously with Layer 1 */}
          <div className="flex flex-col items-center justify-center text-center px-4 w-full z-10 transform-gpu">
            <span
              className="font-extrabold tracking-[0.24em] text-white uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] leading-tight"
              style={{
                fontSize: `${Math.max(13, Math.min(22, size * 0.075))}px`,
                letterSpacing: '0.22em',
                textShadow: '0 0 12px rgba(255,255,255,0.9), 0 0 20px rgba(6,182,212,0.7)',
              }}
            >
              I AM RODEX
            </span>

            <span
              className="mt-1.5 font-bold tracking-[0.18em] text-cyan-200 uppercase drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] leading-tight opacity-95"
              style={{
                fontSize: `${Math.max(8, Math.min(11, size * 0.04))}px`,
                letterSpacing: '0.15em',
                textShadow: '0 0 8px rgba(6,182,212,0.8)',
              }}
            >
              SAY HELLO RODEX TO SPEAK
            </span>
          </div>
        </div>

        {/* Layer 2: Swirling Siri Fluid Nebula Mesh - Theme aware */}
        <div
          className="absolute inset-0 rounded-full mix-blend-color-dodge opacity-80 animate-orb-spin-reverse pointer-events-none transition-all duration-700"
          style={{
            background: activeTheme.meshGradient,
            filter: 'blur(16px)',
          }}
        />

        {/* Layer 3: Internal Luminous Starburst Core */}
        <div
          className={`absolute rounded-full pointer-events-none transition-all duration-500 ${
            state === 'thinking'
              ? 'w-28 h-28 blur-md animate-ping opacity-85'
              : state === 'listening'
              ? 'w-30 h-30 blur-lg scale-115 opacity-75'
              : state === 'speaking'
              ? 'w-28 h-28 blur-lg opacity-75'
              : 'w-22 h-22 blur-md opacity-50'
          }`}
          style={{
            backgroundColor: activeTheme.glowHex,
          }}
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
        <div
          className="absolute inset-0 rounded-full border pointer-events-none transition-colors duration-700"
          style={{ borderColor: activeTheme.ringBorderColor }}
        />
      </motion.div>
    </div>
  );
};
