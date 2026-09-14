import React from 'react';
import {
  Radio,
  MessageSquare,
  Image as ImageIcon,
  Code2,
  MoreHorizontal,
  Globe,
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
    { id: 'home', label: 'Voice Orb', icon: Radio, hasDot: isLive },
    {
      id: 'chat',
      label: isLive ? 'Live Chat' : 'Chat',
      icon: MessageSquare,
      badge: messageCount > 0 ? messageCount : undefined,
      hasDot: isLive,
    },
    { id: 'web', label: 'Web Intel', icon: Globe, hasDot: hasWebIntel },
    { id: 'image', label: 'Vision', icon: ImageIcon },
    { id: 'code', label: 'Code', icon: Code2 },
    { id: 'more', label: 'More', icon: MoreHorizontal },
  ];

  return (
    <nav
      id="rodex-action-bar"
      aria-label="Bottom Navigation"
      className="w-full max-w-md mx-auto px-2 py-1.5 flex items-center justify-between bg-black/80 backdrop-blur-xl border-t border-neutral-900/80 z-20 select-none"
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

