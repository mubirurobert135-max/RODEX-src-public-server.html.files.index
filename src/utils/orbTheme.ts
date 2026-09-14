import { AssistantState, AppMode, ThemeAccent } from '../types';

export interface OrbGlowTheme {
  id: string;
  name: string;
  label: string;
  primaryRGB: [number, number, number];
  secondaryRGB: [number, number, number];
  accentRGB: [number, number, number];
  glowHex: string;
  coreGradient: string;
  meshGradient: string;
  boxShadow: (state: AssistantState, level: number) => string;
  atmosphereClass: string;
  ambientGlowClass: string;
  ringBorderColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export const ORB_THEMES: Record<string, OrbGlowTheme> = {
  // Cyan: Default Idle & Core RODEX
  cyan: {
    id: 'cyan',
    name: 'RODEX Cyan',
    label: 'RODEX Core',
    primaryRGB: [6, 182, 212], // #06b6d4
    secondaryRGB: [34, 211, 238], // #22d3ee
    accentRGB: [99, 102, 241], // #6366f1
    glowHex: '#06b6d4',
    coreGradient:
      'radial-gradient(circle at 35% 35%, #a5f3fc 0%, #06b6d4 22%, #14b8a6 45%, #0d9488 65%, #10b981 78%, #1d4ed8 92%, #020617 100%)',
    meshGradient:
      'conic-gradient(from 45deg, #06b6d4, #6366f1, #14b8a6, #10b981, #06b6d4)',
    boxShadow: (state, level) => {
      if (state === 'listening') {
        return `0 0 ${75 + level * 30}px rgba(6, 182, 212, 0.7), inset 0 0 45px rgba(34, 211, 238, 0.65)`;
      }
      if (state === 'speaking') {
        return `0 0 70px rgba(6, 182, 212, 0.65), inset 0 0 50px rgba(29, 78, 216, 0.55)`;
      }
      return '0 0 52px rgba(6, 182, 212, 0.45), inset 0 0 35px rgba(29, 78, 216, 0.45)';
    },
    atmosphereClass: 'bg-cyan-500/30',
    ambientGlowClass: 'bg-cyan-600/15',
    ringBorderColor: 'rgba(6, 182, 212, 0.4)',
    badgeBg: 'bg-cyan-950/80',
    badgeText: 'text-cyan-300',
    badgeBorder: 'border-cyan-800/80',
  },

  // Gold: Neural Thinking & High-Computation Mode
  gold: {
    id: 'gold',
    name: 'Neural Gold',
    label: 'Thinking Gold',
    primaryRGB: [245, 158, 11], // #f59e0b
    secondaryRGB: [251, 191, 36], // #fbbf24
    accentRGB: [217, 119, 6], // #d97706
    glowHex: '#fbbf24',
    coreGradient:
      'radial-gradient(circle at 35% 35%, #fef3c7 0%, #fbbf24 22%, #f59e0b 45%, #d97706 65%, #b45309 78%, #78350f 92%, #0e0701 100%)',
    meshGradient:
      'conic-gradient(from 45deg, #f59e0b, #fbbf24, #d97706, #fde047, #f59e0b)',
    boxShadow: (_state, _level) => {
      return '0 0 75px rgba(245, 158, 11, 0.75), inset 0 0 45px rgba(251, 191, 36, 0.65)';
    },
    atmosphereClass: 'bg-amber-500/35',
    ambientGlowClass: 'bg-amber-500/20',
    ringBorderColor: 'rgba(245, 158, 11, 0.55)',
    badgeBg: 'bg-amber-950/80',
    badgeText: 'text-amber-300',
    badgeBorder: 'border-amber-700/80',
  },

  // Ruby: Live Call & Two-Way Handsfree Neural Audio Link
  ruby: {
    id: 'ruby',
    name: 'Live Ruby',
    label: 'Live Call Ruby',
    primaryRGB: [225, 29, 72], // #e11d48
    secondaryRGB: [244, 63, 94], // #f43f5e
    accentRGB: [251, 113, 133], // #fb7185
    glowHex: '#e11d48',
    coreGradient:
      'radial-gradient(circle at 35% 35%, #ffe4e6 0%, #f43f5e 22%, #e11d48 45%, #be123c 65%, #9f1239 78%, #881337 92%, #120406 100%)',
    meshGradient:
      'conic-gradient(from 45deg, #e11d48, #f43f5e, #be123c, #fb7185, #e11d48)',
    boxShadow: (state, level) => {
      const boost = state === 'speaking' || state === 'listening' ? level * 35 : 0;
      return `0 0 ${75 + boost}px rgba(225, 29, 72, 0.8), inset 0 0 45px rgba(244, 63, 94, 0.7)`;
    },
    atmosphereClass: 'bg-rose-500/40',
    ambientGlowClass: 'bg-rose-600/22',
    ringBorderColor: 'rgba(244, 63, 94, 0.55)',
    badgeBg: 'bg-rose-950/80',
    badgeText: 'text-rose-300',
    badgeBorder: 'border-rose-700/80',
  },

  // Emerald: Cyber Emerald & Spotify Mode
  emerald: {
    id: 'emerald',
    name: 'Cyber Emerald',
    label: 'Spotify Emerald',
    primaryRGB: [16, 185, 129], // #10b981
    secondaryRGB: [52, 211, 153], // #34d399
    accentRGB: [5, 150, 105], // #059669
    glowHex: '#10b981',
    coreGradient:
      'radial-gradient(circle at 35% 35%, #a7f3d0 0%, #10b981 25%, #059669 50%, #047857 72%, #064e3b 90%, #020617 100%)',
    meshGradient:
      'conic-gradient(from 45deg, #10b981, #34d399, #059669, #06b6d4, #10b981)',
    boxShadow: (_state, level) => {
      return `0 0 ${65 + level * 20}px rgba(16, 185, 129, 0.65), inset 0 0 40px rgba(52, 211, 153, 0.55)`;
    },
    atmosphereClass: 'bg-emerald-500/30',
    ambientGlowClass: 'bg-emerald-600/18',
    ringBorderColor: 'rgba(16, 185, 129, 0.45)',
    badgeBg: 'bg-emerald-950/80',
    badgeText: 'text-emerald-300',
    badgeBorder: 'border-emerald-800/80',
  },

  // Purple: Quantum Violet & Vision Image Mode
  purple: {
    id: 'purple',
    name: 'Quantum Violet',
    label: 'Vision Amethyst',
    primaryRGB: [168, 85, 247], // #a855f7
    secondaryRGB: [192, 132, 252], // #c084fc
    accentRGB: [126, 34, 206], // #7e22ce
    glowHex: '#a855f7',
    coreGradient:
      'radial-gradient(circle at 35% 35%, #f3e8ff 0%, #c084fc 22%, #a855f7 45%, #9333ea 65%, #7e22ce 78%, #581c87 92%, #0d0417 100%)',
    meshGradient:
      'conic-gradient(from 45deg, #a855f7, #c084fc, #7e22ce, #e879f9, #a855f7)',
    boxShadow: (_state, level) => {
      return `0 0 ${65 + level * 20}px rgba(168, 85, 247, 0.65), inset 0 0 40px rgba(192, 132, 252, 0.55)`;
    },
    atmosphereClass: 'bg-purple-500/30',
    ambientGlowClass: 'bg-purple-600/18',
    ringBorderColor: 'rgba(168, 85, 247, 0.45)',
    badgeBg: 'bg-purple-950/80',
    badgeText: 'text-purple-300',
    badgeBorder: 'border-purple-800/80',
  },

  // Azure: Deep Azure & Code / Developer Mode
  azure: {
    id: 'azure',
    name: 'Deep Azure',
    label: 'Cobalt Azure',
    primaryRGB: [59, 130, 246], // #3b82f6
    secondaryRGB: [96, 165, 250], // #60a5fa
    accentRGB: [29, 78, 216], // #1d4ed8
    glowHex: '#3b82f6',
    coreGradient:
      'radial-gradient(circle at 35% 35%, #dbeafe 0%, #60a5fa 22%, #3b82f6 45%, #2563eb 65%, #1d4ed8 78%, #1e40af 92%, #030717 100%)',
    meshGradient:
      'conic-gradient(from 45deg, #3b82f6, #60a5fa, #1d4ed8, #6366f1, #3b82f6)',
    boxShadow: (_state, level) => {
      return `0 0 ${65 + level * 20}px rgba(59, 130, 246, 0.65), inset 0 0 40px rgba(96, 165, 250, 0.55)`;
    },
    atmosphereClass: 'bg-blue-500/30',
    ambientGlowClass: 'bg-blue-600/18',
    ringBorderColor: 'rgba(59, 130, 246, 0.45)',
    badgeBg: 'bg-blue-950/80',
    badgeText: 'text-blue-300',
    badgeBorder: 'border-blue-800/80',
  },
};

/**
 * Resolves the active theme-aware glow palette dynamically based on:
 * - Live calls (Ruby)
 * - Thinking state (Gold)
 * - Active App Mode (e.g. Spotify -> Emerald, Vision -> Purple, Web -> Cyan/Teal)
 * - Idle state (Cyan default)
 * - Or explicit user manual override theme if set
 */
export function getActiveOrbTheme(params: {
  state: AssistantState;
  isLive?: boolean;
  activeMode?: AppMode;
  themeAccent?: ThemeAccent;
}): OrbGlowTheme {
  const { state, isLive = false, activeMode = 'home', themeAccent = 'auto' } = params;

  // 1. Highest Priority: Live Calls are always Ruby
  if (isLive) {
    return ORB_THEMES.ruby;
  }

  // 2. High Priority: Neural Thinking is Gold
  if (state === 'thinking') {
    return ORB_THEMES.gold;
  }

  // 3. User manual override (if set to a specific accent other than 'auto' and 'cyan')
  if (themeAccent && themeAccent !== 'auto' && themeAccent !== 'cyan' && ORB_THEMES[themeAccent]) {
    return ORB_THEMES[themeAccent];
  }

  // 4. Active mode shifting
  if (activeMode === 'spotify') {
    return ORB_THEMES.emerald;
  }
  if (activeMode === 'image') {
    return ORB_THEMES.purple;
  }
  if (activeMode === 'code') {
    return ORB_THEMES.azure;
  }

  // 5. Explicit user choice of cyan, or default idle
  if (themeAccent === 'cyan' || themeAccent === 'auto') {
    return ORB_THEMES.cyan;
  }

  return ORB_THEMES[themeAccent] || ORB_THEMES.cyan;
}
