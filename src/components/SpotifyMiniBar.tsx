import React from 'react';
import { motion } from 'motion/react';
import { Play, Pause, SkipForward, Disc, Monitor } from 'lucide-react';
import { SpotifyTrackInfo, SpotifyDevice } from '../types';
import { triggerHaptic } from '../utils/haptics';

interface SpotifyMiniBarProps {
  playback: SpotifyTrackInfo | null;
  device: SpotifyDevice | null;
  onOpenPlayer: () => void;
  onTogglePlay: (e: React.MouseEvent) => void;
  onNextTrack: (e: React.MouseEvent) => void;
}

export const SpotifyMiniBar: React.FC<SpotifyMiniBarProps> = ({
  playback,
  device,
  onOpenPlayer,
  onTogglePlay,
  onNextTrack,
}) => {
  if (!playback) return null;

  const isPlaying = playback.isPlaying;
  const progressPercent =
    playback.durationMs > 0
      ? Math.min(100, Math.round((playback.progressMs / playback.durationMs) * 100))
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      onClick={() => {
        triggerHaptic('tap');
        onOpenPlayer();
      }}
      className="w-[calc(100%-1.5rem)] max-w-md mx-auto mb-1.5 px-3 py-2 rounded-2xl bg-neutral-900/90 hover:bg-neutral-850/95 backdrop-blur-xl border border-emerald-900/60 shadow-xl flex items-center justify-between gap-3 cursor-pointer transition-colors relative overflow-hidden group select-none"
    >
      {/* Background progress indicator bar */}
      <div
        className="absolute bottom-0 left-0 h-[2px] bg-emerald-400/80 transition-all duration-300"
        style={{ width: `${progressPercent}%` }}
      />

      {/* Left: Thumbnail & Info */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="relative w-9 h-9 rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800 shrink-0">
          {playback.albumArtUrl ? (
            <img
              src={playback.albumArtUrl}
              alt={playback.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-emerald-950">
              <Disc className={`w-5 h-5 text-emerald-400 ${isPlaying ? 'animate-spin' : ''}`} />
            </div>
          )}
          {isPlaying && (
            <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium leading-none mb-0.5">
            <Monitor className="w-3 h-3 shrink-0" />
            <span className="truncate">{device?.name || "Mr. Robert's PC"}</span>
          </div>
          <div className="text-xs font-semibold text-white truncate leading-tight">
            {playback.name}
          </div>
          <div className="text-[11px] text-neutral-400 truncate leading-none mt-0.5">
            {playback.artists.join(', ')}
          </div>
        </div>
      </div>

      {/* Right: Quick Controls */}
      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onTogglePlay}
          className="p-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-500/20 active:scale-95 transition-transform"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-black" /> : <Play className="w-3.5 h-3.5 fill-black ml-0.5" />}
        </button>

        <button
          onClick={onNextTrack}
          className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 active:scale-95 transition-colors"
          title="Next"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
};
