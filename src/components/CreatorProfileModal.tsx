import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserCheck,
  ShieldCheck,
  Award,
  Key,
  Lock,
  X,
  CheckCircle2,
  Save,
} from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

interface CreatorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSpeakStatus?: (text: string) => void;
}

export const CreatorProfileModal: React.FC<CreatorProfileModalProps> = ({
  isOpen,
  onClose,
  onSpeakStatus,
}) => {
  const [profile, setProfile] = useState({
    fullName: 'Mubiru Robert',
    preferredName: 'Robert',
    roles: ['Creator', 'Founder', 'Developer'],
    project: 'RODEX AI',
    relationship: 'Original creator and developer of RODEX',
    recognitionStatus: 'Verified (Secure Server Token)',
    authenticationStatus: 'Authenticated Creator',
    permissions: [] as string[],
    memoryStatus: 'Protected Persistent Core Storage',
  });
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchCreatorProfile();
    }
  }, [isOpen]);

  const fetchCreatorProfile = async () => {
    try {
      const res = await fetch('/api/creator/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (err) {
      console.warn('[Creator Profile Fetch Error]', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    triggerHaptic('tap');
    try {
      const res = await fetch('/api/creator/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredName: profile.preferredName,
          roles: profile.roles,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.creatorProfileState);
        setSuccessMessage('Creator profile saved and secured successfully.');
        onSpeakStatus?.('Creator profile updated and secured successfully.');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      console.warn('[Creator Profile Save Error]', err);
    } finally {
      setSaving(false);
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
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white tracking-wide flex items-center gap-2">
                  Creator Identity & Recognition System
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase border bg-amber-500/10 text-amber-400 border-amber-500/30">
                    Founder Privileged
                  </span>
                </h2>
                <p className="text-xs text-neutral-400">
                  Securing core ownership, recognition permissions, and contextual AI memory.
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

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {successMessage && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Profile Card */}
            <div className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-3xl space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xs">
                    MR
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{profile.fullName}</div>
                    <div className="text-xs text-neutral-400">{profile.relationship}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-[11px] text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {profile.authenticationStatus}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium">Preferred Name</label>
                  <input
                    type="text"
                    value={profile.preferredName}
                    onChange={(e) => setProfile({ ...profile, preferredName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-neutral-400 font-medium">Associated Project</label>
                  <input
                    type="text"
                    value={profile.project}
                    disabled
                    className="w-full px-3.5 py-2 bg-neutral-950/50 border border-neutral-800 rounded-xl text-neutral-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-neutral-400 font-medium">Creator Roles</label>
                <div className="flex flex-wrap gap-2">
                  {profile.roles.map((role, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Creator Authority & Permissions */}
            <div className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-3xl space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
                <Lock className="w-4 h-4 text-cyan-400" />
                <span>Creator Authority Model & Privileged Permissions</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {profile.permissions.map((perm, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-neutral-950 border border-neutral-800 rounded-2xl flex items-center justify-between text-xs"
                  >
                    <span className="text-neutral-200 font-medium">{perm}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Persistence & Security Notice */}
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-xs text-cyan-300 flex items-start gap-2.5">
              <Key className="w-4 h-4 shrink-0 text-cyan-400 mt-0.5" />
              <div>
                <strong>Persistent Memory & Security:</strong> Creator identity is securely stored in core persistent server storage and injected directly into RODEX's neural context. It survives all chat resets, session clearing, and server reboots.
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-6 py-4 border-t border-neutral-800 bg-neutral-950">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Creator Profile'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
