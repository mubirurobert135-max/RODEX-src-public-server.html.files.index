import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Monitor,
  Laptop,
  Smartphone,
  Speaker,
  Search,
  ExternalLink,
  Copy,
  Check,
  Disc,
  Radio,
  Sliders,
  Sparkles,
  Info,
  LogOut,
  RefreshCw,
  Music2,
} from 'lucide-react';
import { SpotifyStatus, SpotifyDevice } from '../types';
import { triggerHaptic } from '../utils/haptics';

interface SpotifyPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSpeakStatus?: (text: string) => void;
}

export const SpotifyPlayerModal: React.FC<SpotifyPlayerModalProps> = ({
  isOpen,
  onClose,
  onSpeakStatus,
}) => {
  const [status, setStatus] = useState<SpotifyStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [volume, setVolume] = useState<number>(75);
  const [copiedCallback, setCopiedCallback] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch current Spotify state from server
  const fetchSpotifyStatus = async () => {
    try {
      const res = await fetch('/api/spotify/status');
      if (res.ok) {
        const data: SpotifyStatus = await res.json();
        setStatus(data);
        if (data.playback?.device?.volume_percent !== undefined) {
          setVolume(data.playback.device.volume_percent);
        } else if (data.device?.volume_percent !== undefined) {
          setVolume(data.device.volume_percent);
        }
      }
    } catch (err) {
      console.warn('[Spotify] Failed to fetch status:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSpotifyStatus();
      pollIntervalRef.current = setInterval(fetchSpotifyStatus, 3500);
    } else {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen]);

  // Listen for OAuth completion from the popup window per oauth-integration guidelines
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.provider === 'spotify') {
        triggerHaptic('activate');
        showToast('Spotify linked with full access! PC control active.');
        fetchSpotifyStatus();
        onSpeakStatus?.('Hlo Mr Robert. Spotify is successfully linked. You have full control over your PC playback.');
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        showToast(`Spotify Auth Error: ${event.data?.error || 'Failed'}`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Connect Spotify via direct provider popup per oauth-integration skill
  const handleConnectSpotify = async () => {
    setLoading(true);
    try {
      triggerHaptic('tap');
      const res = await fetch('/api/spotify/auth-url');
      if (!res.ok) throw new Error('Could not generate Spotify authorization URL.');
      const data = await res.json();

      if (!data.url) throw new Error('No authorization URL returned.');

      // Open OAuth provider URL directly in popup
      const authWindow = window.open(
        data.url,
        'spotify_oauth_popup',
        'width=600,height=750,menubar=no,toolbar=no,location=no,status=no'
      );

      if (!authWindow) {
        showToast('Please allow popups in your browser to authorize Spotify.');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to start Spotify connection.');
    } finally {
      setLoading(false);
    }
  };

  // Disconnect Spotify
  const handleDisconnect = async () => {
    try {
      triggerHaptic('tap');
      await fetch('/api/spotify/disconnect', { method: 'POST' });
      showToast('Spotify disconnected.');
      fetchSpotifyStatus();
    } catch (err) {
      console.error(err);
    }
  };

  // Execute playback commands
  const handleCommand = async (
    action: 'play' | 'pause' | 'next' | 'previous' | 'volume' | 'transfer' | 'search_and_play',
    params?: { query?: string; volumePercent?: number; deviceId?: string }
  ) => {
    setActionLoading(true);
    triggerHaptic('tap');
    try {
      const res = await fetch('/api/spotify/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          query: params?.query,
          volumePercent: params?.volumePercent,
          deviceId: params?.deviceId,
        }),
      });

      const data = await res.json();
      if (data.message) {
        showToast(data.message);
      }
      setTimeout(fetchSpotifyStatus, 600);
    } catch (err: any) {
      showToast(err?.message || 'Command failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setVolume(val);
  };

  const handleVolumeCommit = () => {
    handleCommand('volume', { volumePercent: volume });
  };

  const handleSearchAndPlay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    handleCommand('search_and_play', { query: searchQuery.trim() });
    setSearchQuery('');
  };

  const copyCallbackUrl = () => {
    const callbackUrl =
      status?.redirectUri ||
      `${window.location.origin}/auth/spotify/callback`;
    navigator.clipboard.writeText(callbackUrl);
    setCopiedCallback(true);
    triggerHaptic('tap');
    setTimeout(() => setCopiedCallback(false), 2500);
  };

  const getDeviceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'computer':
        return <Monitor className="w-4 h-4 text-emerald-400" />;
      case 'smartphone':
        return <Smartphone className="w-4 h-4 text-cyan-400" />;
      case 'speaker':
        return <Speaker className="w-4 h-4 text-amber-400" />;
      default:
        return <Laptop className="w-4 h-4 text-emerald-400" />;
    }
  };

  const formatMs = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!isOpen) return null;

  const playback = status?.playback;
  const isPlaying = Boolean(playback?.isPlaying);
  const activeDevice = status?.device || playback?.device;
  const isConnected = Boolean(status?.connected);
  const progressPercent = playback && playback.durationMs > 0
    ? Math.min(100, Math.round((playback.progressMs / playback.durationMs) * 100))
    : 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg max-h-[92vh] flex flex-col bg-neutral-950 border border-emerald-950/80 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden text-neutral-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-900 bg-neutral-950/80">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-950/90 border border-emerald-800/80 flex items-center justify-center shadow-lg shadow-emerald-950/50">
                <Music2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-wide">Spotify PC Access</h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                    {isConnected ? 'PC LINKED' : 'READY TO CONNECT'}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 flex items-center gap-1.5 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'}`} />
                  <span>
                    {activeDevice
                      ? `${activeDevice.name} (${activeDevice.type})`
                      : "Mr. Robert's PC (Spotify Desktop)"}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={fetchSpotifyStatus}
                title="Refresh Status"
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {notification && (
            <div className="bg-emerald-950/90 border-b border-emerald-800/80 px-4 py-2 text-xs text-emerald-300 flex items-center justify-between transition-all">
              <span className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{notification}</span>
              </span>
              <button onClick={() => setNotification(null)} className="text-emerald-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Active Player Card */}
            <div className="relative rounded-2xl bg-gradient-to-b from-neutral-900/90 to-neutral-950 border border-emerald-950/60 p-4 shadow-xl overflow-hidden">
              {/* Subtle ambient blur glow */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center gap-4">
                {/* Album Art with Vinyl spin */}
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 shrink-0 shadow-lg">
                  {playback?.albumArtUrl ? (
                    <img
                      src={playback.albumArtUrl}
                      alt={playback.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-900">
                      <Disc className={`w-10 h-10 text-emerald-500/70 ${isPlaying ? 'animate-spin' : ''}`} />
                    </div>
                  )}
                  {isPlaying && (
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[9px] text-emerald-400 font-bold border border-emerald-800/80 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      PLAYING
                    </div>
                  )}
                </div>

                {/* Track Details */}
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <Monitor className="w-3 h-3" />
                    <span>PC Output Active</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white truncate mt-0.5">
                    {playback?.name || 'No song playing'}
                  </h3>
                  <p className="text-xs text-neutral-400 truncate">
                    {playback?.artists?.join(', ') || 'Select a track or ask RODEX to play music on PC'}
                  </p>
                  {playback?.album && (
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                      Album: {playback.album}
                    </p>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4 space-y-1">
                <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                  <span>{formatMs(playback?.progressMs || 0)}</span>
                  <span>{formatMs(playback?.durationMs || 0)}</span>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="mt-4 flex items-center justify-center gap-4">
                <button
                  onClick={() => handleCommand('previous')}
                  disabled={actionLoading}
                  className="p-2.5 rounded-full bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 transition-all active:scale-95 cursor-pointer"
                  title="Previous Song"
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                <button
                  onClick={() => handleCommand(isPlaying ? 'pause' : 'play')}
                  disabled={actionLoading}
                  className="p-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/30 transition-all active:scale-95 cursor-pointer"
                  title={isPlaying ? 'Pause Spotify' : 'Play Spotify'}
                >
                  {isPlaying ? <Pause className="w-6 h-6 fill-black" /> : <Play className="w-6 h-6 fill-black ml-0.5" />}
                </button>

                <button
                  onClick={() => handleCommand('next')}
                  disabled={actionLoading}
                  className="p-2.5 rounded-full bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 transition-all active:scale-95 cursor-pointer"
                  title="Next Song"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>

              {/* Volume Slider */}
              <div className="mt-4 pt-3 border-t border-neutral-850 flex items-center gap-3">
                <button
                  onClick={() => handleCommand('volume', { volumePercent: volume === 0 ? 70 : 0 })}
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={handleVolumeChange}
                  onMouseUp={handleVolumeCommit}
                  onTouchEnd={handleVolumeCommit}
                  className="flex-1 accent-emerald-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
                <span className="text-xs font-mono text-neutral-400 w-9 text-right">{volume}%</span>
              </div>
            </div>

            {/* Search & Play on PC Form */}
            <form onSubmit={handleSearchAndPlay} className="space-y-2">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-emerald-400" />
                <span>Search & Instant Play on PC</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Song, artist, or playlist (e.g. Starboy, The Weeknd, Lofi)..."
                  className="flex-1 bg-neutral-900 text-neutral-200 text-sm px-4 py-2.5 rounded-xl border border-neutral-800 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!searchQuery.trim() || actionLoading}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold text-xs hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 transition-all active:scale-95 shrink-0"
                >
                  Play on PC
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'Starboy The Weeknd',
                  'Blinding Lights',
                  'Lofi Study Beats',
                  'Daft Punk Get Lucky',
                  'Viva La Vida Coldplay',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleCommand('search_and_play', { query: preset })}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 hover:text-emerald-400 transition-colors"
                  >
                    ▶ {preset}
                  </button>
                ))}
              </div>
            </form>

            {/* PC Devices Detected */}
            <div className="rounded-2xl bg-neutral-900/60 border border-neutral-850 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-300 flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-emerald-400" />
                  <span>Available Hardware & PC Connect Devices</span>
                </span>
                <button
                  onClick={() => handleCommand('transfer')}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  Route to This PC &rarr;
                </button>
              </div>

              <div className="space-y-2">
                {status?.devices && status.devices.length > 0 ? (
                  status.devices.map((dev) => (
                    <div
                      key={dev.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        dev.is_active
                          ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                          : 'bg-neutral-950 border-neutral-850 text-neutral-400 hover:border-neutral-750'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {getDeviceIcon(dev.type)}
                        <div>
                          <div className="text-xs font-medium text-white flex items-center gap-1.5">
                            <span>{dev.name}</span>
                            {dev.type.toLowerCase() === 'computer' && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-800 text-emerald-400 font-mono">
                                PC
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-400">
                            {dev.type} • Volume {dev.volume_percent}%
                          </div>
                        </div>
                      </div>

                      {dev.is_active ? (
                        <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800">
                          ACTIVE
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCommand('transfer', { deviceId: dev.id })}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-emerald-600 text-white transition-colors"
                        >
                          Select
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-xs text-neutral-400">
                    No active Spotify Connect devices currently broadcasting. Open Spotify on your PC to auto-detect.
                  </div>
                )}
              </div>
            </div>

            {/* Voice Control Quick Reference */}
            <div className="rounded-2xl bg-neutral-900/60 border border-neutral-850 p-4 space-y-2.5">
              <span className="text-xs font-semibold text-neutral-300 flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                <span>RODEX Natural Voice Commands for Spotify</span>
              </span>
              <p className="text-[11px] text-neutral-400">
                You can speak naturally to RODEX from the home screen or in live voice mode:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-850 text-neutral-300">
                  🎙️ <strong>"Hey RODEX, play The Weeknd on my PC"</strong>
                </div>
                <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-850 text-neutral-300">
                  🎙️ <strong>"Hey RODEX, pause the music"</strong>
                </div>
                <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-850 text-neutral-300">
                  🎙️ <strong>"Hey RODEX, skip to next song"</strong>
                </div>
                <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-850 text-neutral-300">
                  🎙️ <strong>"Hey RODEX, set volume to 80 on Spotify"</strong>
                </div>
              </div>
            </div>

            {/* Account Link & OAuth Config Section */}
            <div className="rounded-2xl bg-neutral-900/60 border border-neutral-850 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">Spotify Account Authorization</h4>
                  <p className="text-[11px] text-neutral-400">
                    {isConnected
                      ? `Authorized as ${status?.user?.displayName || 'Mr. Robert'}`
                      : 'Authorize RODEX with Spotify OAuth for unrestricted PC control.'}
                  </p>
                </div>

                {isConnected ? (
                  <button
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 rounded-xl bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-800 text-xs font-medium transition-colors flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                ) : (
                  <button
                    onClick={handleConnectSpotify}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 font-semibold text-xs transition-all active:scale-95 shadow-md shadow-emerald-500/20 flex items-center gap-2"
                  >
                    <Music2 className="w-4 h-4" />
                    <span>{loading ? 'Opening Spotify...' : 'Link Spotify Account'}</span>
                  </button>
                )}
              </div>

              {/* Setup Helper / Developer Dashboard instructions */}
              <div className="pt-2 border-t border-neutral-850">
                <button
                  type="button"
                  onClick={() => setShowSetupGuide(!showSetupGuide)}
                  className="text-xs text-neutral-400 hover:text-emerald-400 flex items-center justify-between w-full"
                >
                  <span className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    <span>Spotify Developer Dashboard & Callback Setup Guide</span>
                  </span>
                  <span>{showSetupGuide ? '▲' : '▼'}</span>
                </button>

                {showSetupGuide && (
                  <div className="mt-3 p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3 text-xs text-neutral-300 leading-relaxed">
                    <p className="text-neutral-400">
                      To grant RODEX production access to control Spotify on your PC, configure your Spotify Developer App:
                    </p>

                    <div className="space-y-1.5">
                      <div className="font-semibold text-white">1. Developer Dashboard:</div>
                      <a
                        href="https://developer.spotify.com/dashboard"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-emerald-400 hover:underline"
                      >
                        <span>developer.spotify.com/dashboard</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="space-y-1.5">
                      <div className="font-semibold text-white">2. Exact Redirect Callback URI:</div>
                      <div className="flex items-center gap-2 bg-neutral-900 p-2 rounded-lg font-mono text-[11px] text-emerald-300 break-all border border-neutral-800">
                        <span className="flex-1">
                          {status?.redirectUri || `${window.location.origin}/auth/spotify/callback`}
                        </span>
                        <button
                          type="button"
                          onClick={copyCallbackUrl}
                          className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 shrink-0"
                          title="Copy URI"
                        >
                          {copiedCallback ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-neutral-400">
                        Add this exact URI to <strong>Redirect URIs</strong> in your Spotify app settings.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="font-semibold text-white">3. Environment Variables:</div>
                      <div className="text-[11px] font-mono text-neutral-400 bg-neutral-900 p-2 rounded-lg space-y-1">
                        <div>SPOTIFY_CLIENT_ID=&lt;Your Spotify Client ID&gt;</div>
                        <div>SPOTIFY_CLIENT_SECRET=&lt;Your Spotify Client Secret&gt;</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-neutral-900 bg-neutral-950 flex items-center justify-between text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Disc className="w-3.5 h-3.5 text-emerald-400" />
              <span>Full Spotify Web API & Connect Protocol</span>
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-200 border border-neutral-800 font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
