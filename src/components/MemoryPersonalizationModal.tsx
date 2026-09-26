import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  X,
  Plus,
  Trash2,
  Sparkles,
  ShieldCheck,
  Search,
  Check,
  User,
  Sliders,
  Cloud,
  Database,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { MemoryClient, MemoryEntry, MemoryCategory } from '../services/MemoryService';
import { globalFirebaseAdapter } from '../services/firebaseConfig';
import { triggerHaptic } from '../utils/haptics';

interface MemoryPersonalizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (msg: string) => void;
}

export const MemoryPersonalizationModal: React.FC<MemoryPersonalizationModalProps> = ({
  isOpen,
  onClose,
  onNotification,
}) => {
  const [activeTab, setActiveTab] = useState<'memories' | 'personalization' | 'cloud'>('memories');
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MemoryCategory | 'all'>('all');
  const [loading, setLoading] = useState(false);

  // New Memory Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryCategory>('fact');

  // Personalization State
  const [preferredName, setPreferredName] = useState('Robert');
  const [honorific, setHonorific] = useState('Mr. Robert');
  const [responseStyle, setResponseStyle] = useState<'concise' | 'balanced' | 'detailed'>('balanced');
  const [specialty, setSpecialty] = useState('Full-stack & AI Systems Engineering');
  const [profileSaved, setProfileSaved] = useState(false);

  const loadMemories = async () => {
    setLoading(true);
    const cat = selectedCategory === 'all' ? undefined : selectedCategory;
    const list = await MemoryClient.listMemories(cat, searchQuery);
    setMemories(list);
    setLoading(false);
  };

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/rodex/profile');
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setPreferredName(data.profile.preferredName || 'Robert');
          setHonorific(data.profile.honorific || 'Mr. Robert');
          setResponseStyle(data.profile.responseStyle || 'balanced');
          setSpecialty(data.profile.technicalSpecialty || 'Full-stack & AI Systems Engineering');
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (isOpen) {
      loadMemories();
      loadProfile();
    }
  }, [isOpen, selectedCategory, searchQuery]);

  const handleSaveMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    triggerHaptic('tap');
    const saved = await MemoryClient.saveMemory(newKey.trim(), newValue.trim(), newCategory);
    if (saved) {
      setNewKey('');
      setNewValue('');
      setShowAddForm(false);
      loadMemories();
      onNotification?.('Memory committed to long-term storage.');
    }
  };

  const handleDeleteMemory = async (id: string) => {
    triggerHaptic('tap');
    const success = await MemoryClient.deleteMemory(id);
    if (success) {
      setMemories((prev) => prev.filter((m) => m.id !== id));
      onNotification?.('Memory deleted from profile.');
    }
  };

  const handleSaveProfile = async () => {
    triggerHaptic('tap');
    try {
      const res = await fetch('/api/rodex/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredName,
          honorific,
          responseStyle,
          technicalSpecialty: specialty,
        }),
      });
      if (res.ok) {
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2000);
        onNotification?.('Personalization profile updated.');
      }
    } catch (_) {}
  };

  if (!isOpen) return null;

  const fbStatus = globalFirebaseAdapter.getStatus();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl bg-neutral-950 border border-cyan-900/40 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col max-h-[88vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-neutral-900 flex items-center justify-between bg-neutral-900/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-wide">
                  Memory & Personalization
                </h2>
                <p className="text-xs text-neutral-400 font-mono">
                  Autonomous Knowledge Core & Profile Control
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                triggerHaptic('tap');
                onClose();
              }}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="px-6 py-2 border-b border-neutral-900 flex items-center gap-2 bg-neutral-950">
            <button
              onClick={() => setActiveTab('memories')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'memories'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              Long-Term Memories ({memories.length})
            </button>

            <button
              onClick={() => setActiveTab('personalization')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'personalization'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Personalization
            </button>

            <button
              onClick={() => setActiveTab('cloud')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'cloud'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              Cloud Architecture
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {activeTab === 'memories' && (
              <div className="space-y-4">
                {/* Search & Actions Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search memories by keyword..."
                      className="w-full pl-9 pr-4 py-2 bg-neutral-900/90 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <button
                    onClick={() => {
                      triggerHaptic('tap');
                      setShowAddForm(!showAddForm);
                    }}
                    className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Memory
                  </button>
                </div>

                {/* Add Memory Form */}
                {showAddForm && (
                  <form
                    onSubmit={handleSaveMemory}
                    className="p-4 bg-neutral-900/80 border border-cyan-900/40 rounded-2xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-cyan-300">
                        Record New Long-Term Fact
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="text-neutral-500 hover:text-white text-xs"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-neutral-400 uppercase tracking-wider block mb-1">
                          Key / Subject
                        </label>
                        <input
                          type="text"
                          value={newKey}
                          onChange={(e) => setNewKey(e.target.value)}
                          placeholder="e.g. favorite_ide, coffee_preference"
                          className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-neutral-400 uppercase tracking-wider block mb-1">
                          Category
                        </label>
                        <select
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
                          className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                        >
                          <option value="fact">Factual Knowledge</option>
                          <option value="preference">Personal Preference</option>
                          <option value="project">Project / Work</option>
                          <option value="profile">User Profile</option>
                          <option value="routine">Routine</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-neutral-400 uppercase tracking-wider block mb-1">
                        Factual Detail / Content
                      </label>
                      <textarea
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder="Detail to commit to long-term memory..."
                        rows={2}
                        className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Security filter protects passwords & keys from storage</span>
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-cyan-500 text-black text-xs font-bold rounded-lg hover:bg-cyan-400 transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                )}

                {/* Memories List */}
                {loading ? (
                  <div className="py-12 text-center text-xs text-neutral-500">
                    Loading memory database...
                  </div>
                ) : memories.length === 0 ? (
                  <div className="py-12 text-center text-neutral-500 space-y-2">
                    <Brain className="w-8 h-8 mx-auto text-neutral-600" />
                    <p className="text-xs">No long-term memories found.</p>
                    <p className="text-[11px] text-neutral-600">
                      Say "Hey RODEX, remember that..." to teach RODEX facts anytime.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {memories.map((m) => (
                      <div
                        key={m.id}
                        className="p-3.5 bg-neutral-900/60 border border-neutral-800/80 hover:border-neutral-700 rounded-2xl flex items-start justify-between gap-3 transition-colors"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white tracking-wide">
                              {m.key}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800/60 text-cyan-300 uppercase font-mono">
                              {m.category}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-300 leading-relaxed">{m.value}</p>
                          <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                            <span>
                              Updated{' '}
                              {new Date(m.updatedAt).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            {m.tags && m.tags.length > 0 && (
                              <span>• Tags: {m.tags.join(', ')}</span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteMemory(m.id)}
                          title="Delete memory"
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'personalization' && (
              <div className="space-y-5">
                <div className="p-4 bg-cyan-950/30 border border-cyan-800/40 rounded-2xl flex items-start gap-3 text-xs text-neutral-300">
                  <User className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <p>
                    RODEX personalizes conversational eloquence and reasoning specifically for you.
                    You remain in complete control of your saved profile.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-white block mb-1.5">
                      Preferred Name
                    </label>
                    <input
                      type="text"
                      value={preferredName}
                      onChange={(e) => setPreferredName(e.target.value)}
                      className="w-full px-3.5 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-white block mb-1.5">
                      Spoken Honorific / Address
                    </label>
                    <input
                      type="text"
                      value={honorific}
                      onChange={(e) => setHonorific(e.target.value)}
                      placeholder="e.g. Mr. Robert, Robert, Commander"
                      className="w-full px-3.5 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-white block mb-1.5">
                    Preferred AI Response Depth
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'concise', label: 'Concise', desc: 'Direct, 1-2 sentences' },
                      { id: 'balanced', label: 'Balanced', desc: 'Crisp & structured' },
                      { id: 'detailed', label: 'Detailed', desc: 'In-depth analysis' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic('tap');
                          setResponseStyle(opt.id as any);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          responseStyle === opt.id
                            ? 'bg-cyan-950/60 border-cyan-500 text-white'
                            : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <p className="text-xs font-bold">{opt.label}</p>
                        <p className="text-[10px] text-neutral-500 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-white block mb-1.5">
                    Technical Focus & Specialization
                  </label>
                  <input
                    type="text"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="e.g. Full-stack & AI Systems Engineering"
                    className="w-full px-3.5 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-neutral-500 font-mono">
                    Changes apply immediately to real-time inference.
                  </span>
                  <button
                    onClick={handleSaveProfile}
                    className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                  >
                    {profileSaved ? <Check className="w-3.5 h-3.5 text-black" /> : null}
                    {profileSaved ? 'Saved!' : 'Save Preferences'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'cloud' && (
              <div className="space-y-4">
                <div className="p-4 bg-neutral-900/80 border border-neutral-800 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2.5">
                    <Database className="w-5 h-5 text-cyan-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        Cloud Storage Architecture (Firebase Firestore Ready)
                      </h4>
                      <p className="text-[11px] text-neutral-400">
                        Standardized document schema mapping for effortless cloud migration.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-850">
                      <span className="text-neutral-500 block text-[10px]">Auth Provider</span>
                      <span className="text-cyan-300 font-semibold">{fbStatus.authProvider.toUpperCase()}</span>
                    </div>
                    <div className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-850">
                      <span className="text-neutral-500 block text-[10px]">Storage Mode</span>
                      <span className="text-emerald-400 font-semibold">Local JSON + Memory Cache</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-1">
                      Ready Collections Schema
                    </label>
                    <div className="space-y-1">
                      {globalFirebaseAdapter.getTargetCollections().map((col) => (
                        <div
                          key={col}
                          className="px-3 py-1.5 bg-neutral-950 rounded-lg text-[11px] font-mono text-neutral-300 border border-neutral-850"
                        >
                          {col}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
