import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  UserCheck,
  Radio,
  Sparkles,
  Volume2,
  CheckCircle2,
  Mic,
  ShieldCheck,
} from 'lucide-react';
import { VoiceProfile } from '../types';

interface VoiceProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  voiceProfile: VoiceProfile;
  onTestWakeWord: () => void;
  wakeWordEnabled: boolean;
  onToggleWakeWord: () => void;
}

export const VoiceProfileModal: React.FC<VoiceProfileModalProps> = ({
  isOpen,
  onClose,
  voiceProfile,
  onTestWakeWord,
  wakeWordEnabled,
  onToggleWakeWord,
}) => {
  const [testingTrigger, setTestingTrigger] = useState(false);

  const handleTest = () => {
    setTestingTrigger(true);
    onTestWakeWord();
    setTimeout(() => {
      setTestingTrigger(false);
    }, 1600);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-sm bg-black border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-neutral-900 bg-neutral-950/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Voice Recognition</h2>
                  <p className="text-[11px] text-neutral-400">Biometric Speaker Calibration</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-900 active:scale-90 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Speaker Card */}
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
                    <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                      Authenticated Speaker
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                    {voiceProfile.confidence.toFixed(1)}% CONFIDENCE
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white tracking-wide">
                    {voiceProfile.speakerName}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Primary Commander & Voice Signature Owner
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-900">
                  <div className="bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-800/60">
                    <div className="text-[10px] text-neutral-500 uppercase font-mono">Voice Pitch</div>
                    <div className="text-sm font-semibold text-cyan-400">
                      {voiceProfile.pitchHz} Hz <span className="text-[10px] text-neutral-400">avg</span>
                    </div>
                  </div>
                  <div className="bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-800/60">
                    <div className="text-[10px] text-neutral-500 uppercase font-mono">Voiceprint</div>
                    <div className="text-sm font-semibold text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verified</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Wake Word Rule Section */}
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
                  <Radio className="w-3.5 h-3.5" />
                  <span>Call & Response Directive</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900/70 border border-neutral-800">
                    <span className="text-neutral-400">When you call:</span>
                    <code className="text-cyan-300 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
                      "Hey RODEX"
                    </code>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900/70 border border-neutral-800">
                    <span className="text-neutral-400">RODEX responds:</span>
                    <code className="text-emerald-300 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                      "Hlo Mr Robert"
                    </code>
                  </div>
                </div>

                {/* Hands-Free Wake-Word Toggle */}
                <div className="pt-2 border-t border-neutral-900 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-neutral-200">
                      Hands-Free Wake Word Listening
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      Detects "Hey RODEX" continuously while app is open
                    </div>
                  </div>
                  <button
                    onClick={onToggleWakeWord}
                    className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer ${
                      wakeWordEnabled ? 'bg-cyan-500' : 'bg-neutral-800'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        wakeWordEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Live Test Trigger Button */}
              <button
                onClick={handleTest}
                disabled={testingTrigger}
                className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-98 text-black font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
              >
                {testingTrigger ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Calling "Hey RODEX"...</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    <span>Test Voice Call: "Hey RODEX"</span>
                  </>
                )}
              </button>

              <div className="p-3 rounded-xl bg-neutral-900/40 border border-neutral-800/60 text-[11px] text-neutral-400 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  RODEX is calibrated to recognize Mr. Robert's voice through speech patterns, vocal frequency analysis, and the Gemini neural core.
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
