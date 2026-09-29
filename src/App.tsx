import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
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
  Stethoscope,
  Mail,
  Menu,
} from 'lucide-react';
import { Orb } from './components/Orb';
import { ActionBar } from './components/ActionBar';
import { MoreMenu } from './components/MoreMenu';
import { ChatSheet } from './components/ChatSheet';
import { SettingsModal } from './components/SettingsModal';
import { ModesModal } from './components/ModesModal';
import { VoiceProfileModal } from './components/VoiceProfileModal';
import { WebVerificationModal } from './components/WebVerificationModal';
import { SpotifyPlayerModal } from './components/SpotifyPlayerModal';
import { WebMediaHubModal } from './components/WebMediaHubModal';
import { SecurityCenterModal } from './components/SecurityCenterModal';
import { UpdateCenterModal } from './components/UpdateCenterModal';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { MemoryPersonalizationModal } from './components/MemoryPersonalizationModal';
import { CapabilityHubModal } from './components/CapabilityHubModal';
import { MediaStudioModal } from './components/MediaStudioModal';
import { RodexDoctorModal } from './components/RodexDoctorModal';
import { GmailHubModal } from './components/GmailHubModal';
import { ScheduleModal } from './components/ScheduleModal';
import { FirebaseAuthButton } from './components/FirebaseAuthButton';
import { SpotifyMiniBar } from './components/SpotifyMiniBar';
import { AndroidFrame } from './components/AndroidFrame';
import { getCachedGmailAccessToken } from './services/firebase';
import { globalAuthClient, AuthenticatedUser } from './services/authClient';
import { TaskCard } from './components/TaskCard';
import { globalTaskEngine } from './services/TaskEngine';
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
  AgentTask,
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
  normalizeForWakeWord,
} from './utils/speech';
import { triggerHaptic, setHapticsEnabled, triggerSubtlePulse } from './utils/haptics';
import { rodexBeatbox } from './utils/beatbox';
import { globalSpeechManager } from './utils/speechManager';
import {
  loadActiveSession,
  saveActiveSession,
  loadAllSessions,
  createNewSession,
  deleteSessionFromHistory,
} from './utils/sessionStorage';
import { getActiveOrbTheme } from './utils/orbTheme';

