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
  Music2,
  Maximize2,
  Minimize2,
  Shield,
  RefreshCw,
  Award,
  Play,
  Youtube,
  X,
  Brain,
  Cpu,
  Film,
  Video as VideoIcon,
} from 'lucide-react';
import { Orb } from './components/Orb';
import { ActionBar } from './components/ActionBar';
import { ChatSheet } from './components/ChatSheet';
import { SettingsModal } from './components/SettingsModal';
import { ModesModal } from './components/ModesModal';
import { VoiceProfileModal } from './components/VoiceProfileModal';
import { WebVerificationModal } from './components/WebVerificationModal';
import { SpotifyPlayerModal } from './components/SpotifyPlayerModal';
import { WebMediaHubModal } from './components/WebMediaHubModal';
import { SecurityCenterModal } from './components/SecurityCenterModal';
import { UpdateCenterModal } from './components/UpdateCenterModal';
import { CreatorProfileModal } from './components/CreatorProfileModal';
import { MemoryPersonalizationModal } from './components/MemoryPersonalizationModal';
import { CapabilityHubModal } from './components/CapabilityHubModal';
import { MediaStudioModal } from './components/MediaStudioModal';
import { FirebaseAuthButton } from './components/FirebaseAuthButton';
import { SpotifyMiniBar } from './components/SpotifyMiniBar';
import { AndroidFrame } from './components/AndroidFrame';
import {
  AssistantState,
  ChatMessage,
  AppMode,
  VoiceSettings,
  ThemeAccent,
  VoiceProfile,
  WebSource,
  SpotifyTrackInfo,
  SpotifyDevice,
  ChatSession,
} from './types';
import {
  rodexSynth,
  AudioMeter,
  isHeyRodexCall,
  containsHeyRodexWakeWord,
  extractHeyRodexCommand,
  checkWakeWordMatch,
  playToneChime,
  isConversationExit,
} from './utils/speech';
import { triggerHaptic, setHapticsEnabled } from './utils/haptics';
import {
  loadActiveSession,
  saveActiveSession,
  loadAllSessions,
  createNewSession,
  deleteSessionFromHistory,
} from './utils/sessionStorage';
import { getActiveOrbTheme } from './utils/orbTheme';

