import React, { useEffect, useRef } from 'react';
import {
  MessageSquare,
  Image as ImageIcon,
  Calendar,
  Puzzle,
  Shield,
  Mail,
  Stethoscope,
  RefreshCw,
  User,
  Brain,
  Cpu,
  Film,
  Music2,
  Settings,
  X,
  ChevronRight,
} from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';
import { AuthenticatedUser } from '../services/authClient';

interface MoreMenuProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthenticatedUser | null;
  onOpenChat: () => void;
  onOpenImage: () => void;
  onOpenSchedule: () => void;
  onOpenPlugins: () => void;
  onOpenSecurity: () => void;
  onOpenGmail: () => void;
  onOpenDoctor: () => void;
  onOpenUpdate: () => void;
  onOpenUserProfile: () => void;
  onOpenAuthModal: () => void;
  onOpenMemory: () => void;
  onOpenMediaStudio: () => void;
  onOpenMediaHub: () => void;
  onOpenSettings: () => void;
}

export const MoreMenu: React.FC<MoreMenuProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenChat,
  onOpenImage,
  onOpenSchedule,
  onOpenPlugins,
  onOpenSecurity,
  onOpenGmail,
  onOpenDoctor,
  onOpenUpdate,
  onOpenUserProfile,
  onOpenAuthModal,
  onOpenMemory,
  onOpenMediaStudio,
  onOpenMediaHub,
  onOpenSettings,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // 1. Primary Capabilities FIRST (Chat, Image, Schedule, Plugins)
  const primaryCapabilities = [
    {
      id: 'chat',
      label: '1. Chat',
      sublabel: 'Interactive chat & voice reasoning session',
      icon: MessageSquare,
      color: 'text-cyan-400 bg-cyan-950/80 border-cyan-800/80',
      action: onOpenChat,
    },
    {
      id: 'image',
      label: '2. Image',
      sublabel: 'AI Image Studio & Multimodal Generation',
      icon: ImageIcon,
      color: 'text-purple-400 bg-purple-950/80 border-purple-800/80',
      action: onOpenImage,
    },
    {
      id: 'schedule',
      label: '3. Schedule',
      sublabel: 'Calendar, Reminders & Event Management',
      icon: Calendar,
      color: 'text-blue-400 bg-blue-950/80 border-blue-800/80',
      action: onOpenSchedule,
    },
    {
      id: 'plugins',
      label: '4. Plugins',
      sublabel: 'RODEX Multi-Capability & 8 Domains Hub',
      icon: Puzzle,
      color: 'text-amber-400 bg-amber-950/80 border-amber-800/80',
      action: onOpenPlugins,
    },
  ];

  // 2. Secondary / System Features SECOND
  const systemFeatures = [
    {
      id: 'security',
      label: '5. Security Center',
      sublabel: 'Biometric protection & firewalls',
      icon: Shield,
      color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60',
      action: onOpenSecurity,
    },
    {
      id: 'email',
      label: '6. Email Integrations',
      sublabel: 'Gmail & email intelligence hub',
      icon: Mail,
      color: 'text-red-400 bg-red-950/60 border-red-800/60',
      action: onOpenGmail,
    },
    {
      id: 'doctor',
      label: '7. RODEX Doctor',
      sublabel: 'Diagnostic & system reliability',
      icon: Stethoscope,
      color: 'text-cyan-400 bg-cyan-950/60 border-cyan-800/60',
      action: onOpenDoctor,
    },
    {
      id: 'updates',
      label: '8. Autonomous Updates',
      sublabel: 'AI engine & auto-sync intelligence',
      icon: RefreshCw,
      color: 'text-indigo-400 bg-indigo-950/60 border-indigo-800/60',
      action: onOpenUpdate,
    },
    {
      id: 'account',
      label: currentUser ? `9. User Account (@${currentUser.username})` : '9. User Account & Sign In',
      sublabel: currentUser?.displayName || 'Manage preferences & auth profile',
      icon: User,
      color: 'text-amber-400 bg-amber-950/60 border-amber-800/60',
      action: () => {
        if (currentUser) {
          onOpenUserProfile();
        } else {
          onOpenAuthModal();
        }
      },
    },
  ];

  const secondaryTools = [
    {
      id: 'memory',
      label: 'Long-Term Memory',
      icon: Brain,
      color: 'text-purple-400',
      action: onOpenMemory,
    },
    {
      id: 'studio',
      label: 'Veo 3 Video Studio',
      icon: Film,
      color: 'text-rose-400',
      action: onOpenMediaStudio,
    },
    {
      id: 'mediahub',
      label: 'Web Music & Videos',
      icon: Music2,
      color: 'text-cyan-400',
      action: onOpenMediaHub,
    },
    {
      id: 'settings',
      label: 'System Settings',
      icon: Settings,
      color: 'text-neutral-300',
      action: onOpenSettings,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-start justify-start p-4 sm:p-6 animate-fade-in overflow-y-auto">
      <div
        ref={menuRef}
        className="w-full max-w-sm bg-neutral-950/95 border border-neutral-800/90 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 text-white animate-scale-up mt-2 sm:mt-4 ml-0 sm:ml-2 my-auto"
        role="dialog"
        aria-label="RODEX Navigation & Capabilities Menu"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400 font-bold text-xs shadow-[0_0_12px_rgba(6,182,212,0.3)]">
              R
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">RODEX Navigation</h2>
              <p className="text-[10px] text-neutral-400">All features & system capabilities</p>
            </div>
          </div>

          <button
            onClick={() => {
              triggerHaptic('tap');
              onClose();
            }}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-900 transition-all cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SECTION 1: PRIMARY CAPABILITIES (Chat, Image, Schedule, Plugins) FIRST */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 px-1 mb-1">
            Primary Capabilities
          </p>
          {primaryCapabilities.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  triggerHaptic('tap');
                  onClose();
                  item.action();
                }}
                className="w-full p-2.5 rounded-2xl bg-neutral-900/80 hover:bg-neutral-800/80 border border-neutral-800 hover:border-cyan-500/50 flex items-center justify-between gap-3 text-left transition-all active:scale-98 cursor-pointer group shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${item.color}`}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                      {item.label}
                    </p>
                    <p className="text-[10px] text-neutral-400 truncate">{item.sublabel}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-cyan-400 transition-colors shrink-0" />
              </button>
            );
          })}
        </div>

        {/* VISUAL DIVIDER */}
        <div className="h-px bg-neutral-800/80 my-1" />

        {/* SECTION 2: SECONDARY / SYSTEM FEATURES SECOND */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-1 mb-1">
            System & Security
          </p>
          {systemFeatures.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  triggerHaptic('tap');
                  onClose();
                  item.action();
                }}
                className="w-full p-2.5 rounded-2xl bg-neutral-900/50 hover:bg-neutral-900 border border-neutral-800/60 hover:border-neutral-700 flex items-center justify-between gap-3 text-left transition-all active:scale-98 cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${item.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors truncate">
                      {item.label}
                    </p>
                    <p className="text-[10px] text-neutral-400 truncate">{item.sublabel}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-neutral-300 transition-colors shrink-0" />
              </button>
            );
          })}
        </div>

        {/* SECTION 3: OTHER UTILITIES & SETTINGS */}
        <div className="space-y-1 pt-1 border-t border-neutral-900">
          <div className="grid grid-cols-1 gap-1">
            {secondaryTools.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    triggerHaptic('tap');
                    onClose();
                    item.action();
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-neutral-900 flex items-center justify-between text-xs text-neutral-300 hover:text-white transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${item.color}`} />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-600 group-hover:text-neutral-300" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-neutral-900/80 flex items-center justify-between text-[10px] text-neutral-500 px-1">
          <span>RODEX AI Core v4.2</span>
          <span className="text-cyan-400/80 font-mono">Firebase Active</span>
        </div>
      </div>
    </div>
  );
};
