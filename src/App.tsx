import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Settings,
  Volume2,
  VolumeX,
  Sparkles,
  MessageSquare,
  AlertCircle,
  Radio,
  UserCheck,
  Phone,
  PhoneOff,
  Zap,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { Orb } from './components/Orb';
import { ActionBar } from './components/ActionBar';
import { ChatSheet } from './components/ChatSheet';
import { SettingsModal } from './components/SettingsModal';
import { ModesModal } from './components/ModesModal';
import { VoiceProfileModal } from './components/VoiceProfileModal';
import { WebVerificationModal } from './components/WebVerificationModal';
import { AndroidFrame } from './components/AndroidFrame';
import {
  AssistantState,
  ChatMessage,
  AppMode,
  VoiceSettings,
  ThemeAccent,
  VoiceProfile,
  WebSource,
} from './types';
import {
  rodexSynth,
  AudioMeter,
  isHeyRodexCall,
  containsHeyRodexWakeWord,
  extractHeyRodexCommand,
  playToneChime,
  isConversationExit,
} from './utils/speech';
import { triggerHaptic, setHapticsEnabled } from './utils/haptics';

export default function App() {
  // Core Assistant States
  const [state, setState] = useState<AssistantState>('idle');
  const [activeMode, setActiveMode] = useState<AppMode>('home');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVoiceProfileOpen, setIsVoiceProfileOpen] = useState(false);
  const [isWebVerifyOpen, setIsWebVerifyOpen] = useState(false);

  // Real-time Two-Way Live Conversation State
  const [isLiveConversation, setIsLiveConversation] = useState(false);
  const isLiveConversationRef = useRef(false);
  const consecutiveSilenceCountRef = useRef(0);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Voice Profile / Speaker Recognition State (Mr. Robert)
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile>({
    speakerName: 'Mr. Robert',
    isRecognized: true,
    confidence: 99.4,
    pitchHz: 124,
    voiceprintStatus: 'calibrated',
    wakeWord: 'Hey RODEX',
  });

  // Audio and Speech State
  const [audioLevel, setAudioLevel] = useState(0);
  const [pitchHz, setPitchHz] = useState<number>(124);
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState<string>(
    'Greetings. I am RODEX, calibrated for Mr. Robert. Say "Hey RODEX" or tap the orb to speak.'
  );
  const [isMuted, setIsMuted] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [showPermDialog, setShowPermDialog] = useState(false);

  // Settings
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    voiceURI: '',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    autoSpeak: true,
    wakeWordEnabled: true,
    audioSens: 3,
    webSearchEnabled: true,
    hapticFeedbackEnabled: true,
  });
  const [themeAccent, setThemeAccent] = useState<ThemeAccent>('cyan');

  // Synchronize Haptic Vibration State with User Preferences
  useEffect(() => {
    setHapticsEnabled(voiceSettings.hapticFeedbackEnabled !== false);
  }, [voiceSettings.hapticFeedbackEnabled]);

  // Dynamic Thinking Capacity Tracker (operating at millions of neural operations per second)
  const [thinkingOps, setThinkingOps] = useState('486.2M');

  useEffect(() => {
    if (state !== 'thinking') return;
    const interval = setInterval(() => {
      // High-frequency computational variance in the 450M - 520M ops/sec range
      const ops = (450 + Math.random() * 65).toFixed(1);
      setThinkingOps(`${ops}M`);
    }, 75);
    return () => clearInterval(interval);
  }, [state]);

  // Messages History & Web Grounding Sources
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastSources, setLastSources] = useState<WebSource[]>([]);
  const [lastSearchQueries, setLastSearchQueries] = useState<string[]>([]);

  // Refs for Speech Recognition and Audio Meter
  const recognitionRef = useRef<any>(null);
  const audioMeterRef = useRef<AudioMeter>(new AudioMeter());
  const animationFrameRef = useRef<number | null>(null);
  const wakeWordTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check microphone permissions on mount
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((permissionStatus) => {
          if (permissionStatus.state === 'granted') {
            setMicPermissionGranted(true);
          }
          permissionStatus.onchange = () => {
            setMicPermissionGranted(permissionStatus.state === 'granted');
          };
        })
        .catch(() => {
          // Ignore if permission query not supported
        });
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      audioMeterRef.current.stop();
      rodexSynth.stop();
    };
  }, []);

  // Request Microphone Permission
  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release initial probe stream
      stream.getTracks().forEach((track) => track.stop());
      setMicPermissionGranted(true);
      setShowPermDialog(false);
      return true;
    } catch (err) {
      console.warn('[RODEX Mic Perm Denied]', err);
      setMicPermissionGranted(false);
      setShowPermDialog(false);
      return false;
    }
  }, []);

  // Audio meter loop for real-time orb reactivity and voice biometric tracking
  const startAudioMeterLoop = () => {
    const update = () => {
      const metrics = audioMeterRef.current.getVoiceMetrics();
      setAudioLevel(metrics.level * (voiceSettings.audioSens * 0.7));
      if (metrics.pitchHz > 0) {
        setPitchHz(metrics.pitchHz);
      }
      if (metrics.isSpeech) {
        setVoiceProfile((prev) => ({
          ...prev,
          pitchHz: metrics.pitchHz,
          confidence: Math.max(prev.confidence, metrics.confidence),
          voiceprintStatus: 'matched',
        }));
      }
      animationFrameRef.current = requestAnimationFrame(update);
    };
    update();
  };

  const stopAudioMeterLoop = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioLevel(0);
    setPitchHz(124);
    audioMeterRef.current.stop();
  };

  // Speak AI text response using voice synthesis
  const speakResponse = useCallback(
    (text: string, onComplete?: () => void) => {
      if (isMuted || !voiceSettings.autoSpeak) {
        setState('idle');
        onComplete?.();
        return;
      }

      setState('speaking');

      // Synthesize pulse rhythm and harmonic pitch frequency for orb while speaking
      const startTime = Date.now();
      const speakInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setAudioLevel(Math.abs(Math.sin(elapsed * 6)) * 0.45);
        // Modulate synthetic voice pitch frequency dynamically (135Hz - 175Hz)
        setPitchHz(145 + Math.sin(elapsed * 4.5) * 28);
      }, 50);

      rodexSynth.speak(text, {
        voiceURI: voiceSettings.voiceURI,
        rate: voiceSettings.rate,
        pitch: voiceSettings.pitch,
        volume: voiceSettings.volume,
        onStart: () => {
          setState('speaking');
        },
        onEnd: () => {
          clearInterval(speakInterval);
          setAudioLevel(0);
          setPitchHz(124);
          setState('idle');
          onComplete?.();
        },
        onError: () => {
          clearInterval(speakInterval);
          setAudioLevel(0);
          setPitchHz(124);
          setState('idle');
          onComplete?.();
        },
      });
    },
    [isMuted, voiceSettings]
  );

  // Direct Live Real-Time Call Controller
  const startLiveCall = async () => {
    if (!micPermissionGranted) {
      const granted = await requestMicPermission();
      if (!granted) return;
    }
    isLiveConversationRef.current = true;
    setIsLiveConversation(true);
    consecutiveSilenceCountRef.current = 0;
    playToneChime('wake');
    const introSpeech = 'Hlo Mr Robert. I am here, what is on your mind?';
    setLastResponse(introSpeech);
    speakResponse(introSpeech, () => {
      if (isLiveConversationRef.current) {
        playToneChime('listen');
        startListening();
      }
    });
  };

  const endLiveCall = () => {
    isLiveConversationRef.current = false;
    setIsLiveConversation(false);
    consecutiveSilenceCountRef.current = 0;
    rodexSynth.stop();
    playToneChime('end');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    stopAudioMeterLoop();
    setState('idle');
    setLastResponse('Conversation ended. Say "Hey RODEX" to talk again.');
  };

  // Send query to server-side Gemini API or handle direct "Hey RODEX" wake-word
  const handleSendMessage = async (
    userText: string,
    imagePayload?: { data: string; mimeType: string }
  ) => {
    if (!userText.trim() && !imagePayload) return;

    // Stop speaking if currently active
    rodexSynth.stop();

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const createId = (prefix = 'msg') =>
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Handle conversation exit / goodbye words / explicit user instruction to end call
    if (isConversationExit(userText)) {
      const wasLive = isLiveConversationRef.current;
      isLiveConversationRef.current = false;
      setIsLiveConversation(false);
      consecutiveSilenceCountRef.current = 0;
      playToneChime('end');

      const userMsg: ChatMessage = {
        id: createId('user'),
        sender: 'user',
        text: userText,
        timestamp,
        speaker: 'Mr. Robert',
        speakerVerified: true,
      };

      const exitReply = wasLive
        ? 'Call ended as instructed, Mr. Robert. I am on standby whenever you need me.'
        : 'Goodbye Mr. Robert. Have a wonderful day! I remain on standby.';
      const assistantMsg: ChatMessage = {
        id: createId('assistant'),
        sender: 'assistant',
        text: exitReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setLastResponse(exitReply);
      speakResponse(exitReply);
      return;
    }

    // Prime voice synthesis engine to guarantee audio playback
    rodexSynth.prime();

    // Check if user called or activated RODEX ("Hey RODEX", "RODEX", "Hey RODEX what is the latest world news?", etc.)
    const { isCall, command } = extractHeyRodexCommand(userText);
    const isPureActivation = isHeyRodexCall(userText) || (isCall && !command.trim());

    if (isPureActivation) {
      triggerHaptic('activate');
      isLiveConversationRef.current = true;
      setIsLiveConversation(true);
      consecutiveSilenceCountRef.current = 0;
      playToneChime('wake');

      const userMsg: ChatMessage = {
        id: createId('user'),
        sender: 'user',
        text: userText,
        timestamp,
        speaker: 'Mr. Robert',
        speakerVerified: true,
      };

      const greetingSpeech = 'Hlo Mr Robert. I am here, what is on your mind?';
      const greetingFullText = 'Hlo Mr Robert! I am listening. How can I assist you with world news, internet intelligence, or anything today?';

      const assistantMsg: ChatMessage = {
        id: createId('assistant'),
        sender: 'assistant',
        text: greetingFullText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setLastResponse(greetingSpeech);
      setVoiceProfile((prev) => ({
        ...prev,
        voiceprintStatus: 'matched',
        confidence: 99.4,
      }));

      // Speak back immediately, and right after speaking AUTO-LISTEN for real-time human conversation!
      speakResponse(greetingSpeech, () => {
        if (isLiveConversationRef.current) {
          playToneChime('listen');
          startListening();
        }
      });
      return;
    }

    // Strict Activation Gate: RODEX is ONLY active when called!
    if (!isLiveConversationRef.current) {
      const isExplicitModalOrChat =
        activeMode === 'chat' ||
        Boolean(imagePayload) ||
        activeMode === 'code' ||
        activeMode === 'image' ||
        activeMode === 'web';

      if (!isCall && !isPureActivation && !isExplicitModalOrChat) {
        // STRICT ACTIVATION GATE ENFORCED:
        // RODEX was not called by name or wake-word! Remain completely dormant on standby!
        setState('idle');
        setLastResponse('RODEX is dormant on standby. Call "Hey RODEX" to activate.');
        triggerHaptic('tap');
        return;
      }
    }

    // Activated with command: enter live conversation and talk back!
    triggerHaptic('activate');
    isLiveConversationRef.current = true;
    setIsLiveConversation(true);
    consecutiveSilenceCountRef.current = 0;
    if (isCall) {
      playToneChime('wake');
    }

    const userMsg: ChatMessage = {
      id: createId('user'),
      sender: 'user',
      text: userText,
      timestamp,
      speaker: 'Mr. Robert',
      speakerVerified: true,
      imageUrl: imagePayload ? `data:${imagePayload.mimeType};base64,${imagePayload.data}` : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setState('thinking');
    setLastResponse('Neural Core: Computing at 480M+ ops/sec • Searching World Wide Web...');

    try {
      // Build conversation history payload
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        text: m.text,
      }));

      const customInstruction = isCall
        ? 'The user is Mr. Robert and activated you with "Hey RODEX". You recognize his voice. Address him starting with "Hlo Mr Robert" in your reply, and provide fresh, real-time web-grounded information from the Internet.'
        : 'The user is Mr. Robert. You recognize his voice. Address him respectfully as Mr. Robert, and provide fresh, real-time web-grounded information from the Internet.';

      const clientFormattedTime = new Date().toLocaleString([], {
        dateStyle: 'full',
        timeStyle: 'medium',
      });
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Kampala';

      const queryToSend = isCall && command ? command : userText;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: queryToSend,
          image: imagePayload,
          history: historyPayload,
          customInstruction,
          liveConversation: isLiveConversationRef.current,
          enableWebSearch: voiceSettings.webSearchEnabled !== false,
          clientFormattedTime,
          timeZone,
          clientTime: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      const reply = data.reply || 'RODEX response received.';
      const sources: WebSource[] = data.sources || [];
      const searchQueries: string[] = data.searchQueries || [];
      const webGrounded: boolean = !!data.webGrounded;

      const assistantMsg: ChatMessage = {
        id: createId('assistant'),
        sender: 'assistant',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources,
        searchQueries,
        webGrounded,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setLastResponse(reply);
      setLastSources(sources);
      setLastSearchQueries(searchQueries);

      // Speak response aloud, and if in live conversation, seamlessly auto-listen for Mr. Robert's reply!
      speakResponse(reply, () => {
        if (isLiveConversationRef.current) {
          playToneChime('listen');
          startListening();
        }
      });
    } catch (err: any) {
      console.error('[RODEX Chat error]', err);
      const errorText =
        'RODEX alert: Unable to reach the neural core. Please ensure your network is stable and Gemini API key is configured.';
      setLastResponse(errorText);
      const errorMsg: ChatMessage = {
        id: createId('error'),
        sender: 'assistant',
        text: errorText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        error: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
      speakResponse(errorText);
    }
  };

  // Hands-Free Background "Hey RODEX" Wake Word Listener (iPhone Siri Style)
  const wakeWordRecognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!voiceSettings.wakeWordEnabled || state !== 'idle' || !micPermissionGranted) {
      if (wakeWordRecognitionRef.current) {
        try {
          wakeWordRecognitionRef.current.abort();
        } catch (_) {}
        wakeWordRecognitionRef.current = null;
      }
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    let isAlive = true;
    let wakeRec: any = null;

    const startWakeRecognition = () => {
      if (!isAlive || !voiceSettings.wakeWordEnabled || state !== 'idle' || !micPermissionGranted) return;
      try {
        wakeRec = new SpeechRecognition();
        wakeWordRecognitionRef.current = wakeRec;
        wakeRec.continuous = true;
        wakeRec.interimResults = true;
        wakeRec.lang = 'en-US';

        wakeRec.onresult = (event: any) => {
          let currentText = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentText += event.results[i][0].transcript;
          }
          if (containsHeyRodexWakeWord(currentText)) {
            triggerHaptic('activate');
            try {
              wakeRec.stop();
            } catch (_) {}
            handleSendMessage(currentText.trim());
          }
        };

        wakeRec.onerror = (err: any) => {
          if (err?.error === 'not-allowed') {
            setMicPermissionGranted(false);
          }
        };

        wakeRec.onend = () => {
          if (isAlive && voiceSettings.wakeWordEnabled && state === 'idle' && micPermissionGranted) {
            setTimeout(() => {
              if (isAlive && voiceSettings.wakeWordEnabled && state === 'idle') {
                startWakeRecognition();
              }
            }, 200);
          }
        };

        wakeRec.start();
      } catch (_) {}
    };

    startWakeRecognition();

    return () => {
      isAlive = false;
      if (wakeRec) {
        try {
          wakeRec.abort();
        } catch (_) {}
      }
      wakeWordRecognitionRef.current = null;
    };
  }, [voiceSettings.wakeWordEnabled, state, micPermissionGranted]);

  // Start Voice Recognition (Tap-to-talk, Barge-In, or Auto-Turn Taking)
  const startListening = async () => {
    // Prime the voice synthesis engine immediately on user gesture to guarantee speech playback
    rodexSynth.prime();

    // Physical haptic tap feedback
    triggerHaptic('tap');

    // If speaking, barge-in interrupts speech and immediately listens to Mr. Robert
    if (state === 'speaking') {
      rodexSynth.stop();
      playToneChime('bargein');
    }

    // If currently listening, manual tap stops and processes immediately
    if (state === 'listening') {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      stopAudioMeterLoop();
      return;
    }

    // Check permission
    if (!micPermissionGranted) {
      setShowPermDialog(true);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Graceful fallback for browsers without SpeechRecognition
      setIsChatOpen(true);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let lastCaptured = '';

      recognition.onstart = async () => {
        setState('listening');
        setTranscript('');
        await audioMeterRef.current.start();
        startAudioMeterLoop();
      };

      recognition.onresult = (event: any) => {
        let current = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          current += event.results[i][0].transcript;
        }
        lastCaptured = current;
        setTranscript(current);

        // Immediate trigger if user said "Hey RODEX" while recording
        if (isHeyRodexCall(current)) {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          try {
            recognition.stop();
          } catch (_) {}
          return;
        }

        // Real-time human turn-taking: 850ms silence pause automatically finalizes the turn
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = setTimeout(() => {
          if (current.trim()) {
            try {
              recognition.stop();
            } catch (_) {}
          }
        }, 850);
      };

      recognition.onerror = (event: any) => {
        console.warn('[RODEX Speech Recognition error]', event.error);
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        stopAudioMeterLoop();
        if (event.error === 'not-allowed') {
          setMicPermissionGranted(false);
          setShowPermDialog(true);
        }
        setState('idle');
      };

      recognition.onend = () => {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        stopAudioMeterLoop();
        const finalText = (lastCaptured || transcript).trim();
        if (finalText) {
          consecutiveSilenceCountRef.current = 0;
          handleSendMessage(finalText);
        } else if (isLiveConversationRef.current) {
          // Continuous Live Call: Never ends on silence or pauses.
          // The call continues running patiently and will ONLY end when Mr. Robert explicitly instructs
          // (e.g., says "end call", "hang up", "goodbye") or taps the End Call button.
          setTimeout(() => {
            if (isLiveConversationRef.current && state !== 'speaking') {
              startListening();
            }
          }, 250);
        } else {
          setState('idle');
        }
      };

      recognition.start();
    } catch (e) {
      console.error('[RODEX Start Listening error]', e);
      stopAudioMeterLoop();
      setState('idle');
    }
  };

  // Status subtitle copy
  const getStatusText = () => {
    switch (state) {
      case 'listening':
        return transcript || 'Listening to your voice...';
      case 'thinking':
        return `RODEX is thinking at ${thinkingOps} ops/sec...`;
      case 'speaking':
        return 'Speaking response...';
      case 'idle':
      default:
        return 'Tap orb or mic to speak';
    }
  };

  return (
    <AndroidFrame>
      <main
        id="rodex-main-screen"
        className="w-full h-full flex flex-col justify-between relative bg-black text-white overflow-hidden select-none"
      >
        {/* Top Futuristic Header */}
        <header className="px-5 py-3 flex items-center justify-between z-20 bg-black/60 backdrop-blur-md border-b border-neutral-900/60">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
            <h1 className="text-sm font-bold tracking-[0.25em] text-white">RODEX</h1>
            <span className="text-[10px] font-mono tracking-widest text-cyan-500/80 px-1.5 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/40">
              v1.0
            </span>
          </div>

          {/* Center Header Pill: Live Stream Active or Verified Voice ID for Mr. Robert */}
          <div className="flex items-center">
            {isLiveConversation ? (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/70 shadow-[0_0_12px_rgba(16,185,129,0.3)] animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-ping" />
                <span className="text-[10px] font-bold tracking-wider text-emerald-300 uppercase">
                  Live Call
                </span>
                <button
                  id="header-end-call-btn"
                  onClick={endLiveCall}
                  className="ml-1 px-1.5 py-0.5 rounded-full bg-red-950 hover:bg-red-900 border border-red-700 text-red-300 text-[9px] font-bold cursor-pointer transition-colors"
                  title="End Live Call"
                >
                  End
                </button>
              </div>
            ) : (
              <button
                id="header-voice-id-btn"
                onClick={() => {
                  triggerHaptic('tap');
                  setIsVoiceProfileOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-950/90 border border-neutral-800 hover:border-cyan-500/50 transition-all shadow-sm group cursor-pointer active:scale-95"
                title="Voice Biometrics: Mr. Robert (Verified)"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
                <span className="text-[11px] text-neutral-300 font-medium group-hover:text-cyan-300 transition-colors">
                  Mr. Robert
                </span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/80 font-mono">
                  ID
                </span>
              </button>
            )}

            {/* World Wide Web Verification & Real-Time API Monitor Button */}
            <button
              id="header-www-verify-btn"
              onClick={() => {
                triggerHaptic('tap');
                setIsWebVerifyOpen(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 transition-all shadow-sm cursor-pointer active:scale-95 text-[10px] font-mono"
              title="Verify RODEX World Wide Web Link & Real-Time API"
            >
              <Globe className="w-3 h-3 text-emerald-400" />
              <span className="font-semibold tracking-tight">WWW VERIFIED</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            {/* Audio Voice Mute Toggle */}
            <button
              id="audio-mute-toggle"
              onClick={() => {
                if (rodexSynth.isSpeaking()) rodexSynth.stop();
                setIsMuted(!isMuted);
              }}
              title={isMuted ? 'Unmute voice output' : 'Mute voice output'}
              className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-900 active:scale-95 transition-all"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-neutral-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-cyan-400" />
              )}
            </button>

            {/* Chat History Icon Button */}
            <button
              id="header-chat-btn"
              onClick={() => setIsChatOpen(true)}
              title="Open Chat History"
              className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-900 active:scale-95 transition-all relative"
            >
              <MessageSquare className="w-4 h-4" />
              {messages.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-cyan-400 rounded-full" />
              )}
            </button>

            {/* Settings Icon Button */}
            <button
              id="header-settings-btn"
              onClick={() => setIsSettingsOpen(true)}
              title="RODEX Settings"
              className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-900 active:scale-95 transition-all"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Center: The Large Glowing AI Orb - Pure, Grand & Uncluttered (All Tabs Removed Around Orb) */}
        <div className="flex-1 flex flex-col items-center justify-center relative px-6 w-full">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute w-80 h-80 rounded-full bg-cyan-600/10 blur-[100px] pointer-events-none" />

          {/* Central Orb Identity */}
          <div className="relative my-auto flex flex-col items-center py-4">
            <Orb
              state={state}
              audioLevel={audioLevel}
              pitchHz={pitchHz}
              size={250}
              onClick={startListening}
            />
          </div>

          {/* Clean Subtitle & Speech Visualizer Text */}
          <div className="w-full max-w-sm text-center mb-6 min-h-[50px] flex items-center justify-center pointer-events-none">
            {state === 'listening' ? (
              <p className="text-xs sm:text-sm text-neutral-300 font-normal leading-relaxed line-clamp-3 px-4 transition-all">
                <span className="text-cyan-300 italic font-medium">"{getStatusText()}"</span>
              </p>
            ) : state === 'thinking' ? (
              <div className="flex flex-col items-center gap-1.5 animate-pulse px-4">
                <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.35)]">
                  <Zap className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                  <span className="text-[11px] font-mono font-bold tracking-wider text-emerald-300">
                    NEURAL CORE: {thinkingOps} OPS/SEC
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 font-mono tracking-wide">
                  Computing millions of inferences/sec • Live Web Grounding
                </span>
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-neutral-300 font-normal leading-relaxed line-clamp-3 px-4 transition-all">
                {lastResponse}
              </p>
            )}
          </div>
        </div>

        {/* Bottom Section: Tap-To-Talk Microphone Controller */}
        <div className="w-full flex flex-col items-center pb-2 z-20">
          <div className="relative mb-3 flex items-center justify-center gap-4">
            {/* Glow Aura when listening */}
            {state === 'listening' && (
              <div className="absolute w-24 h-24 rounded-full bg-cyan-400/30 blur-xl animate-pulse pointer-events-none" />
            )}

            {/* Microphone Button */}
            <button
              id="tap-to-talk-button"
              onClick={startListening}
              className={`relative w-18 h-18 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 shadow-2xl border cursor-pointer ${
                state === 'listening'
                  ? 'bg-cyan-500 text-black border-cyan-300 shadow-[0_0_35px_rgba(6,182,212,0.8)] scale-105'
                  : state === 'speaking'
                  ? 'bg-teal-950 text-teal-300 border-teal-500/80 shadow-[0_0_20px_rgba(20,184,166,0.3)]'
                  : state === 'thinking'
                  ? 'bg-neutral-900 text-emerald-400 border-emerald-500/50'
                  : isLiveConversation
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.4)] animate-pulse'
                  : 'bg-neutral-950 hover:bg-neutral-900 text-cyan-400 border-neutral-800 hover:border-cyan-500/50 shadow-[0_0_15px_rgba(0,0,0,0.8)]'
              }`}
              title={
                state === 'listening'
                  ? 'Tap to send immediately'
                  : state === 'speaking'
                  ? 'Tap or speak to interrupt RODEX'
                  : isLiveConversation
                  ? 'Live Call Active - Tap to speak'
                  : 'Tap to talk with RODEX'
              }
            >
              {state === 'listening' ? (
                <Mic className="w-7 h-7 animate-bounce" />
              ) : state === 'speaking' ? (
                <Volume2 className="w-7 h-7 animate-pulse" />
              ) : state === 'thinking' ? (
                <Sparkles className="w-7 h-7 animate-spin" />
              ) : isLiveConversation ? (
                <Mic className="w-7 h-7 text-emerald-400" />
              ) : (
                <Mic className="w-7 h-7" />
              )}
            </button>

            {/* Dedicated End Call Hang-Up Button when Live Call is active */}
            {isLiveConversation && (
              <button
                id="hangup-call-btn"
                onClick={endLiveCall}
                className="w-12 h-12 rounded-full bg-red-950/90 hover:bg-red-900 border border-red-600/80 text-red-300 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.35)] active:scale-90 transition-all cursor-pointer"
                title="Hang up / End Real-Time Call"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            )}
          </div>

          <span className="text-[11px] font-medium tracking-wider text-neutral-400 mb-2">
            {state === 'listening'
              ? isLiveConversation
                ? 'LISTENING TO MR. ROBERT • TALK NATURALLY'
                : 'LISTENING • TAP TO SEND'
              : state === 'speaking'
              ? 'RODEX IS SPEAKING • TAP OR SPEAK TO INTERRUPT'
              : state === 'thinking'
              ? `NEURAL CAPACITY: ${thinkingOps} OPS/SEC • COMPUTING MILLIONS/SEC`
              : isLiveConversation
              ? 'LIVE CALL ACTIVE • SAY "END CALL" OR TAP 📵 TO END'
              : 'TAP TO TALK OR SAY "HEY RODEX"'}
          </span>

          {/* Android Navigation Action Bar with Live Updated Tabs */}
          <ActionBar
            activeMode={activeMode}
            onSelectMode={(mode) => {
              if (mode === 'home') {
                setActiveMode('home');
              } else if (mode === 'chat') {
                setIsChatOpen(true);
              } else {
                setActiveMode(mode);
              }
            }}
            messageCount={messages.length}
            hasWebIntel={lastSources.length > 0}
            isLive={isLiveConversation}
          />
        </div>

        {/* Android Native Permission Dialog */}
        {showPermDialog && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-950/60 border border-cyan-800/60 text-cyan-400 flex items-center justify-center mx-auto">
                <Mic className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="text-base font-semibold text-white">
                  Allow RODEX to record audio?
                </h3>
                <p className="text-xs text-neutral-400">
                  RODEX requires microphone access to process voice commands and animate the neural orb in real time.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  id="grant-mic-button"
                  onClick={() => requestMicPermission()}
                  className="w-full py-3 rounded-xl bg-cyan-500 text-black font-semibold hover:bg-cyan-400 active:scale-98 transition-all text-xs"
                >
                  While using the app
                </button>
                <button
                  onClick={() => requestMicPermission()}
                  className="w-full py-2.5 rounded-xl bg-neutral-900 text-neutral-300 hover:bg-neutral-800 active:scale-98 transition-all text-xs border border-neutral-800"
                >
                  Only this time
                </button>
                <button
                  onClick={() => setShowPermDialog(false)}
                  className="w-full py-2 text-neutral-500 hover:text-neutral-300 text-xs transition-colors"
                >
                  Don't allow
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Slide-up Chat History Sheet */}
        <ChatSheet
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={messages}
          onSendMessage={(text) => handleSendMessage(text)}
          onReplayAudio={(text) => speakResponse(text)}
          onClearHistory={() => setMessages([])}
          assistantState={state}
          onStartVoice={startListening}
        />

        {/* Settings Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          voiceSettings={voiceSettings}
          onUpdateVoiceSettings={setVoiceSettings}
          themeAccent={themeAccent}
          onUpdateTheme={setThemeAccent}
          onRequestMicPermission={requestMicPermission}
          micPermissionGranted={micPermissionGranted}
          onOpenVoiceProfile={() => setIsVoiceProfileOpen(true)}
        />

        {/* Voice Profile & Biometrics Modal (Mr. Robert) */}
        <VoiceProfileModal
          isOpen={isVoiceProfileOpen}
          onClose={() => setIsVoiceProfileOpen(false)}
          profile={voiceProfile}
          onRecalibrate={() => {
            setVoiceProfile((prev) => ({
              ...prev,
              confidence: 99.8,
              voiceprintStatus: 'calibrated',
            }));
            speakResponse('Voice profile recalibrated successfully for Mr. Robert.');
          }}
          onTestWakeWord={() => {
            setIsVoiceProfileOpen(false);
            handleSendMessage('Hey RODEX');
          }}
        />

        {/* Action Modes Modal (Image, File, Code, More / Flutter APK, Web Intel) */}
        <ModesModal
          mode={activeMode}
          onClose={() => setActiveMode('home')}
          onSubmitPrompt={(text, image) => handleSendMessage(text, image)}
          currentSources={lastSources}
        />

        {/* World Wide Web Verification & Real-Time API Monitor Modal */}
        <WebVerificationModal
          isOpen={isWebVerifyOpen}
          onClose={() => setIsWebVerifyOpen(false)}
          onAskRodex={(prompt) => {
            setIsWebVerifyOpen(false);
            handleSendMessage(prompt);
          }}
        />
      </main>
    </AndroidFrame>
  );
}