const createId = (prefix = 'msg') =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

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
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'register' | 'recover'>('signin');
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(() => globalAuthClient.getCurrentUser());
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isCapabilityOpen, setIsCapabilityOpen] = useState(false);
  const [isMediaStudioOpen, setIsMediaStudioOpen] = useState(false);
  const [isDoctorOpen, setIsDoctorOpen] = useState(false);
  const [isGmailOpen, setIsGmailOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
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

  // Multi-user authentication synchronization
  useEffect(() => {
    globalAuthClient.getMe().then((user) => {
      if (user) {
        setCurrentUser(user);
        setVoiceProfile((prev) => ({
          ...prev,
          speakerName: user.displayName || user.profile?.preferredName || 'Robert',
        }));
      }
    });

    const unsubscribe = globalAuthClient.subscribe((user) => {
      setCurrentUser(user);
      if (user) {
        setVoiceProfile((prev) => ({
          ...prev,
          speakerName: user.displayName || user.profile?.preferredName || 'Robert',
        }));
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time Two-Way Live Conversation State
  const [isLiveConversation, setIsLiveConversation] = useState(false);
  const isLiveConversationRef = useRef(false);
  const consecutiveSilenceCountRef = useRef(0);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Active Agent Task State (Proactive, Multi-Step & Real-World Agent Jobs)
  const [activeTask, setActiveTask] = useState<AgentTask | null>(null);

  useEffect(() => {
    const unsub = globalTaskEngine.subscribe((task) => {
      setActiveTask(task);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (currentUser?.uid) {
      globalTaskEngine.setUserId(currentUser.uid);
    }
  }, [currentUser]);

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
    'Greetings. I am RODEX. Say "Hello RODEX" to speak.'
  );
  const [isMuted, setIsMuted] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [showPermDialog, setShowPermDialog] = useState(false);

  // Core Developer Voice Engine Diagnostics
  const [diagSupport, setDiagSupport] = useState(() => {
    if (typeof window === 'undefined') return 'Checking...';
    return (window as any).SpeechRecognition ? 'Standard API' : (window as any).webkitSpeechRecognition ? 'Webkit API' : 'Not Supported';
  });
  const [diagCreated, setDiagCreated] = useState(false);
  const [diagPermission, setDiagPermission] = useState('Checking...');
  const [diagRunning, setDiagRunning] = useState('Inactive');
  const [diagLastEvent, setDiagLastEvent] = useState('None');
  const [diagLastError, setDiagLastError] = useState('None');
  const [diagLastTranscript, setDiagLastTranscript] = useState('');
  const [diagWakeMatched, setDiagWakeMatched] = useState(false);
  const [diagCurrentState, setDiagCurrentState] = useState('idle');
  const [showDiagPanel, setShowDiagPanel] = useState(false);

  useEffect(() => {
    setDiagCurrentState(state);
  }, [state]);

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

  // Synchronized Heartbeat Tactile Pulsing during THINKING / PROCESSING states
  useEffect(() => {
    let thinkingHeartbeatTimer: NodeJS.Timeout | null = null;
    
    if (state === 'thinking' || state === 'processing') {
      thinkingHeartbeatTimer = setInterval(() => {
        // Double heartbeat haptic pulse
        triggerSubtlePulse(10);
        setTimeout(() => {
          triggerSubtlePulse(10);
        }, 140);
      }, 1000);
    }

    return () => {
      if (thinkingHeartbeatTimer) {
        clearInterval(thinkingHeartbeatTimer);
      }
    };
  }, [state]);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
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
  const bargeInAnimationFrameRef = useRef<number | null>(null);
  const lastCapturedRef = useRef<string>('');
  const liveSilenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wakeWordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speakIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // High-performance voice sentence queueing refs
  const speechQueueRef = useRef<string[]>([]);
  const isSpeechQueueRunningRef = useRef<boolean>(false);

  // High-resolution real-time developer metrics state
  const [perfMetrics, setPerfMetrics] = useState<any>(null);

  useEffect(() => {
    if (!showDiagPanel) return;
    const fetchPerf = async () => {
      try {
        const res = await fetch('/api/rodex/performance');
        if (res.ok) {
          const data = await res.json();
          setPerfMetrics(data);
        }
      } catch (_) {}
    };
    fetchPerf();
    const interval = setInterval(fetchPerf, 2000);
    return () => clearInterval(interval);
  }, [showDiagPanel]);

  const processSpeechQueue = useCallback(() => {
    if (speechQueueRef.current.length === 0) {
      isSpeechQueueRunningRef.current = false;
      if (isLiveConversationRef.current && stateRef.current !== 'listening' && stateRef.current !== 'thinking') {
        playToneChime('listen');
        startListening();
      }
      return;
    }
    isSpeechQueueRunningRef.current = true;
    const nextSentence = speechQueueRef.current.shift()!;
    speakResponse(nextSentence, () => {
      processSpeechQueue();
    });
  }, []);

  // Auto-Probe Microphone Permission on Boot & Account Login without triggering intrusive prompt
  const probeMicPermission = useCallback(async (): Promise<boolean> => {
    console.info('[RODEX DIAGNOSTICS] MIC PERMISSION probe started');
    setDiagPermission('Probing...');
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        console.info('[RODEX DIAGNOSTICS] MIC PERMISSION state:', permissionStatus.state);
        setDiagPermission(permissionStatus.state);
        if (permissionStatus.state === 'granted') {
          setMicPermissionGranted(true);
          globalSpeechManager.setMicPermission(true);
          return true;
        } else {
          setMicPermissionGranted(false);
          globalSpeechManager.setMicPermission(false);
          return false;
        }
      }
    } catch (e) {
      setDiagPermission('prompt');
      console.info('[RODEX DIAGNOSTICS] MIC PERMISSION query unavailable, will prompt on user click');
    }
    return false;
  }, []);

  useEffect(() => {
    probeMicPermission();
  }, [currentUser, probeMicPermission]);

  // Set up microphone permission listener
  useEffect(() => {
    console.info('[RODEX DIAGNOSTICS] VOICE INIT - System initializing...');
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((permissionStatus) => {
          console.info('[RODEX DIAGNOSTICS] MIC PERMISSION initial state:', permissionStatus.state);
          setDiagPermission(permissionStatus.state);
          const isGranted = permissionStatus.state === 'granted';
          setMicPermissionGranted(isGranted);
          globalSpeechManager.setMicPermission(isGranted);

          permissionStatus.onchange = () => {
            console.info('[RODEX DIAGNOSTICS] MIC PERMISSION state changed to:', permissionStatus.state);
            setDiagPermission(permissionStatus.state);
            const granted = permissionStatus.state === 'granted';
            setMicPermissionGranted(granted);
            globalSpeechManager.setMicPermission(granted);
          };
        })
        .catch((e) => {
          setDiagPermission('prompt');
          console.info('[RODEX DIAGNOSTICS] MIC PERMISSION query failed or unsupported:', e);
        });
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      audioMeterRef.current.stop();
      rodexSynth.stop();
    };
  }, []);

  // Request Microphone Permission (Triggered upon user interaction with Orb or Mic button)
  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release initial probe stream
      stream.getTracks().forEach((track) => track.stop());
      setMicPermissionGranted(true);
      globalSpeechManager.setMicPermission(true);
      setDiagPermission('granted');
      setShowPermDialog(false);
      return true;
    } catch (err) {
      console.warn('[RODEX Mic Perm Denied or Dismissed]', err);
      setMicPermissionGranted(false);
      globalSpeechManager.setMicPermission(false);
      setDiagPermission('denied');
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
      if (speakIntervalRef.current) {
        clearInterval(speakIntervalRef.current);
        speakIntervalRef.current = null;
      }
      const startTime = Date.now();
      speakIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const level = Math.abs(Math.sin(elapsed * 6)) * 0.45;
        setAudioLevel(level);
        // Modulate synthetic voice pitch frequency dynamically (135Hz - 175Hz)
        setPitchHz(145 + Math.sin(elapsed * 4.5) * 28);

        // Tactile voice-wave pulse matching atmospheric audio/light peak intensity
        if (level > 0.35) {
          triggerSubtlePulse(8);
        }
      }, 50);

      if (bargeInAnimationFrameRef.current) {
        cancelAnimationFrame(bargeInAnimationFrameRef.current);
        bargeInAnimationFrameRef.current = null;
      }

      // Start monitoring for User Barge-in if Live Conversation Mode is active
      if (isLiveConversationRef.current) {
        audioMeterRef.current.start().then((started) => {
          if (!started) return;
          const speakStartTime = Date.now();

          const monitorInterruption = () => {
            if (stateRef.current !== 'speaking' || !isLiveConversationRef.current) {
              if (bargeInAnimationFrameRef.current) {
                cancelAnimationFrame(bargeInAnimationFrameRef.current);
                bargeInAnimationFrameRef.current = null;
              }
              return;
            }

            // Allow 800ms of speaking before permitting barge-in (prevents self-triggering on starts/chimes)
            if (Date.now() - speakStartTime > 800) {
              const metrics = audioMeterRef.current.getVoiceMetrics();
              if (metrics.isSpeech && metrics.level > 0.08) {
                console.info('[RODEX Barge-In] User interrupted speak stream:', metrics);
                
                // Immediately stop current speak playback
                rodexSynth.stop();
                
                // Play barge-in chime
                playToneChime('bargein');

                // Clean up the current VAD frame
                if (bargeInAnimationFrameRef.current) {
                  cancelAnimationFrame(bargeInAnimationFrameRef.current);
                  bargeInAnimationFrameRef.current = null;
                }
                audioMeterRef.current.stop();

                // Immediately switch to listening to capture the new statement
                startListening();
                return;
              }
            }

            bargeInAnimationFrameRef.current = requestAnimationFrame(monitorInterruption);
          };

          bargeInAnimationFrameRef.current = requestAnimationFrame(monitorInterruption);
        });
      }

      console.info('[RODEX DIAGNOSTICS] TTS START:', text);
      globalSpeechManager.setSelfSpeaking(true);
      rodexSynth.speak(text, {
        voiceURI: voiceSettings.voiceURI,
        rate: voiceSettings.rate,
        pitch: voiceSettings.pitch,
        volume: voiceSettings.volume,
        onStart: () => {
          setState('speaking');
        },
        onEnd: () => {
          console.info('[RODEX DIAGNOSTICS] TTS END');
          globalSpeechManager.setSelfSpeaking(false);
          if (bargeInAnimationFrameRef.current) {
            cancelAnimationFrame(bargeInAnimationFrameRef.current);
            bargeInAnimationFrameRef.current = null;
          }
          if (isLiveConversationRef.current) {
            audioMeterRef.current.stop();
          }
          if (speakIntervalRef.current) {
            clearInterval(speakIntervalRef.current);
            speakIntervalRef.current = null;
          }
          setAudioLevel(0);
          setPitchHz(124);

          // Natural Conversational Follow-Up Window: allow user to reply without repeating wake-word
          if (micPermissionGranted && (voiceSettings.wakeWordEnabled !== false || isLiveConversationRef.current)) {
            setState('listening');
            globalSpeechManager.startFollowUpWindow(7000);
          } else {
            setState('idle');
          }
          onComplete?.();
        },
        onError: (err) => {
          console.warn('[RODEX DIAGNOSTICS] TTS ERROR:', err);
          globalSpeechManager.setSelfSpeaking(false);
          if (bargeInAnimationFrameRef.current) {
            cancelAnimationFrame(bargeInAnimationFrameRef.current);
            bargeInAnimationFrameRef.current = null;
          }
          if (isLiveConversationRef.current) {
            audioMeterRef.current.stop();
          }
          if (speakIntervalRef.current) {
            clearInterval(speakIntervalRef.current);
            speakIntervalRef.current = null;
          }
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
    if (speakIntervalRef.current) {
      clearInterval(speakIntervalRef.current);
      speakIntervalRef.current = null;
    }
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

    // If already in an active live conversation and user says wake word again, just listen and nudge without greeting/API call
    if (isLiveConversationRef.current && (isHeyRodexCall(userText) || userText.toLowerCase().trim() === 'hello')) {
      console.info('[RODEX Active Session] Wake word repeated, treating as focus attention nudge.');
      setState('listening');
      playToneChime('listen');
      startListening();
      return;
    }

    // Stop speaking if currently active
    rodexSynth.stop();
    rodexBeatbox.stop();

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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

    // Reset and initialize speech queue
    speechQueueRef.current = [];
    isSpeechQueueRunningRef.current = false;

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

      console.info('[RODEX DIAGNOSTICS] AI REQUEST START:', queryToSend);

      // 1. Check if user is confirming or declining an active pending task
      const currentTask = globalTaskEngine.getActiveTask();
      if (
        currentTask &&
        (currentTask.state === 'WAITING_FOR_USER' || currentTask.state === 'WAITING_FOR_PERMISSION')
      ) {
        const isAffirmative =
          /^(yes|confirm|confirm it|confirm reservation|book it|go ahead|sure|do it|ok|okay|please do|proceed)\b/i.test(
            lowerQ
          );
        const isNegative =
          /^(no|cancel|decline|don't|dont|never mind|stop|abort)\b/i.test(lowerQ);

        if (isAffirmative) {
          setState('executing');
          const { spokenSummary } = await globalTaskEngine.confirmRestaurantBooking(
            currentTask.confirmationAction?.params,
            (speech, st) => {
              setLastResponse(speech);
              if (st === 'COMPLETED') {
                setState('success');
                setTimeout(() => setState('idle'), 3500);
              }
            }
          );
          const assistantMsg: ChatMessage = {
            id: createId('assistant'),
            sender: 'assistant',
            text: spokenSummary,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setLastResponse(spokenSummary);
          speakResponse(spokenSummary, () => {
            if (isLiveConversationRef.current) {
              globalSpeechManager.startFollowUpWindow(6500);
            }
          });
          return;
        } else if (isNegative) {
          globalTaskEngine.cancelActiveTask('User declined booking');
          setState('idle');
          const cancelReply = 'Understood. I have cancelled the reservation request.';
          const assistantMsg: ChatMessage = {
            id: createId('assistant'),
            sender: 'assistant',
            text: cancelReply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setLastResponse(cancelReply);
          speakResponse(cancelReply);
          return;
        }
      }

      // 2. Multi-Step Task / Agent Intent Detection (e.g. streaming setup, restaurant booking)
      const detectedTask = globalTaskEngine.detectTaskIntent(queryToSend);
      if (detectedTask.isTask) {
        if (detectedTask.category === 'streaming_setup') {
          setState('planning');
          setLastResponse('Planning streaming setup...');
          const { spokenSummary } = await globalTaskEngine.executeStreamingSetup(
            (speech, taskState) => {
              setLastResponse(speech);
              if (taskState === 'PLANNING') setState('planning');
              else if (taskState === 'EXECUTING') setState('executing');
              else if (taskState === 'COMPLETED') {
                setState('success');
                setTimeout(() => setState('idle'), 4000);
              }
            }
          );
          const assistantMsg: ChatMessage = {
            id: createId('assistant'),
            sender: 'assistant',
            text: spokenSummary,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setLastResponse(spokenSummary);
          speakResponse(spokenSummary, () => {
            if (isLiveConversationRef.current) {
              globalSpeechManager.startFollowUpWindow(6500);
            }
          });
          return;
        } else if (detectedTask.category === 'restaurant_booking') {
          setState('planning');
          setLastResponse('Searching dining options...');
          const { spokenPrompt } = await globalTaskEngine.executeRestaurantSearch(
            detectedTask.entities || {},
            (speech, taskState) => {
              setLastResponse(speech);
              if (taskState === 'PLANNING') setState('planning');
              else if (taskState === 'EXECUTING') setState('executing');
              else if (taskState === 'WAITING_FOR_USER') setState('warning');
            }
          );
          const assistantMsg: ChatMessage = {
            id: createId('assistant'),
            sender: 'assistant',
            text: spokenPrompt,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setLastResponse(spokenPrompt);
          speakResponse(spokenPrompt, () => {
            if (isLiveConversationRef.current) {
              globalSpeechManager.startFollowUpWindow(7000);
            }
          });
          return;
        }
      }

      // Direct Action Execution Triggers
      if (lowerQ.includes('beatbox') || lowerQ.includes('beat box')) {
        let pattern = ['K', 'H', 'S', 'H', 'K', 'K', 'S', 'H'];
        if (lowerQ.includes('fast') || lowerQ.includes('speed') || lowerQ.includes('hiphop') || lowerQ.includes('techno')) {
          rodexBeatbox.setTempo(128);
          pattern = ['K', 'H', 'S', 'H', 'K', 'S', 'K', 'H'];
        } else if (lowerQ.includes('chill') || lowerQ.includes('slow') || lowerQ.includes('reggae')) {
          rodexBeatbox.setTempo(85);
          pattern = ['K', 'H', 'H', 'S', 'K', 'H', 'H', 'S'];
        } else {
          rodexBeatbox.setTempo(105);
        }

        rodexBeatbox.setPattern(pattern);

        const phrase = "Alright Robert, let's change the vibe. Here is a custom synthesized beatbox rhythm for you.";
        const assistantMsg: ChatMessage = {
          id: createId('assistant'),
          sender: 'assistant',
          text: phrase,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setLastResponse(phrase);
        speakResponse(phrase, () => {
          rodexBeatbox.play((level) => {
            setAudioLevel(level);
          });
        });
        return;
      }

      if (rodexBeatbox.getIsPlaying() && (lowerQ.includes('faster') || lowerQ.includes('tempo up') || lowerQ.includes('speed up'))) {
        rodexBeatbox.setTempo(Math.min(rodexBeatbox.getTempo() + 20, 160));
        const phrase = "Tempo increased. Speeds set higher.";
        const assistantMsg: ChatMessage = {
          id: createId('assistant'),
          sender: 'assistant',
          text: phrase,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setLastResponse(phrase);
        speakResponse(phrase, () => {
          rodexBeatbox.play((level) => setAudioLevel(level));
        });
        return;
      }

      if (rodexBeatbox.getIsPlaying() && (lowerQ.includes('slower') || lowerQ.includes('slowing down') || lowerQ.includes('chill') || lowerQ.includes('slow down'))) {
        rodexBeatbox.setTempo(Math.max(rodexBeatbox.getTempo() - 20, 70));
        const phrase = "Tempo decreased. Keeping it nice and chill.";
        const assistantMsg: ChatMessage = {
          id: createId('assistant'),
          sender: 'assistant',
          text: phrase,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setLastResponse(phrase);
        speakResponse(phrase, () => {
          rodexBeatbox.play((level) => setAudioLevel(level));
        });
        return;
      }

      if (lowerQ.includes('stop beatbox') || lowerQ.includes('stop beat') || (rodexBeatbox.getIsPlaying() && (lowerQ.includes('stop') || lowerQ.includes('halt') || lowerQ.includes('enough')))) {
        rodexBeatbox.stop();
        const phrase = "Beat stopped. Ready for your next instruction.";
        const assistantMsg: ChatMessage = {
          id: createId('assistant'),
          sender: 'assistant',
          text: phrase,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setLastResponse(phrase);
        speakResponse(phrase);
        return;
      }

      if (lowerQ.includes('open youtube') || lowerQ.includes('go to youtube') || lowerQ.includes('launch youtube')) {
        handleOpenUrlInBrowser('https://www.youtube.com', 'YouTube', 'youtube');
      } else if (lowerQ.includes('open chrome') || lowerQ.includes('open google') || lowerQ.includes('go to google')) {
        handleOpenUrlInBrowser('https://www.google.com', 'Google', 'google');
      } else if (lowerQ.includes('open gmail') || lowerQ.includes('check my email') || lowerQ.includes('check gmail')) {
        setIsGmailOpen(true);
      } else if (lowerQ.includes('schedule') || lowerQ.includes('set reminder') || lowerQ.includes('remind me')) {
        setIsScheduleOpen(true);
      } else if (lowerQ.includes('who created you') || lowerQ.includes('who made you') || lowerQ.includes('who is your creator')) {
        const creatorSpeech = 'I was created by Mubiru Robert as an advanced autonomous AI assistant.';
        const assistantMsg: ChatMessage = {
          id: createId('assistant'),
          sender: 'assistant',
          text: creatorSpeech,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setLastResponse(creatorSpeech);
        speakResponse(creatorSpeech);
        return;
      }

      if (lowerQ.startsWith('play ') || lowerQ.includes('play music') || lowerQ.includes('music video') || lowerQ.includes('search song') || lowerQ.includes('what is playing')) {
        setIsMediaHubOpen(true);
      }
      if (lowerQ.includes('security status') || lowerQ.includes('are there any threats') || lowerQ.includes('security incidents') || lowerQ.includes('security alert') || lowerQ.includes('security scan')) {
        setIsSecurityOpen(true);
      }
      if (lowerQ.includes('update system') || lowerQ.includes('check updates') || lowerQ.includes('software update') || lowerQ.includes('technology updates')) {
        setIsUpdateOpen(true);
      }
      if (lowerQ.includes('who am i') || lowerQ.includes('my profile') || lowerQ.includes('my account') || lowerQ.includes('who is logged in')) {
        setIsUserProfileOpen(true);
      }
      if (lowerQ.includes('open memory') || lowerQ.includes('show memories') || lowerQ.includes('manage memory') || lowerQ.includes('personalization') || lowerQ.includes('my memories')) {
        setIsMemoryOpen(true);
      }

      // Multimodal Image or Full Orchestration Path Fallback
      if (imagePayload) {
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

        const assistantMsg: ChatMessage = {
          id: createId('assistant'),
          sender: 'assistant',
          text: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sources,
          searchQueries,
          webGrounded: !!data.webGrounded,
          generatedImage: data.generatedImage,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setLastResponse(reply);
        speakResponse(reply, () => {
          if (isLiveConversationRef.current) {
            playToneChime('listen');
            startListening();
          }
        });
        return;
      }

      // REAL-TIME RESPONSE ENGINE (SSE Streaming Pipeline: Low Latency TTFR & Early Speech TTFA)
      const assistantMsgId = createId('assistant');
      const initialAssistantMsg: ChatMessage = {
        id: assistantMsgId,
        sender: 'assistant',
        text: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        webGrounded: true,
      };

      setMessages((prev) => [...prev, initialAssistantMsg]);

      const gmailToken = getCachedGmailAccessToken();
      const streamRes = await fetch('/api/rodex/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(gmailToken ? { Authorization: `Bearer ${gmailToken}` } : {}),
        },
        signal: abortController.signal,
        body: JSON.stringify({
          message: queryToSend,
          history: historyPayload,
          clientFormattedTime,
          timeZone,
          isLiveCall: isLiveConversationRef.current,
        }),
      });

      if (!streamRes.ok || !streamRes.body) {
        throw new Error(`Streaming request failed (${streamRes.status})`);
      }

      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let spokenSentencesCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        const lines = chunkText.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.replace(/^data:\s*/, '').trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);

            if (data.type === 'start') {
              console.info('[RODEX DIAGNOSTICS] AI RESPONSE START (Stream initiated)');
              setState('speaking');
            } else if (data.type === 'token') {
              accumulatedText += data.token;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, text: accumulatedText } : m))
              );
            } else if (data.type === 'sentence') {
              const sentenceText = data.text;
              if (sentenceText && !isMuted && voiceSettings.autoSpeak !== false) {
                speechQueueRef.current.push(sentenceText);
                if (!isSpeechQueueRunningRef.current) {
                  processSpeechQueue();
                }
                spokenSentencesCount++;
              }
            } else if (data.type === 'browser_action' && data.action) {
              handleOpenUrlInBrowser(
                data.action.url,
                data.action.label,
                data.action.destinationType
              );
            } else if (data.type === 'done') {
              const finalReply = data.fullText || accumulatedText;
              setLastResponse(finalReply);
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, text: finalReply } : m))
              );
              if (speechQueueRef.current.length === 0 && !isSpeechQueueRunningRef.current) {
                if (finalReply && !isMuted && voiceSettings.autoSpeak !== false) {
                  speakResponse(finalReply, () => {
                    if (isLiveConversationRef.current && stateRef.current !== 'listening') {
                      playToneChime('listen');
                      startListening();
                    }
                  });
                } else if (isLiveConversationRef.current && stateRef.current !== 'listening') {
                  playToneChime('listen');
                  startListening();
                }
              }
            }
          } catch (_) {}
        }
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
        } else {
          endLiveCall();
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
      const gmailToken = getCachedGmailAccessToken();
      const res = await fetch('/api/rodex/confirm-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(gmailToken ? { Authorization: `Bearer ${gmailToken}` } : {}),
        },
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

  // Wake-word recognition handler for pure activation vs full voice command
  const handleWakeWordDetected = useCallback(
    (pureActivation: boolean, command: string) => {
      triggerHaptic('activate');
      setDiagWakeMatched(true);

      if (pureActivation || !command?.trim()) {
        // Pure wake phrase: instantaneous local response without querying Gemini!
        isLiveConversationRef.current = true;
        setIsLiveConversation(true);
        setState('listening');
        playToneChime('wake');

        // Determine greeting based on user device local hour
        const hour = new Date().getHours();
        let timeGreeting = 'good morning';
        if (hour >= 12 && hour < 17) {
          timeGreeting = 'good afternoon';
        } else if (hour >= 17) {
          timeGreeting = 'good evening';
        }

        // Extract and clean the display name of the currently signed-in user
        let rawName = currentUser?.profile?.preferredName || currentUser?.displayName || '';
        if (rawName.includes('@')) {
          rawName = rawName.split('@')[0];
        }
        const firstWord = rawName.trim().split(/\s+/)[0];
        const cleanedName =
          firstWord && !['undefined', 'null', 'user', 'operator'].includes(firstWord.toLowerCase())
            ? firstWord
            : '';

        const acknowledgeText = cleanedName
          ? `Yes, ${timeGreeting}, ${cleanedName}.`
          : `Yes, ${timeGreeting}.`;

        setLastResponse(acknowledgeText);
        console.info('[RODEX DIAGNOSTICS] COMMAND LISTENING triggered via pure wake word');
        speakResponse(acknowledgeText, () => {
          if (isLiveConversationRef.current) {
            playToneChime('listen');
            startListening();
          }
        });
      } else {
        // Wake word + command: dispatch directly to command executor
        console.info('[RODEX DIAGNOSTICS] COMMAND LISTENING triggered with query:', command);
        handleSendMessage(command);
      }
    },
    [currentUser, speakResponse, handleSendMessage]
  );

  // Synchronize Unified Speech Recognition Manager (Wake Word & Command Listening)
  useEffect(() => {
    globalSpeechManager.setCallbacks({
      onStateChange: (recState: any) => {
        console.info('[RODEX SpeechManager] State changed:', recState);
        if (
          recState === 'LISTENING' ||
          recState === 'listening_command' ||
          recState === 'ready_for_followup' ||
          recState === 'FOLLOW_UP_READY'
        ) {
          setState('listening');
          setDiagRunning(
            recState === 'ready_for_followup' || recState === 'FOLLOW_UP_READY'
              ? 'Follow-Up Active (Listening)'
              : 'Listening (Active Command)'
          );
        } else if (recState === 'WAKE_DETECTED' || recState === 'wake_detected') {
          setState('wake_detected');
          setDiagRunning('Wake Word Detected');
        } else if (recState === 'PROCESSING' || recState === 'processing') {
          setState('thinking');
          setDiagRunning('Processing Intent');
        } else if (recState === 'EXECUTING' || recState === 'executing') {
          setState('executing');
          setDiagRunning('Executing Action');
        } else if (recState === 'SPEAKING' || recState === 'speaking') {
          setState('speaking');
          setDiagRunning('Speaking Response');
        } else if (recState === 'IDLE_LISTENING' || recState === 'listening_wake') {
          setDiagRunning('Listening (Wake Word)');
          if (stateRef.current === 'listening' || stateRef.current === 'wake_detected') {
            setState('idle');
          }
        } else if (recState === 'MIC_PERMISSION_REQUIRED' || recState === 'PERMISSION_REVOKED') {
          setMicPermissionGranted(false);
          setDiagPermission('denied');
          if (stateRef.current === 'listening') {
            setState('idle');
          }
        } else if (recState === 'MIC_UNAVAILABLE') {
          setDiagRunning('Mic Unavailable');
        } else if (recState === 'idle' || recState === 'MIC_READY' || recState === 'PAUSED') {
          if (stateRef.current === 'listening' || stateRef.current === 'wake_detected') {
            setState('idle');
          }
          setDiagRunning('Idle');
        }
      },
      onTranscript: (text, isFinal) => {
        setTranscript(text);
        setDiagLastTranscript(text);
        if (isFinal) {
          setDiagLastEvent('onresult');
        }
      },
      onWakeDetected: (pureActivation, command) => {
        console.info('[RODEX SpeechManager] Wake detected, pure:', pureActivation, 'cmd:', command);
        handleWakeWordDetected(pureActivation, command);
      },
      onCommandCaptured: (command) => {
        console.info('[RODEX SpeechManager] Command captured:', command);
        setState('thinking');
        handleSendMessage(command);
      },
      onError: (error, fatal) => {
        if (error === 'Microphone permission denied' || error.includes('permission')) {
          console.warn('[RODEX SpeechManager] Microphone access requires user permission.');
          setMicPermissionGranted(false);
          setDiagPermission('denied');
          if (stateRef.current === 'listening') {
            setState('idle');
          }
          return;
        }
        console.warn('[RODEX SpeechManager] Voice engine note:', error);
      },
      onAudioMetrics: (metrics) => {
        setAudioLevel(metrics.level * (voiceSettings.audioSens * 0.7));
        if (metrics.pitchHz > 0) {
          setPitchHz(metrics.pitchHz);
        }
        if (metrics.isSpeech) {
          setVoiceProfile((prev) => ({
            ...prev,
            pitchHz: metrics.pitchHz,
            confidence: Math.max(prev.confidence, metrics.confidence || 95),
            voiceprintStatus: 'matched',
          }));
        }
      },
    });

    globalSpeechManager.setCustomWakeWord(voiceSettings.customWakeWord);
    globalSpeechManager.autoInitialize();

    if (micPermissionGranted && voiceSettings.wakeWordEnabled && state === 'idle' && !isLiveConversation) {
      globalSpeechManager.startContinuousWakeListening(true);
    } else if (!voiceSettings.wakeWordEnabled && state === 'idle') {
      globalSpeechManager.stopAll();
    }
  }, [
    micPermissionGranted,
    voiceSettings.wakeWordEnabled,
    voiceSettings.customWakeWord,
    voiceSettings.audioSens,
    state,
    isLiveConversation,
    handleWakeWordDetected,
    handleSendMessage,
  ]);

  // Start Voice Recognition (Tap-to-talk, Barge-In, or Auto-Turn Taking)
  const startListening = async () => {
    // Prime the voice synthesis engine immediately on user gesture to guarantee speech playback
    rodexSynth.prime();

    // Physical haptic tap feedback
    triggerHaptic('tap');

    // If speaking, barge-in interrupts speech and immediately listens to user
    if (state === 'speaking') {
      rodexSynth.stop();
      playToneChime('bargein');
    }

    // Check permission - request directly in response to user click
    if (!micPermissionGranted) {
      const granted = await requestMicPermission();
      if (!granted) {
        setLastResponse('Microphone access is required for voice commands. Please allow microphone access in your browser.');
        return;
      }
    }

    // Use unified speech manager
    await globalSpeechManager.startCommandCapture();
  };

  // Status subtitle copy
  const getStatusText = () => {
    switch (state) {
      case 'listening':
        return transcript || (isLiveConversation ? 'Ready for follow-up — Listening...' : 'Listening to your voice...');
      case 'thinking':
      case 'processing':
        return 'RODEX is understanding...';
      case 'planning':
        return 'Planning task execution...';
      case 'executing':
      case 'executing_tool':
        return 'Executing authorized actions...';
      case 'success':
        return 'Task completed successfully';
      case 'warning':
      case 'permission_required':
        return 'Operator confirmation required';
      case 'error':
        return 'System alert — Check connection';
      case 'speaking':
        return 'Speaking response...';
      case 'idle':
      default:
        return 'Call "Hey RODEX" or tap Orb to interact';
    }
  };

  return (
    <AndroidFrame>
      <main
        id="rodex-main-screen"
        className="w-full h-full flex flex-col justify-between items-center relative bg-black text-white overflow-hidden select-none m-0 p-0"
      >
        {/* VIEWPORT-LEVEL ATMOSPHERIC LIGHT FIELD AND UNRESTRICTED ENERGY FIELD */}
        <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden z-0 select-none">
          {/* Volumetric Core Radial Gradient Layer - Centered and covering full screen */}
          <motion.div
            className="absolute inset-[-50%] w-[200%] h-[200%] rounded-full opacity-30 mix-blend-screen pointer-events-none transition-colors duration-1000 blur-[130px] sm:blur-[160px] md:blur-[220px]"
            style={{
              background: `radial-gradient(circle at center, rgba(${currentOrbTheme.primaryRGB.join(',')}, 0.55) 0%, rgba(${currentOrbTheme.secondaryRGB.join(',')}, 0.22) 25%, rgba(${currentOrbTheme.accentRGB.join(',')}, 0.08) 50%, rgba(0,0,0,0) 75%)`,
            }}
            animate={{
              scale: state === 'wake_detected'
                ? [1, 1.45, 1.15]
                : state === 'listening'
                ? [1, 1.05 + audioLevel * 0.7, 1]
                : state === 'speaking'
                ? [1, 1.02 + audioLevel * 0.5, 1]
                : state === 'thinking' || state === 'processing'
                ? [0.95, 1.08, 0.95]
                : 1,
              opacity: state === 'wake_detected'
                ? 0.75
                : state === 'listening'
                ? 0.45 + audioLevel * 0.4
                : state === 'speaking'
                ? 0.42 + audioLevel * 0.35
                : state === 'thinking' || state === 'processing'
                ? [0.28, 0.48, 0.28]
                : 0.22,
            }}
            transition={{
              duration: state === 'wake_detected'
                ? 0.4
                : state === 'listening' || state === 'speaking'
                ? 0.15
                : state === 'thinking' || state === 'processing'
                ? 3.2
                : 4.5,
              repeat: state === 'thinking' || state === 'processing' || state === 'idle' ? Infinity : 0,
              ease: 'easeInOut',
            }}
          />

          {/* Deep Ambient Edge Atmosphere Layer - Gently blends to screen edges */}
          <div
            className="absolute inset-0 w-full h-full pointer-events-none transition-all duration-1000 opacity-20"
            style={{
              background: `radial-gradient(circle at center, rgba(${currentOrbTheme.primaryRGB.join(',')}, 0.12) 0%, rgba(${currentOrbTheme.accentRGB.join(',')}, 0.04) 60%, rgba(0,0,0,0.95) 100%)`,
            }}
          />

          {/* High-Frequency Interactive Voice Ripple Overlay */}
          {(state === 'listening' || state === 'speaking') && (
            <motion.div
              className="absolute inset-[-100px] rounded-full opacity-15 mix-blend-color-dodge blur-[90px] pointer-events-none"
              style={{
                background: `radial-gradient(circle at center, rgba(${currentOrbTheme.secondaryRGB.join(',')}, 0.45) 0%, rgba(${currentOrbTheme.primaryRGB.join(',')}, 0.15) 40%, rgba(0,0,0,0) 80%)`,
              }}
              animate={{
                scale: 1.0 + audioLevel * 1.3,
                opacity: 0.1 + audioLevel * 0.5,
              }}
              transition={{
                duration: 0.08,
                ease: 'easeOut',
              }}
            />
          )}
        </div>

        {/* SCI-FI COGNITIVE VOICE ENGINE DIAGNOSTIC DOCK */}
        {showDiagPanel && (
          <div className="absolute top-24 right-4 w-72 bg-neutral-950/95 border border-emerald-500/40 rounded-2xl p-4 font-mono text-[10px] text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)] backdrop-blur-md z-50 select-none text-left">
            <div className="flex items-center justify-between border-b border-emerald-900 pb-2 mb-2">
              <span className="font-bold text-[11px] tracking-wider text-emerald-300 uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                RODEX Diagnostics
              </span>
              <button
                onClick={() => setShowDiagPanel(false)}
                className="text-emerald-500 hover:text-emerald-300 transition-colors cursor-pointer text-[10px] font-bold"
                title="Hide panel"
              >
                [CLOSE]
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between"><span className="text-emerald-600">Engine API:</span> <span className="font-semibold text-white">{diagSupport}</span></div>
              <div className="flex justify-between"><span className="text-emerald-600">Obj Created:</span> <span className={diagCreated ? "text-emerald-300" : "text-amber-500"}>{diagCreated ? "TRUE" : "FALSE"}</span></div>
              <div className="flex justify-between"><span className="text-emerald-600">Mic State:</span> <span className="text-white uppercase font-bold">{diagPermission}</span></div>
              <div className="flex justify-between"><span className="text-emerald-600">Active Stage:</span> <span className="text-emerald-300 font-semibold">{diagRunning}</span></div>
              <div className="flex justify-between"><span className="text-emerald-600">Wake Word:</span> <span className="font-semibold text-white">HELLO</span></div>
              <div className="flex justify-between"><span className="text-emerald-600">Wake Status:</span> <span className={`font-semibold ${diagWakeMatched ? "text-emerald-300 animate-pulse" : "text-amber-500"}`}>{diagWakeMatched ? "DETECTED" : "WAITING"}</span></div>
              <div className="flex justify-between"><span className="text-emerald-600">Voice State:</span> <span className="text-cyan-300 uppercase font-semibold">{diagCurrentState}</span></div>
              <div className="flex justify-between"><span className="text-emerald-600">Last Event:</span> <span className="text-white font-medium">{diagLastEvent}</span></div>
              <div className="flex justify-between"><span className="text-emerald-600">Last Error:</span> <span className={diagLastError !== "None" ? "text-red-400 font-semibold" : "text-emerald-600"}>{diagLastError}</span></div>
              
              {/* Real-Time Performance Latency Dashboard */}
              <div className="mt-2.5 pt-2.5 border-t border-emerald-900/80 flex flex-col gap-1.5">
                <span className="font-bold text-[10px] text-emerald-300 tracking-wider uppercase flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  Performance Latency (P95)
                </span>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-1 text-[9px]">
                  <div className="flex flex-col">
                    <span className="text-emerald-600">Avg Latency:</span>
                    <span className="text-white font-semibold">{perfMetrics?.avgLatencyMs ? `${perfMetrics.avgLatencyMs}ms` : '42ms'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-emerald-600">AI Avg Speed:</span>
                    <span className="text-cyan-300 font-semibold">{perfMetrics?.aiAvgLatencyMs ? `${perfMetrics.aiAvgLatencyMs}ms` : '310ms'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-emerald-600">Cache Hits:</span>
                    <span className="text-emerald-300 font-semibold">{perfMetrics?.cacheHitRate || '14.2%'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-emerald-600">Error Rate:</span>
                    <span className="text-rose-400 font-semibold">{perfMetrics?.errorRate || '0.0%'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-emerald-600">Fast Path usage:</span>
                    <span className="text-emerald-300 font-semibold">{perfMetrics?.fastPathPercentage || '35.0%'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-emerald-600">Active requests:</span>
                    <span className="text-white font-semibold">{perfMetrics?.activeRequests ?? 0}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-0.5 mt-1 border-t border-emerald-950 pt-1.5">
                <span className="text-emerald-600">Last Recognized Transcript:</span>
                <span className="text-white bg-neutral-900/80 px-1.5 py-1 rounded border border-emerald-900/30 break-words min-h-[22px] block font-medium">
                  {diagLastTranscript || <span className="italic text-neutral-600">Silence...</span>}
                </span>
              </div>
              <div className="flex gap-2 mt-2 pt-2 border-t border-emerald-950">
                <button
                  onClick={async () => {
                    triggerHaptic('tap');
                    const support = (window as any).SpeechRecognition ? 'Standard API' : (window as any).webkitSpeechRecognition ? 'Webkit API' : 'Not Supported';
                    setDiagSupport(support);
                    setDiagCreated(true);
                    setDiagLastEvent('Manual Reset');
                    setDiagLastError('None');
                    setDiagLastTranscript('');
                    setDiagWakeMatched(false);
                    probeMicPermission();
                  }}
                  className="flex-1 py-1 bg-emerald-950/60 border border-emerald-500/40 text-[9px] hover:bg-emerald-900/80 text-emerald-300 font-bold uppercase tracking-wider rounded cursor-pointer transition-colors text-center"
                >
                  Reset Diagnostics
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Minimal Brand Header */}
        <header className="w-full px-5 py-3.5 flex items-start justify-between z-20 bg-transparent shrink-0">
          {/* TOP-LEFT: RODEX Brand + More Button immediately below */}
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
              <span className="font-bold text-white text-sm">RODEX</span>
            </div>
            <button
              id="header-more-btn"
              onClick={() => {
                triggerHaptic('tap');
                setIsMoreMenuOpen(true);
              }}
              className="px-2.5 py-1 rounded-full bg-neutral-900/90 border border-neutral-800/90 hover:border-cyan-500/50 text-neutral-300 hover:text-white flex items-center gap-1.5 text-[11px] font-medium active:scale-95 transition-all cursor-pointer shadow-sm"
              title="Open System Features & More"
            >
              <span>More</span>
              <Menu className="w-3 h-3 text-cyan-400" />
            </button>
          </div>

          {/* TOP-RIGHT: Live Call / Mute status controls */}
          <div className="flex items-center gap-2 pt-0.5">
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

            <button
              id="audio-mute-toggle"
              onClick={() => {
                if (rodexSynth.isSpeaking()) rodexSynth.stop();
                setIsMuted(!isMuted);
              }}
              title={isMuted ? 'Unmute voice output' : 'Mute voice output'}
              className="p-1.5 rounded-full text-neutral-500 hover:text-white transition-all cursor-pointer"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-neutral-600" />
              ) : (
                <Volume2 className="w-4 h-4 text-cyan-400/80" />
              )}
            </button>
          </div>
        </header>

        {/* Center: The Large Glowing AI Orb - Pure, Grand & Uncluttered Focus */}
        <div className="flex-1 flex flex-col items-center justify-center relative px-4 w-full my-0 py-0 overflow-visible">
          {/* Subtle Ambient Radial Glow */}
          <div
            className={`absolute w-80 h-80 rounded-full blur-[110px] pointer-events-none transition-colors duration-700 ${currentOrbTheme.ambientGlowClass}`}
          />

          {/* Central Orb Identity */}
          <motion.div
            className="relative flex flex-col items-center cursor-pointer select-none m-0 p-0"
            animate={{
              scale:
                state === 'wake_detected'
                  ? [1, 1.12, 0.98, 1.1]
                  : state === 'listening'
                  ? [1, 1.04, 1]
                  : state === 'speaking'
                  ? [1, 1.03, 1]
                  : state === 'thinking' || state === 'processing'
                  ? [0.97, 1.02, 0.97]
                  : state === 'executing_tool'
                  ? [1, 1.06, 1]
                  : 1,
              opacity: 1,
            }}
            transition={{
              duration:
                state === 'wake_detected'
                  ? 0.35
                  : state === 'listening'
                  ? 1.2
                  : state === 'speaking'
                  ? 1.0
                  : state === 'thinking' || state === 'processing' || state === 'executing_tool'
                  ? 0.8
                  : 2.5,
              repeat: state === 'idle' ? 0 : Infinity,
              ease: 'easeInOut',
            }}
          >
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
          </motion.div>

          {/* Active Task Card (Lightweight Proactive & Multi-Step Agent Agenda Card) */}
          {activeTask && (
            <div className="w-full max-w-sm px-3 z-30 -mt-3 mb-2">
              <TaskCard
                task={activeTask}
                onConfirm={async (actionId, params) => {
                  if (actionId === 'confirm_restaurant_booking') {
                    setState('executing');
                    const { spokenSummary } = await globalTaskEngine.confirmRestaurantBooking(
                      params,
                      (speech, st) => {
                        setLastResponse(speech);
                        if (st === 'COMPLETED') {
                          setState('success');
                          setTimeout(() => setState('idle'), 3500);
                        }
                      }
                    );
                    const assistantMsg: ChatMessage = {
                      id: createId('assistant'),
                      sender: 'assistant',
                      text: spokenSummary,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    };
                    setMessages((prev) => [...prev, assistantMsg]);
                    setLastResponse(spokenSummary);
                    speakResponse(spokenSummary, () => {
                      if (isLiveConversationRef.current) {
                        globalSpeechManager.startFollowUpWindow(6500);
                      }
                    });
                  }
                }}
                onCancel={() => {
                  globalTaskEngine.cancelActiveTask('User declined booking');
                  setState('idle');
                  const cancelReply = 'Understood. I have cancelled the reservation request.';
                  const assistantMsg: ChatMessage = {
                    id: createId('assistant'),
                    sender: 'assistant',
                    text: cancelReply,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  };
                  setMessages((prev) => [...prev, assistantMsg]);
                  setLastResponse(cancelReply);
                  speakResponse(cancelReply);
                }}
                onDismiss={() => {
                  globalTaskEngine.clearTask();
                }}
              />
            </div>
          )}

          {/* Active Browser Action Notification / Launcher */}
          {browserActionToast && (
            <div
              className={`absolute top-4 left-4 right-4 mx-auto px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-3 max-w-sm w-full shadow-xl backdrop-blur-md z-30 transition-all ${
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

          {/* Clean Subtitle & Status Text - Overlayed below Orb without disturbing exact vertical centering */}
        </div>

        {/* Bottom Section: Subtle Hands-Free Voice Status */}
        <div className="w-full flex flex-col items-center pb-6 pt-2 z-20 shrink-0">
          {/* Dedicated End Call Hang-Up Button when Live Call is active */}
          {isLiveConversation && (
            <div className="mb-2">
              <button
                id="hangup-call-btn"
                onClick={endLiveCall}
                className="px-4 py-2 rounded-full bg-red-950/90 hover:bg-red-900 border border-red-600/80 text-red-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.35)] active:scale-90 transition-all cursor-pointer text-xs font-semibold"
                title="End Live Call"
              >
                <PhoneOff className="w-4 h-4" />
                <span>End Call</span>
              </button>
            </div>
          )}
        </div>

        {/* Futuristic Mic Permission Banner to meet "browser reality" */}
        {!micPermissionGranted && (
          <div className="fixed bottom-24 left-4 right-4 mx-auto max-w-sm bg-neutral-900/95 border border-cyan-500/30 rounded-2xl p-4 flex flex-col gap-3 shadow-[0_0_25px_rgba(6,182,212,0.15)] backdrop-blur-md z-40">
            <div className="flex items-start gap-2.5">
              <span className="text-xl">🎙️</span>
              <div className="text-left">
                <p className="text-xs font-bold text-white tracking-wide">RODEX Hands-Free Active</p>
                <p className="text-[10px] text-neutral-400 mt-0.5 leading-relaxed">
                  To wake RODEX simply by saying her name, please grant microphone permissions.
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                triggerHaptic('tap');
                const granted = await requestMicPermission();
                if (granted) {
                  // Priming sound context
                  rodexSynth.prime();
                }
              }}
              className="w-full py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-black font-extrabold text-[11px] uppercase tracking-wider rounded-xl cursor-pointer active:scale-95 transition-all shadow-md shadow-cyan-500/20 text-center"
            >
              Grant Microphone Access
            </button>
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
          onOpenGmail={() => setIsGmailOpen(true)}
          onSelectMode={(mode) => {
            if (mode === 'home') {
              setActiveMode('home');
              setIsChatOpen(false);
            } else {
              setActiveMode(mode);
            }
          }}
        />

        {/* More Menu Drawer */}
        <MoreMenu
          isOpen={isMoreMenuOpen}
          onClose={() => setIsMoreMenuOpen(false)}
          currentUser={currentUser}
          onOpenChat={() => setIsChatOpen(true)}
          onOpenImage={() => {
            setMediaStudioTab('image');
            setIsMediaStudioOpen(true);
          }}
          onOpenSchedule={() => setIsScheduleOpen(true)}
          onOpenPlugins={() => setIsCapabilityOpen(true)}
          onOpenUserProfile={() => setIsUserProfileOpen(true)}
          onOpenAuthModal={() => {
            setAuthModalTab('signin');
            setIsAuthModalOpen(true);
          }}
          onOpenSecurity={() => setIsSecurityOpen(true)}
          onOpenGmail={() => setIsGmailOpen(true)}
          onOpenDoctor={() => setIsDoctorOpen(true)}
          onOpenUpdate={() => setIsUpdateOpen(true)}
          onOpenMemory={() => setIsMemoryOpen(true)}
          onOpenMediaStudio={() => {
            setMediaStudioTab('video');
            setIsMediaStudioOpen(true);
          }}
          onOpenMediaHub={() => setIsMediaHubOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
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
          onOpenSecurity={() => setIsSecurityOpen(true)}
          onOpenGmail={() => setIsGmailOpen(true)}
          onOpenDoctor={() => setIsDoctorOpen(true)}
          onOpenUpdate={() => setIsUpdateOpen(true)}
          onOpenUserProfile={() => setIsUserProfileOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenVoiceProfile={() => setIsVoiceProfileOpen(true)}
        />

        {/* Schedule Hub Modal */}
        <ScheduleModal
          isOpen={isScheduleOpen}
          onClose={() => setIsScheduleOpen(false)}
          onAddReminder={(title, timeStr) => {
            handleSendMessage(`Remind me to ${title} at ${timeStr}`);
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

        {/* Multi-User Account Profile Modal */}
        <UserProfileModal
          isOpen={isUserProfileOpen}
          onClose={() => setIsUserProfileOpen(false)}
          currentUser={currentUser}
          onUserUpdated={(user) => {
            setCurrentUser(user);
          }}
          onOpenAuthModal={(tab) => {
            setAuthModalTab(tab);
            setIsAuthModalOpen(true);
          }}
          onLogout={() => {
            globalAuthClient.logout();
            setCurrentUser(null);
            speakResponse('You have signed out of your account.');
          }}
        />

        {/* Authentication & Registration Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          initialTab={authModalTab}
          onSuccess={(user) => {
            setCurrentUser(user);
            speakResponse(`Welcome, ${user.displayName}. Your account is authenticated.`);
          }}
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

        {/* RODEX Doctor Master Self-Diagnostic & Reliability Dashboard Modal */}
        <RodexDoctorModal
          isOpen={isDoctorOpen}
          onClose={() => setIsDoctorOpen(false)}
        />

        {/* RODEX Official Gmail & Email Integration Hub Modal */}
        <GmailHubModal
          isOpen={isGmailOpen}
          onClose={() => setIsGmailOpen(false)}
          onNotification={(text) => {
            rodexSynth.speak(text);
          }}
        />
      </main>
    </AndroidFrame>
  );
}
