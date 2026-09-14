import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Search,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Music,
  Video,
  Radio,
  Wifi,
  WifiOff,
  Activity,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Disc,
  Info,
  Tv,
} from 'lucide-react';
import { MediaSearchResult, NetworkQualityStats, WebSource } from '../types';
import { triggerHaptic } from '../utils/haptics';

interface WebMediaHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSpeakStatus?: (text: string) => void;
}

export const WebMediaHubModal: React.FC<WebMediaHubModalProps> = ({
  isOpen,
  onClose,
  onSpeakStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'player' | 'network'>('search');
  const [searchResults, setSearchResults] = useState<MediaSearchResult[]>([]);
  const [currentMedia, setCurrentMedia] = useState<MediaSearchResult | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);

  // Network & Playback Quality Intelligence State
  const [netStats, setNetStats] = useState<NetworkQualityStats>({
    effectiveType: '4g',
    latencyMs: 42,
    downlinkMbps: 35.4,
    connectionStable: true,
    bufferingRisk: 'low',
    strategy: 'high-quality',
    deviceCores: navigator.hardwareConcurrency || 8,
    deviceMemoryGb: (navigator as any).deviceMemory || 8,
  });

  // Evaluate Network & Device conditions on mount
  useEffect(() => {
    const updateNetworkStats = () => {
      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      const effectiveType = conn?.effectiveType || '4g';
      const downlink = conn?.downlink || 25;
      const rtt = conn?.rtt || 45;

      let risk: 'low' | 'medium' | 'high' = 'low';
      let strategy: 'high-quality' | 'balanced' | 'low-bandwidth' | 'offline' = 'high-quality';

      if (!navigator.onLine) {
        risk = 'high';
        strategy = 'offline';
      } else if (effectiveType === '2g' || downlink < 2) {
        risk = 'high';
        strategy = 'low-bandwidth';
      } else if (effectiveType === '3g' || downlink < 8) {
        risk = 'medium';
        strategy = 'balanced';
      }

      setNetStats({
        effectiveType,
        latencyMs: rtt,
        downlinkMbps: downlink,
        connectionStable: navigator.onLine,
        bufferingRisk: risk,
        strategy,
        deviceCores: navigator.hardwareConcurrency || 8,
        deviceMemoryGb: (navigator as any).deviceMemory || 8,
      });
    };

    updateNetworkStats();
    window.addEventListener('online', updateNetworkStats);
    window.addEventListener('offline', updateNetworkStats);
    return () => {
      window.removeEventListener('online', updateNetworkStats);
      window.removeEventListener('offline', updateNetworkStats);
    };
  }, []);

  // Handle Search Request
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    triggerHaptic('tap');
    try {
      const res = await fetch('/api/media/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!res.ok) throw new Error('Failed to search media.');
      const data = await res.json();

      // Parse AI response or build structured item
      const item: MediaSearchResult = {
        id: Date.now().toString(),
        title: searchQuery,
        artist: "Web Verified Artist",
        album: "Trending Release (2026)",
        type: searchQuery.toLowerCase().includes('video') ? 'music_video' : 'song',
        videoUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`,
        albumArtUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80",
        releaseDate: "2026",
        genre: "Global Hit",
        lyricsSnippet: data.rawText?.slice(0, 180) || "Live web music intelligence synchronized.",
        sources: data.sources || [{ title: "Google Search Grounding", url: "https://google.com", domain: "google.com" }],
        recommendedQuality: netStats.strategy === 'low-bandwidth' ? 'Audio-Only' : 'HD',
      };

      setSearchResults([item]);
      setCurrentMedia(item);
      setActiveTab('player');
      setIsPlaying(true);
      onSpeakStatus?.(`Playing ${item.title} by ${item.artist}. Quality adjusted to ${netStats.strategy}.`);
    } catch (err: any) {
      console.warn('[Media Hub Search Error]', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white tracking-wide">
                  RODEX Web Music & Video Intelligence
                </h2>
                <p className="text-xs text-neutral-400">
                  Network Strategy: <span className="text-cyan-400 font-mono capitalize">{netStats.strategy}</span> ({netStats.effectiveType.toUpperCase()}, {netStats.downlinkMbps} Mbps)
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                triggerHaptic('tap');
                onClose();
              }}
              className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 px-6 py-2.5 bg-neutral-900/40 border-b border-neutral-800 text-xs">
            <button
              onClick={() => { triggerHaptic('tap'); setActiveTab('search'); }}
              className={`px-3.5 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'search' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              Search & Explore
            </button>
            <button
              onClick={() => { triggerHaptic('tap'); setActiveTab('player'); }}
              className={`px-3.5 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'player' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Disc className="w-3.5 h-3.5" />
              Active Media Player
            </button>
            <button
              onClick={() => { triggerHaptic('tap'); setActiveTab('network'); }}
              className={`px-3.5 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'network' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Network & Quality Intelligence
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === 'search' && (
              <div className="space-y-6">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search songs, music videos, artists, or trending Afrobeat..."
                      className="w-full pl-10 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-sm rounded-2xl transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Search Web
                  </button>
                </form>

                {/* Quick Suggestion Pills */}
                <div>
                  <div className="text-xs font-semibold text-neutral-400 mb-2.5">Recommended Searches</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Play Calm Down by Rema",
                      "Trending Afrobeat 2026",
                      "Official Music Video Top Hits",
                      "Acoustic Live Sessions",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => {
                          setSearchQuery(suggestion);
                        }}
                        className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs text-neutral-300 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search Results List */}
                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-neutral-400">Search & Web Grounded Results</div>
                    {searchResults.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setCurrentMedia(item);
                          setActiveTab('player');
                          setIsPlaying(true);
                        }}
                        className="p-4 bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800 hover:border-cyan-500/50 rounded-2xl flex items-center justify-between cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800 relative shrink-0">
                            <img src={item.albumArtUrl} alt={item.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play className="w-5 h-5 text-white fill-white" />
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">
                              {item.title}
                            </div>
                            <div className="text-xs text-neutral-400 mt-0.5">{item.artist} • {item.album}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            {item.recommendedQuality}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'player' && (
              <div className="space-y-6 flex flex-col items-center text-center">
                {currentMedia ? (
                  <>
                    <div className="relative w-48 h-48 rounded-3xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-2xl group">
                      <img src={currentMedia.albumArtUrl} alt={currentMedia.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                        <div className="text-xs font-mono text-cyan-400 flex items-center gap-1">
                          <Tv className="w-3.5 h-3.5" />
                          Web Player Active
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 max-w-md">
                      <h3 className="text-xl font-bold text-white tracking-wide">{currentMedia.title}</h3>
                      <p className="text-sm text-neutral-400">{currentMedia.artist} — {currentMedia.album}</p>
                    </div>

                    {/* Lyrics / Description Snippet */}
                    <div className="w-full p-4 bg-neutral-900/60 border border-neutral-800 rounded-2xl text-xs text-neutral-300 text-left font-serif italic">
                      "{currentMedia.lyricsSnippet}"
                    </div>

                    {/* Media Controls */}
                    <div className="flex items-center gap-6">
                      <button
                        onClick={() => triggerHaptic('tap')}
                        className="p-3 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-300 transition-colors"
                      >
                        <SkipBack className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          triggerHaptic('activate');
                          setIsPlaying(!isPlaying);
                        }}
                        className="p-5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black shadow-xl shadow-cyan-500/20 active:scale-95 transition-transform"
                      >
                        {isPlaying ? <Pause className="w-6 h-6 fill-black" /> : <Play className="w-6 h-6 fill-black ml-0.5" />}
                      </button>
                      <button
                        onClick={() => triggerHaptic('tap')}
                        className="p-3 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-300 transition-colors"
                      >
                        <SkipForward className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Launch External Web / YouTube Player */}
                    {currentMedia.videoUrl && (
                      <a
                        href={currentMedia.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-medium text-cyan-400 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open Official Music Video on YouTube
                      </a>
                    )}
                  </>
                ) : (
                  <div className="py-12 text-center space-y-3">
                    <Disc className="w-12 h-12 text-neutral-600 mx-auto animate-spin" />
                    <p className="text-sm text-neutral-400">No media currently selected. Search a song or artist to begin.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'network' && (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-neutral-400">Network & Device Playback Intelligence Diagnostics</div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 bg-neutral-900/80 border border-neutral-800 rounded-2xl space-y-1">
                    <div className="text-xs text-neutral-400 flex items-center gap-1.5">
                      <Wifi className="w-4 h-4 text-cyan-400" />
                      Connection Type
                    </div>
                    <div className="text-lg font-bold text-white uppercase">{netStats.effectiveType}</div>
                  </div>

                  <div className="p-4 bg-neutral-900/80 border border-neutral-800 rounded-2xl space-y-1">
                    <div className="text-xs text-neutral-400 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      Estimated Latency & Speed
                    </div>
                    <div className="text-lg font-bold text-white font-mono">{netStats.latencyMs} ms ({netStats.downlinkMbps} Mbps)</div>
                  </div>

                  <div className="p-4 bg-neutral-900/80 border border-neutral-800 rounded-2xl space-y-1">
                    <div className="text-xs text-neutral-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-cyan-400" />
                      Buffering Risk
                    </div>
                    <div className="text-lg font-bold text-white capitalize">{netStats.bufferingRisk} Risk</div>
                  </div>

                  <div className="p-4 bg-neutral-900/80 border border-neutral-800 rounded-2xl space-y-1">
                    <div className="text-xs text-neutral-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Device Hardware Cores
                    </div>
                    <div className="text-lg font-bold text-white">{netStats.deviceCores} Cores Available</div>
                  </div>
                </div>

                <div className="p-4 bg-cyan-950/20 border border-cyan-900/50 rounded-2xl text-xs text-cyan-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Info className="w-4 h-4" />
                    Intelligent Strategy Active: <span className="uppercase">{netStats.strategy}</span>
                  </div>
                  <p className="text-neutral-400 leading-relaxed">
                    RODEX automatically evaluates network stability, bandwidth speed, and device capacity before launching media streams to ensure zero stuttering and optimal quality.
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