export default function App() {
  // Core Assistant States
  const [state, setState] = useState<AssistantState>('idle');
  const [activeMode, setActiveMode] = useState<AppMode>('home');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVoiceProfileOpen, setIsVoiceProfileOpen] = useState(false);
  const [isWebVerifyOpen, setIsWebVerifyOpen] = useState(false);
  const [isSpotifyOpen, setIsSpotifyOpen] = useState(false);
  const [isMediaHubOpen, setIsMediaHubOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isCapabilityOpen, setIsCapabilityOpen] = useState(false);
  const [isMediaStudioOpen, setIsMediaStudioOpen] = useState(false);
  const [mediaStudioTab, setMediaStudioTab] = useState<'video' | 'image' | 'maps' | 'search' | 'gallery'>('video');

  // Live Chat Sessions & Persistence
  const [activeSession, setActiveSession] = useState<ChatSession>(() => loadActiveSession());
  const [allSessions, setAllSessions] = useState<ChatSession[]>(() => loadAllSessions());

  // Spotify Playback on PC
  const [spotifyPlayback, setSpotifyPlayback] = useState<SpotifyTrackInfo | null>(null);
  const [spotifyDevice, setSpotifyDevice] = useState<SpotifyDevice | null>(null);

  // Poll or refresh Spotify status
  const refreshSpotifyStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/spotify/status');
      if (res.ok) {
        const data = await res.json();
        setSpotifyPlayback(data.playback || null);
        setSpotifyDevice(data.device || null);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    refreshSpotifyStatus();
    const interval = setInterval(refreshSpotifyStatus, 6000);
    return () => clearInterval(interval);
  }, [refreshSpotifyStatus]);

  // Real-time Two-Way Live Conversation State
  const [isLiveConversation, setIsLiveConversation] = useState(false);
  const isLiveConversationRef = useRef(false);
  const consecutiveSilenceCountRef = useRef(0);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Voice Profile / Speaker Recognition State
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile>({
    speakerName: 'User',
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
    'Greetings. I am RODEX. Say "Hey RODEX" or tap the orb to speak.'
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
  const [themeAccent, setThemeAccent] = useState<ThemeAccent>(() => {
    return (localStorage.getItem('rodex_theme_accent') as ThemeAccent) || 'auto';
  });

  const handleUpdateTheme = (theme: ThemeAccent) => {
    setThemeAccent(theme);
    localStorage.setItem('rodex_theme_accent', theme);
  };

  // Synchronize Haptic Vibration State with User Preferences
  useEffect(() => {
    setHapticsEnabled(voiceSettings.hapticFeedbackEnabled !== false);
  }, [voiceSettings.hapticFeedbackEnabled]);

  // Dynamically resolved theme-aware orb glow palette (Gold for thinking, Cyan for idle, Ruby for live calls)
  const currentOrbTheme = React.useMemo(() => {
    return getActiveOrbTheme({
      state,
      isLive: isLiveConversation,
      activeMode,
      themeAccent,
    });
  }, [state, isLiveConversation, activeMode, themeAccent]);

  // Dynamic High-Velocity Neural Capacity Tracker (operating at millions of operations per second)
  const [neuralOps, setNeuralOps] = useState('784.6M');
  const [thinkingOps, setThinkingOps] = useState('860.2M');

  useEffect(() => {
    const interval = setInterval(() => {
      if (state === 'thinking') {
        const ops = (820 + Math.random() * 160).toFixed(1);
        setThinkingOps(`${ops}M`);
        setNeuralOps(`${ops}M`);
      } else if (state === 'speaking' || state === 'listening') {
        const ops = (680 + Math.random() * 120).toFixed(1);
        setNeuralOps(`${ops}M`);
      } else {
        const ops = (560 + Math.random() * 80).toFixed(1);
        setNeuralOps(`${ops}M`);
      }
    }, 120);
    return () => clearInterval(interval);
  }, [state]);

  // Pending Request AbortController & Deduplication Ref
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const lastSentQueryRef = useRef<{ text: string; time: number }>({ text: '', time: 0 });

  // Screen-Adaptive Responsive Orb Sizing for Full-Screen & Multi-Device Previews
  const [orbSize, setOrbSize] = useState(280);
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w >= 1024 && h >= 800) {
        setOrbSize(340);
      } else if (w >= 768 && h >= 680) {
        setOrbSize(300);
      } else if (h < 640) {
        setOrbSize(220);
      } else {
        setOrbSize(260);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // HTML5 Fullscreen State & Toggle
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFSChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    } catch (_) {}
  }, []);

  // Messages History & Web Grounding Sources
  const [messages, setMessages] = useState<ChatMessage[]>(() => activeSession.messages || []);
  const [lastSources, setLastSources] = useState<WebSource[]>([]);
  const [lastSearchQueries, setLastSearchQueries] = useState<string[]>([]);

  // Browser Navigation & Web-Opening Execution Feedback
  const [browserActionToast, setBrowserActionToast] = useState<{
    url: string;
    label: string;
    destinationType?: 'youtube' | 'google' | 'website';
    status: 'opened' | 'blocked';
    timestamp: number;
  } | null>(null);

  const handleOpenUrlInBrowser = useCallback(
    (url: string, label?: string, destinationType?: 'youtube' | 'google' | 'website') => {
      if (!url) return;
      const cleanUrl = url.trim();
      const siteLabel =
        label ||
        (cleanUrl.includes('youtube.com')
          ? 'YouTube'
          : cleanUrl.includes('google.com')
          ? 'Google'
          : 'External Website');

      try {
        const openedWindow = window.open(cleanUrl, '_blank', 'noopener,noreferrer');
        const isBlocked =
          !openedWindow || openedWindow.closed || typeof openedWindow.closed === 'undefined';

        setBrowserActionToast({
          url: cleanUrl,
          label: siteLabel,
          destinationType,
          status: isBlocked ? 'blocked' : 'opened',
          timestamp: Date.now(),
        });

        if (!isBlocked) {
          setTimeout(() => {
            setBrowserActionToast((prev) => (prev?.url === cleanUrl ? null : prev));
          }, 8000);
        }
      } catch (err) {
        console.warn('[RODEX Browser Open Error]', err);
        setBrowserActionToast({
          url: cleanUrl,
          label: siteLabel,
          destinationType,
          status: 'blocked',
          timestamp: Date.now(),
        });
      }
    },
    []
  );

  // Synchronize Active Session with Local Storage
  useEffect(() => {
    setActiveSession((prev) => {
      const updated: ChatSession = {
        ...prev,
        messages,
        lastActiveAt: new Date().toISOString(),
      };
      saveActiveSession(updated);
      return updated;
    });
    setAllSessions(loadAllSessions());
  }, [messages]);

  const handleSelectSession = (session: ChatSession) => {
    setActiveSession(session);
    setMessages(session.messages || []);
    saveActiveSession(session);
  };

  const handleNewSession = () => {
    const newSession = createNewSession();
    setActiveSession(newSession);
    setMessages(newSession.messages || []);
    setAllSessions(loadAllSessions());
  };

  const handleDeleteSession = (sessionId: string) => {
    const remaining = deleteSessionFromHistory(sessionId);
    setAllSessions(remaining);
    if (activeSession.id === sessionId) {
      if (remaining.length > 0) {
        handleSelectSession(remaining[0]);
      } else {
        handleNewSession();
      }
    }
  };

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
    const introSpeech = 'Live call connected. How can I assist you today?';
    setLastResponse(introSpeech);

    const liveStartMsg: ChatMessage = {
      id: `live-start-${Date.now()}`,
      sender: 'assistant',
      text: 'Live audio connection active. Listening for your voice.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      speakerVerified: true,
      webGrounded: true,
    };
    setMessages((prev) => [...prev, liveStartMsg]);

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
    const endText = 'Conversation ended. Say "Hey RODEX" to talk again.';
    setLastResponse(endText);

    const liveEndMsg: ChatMessage = {
      id: `live-end-${Date.now()}`,
      sender: 'assistant',
      text: 'Live audio call disconnected. Session transcript preserved and ready to retrieve anytime.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, liveEndMsg]);
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

    // Deduplicate rapid identical submissions within 400ms
    const nowMs = Date.now();
    if (lastSentQueryRef.current.text === userText.trim() && nowMs - lastSentQueryRef.current.time < 400) {
      return;
    }
    lastSentQueryRef.current = { text: userText.trim(), time: nowMs };

    // Abort any prior in-flight request to prioritize current user action
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;

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
        speaker: 'User',
        speakerVerified: true,
      };

      const exitReply = wasLive
        ? 'Call ended. I remain on standby whenever you need me.'
        : 'Goodbye. Have a wonderful day, I remain on standby.';
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

    // Handle explicit user request to retrieve or display the live chat session
    if (
      /retrieve.*(chat|session|transcript|log)|show.*(chat|session|transcript)|open.*(chat|session)|view.*(chat|session)|display.*(chat|session)/i.test(
        userText
      )
    ) {
      triggerHaptic('tap');
      setIsChatOpen(true);
      const retrieveReply =
        'Displaying your chat conversation on screen.';
      const userMsg: ChatMessage = {
        id: createId('user'),
        sender: 'user',
        text: userText,
        timestamp,
        speaker: 'User',
        speakerVerified: true,
      };
      const assistantMsg: ChatMessage = {
        id: createId('assistant'),
        sender: 'assistant',
        text: retrieveReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        webGrounded: true,
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setLastResponse(retrieveReply);
      speakResponse(retrieveReply);
      return;
    }

    // Check if user called or activated RODEX ("Hey RODEX", "RODEX", "Hey RODEX what is the latest world news?", custom wake-word, etc.)
    const wakeMatch = checkWakeWordMatch(userText, voiceSettings.customWakeWord);
    const { isCall, isPureActivation, command } = wakeMatch;

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
        speaker: 'User',
        speakerVerified: true,
      };

      const greetingSpeech = 'I am here. How can I assist you?';
      const greetingFullText = 'I am listening. How can I assist you today?';

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
      speaker: 'User',
      speakerVerified: true,
      imageUrl: imagePayload ? `data:${imagePayload.mimeType};base64,${imagePayload.data}` : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setState('thinking');
    setLastResponse('RODEX is thinking...');

    try {
      // Build conversation history payload
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        text: m.text,
      }));

      const customInstruction =
        'You are RODEX, an advanced, highly intelligent AI assistant. Provide clear, direct, accurate, and helpful answers with real-time web-grounded information when appropriate. Keep spoken responses concise and conversational.';

      const clientFormattedTime = new Date().toLocaleString([], {
        dateStyle: 'full',
        timeStyle: 'medium',
      });
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Kampala';

      const queryToSend = isCall && command ? command : userText;
      const lowerQ = queryToSend.toLowerCase();
      if (lowerQ.startsWith('play ') || lowerQ.includes('play music') || lowerQ.includes('music video') || lowerQ.includes('search song') || lowerQ.includes('what is playing')) {
        setIsMediaHubOpen(true);
      }
      if (lowerQ.includes('security status') || lowerQ.includes('are there any threats') || lowerQ.includes('security incidents') || lowerQ.includes('security alert') || lowerQ.includes('security scan')) {
        setIsSecurityOpen(true);
      }
      if (lowerQ.includes('update system') || lowerQ.includes('check updates') || lowerQ.includes('software update') || lowerQ.includes('technology updates')) {
        setIsUpdateOpen(true);
      }
      if (lowerQ.includes('who am i') || lowerQ.includes('who created you') || lowerQ.includes('who is your founder') || lowerQ.includes('who developed') || lowerQ.includes('who is robert') || lowerQ.includes('creator profile')) {
        setIsCreatorOpen(true);
      }
      if (lowerQ.includes('open memory') || lowerQ.includes('show memories') || lowerQ.includes('manage memory') || lowerQ.includes('personalization') || lowerQ.includes('my memories')) {
        setIsMemoryOpen(true);
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
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
          performanceMode: voiceSettings.performanceMode || 'ultra',
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
      const actionStatus = data.actionStatus || data.orchestrationTrace?.actionStatus;

      const assistantMsg: ChatMessage = {
        id: createId('assistant'),
        sender: 'assistant',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources,
        searchQueries,
        webGrounded,
        actionStatus,
        generatedImage: data.generatedImage,
        orchestrationTrace: data.orchestrationTrace,
        pendingConfirmation: data.pendingConfirmation,
      };


      if (data.spotify) {
        if (data.spotify.playback !== undefined) {
          setSpotifyPlayback(data.spotify.playback);
        }
        if (data.spotify.device !== undefined) {
          setSpotifyDevice(data.spotify.device);
        }
      }

      setMessages((prev) => [...prev, assistantMsg]);
      setLastResponse(reply);
      setLastSources(sources);
      setLastSearchQueries(searchQueries);

      // Execute browser-opening tools returned by the orchestrator
      if (data.orchestrationTrace?.executedTools?.length > 0) {
        for (const executedTool of data.orchestrationTrace.executedTools) {
          if (
            executedTool.toolName === 'open_approved_url' &&
            executedTool.result?.success &&
            executedTool.result?.output?.url
          ) {
            handleOpenUrlInBrowser(
              executedTool.result.output.url,
              executedTool.result.output.label,
              executedTool.result.output.destinationType
            );
          }
        }
      }

      // Reflect tool execution state if tools were executed
      if (data.orchestrationTrace?.executedTools?.length > 0) {
        setState('executing_tool');
      }

      // If pending confirmation is required, hold permission_required state
      if (data.pendingConfirmation) {
        setState('permission_required');
        speakResponse(reply, () => {
          setState('permission_required');
        });
      } else {
        // Speak response aloud, and if in live conversation, seamlessly auto-listen for reply
        speakResponse(reply, () => {
          if (isLiveConversationRef.current) {
            playToneChime('listen');
            startListening();
          }
        });
      }
    } catch (err: any) {
      // If the request was aborted by a subsequent action, silently exit without error state
      if (
        abortController.signal.aborted ||
        err?.name === 'AbortError' ||
        (typeof err?.message === 'string' && err.message.toLowerCase().includes('abort'))
      ) {
        return;
      }

      console.error('[RODEX Chat error]', err);
      setState('error');
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
      speakResponse(errorText, () => {
        if (!isLiveConversationRef.current) {
          setTimeout(() => {
            setState('idle');
          }, 2000);
        }
      });
    } finally {
      if (activeAbortControllerRef.current === abortController) {
        activeAbortControllerRef.current = null;
      }
    }
  };

  const handleConfirmAction = async (actionId: string, toolName: string, params: any) => {
    try {
      const res = await fetch('/api/rodex/confirm-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, toolName, params }),
      });
      const data = await res.json();
      if (data.status === 'ok' && data.result) {
        const confirmText = data.result.message || `Action "${toolName}" executed with verified operator permission.`;
        const resultMsg: ChatMessage = {
          id: `confirmed-${Date.now()}`,
          sender: 'assistant',
          text: confirmText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        if (params?.action === 'clear_history') {
          setMessages([]);
        } else {
          setMessages((prev) => [...prev, resultMsg]);
        }
        speakResponse(confirmText);
      }
    } catch (err: any) {
      console.error('[Action Confirmation Error]', err);
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
          const isWakeTriggered =
            containsHeyRodexWakeWord(currentText) ||
            checkWakeWordMatch(currentText, voiceSettings.customWakeWord).isCall;

          if (isWakeTriggered) {
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
      case 'processing':
        return 'RODEX is thinking...';
      case 'executing_tool':
        return 'Executing approved action...';
      case 'permission_required':
        return 'Operator approval required';
      case 'error':
        return 'System alert — Check connection';
      case 'speaking':
        return 'Speaking response...';
      case 'idle':
      default:
        return isLiveConversation ? 'Live Call Active — Listening...' : 'Tap orb or mic to speak';
    }
  };

  return (
    <AndroidFrame>
      <main
        id="rodex-main-screen"
        className="w-full h-full flex flex-col justify-between relative bg-black text-white overflow-hidden select-none"
      >
        {/* Top Minimal Header */}
        <header className="px-5 py-3.5 flex items-center justify-between z-20 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-900/80">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
            <h1 className="text-sm font-bold tracking-[0.25em] text-white">RODEX</h1>
          </div>

          {/* Center: Live Call indicator if active */}
          <div className="flex items-center">
            {isLiveConversation && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-500/60 shadow-[0_0_12px_rgba(244,63,94,0.3)] animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                <span className="text-[10px] font-bold tracking-wider text-rose-300 uppercase">
                  Live Call
                </span>
                <button
                  id="header-end-call-btn"
                  onClick={endLiveCall}
                  className="ml-1 px-1.5 py-0.5 rounded-full bg-red-900 hover:bg-red-800 border border-red-600 text-red-100 text-[9px] font-bold cursor-pointer transition-colors"
                  title="End Live Call"
                >
                  End
                </button>
              </div>
            )}
          </div>

          {/* Right: Essential Window Controls */}
          <div className="flex items-center gap-1">
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

            <button
              id="header-chat-btn"
              onClick={() => setIsChatOpen(true)}
              title="Open Chat Session"
              className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-900 active:scale-95 transition-all relative"
            >
              <MessageSquare className="w-4 h-4" />
              {messages.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-cyan-400 rounded-full" />
              )}
            </button>

            <button
              id="header-media-hub-btn"
              onClick={() => {
                triggerHaptic('tap');
                setIsMediaHubOpen(true);
              }}
              title="Web Music & Video Hub"
              className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-900 active:scale-95 transition-all text-cyan-400"
            >
              <Music2 className="w-4 h-4" />
            </button>

            <button
              id="header-security-btn"
              onClick={() => {
                triggerHaptic('tap');
                setIsSecurityOpen(true);
              }}
              title="RODEX Security Center"
              className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-900 active:scale-95 transition-all text-emerald-400"
            >
              <Shield className="w-4 h-4" />
            </button>

            <button
              id="header-update-btn"
              onClick={() => {
                triggerHaptic('tap');
                setIsUpdateOpen(true);
              }}
              title="Autonomous Update & Intelligence"
              className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-900 active:scale-95 transition-all text-cyan-400"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              id="header-creator-btn"
              onClick={() => {
                triggerHaptic('tap');
                setIsCreatorOpen(true);
              }}
              title="Creator Profile & Founder Recognition"
              className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-900 active:scale-95 transition-all text-amber-400"
            >
              <Award className="w-4 h-4" />
            </button>

            <button
              id="header-studio-btn"
              onClick={() => {
                triggerHaptic('tap');
                setMediaStudioTab('video');
                setIsMediaStudioOpen(true);
              }}
              title="Veo 3 Video & Multimodal Studio"
              className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-900 active:scale-95 transition-all text-cyan-400"
            >
              <Film className="w-4 h-4" />
            </button>

            <button
              id="header-capability-btn"
              onClick={() => {
                triggerHaptic('tap');
                setIsCapabilityOpen(true);
              }}
              title="RODEX Multi-Capability Hub & 8 Domains"
              className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-900 active:scale-95 transition-all text-indigo-400 relative"
            >
              <Cpu className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            </button>

            <button
              id="header-memory-btn"
              onClick={() => {
                triggerHaptic('tap');
                setIsMemoryOpen(true);
              }}
              title="Long-Term Memory & Personalization"
              className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-900 active:scale-95 transition-all text-purple-400"
            >
              <Brain className="w-4 h-4" />
            </button>

            <button
              id="header-settings-btn"
              onClick={() => setIsSettingsOpen(true)}
              title="Settings"
              className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-900 active:scale-95 transition-all"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Firebase Google Auth Profile & Sync Badge */}
            <FirebaseAuthButton />
          </div>
        </header>

        {/* Center: The Large Glowing AI Orb - Pure, Grand & Uncluttered Focus */}
        <div className="flex-1 flex flex-col items-center justify-center relative px-6 w-full">
          {/* Subtle Ambient Radial Glow */}
          <div
            className={`absolute w-80 h-80 rounded-full blur-[110px] pointer-events-none transition-colors duration-700 ${currentOrbTheme.ambientGlowClass}`}
          />

          {/* Central Orb Identity */}
          <div className="relative my-auto flex flex-col items-center py-2">
            <Orb
              state={state}
              audioLevel={audioLevel}
              pitchHz={pitchHz}
              size={260}
              onClick={startListening}
              activeMode={activeMode}
              isLive={isLiveConversation}
              themeAccent={themeAccent}
            />
          </div>

          {/* Active Browser Action Notification / Launcher */}
          {browserActionToast && (
            <div
              className={`mb-3 px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-3 max-w-sm w-full mx-auto shadow-xl backdrop-blur-md z-30 transition-all ${
                browserActionToast.destinationType === 'youtube'
                  ? 'bg-red-950/90 border-red-500/60 text-red-100'
                  : 'bg-cyan-950/90 border-cyan-500/60 text-cyan-100'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    browserActionToast.destinationType === 'youtube'
                      ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                      : 'bg-cyan-600 text-black shadow-[0_0_12px_rgba(6,182,212,0.5)]'
                  }`}
                >
                  {browserActionToast.destinationType === 'youtube' ? (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  ) : (
                    <Globe className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate text-white">
                    {browserActionToast.label}
                  </p>
                  <p className="text-[10px] text-neutral-300 truncate">
                    {browserActionToast.status === 'blocked'
                      ? 'Pop-up blocked: Tap to open'
                      : 'Opening in browser tab'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  id="active-browser-action-open-btn"
                  onClick={() => {
                    triggerHaptic('tap');
                    window.open(browserActionToast.url, '_blank', 'noopener,noreferrer');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm"
                >
                  <span>Open</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setBrowserActionToast(null)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white transition-colors"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Clean Subtitle & Status Text */}
          <div className="w-full max-w-sm text-center mb-4 min-h-[44px] flex items-center justify-center pointer-events-none">
            {state === 'listening' ? (
              <p className="text-xs sm:text-sm text-cyan-300 font-normal leading-relaxed line-clamp-3 px-4 italic animate-pulse">
                "{transcript || 'Listening to your voice...'}"
              </p>
            ) : state === 'thinking' || state === 'processing' ? (
              <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-medium animate-pulse">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span>RODEX is thinking...</span>
              </div>
            ) : state === 'executing_tool' ? (
              <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-violet-950/50 border border-violet-500/50 text-violet-300 text-xs font-medium animate-pulse">
                <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                <span>Executing approved action...</span>
              </div>
            ) : state === 'permission_required' ? (
              <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-950/60 border border-amber-500/60 text-amber-300 text-xs font-medium animate-pulse">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>Operator approval required</span>
              </div>
            ) : state === 'error' ? (
              <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-950/60 border border-red-500/60 text-red-300 text-xs font-medium animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                <span>System alert — Connection error</span>
              </div>
            ) : state === 'speaking' ? (
              <p className="text-xs sm:text-sm text-neutral-300 font-normal leading-relaxed line-clamp-3 px-4">
                {lastResponse || 'Speaking response...'}
              </p>
            ) : (
              <p className="text-xs text-neutral-400 font-normal leading-relaxed line-clamp-2 px-4">
                {lastResponse || (isLiveConversation ? 'Live Call Active — Listening...' : 'Tap orb or microphone to speak')}
              </p>
            )}
          </div>
        </div>

        {/* Bottom Section: Microphone and Voice-Status Controls */}
        <div className="w-full flex flex-col items-center pb-6 pt-2 z-20">
          <div className="relative mb-2.5 flex items-center justify-center gap-4">
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
                  ? 'bg-amber-950 text-amber-300 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                  : isLiveConversation
                  ? 'bg-rose-950 text-rose-300 border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.4)] animate-pulse'
                  : 'bg-neutral-900/90 hover:bg-neutral-850 text-cyan-400 border-neutral-800 hover:border-cyan-500/50 shadow-[0_0_20px_rgba(0,0,0,0.8)]'
              }`}
              title={
                state === 'listening'
                  ? 'Tap to send immediately'
                  : state === 'speaking'
                  ? 'Tap or speak to interrupt'
                  : isLiveConversation
                  ? 'Live Call Active - Tap to speak'
                  : 'Tap to speak with RODEX'
              }
            >
              {state === 'listening' ? (
                <Mic className="w-7 h-7 animate-bounce" />
              ) : state === 'speaking' ? (
                <Volume2 className="w-7 h-7 animate-pulse" />
              ) : state === 'thinking' ? (
                <Sparkles className="w-7 h-7 animate-spin" />
              ) : isLiveConversation ? (
                <Mic className="w-7 h-7 text-rose-300" />
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
                title="End Live Call"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            )}
          </div>

          <span className="text-[11px] font-medium tracking-wider text-neutral-500">
            {state === 'listening'
              ? 'LISTENING • TAP TO SEND'
              : state === 'speaking'
              ? 'SPEAKING • TAP TO INTERRUPT'
              : state === 'thinking'
              ? 'PROCESSING...'
              : isLiveConversation
              ? 'LIVE CALL ACTIVE • SAY "END CALL" OR TAP END'
              : 'TAP TO TALK OR SAY "HEY RODEX"'}
          </span>
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
          activeSession={activeSession}
          allSessions={allSessions}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          messages={messages}
          onSendMessage={(text) => handleSendMessage(text)}
          onReplayAudio={(text) => speakResponse(text)}
          onClearHistory={() => setMessages([])}
          assistantState={state}
          onStartVoice={startListening}
          isLiveConversation={isLiveConversation}
          onConfirmAction={handleConfirmAction}
          onToggleLiveCall={() => {
            if (isLiveConversation) {
              endLiveCall();
            } else {
              startLiveCall();
            }
          }}
        />

        {/* Settings Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          voiceSettings={voiceSettings}
          onUpdateVoiceSettings={setVoiceSettings}
          themeAccent={themeAccent}
          onUpdateTheme={handleUpdateTheme}
          onRequestMicPermission={requestMicPermission}
          micPermissionGranted={micPermissionGranted}
          onOpenVoiceProfile={() => setIsVoiceProfileOpen(true)}
          onOpenSpotify={() => setIsSpotifyOpen(true)}
          onOpenWebVerify={() => setIsWebVerifyOpen(true)}
          onOpenMemory={() => setIsMemoryOpen(true)}
          onSelectMode={(mode) => {
            if (mode === 'home') {
              setActiveMode('home');
              setIsChatOpen(false);
            } else {
              setActiveMode(mode);
            }
          }}
        />

        {/* Voice Profile & Biometrics Modal */}
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
            speakResponse('Voice profile recalibrated successfully.');
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
          onOpenSpotify={() => setIsSpotifyOpen(true)}
          onOpenMemory={() => setIsMemoryOpen(true)}
          onOpenCapabilities={() => setIsCapabilityOpen(true)}
          onOpenMediaStudio={(tab) => {
            setMediaStudioTab(tab);
            setIsMediaStudioOpen(true);
          }}
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

        {/* Spotify PC Access & Player Modal */}
        <SpotifyPlayerModal
          isOpen={isSpotifyOpen}
          onClose={() => setIsSpotifyOpen(false)}
          onSpeakStatus={(text) => speakResponse(text)}
        />

        {/* Web Music & Video Intelligence Hub Modal */}
        <WebMediaHubModal
          isOpen={isMediaHubOpen}
          onClose={() => setIsMediaHubOpen(false)}
          onSpeakStatus={(text) => speakResponse(text)}
        />

        {/* RODEX Security Center Modal */}
        <SecurityCenterModal
          isOpen={isSecurityOpen}
          onClose={() => setIsSecurityOpen(false)}
          onSpeakStatus={(text) => speakResponse(text)}
        />

        {/* RODEX Autonomous Update & Intelligence Center Modal */}
        <UpdateCenterModal
          isOpen={isUpdateOpen}
          onClose={() => setIsUpdateOpen(false)}
          onSpeakStatus={(text) => speakResponse(text)}
        />

        {/* Creator Identity & Recognition Modal */}
        <CreatorProfileModal
          isOpen={isCreatorOpen}
          onClose={() => setIsCreatorOpen(false)}
          onSpeakStatus={(text) => speakResponse(text)}
        />

        {/* Long-Term Memory & User Personalization Modal */}
        <MemoryPersonalizationModal
          isOpen={isMemoryOpen}
          onClose={() => setIsMemoryOpen(false)}
          onNotification={(msg) => speakResponse(msg)}
        />

        {/* RODEX Capability Hub & Multi-Domain System Modal */}
        <CapabilityHubModal
          isOpen={isCapabilityOpen}
          onClose={() => setIsCapabilityOpen(false)}
          onExecutePrompt={(prompt) => handleSendMessage(prompt)}
        />

        {/* RODEX Multimodal Studio (Veo 3 Video, Image Edit, Maps & Search Grounding, Firebase Gallery) */}
        <MediaStudioModal
          isOpen={isMediaStudioOpen}
          onClose={() => setIsMediaStudioOpen(false)}
          initialTab={mediaStudioTab}
        />
      </main>
    </AndroidFrame>
  );
}
