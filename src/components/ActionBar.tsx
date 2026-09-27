import React from 'react';
import {
  Radio,
  MessageSquare,
  Image as ImageIcon,
  Calendar,
  Puzzle,
  MoreHorizontal,
} from 'lucide-react';
import { AppMode } from '../types';
import { triggerHaptic } from '../utils/haptics';

interface ActionBarProps {
  activeMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  messageCount?: number;
  hasWebIntel?: boolean;
  isLive?: boolean;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  activeMode,
  onSelectMode,
  messageCount = 0,
  hasWebIntel = false,
  isLive = false,
}) => {
  const actions: Array<{
    id: AppMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
    hasDot?: boolean;
  }> = [
    {
      id: 'chat',
      label: 'Chat',
      icon: MessageSquare,
      badge: messageCount > 0 ? messageCount : undefined,
      hasDot: isLive,
    },
    { id: 'image', label: 'Image', icon: ImageIcon },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'plugins', label: 'Plugins', icon: Puzzle },
  ];

  return (
    <nav
      id="rodex-action-bar"
      aria-label="Bottom Navigation"
      className="w-full max-w-md mx-auto px-3 py-2 flex items-center justify-between bg-neutral-950/90 backdrop-blur-2xl border-t border-neutral-900/80 z-20 select-none pb-[env(safe-area-inset-bottom)]"
    >
      {actions.map((item) => {
        const Icon = item.icon;
        const isActive = activeMode === item.id;
        return (
          <button
            key={item.id}
            id={`action-btn-${item.id}`}
            onClick={() => {
              triggerHaptic('tap');
              onSelectMode(item.id);
            }}
            className={`flex flex-col items-center justify-center py-1 px-1.5 sm:px-2 rounded-xl transition-all duration-200 active:scale-95 flex-1 relative cursor-pointer ${
              isActive
                ? 'text-cyan-400 bg-cyan-950/40 font-medium'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
            }`}
          >
            <div className="relative">
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 transition-transform" />
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee]" />
              )}
              {item.badge !== undefined && (
                <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-1 rounded-full bg-cyan-500 text-black text-[9px] font-bold flex items-center justify-center">
                  {item.badge}
                </span>
              )}
              {item.hasDot && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
              )}
            </div>
            <span className="text-[10px] font-medium tracking-tight mt-1 whitespace-nowrap">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

