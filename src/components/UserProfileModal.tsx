import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Mail,
  Shield,
  Clock,
  Volume2,
  Sliders,
  CheckCircle2,
  LogOut,
  UserPlus,
  Radio,
} from 'lucide-react';
import { AuthenticatedUser, globalAuthClient } from '../services/authClient';
import { triggerHaptic } from '../utils/haptics';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthenticatedUser | null;
  onUserUpdated: (user: AuthenticatedUser) => void;
  onOpenAuthModal: (tab: 'signin' | 'register') => void;
  onLogout: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
  onOpenAuthModal,
  onLogout,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [honorific, setHonorific] = useState('');
  const [tone, setTone] = useState<'professional' | 'conversational' | 'technical'>('professional');
  const [responseStyle, setResponseStyle] = useState<'concise' | 'balanced' | 'detailed'>('balanced');
  const [timezone, setTimezone] = useState('Africa/Kampala');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      setPreferredName(currentUser.profile?.preferredName || currentUser.displayName || '');
      setHonorific(currentUser.profile?.honorific || currentUser.displayName || '');
      setTone(currentUser.profile?.tone || 'professional');
      setResponseStyle(currentUser.profile?.responseStyle || 'balanced');
      setTimezone(currentUser.profile?.timezone || 'Africa/Kampala');
    }
  }, [currentUser]);

  if (!isOpen || !currentUser) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    triggerHaptic('tap');

    try {
      const updated = await globalAuthClient.updateProfile({
        displayName,
        preferredName,
        honorific,
        tone,
        responseStyle,
        timezone,
      });
      triggerHaptic('success');
      onUserUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      triggerHaptic('error');
      setError(err?.message || 'Failed to update profile settings.');
    } finally {
      setSaving(false);
    }
  };

  const formattedJoinDate = currentUser.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Recent';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-neutral-950 border border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-base">
              {currentUser.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-1.5">
                <span>{currentUser.displayName}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 font-normal">
                  Active User
                </span>
              </h2>
              <p className="text-xs text-neutral-400">{currentUser.email}</p>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHaptic('tap');
              onClose();
            }}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {saveSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>User profile preferences saved successfully!</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Account Details Card */}
          <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2.5">
            <div className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5 mb-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Account Credentials & Session</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-black/40 border border-neutral-800/80">
                <span className="text-[10px] text-neutral-500 block uppercase tracking-wider">Username</span>
                <span className="text-white font-medium">@{currentUser.username}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-neutral-800/80">
                <span className="text-[10px] text-neutral-500 block uppercase tracking-wider">Member Since</span>
                <span className="text-white font-medium">{formattedJoinDate}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-neutral-800/80">
                <span className="text-[10px] text-neutral-500 block uppercase tracking-wider">Session Security</span>
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <Radio className="w-2.5 h-2.5" /> Isolated Token
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-neutral-800/80">
                <span className="text-[10px] text-neutral-500 block uppercase tracking-wider">User ID</span>
                <span className="text-neutral-400 font-mono text-[11px] truncate block">{currentUser.id}</span>
              </div>
            </div>
          </div>

          {/* Personalization Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Voice & AI Persona Customization</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/60"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Preferred Name
                </label>
                <input
                  type="text"
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/60"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Honorific Address
                </label>
                <input
                  type="text"
                  value={honorific}
                  onChange={(e) => setHonorific(e.target.value)}
                  placeholder="e.g. Mr. Robert, Robert"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/60"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Timezone
                </label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/60"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Conversational Tone
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as any)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/60"
                >
                  <option value="professional">Professional & Crisp</option>
                  <option value="conversational">Conversational & Warm</option>
                  <option value="technical">Technical & In-Depth</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Response Depth
                </label>
                <select
                  value={responseStyle}
                  onChange={(e) => setResponseStyle(e.target.value as any)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/60"
                >
                  <option value="concise">Concise (Fast Spoken)</option>
                  <option value="balanced">Balanced</option>
                  <option value="detailed">Detailed & Comprehensive</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
            >
              {saving ? <span>Saving Changes...</span> : <span>Save Preferences</span>}
            </button>
          </form>

          {/* Account Switching & Sign Out */}
          <div className="pt-2 border-t border-neutral-800 flex items-center justify-between gap-2">
            <button
              onClick={() => {
                triggerHaptic('tap');
                onClose();
                onOpenAuthModal('register');
              }}
              className="flex-1 py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-neutral-800"
            >
              <UserPlus className="w-3.5 h-3.5 text-neutral-400" />
              <span>Switch / Add Account</span>
            </button>

            <button
              onClick={() => {
                triggerHaptic('tap');
                onLogout();
                onClose();
              }}
              className="py-2 px-4 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-red-900/40"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
