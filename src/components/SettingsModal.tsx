import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Volume2,
  Mic,
  Palette,
  ShieldCheck,
  Play,
  RotateCcw,
  Sparkles,
  Info,
  Globe,
  Smartphone,
  Zap,
} from 'lucide-react';
import { VoiceSettings, ThemeAccent } from '../types';
import { rodexSynth } from '../utils/speech';
import { triggerHaptic, isHapticsSupported } from '../utils/haptics';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  voiceSettings: VoiceSettings;
  onUpdateVoiceSettings: (settings: VoiceSettings) => void;
  themeAccent: ThemeAccent;
  onUpdateTheme: (theme: ThemeAccent) => void;
  onRequestMicPermission: () => Promise<boolean>;
  micPermissionGranted: boolean;
  onOpenVoiceProfile?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  voiceSettings,
  onUpdateVoiceSettings,
  themeAccent,
  onUpdateTheme,
  onRequestMicPermission,
  micPermissionGranted,
  onOpenVoiceProfile,
}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [testTestingVoice, setTestingVoice] = useState(false);
  const [micStatusMsg, setMicStatusMsg] = useState<string | null>(null);
  const [hapticTestActive, setHapticTestActive] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const updateVoices = () => {
        setVoices(rodexSynth.getVoices());
      };
      updateVoices();

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
        return () => {
          window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
        };
      }
    }
  }, [isOpen]);

  // Deduplicate and provide guaranteed unique React keys for voice options
  const sanitizedVoices = useMemo(() => {
    const seen = new Set<string>();
    const list: { key: string; value: string; label: string }[] = [];

    voices.forEach((v, index) => {
      const val = v.voiceURI || v.name;
      // Deduplicate identical voiceURI and language combinations
      const dedupId = `${val}:::${v.lang}:::${v.name}`;
      if (!seen.has(dedupId)) {
        seen.add(dedupId);
        list.push({
          key: `voice-${index}-${val}-${v.lang}`,
          value: val,
          label: `${v.name} (${v.lang})`,
        });
      }
    });

    return list;
  }, [voices]);

  const handleTestVoice = () => {
    setTestingVoice(true);
    rodexSynth.speak('Greetings. I am RODEX, your advanced AI voice assistant. Subsystems nominal.', {
      voiceURI: voiceSettings.voiceURI,
      rate: voiceSettings.rate,
      pitch: voiceSettings.pitch,
      volume: voiceSettings.volume,
      onEnd: () => setTestingVoice(false),
      onError: () => setTestingVoice(false),
    });
  };

  const handleRequestMic = async () => {
    setMicStatusMsg('Requesting microphone access...');
    const granted = await onRequestMicPermission();
    if (granted) {
      setMicStatusMsg('Microphone permission granted successfully.');
    } else {
      setMicStatusMsg('Microphone permission denied or unavailable in this environment.');
    }
    setTimeout(() => setMicStatusMsg(null), 3500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="rodex-settings-modal"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col justify-between overflow-hidden"
        >
          {/* Header */}
          <header className="px-5 py-4 border-b border-neutral-900 flex items-center justify-between bg-black/80">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <h2 className="text-base font-semibold text-white tracking-wider">
                RODEX PREFERENCES
              </h2>
            </div>
            <button
              id="close-settings-btn"
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </header>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 max-w-lg mx-auto w-full">
            {/* 1. Voice Settings */}
            <section className="bg-neutral-950 border border-neutral-900 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-cyan-400 font-medium text-sm">
                  <Volume2 className="w-4 h-4" />
                  <span>Speech & Synthesis</span>
                </div>
                <button
                  onClick={handleTestVoice}
                  disabled={testTestingVoice}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/50 hover:bg-cyan-900/60 active:scale-95 transition-colors"
                >
                  <Play className="w-3 h-3" />
                  <span>{testTestingVoice ? 'Testing...' : 'Test Voice'}</span>
                </button>
              </div>

              {/* Voice Selector */}
              <div className="space-y-1.5">
                <label className="text-xs text-neutral-400">Assistant Voice Profile</label>
                <select
                  value={voiceSettings.voiceURI}
                  onChange={(e) =>
                    onUpdateVoiceSettings({ ...voiceSettings, voiceURI: e.target.value })
                  }
                  className="w-full bg-neutral-900 text-neutral-200 text-xs rounded-xl px-3 py-2.5 border border-neutral-800 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">Default AI Synthesis Voice (Auto)</option>
                  {sanitizedVoices.map((item) => (
                    <option key={item.key} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rate & Pitch */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>Speed</span>
                    <span className="text-cyan-400">{voiceSettings.rate.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.5"
                    step="0.1"
                    value={voiceSettings.rate}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        rate: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>Pitch</span>
                    <span className="text-cyan-400">{voiceSettings.pitch.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.3"
                    step="0.1"
                    value={voiceSettings.pitch}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        pitch: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Auto Speak Toggle */}
              <label className="flex items-center justify-between cursor-pointer pt-1">
                <div>
                  <div className="text-xs text-neutral-200 font-medium">Read Responses Aloud</div>
                  <div className="text-[11px] text-neutral-500">
                    RODEX vocalizes all AI responses automatically
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={voiceSettings.autoSpeak}
                  onChange={(e) =>
                    onUpdateVoiceSettings({ ...voiceSettings, autoSpeak: e.target.checked })
                  }
                  className="w-4 h-4 accent-cyan-400 cursor-pointer"
                />
              </label>
            </section>

            {/* 2. Wake-word Architecture */}
            <section className="bg-neutral-950 border border-neutral-900 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-cyan-400 font-medium text-sm">
                  <Mic className="w-4 h-4" />
                  <span>Activation Mode</span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                  Tap-To-Talk Active
                </span>
              </div>

              <div className="space-y-2">
                {/* Mr. Robert Voice Profile Link */}
                <button
                  onClick={() => {
                    onClose();
                    onOpenVoiceProfile?.();
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-neutral-900/90 hover:bg-neutral-850 border border-neutral-800 text-xs text-neutral-200 flex items-center justify-between transition-colors active:scale-98"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Voice ID: <strong>Mr. Robert</strong></span>
                  </span>
                  <span className="text-[11px] text-cyan-400 font-medium">Calibrated &rarr;</span>
                </button>

                <label className="flex items-start justify-between cursor-pointer pt-1">
                  <div className="pr-4">
                    <div className="text-xs text-neutral-200 font-medium">
                      "Hey RODEX" Hotword Hook
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      Enables continuous speech listener loop when app is active.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={voiceSettings.wakeWordEnabled}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        wakeWordEnabled: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-cyan-400 mt-1 cursor-pointer"
                  />
                </label>

                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800/80 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    <strong>Android Native Note:</strong> True background wake-word listening while screen is locked requires an Android <code>VoiceInteractionService</code> or continuous Porcupine engine compiled in the APK. Tap-to-talk is the standard prototype input method.
                  </p>
                </div>
              </div>
            </section>

            {/* World Wide Web Connectivity */}
            <section className="bg-neutral-950 border border-neutral-900 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-cyan-400 font-medium text-sm">
                  <Globe className="w-4 h-4" />
                  <span>World Wide Web Connectivity</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-medium">
                  Live Internet
                </span>
              </div>

              <div className="space-y-3">
                <label className="flex items-start justify-between cursor-pointer p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800 hover:border-cyan-500/40 transition-colors">
                  <div className="pr-3">
                    <div className="text-xs text-neutral-200 font-medium">
                      Google Search Grounding
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      Grounds RODEX responses with real-time news, current events, research, facts, and live website citations across the web.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={voiceSettings.webSearchEnabled !== false}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        webSearchEnabled: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-cyan-400 mt-1 cursor-pointer"
                  />
                </label>

                <div className="text-[11px] text-neutral-400 px-1 flex items-center justify-between">
                  <span>Source verification:</span>
                  <span className="text-cyan-400 font-medium">Real-time Web Grounding</span>
                </div>
              </div>
            </section>

            {/* 3. Hardware & Permissions */}
            <section className="bg-neutral-950 border border-neutral-900 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 font-medium text-sm">
                <ShieldCheck className="w-4 h-4" />
                <span>Microphone & Permissions</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      micPermissionGranted ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400'
                    }`}
                  />
                  <div>
                    <div className="text-xs text-neutral-200 font-medium">
                      {micPermissionGranted ? 'Microphone Accessible' : 'Microphone Not Granted'}
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {micPermissionGranted
                        ? 'Audio feed active for speech & visualizer'
                        : 'Tap button to grant browser/system mic access'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleRequestMic}
                  className="text-xs px-3 py-1.5 rounded-lg bg-cyan-500 text-black font-semibold hover:bg-cyan-400 active:scale-95 transition-all"
                >
                  {micPermissionGranted ? 'Test Mic' : 'Authorize'}
                </button>
              </div>

              {micStatusMsg && (
                <p className="text-xs text-cyan-400 text-center animate-fade-in">
                  {micStatusMsg}
                </p>
              )}
            </section>

            {/* 4. Haptic Feedback (Vibration API) */}
            <section className="bg-neutral-950 border border-neutral-900 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-cyan-400 font-medium text-sm">
                  <Smartphone className="w-4 h-4" />
                  <span>Haptic Vibration Feedback</span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                    isHapticsSupported()
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                  }`}
                >
                  {isHapticsSupported() ? 'Vibration API Ready' : 'Limited Motor API'}
                </span>
              </div>

              <div className="space-y-3">
                <label className="flex items-start justify-between cursor-pointer p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800 hover:border-cyan-500/40 transition-colors">
                  <div className="pr-3">
                    <div className="text-xs text-neutral-200 font-medium">
                      Tactile Physical Haptics
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                      Delivers physical vibration pulses on tap-to-talk, "Hey RODEX" wake-word activation, microphone turn-taking, and call management for Mr. Robert.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={voiceSettings.hapticFeedbackEnabled !== false}
                    onChange={(e) =>
                      onUpdateVoiceSettings({
                        ...voiceSettings,
                        hapticFeedbackEnabled: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-cyan-400 mt-1 cursor-pointer"
                  />
                </label>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900/40 border border-neutral-800/80">
                  <div className="text-[11px] text-neutral-400">
                    Test activation vibration pattern:
                  </div>
                  <button
                    id="test-haptic-btn"
                    type="button"
                    onClick={() => {
                      setHapticTestActive(true);
                      triggerHaptic('activate');
                      setTimeout(() => setHapticTestActive(false), 500);
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                      hapticTestActive
                        ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.8)]'
                        : 'bg-neutral-850 hover:bg-neutral-800 text-cyan-300 border-neutral-700'
                    }`}
                  >
                    <Zap className={`w-3.5 h-3.5 ${hapticTestActive ? 'animate-bounce' : ''}`} />
                    <span>{hapticTestActive ? 'Pulsing...' : 'Test Vibration'}</span>
                  </button>
                </div>
              </div>
            </section>

            {/* 5. Theme Accents */}
            <section className="bg-neutral-950 border border-neutral-900 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 font-medium text-sm">
                <Palette className="w-4 h-4" />
                <span>Orb Glow Palette</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  {
                    id: 'cyan' as ThemeAccent,
                    label: 'RODEX Core',
                    desc: 'Cyan, Teal & Deep Blue',
                    colors: 'from-cyan-500 to-blue-600',
                  },
                  {
                    id: 'emerald' as ThemeAccent,
                    label: 'Cyber Emerald',
                    desc: 'Emerald & Jade Green',
                    colors: 'from-emerald-400 to-teal-700',
                  },
                  {
                    id: 'purple' as ThemeAccent,
                    label: 'Quantum Violet',
                    desc: 'Violet & Electric Blue',
                    colors: 'from-purple-500 to-blue-600',
                  },
                  {
                    id: 'azure' as ThemeAccent,
                    label: 'Deep Azure',
                    desc: 'Pure Azure & Cobalt',
                    colors: 'from-blue-400 to-indigo-700',
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onUpdateTheme(item.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      themeAccent === item.id
                        ? 'border-cyan-400 bg-cyan-950/30'
                        : 'border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-3.5 h-3.5 rounded-full bg-gradient-to-tr ${item.colors}`}
                      />
                      <span className="text-xs font-medium text-neutral-200">{item.label}</span>
                    </div>
                    <span className="text-[10px] text-neutral-500 mt-1 block">{item.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Reset Button */}
            <div className="pt-2 text-center">
              <button
                onClick={() => {
                  onUpdateVoiceSettings({
                    voiceURI: '',
                    rate: 1.0,
                    pitch: 1.0,
                    volume: 1.0,
                    autoSpeak: true,
                    wakeWordEnabled: false,
                    audioSens: 3,
                  });
                  onUpdateTheme('cyan');
                }}
                className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Factory Defaults</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
