import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Upload,
  Camera,
  FileCode,
  Terminal,
  Cpu,
  Copy,
  Check,
  Smartphone,
  ExternalLink,
  Download,
  Globe,
  Search,
  Newspaper,
  TrendingUp,
  Compass,
  Sparkles,
  Radio,
  Music2,
} from 'lucide-react';
import { AppMode } from '../types';
import {
  FLUTTER_MAIN,
  FLUTTER_PUBSPEC,
  FLUTTER_MANIFEST,
  FLUTTER_RUN_INSTRUCTIONS,
} from '../utils/flutterCode';

interface ModesModalProps {
  mode: AppMode;
  onClose: () => void;
  onSubmitPrompt: (text: string, image?: { data: string; mimeType: string }) => void;
  currentSources?: Array<{ title: string; url: string; domain?: string }>;
  onOpenSpotify?: () => void;
}

export const ModesModal: React.FC<ModesModalProps> = ({
  mode,
  onClose,
  onSubmitPrompt,
  currentSources = [],
  onOpenSpotify,
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imagePayload, setImagePayload] = useState<{ data: string; mimeType: string } | null>(null);
  const [imagePrompt, setImagePrompt] = useState('');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [filePrompt, setFilePrompt] = useState('');
  const [codePrompt, setCodePrompt] = useState('');
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [activeFlutterTab, setActiveFlutterTab] = useState<'guide' | 'main' | 'pubspec' | 'manifest'>('guide');

  // World Wide Web Intelligence States
  const [webQuery, setWebQuery] = useState('');
  const [webTopic, setWebTopic] = useState('World News and Tech Innovation');
  const [webLoading, setWebLoading] = useState(false);
  const [webIntelResult, setWebIntelResult] = useState<{
    summary?: string;
    sources?: Array<{ title: string; url: string; domain?: string }>;
    searchQueries?: string[];
    topic?: string;
  } | null>(null);

  const handleFetchWebIntel = async (topicToFetch?: string) => {
    const targetTopic = topicToFetch || webTopic || 'Global Breaking News and Technology';
    setWebLoading(true);
    setWebIntelResult(null);
    try {
      const res = await fetch(`/api/web-explore?topic=${encodeURIComponent(targetTopic)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setWebIntelResult(data);
    } catch (err: any) {
      setWebIntelResult({
        summary: 'Unable to reach World Wide Web intelligence at this moment. Please verify internet connectivity.',
        sources: [],
        searchQueries: [],
        topic: targetTopic,
      });
    } finally {
      setWebLoading(false);
    }
  };

  const handleSendWebQuery = (overrideQuery?: string) => {
    const q = overrideQuery || webQuery;
    if (!q.trim()) return;
    onSubmitPrompt(`[Web Search Request]: ${q.trim()}`);
    onClose();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      const base64Data = result.split(',')[1];
      setImagePayload({
        data: base64Data,
        mimeType: file.type || 'image/jpeg',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setFileContent(reader.result as string);
    };
    reader.readAsText(file);
  };

  const handleSendImage = () => {
    if (!imagePayload) return;
    onSubmitPrompt(imagePrompt.trim() || 'Describe and analyze this image for me.', imagePayload);
    onClose();
  };

  const handleSendFile = () => {
    if (!fileContent) return;
    const combined = `[Uploaded File: ${fileName}]\n\`\`\`\n${fileContent.slice(0, 3000)}\n\`\`\`\n\nUser request: ${filePrompt || 'Please summarize and explain this document.'}`;
    onSubmitPrompt(combined);
    onClose();
  };

  const handleSendCode = () => {
    if (!codePrompt.trim()) return;
    onSubmitPrompt(`[Code Request]: ${codePrompt.trim()}`);
    onClose();
  };

  const handleCopyCode = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFile(id);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  if (mode === 'home' || mode === 'chat') return null;

  return (
    <AnimatePresence>
      <motion.div
        id="rodex-modes-modal"
        initial={{ opacity: 0, y: '50%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '50%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col justify-between overflow-hidden"
      >
        {/* Header */}
        <header className="px-5 py-4 border-b border-neutral-900 flex items-center justify-between bg-black/80">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base font-semibold text-white tracking-wider uppercase">
              {mode === 'web' && 'World Wide Web Intelligence & Sources'}
              {mode === 'image' && 'Image Vision Subsystem'}
              {mode === 'file' && 'File Inspector Subsystem'}
              {mode === 'code' && 'Code Synthesis Subsystem'}
              {mode === 'more' && 'Android APK & Flutter Package'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Modal Content depending on active mode */}
        <div className="flex-1 overflow-y-auto px-5 py-6 max-w-xl mx-auto w-full">
          {/* WORLD WIDE WEB INTEL & SOURCES MODE */}
          {mode === 'web' && (
            <div className="space-y-4">
              {/* Web Grounding Banner with Live Verification */}
              <div className="p-4 rounded-2xl bg-neutral-950 border border-emerald-900/60 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">WORLD WIDE WEB VERIFIED</span>
                        <span className="text-[9px] font-mono px-2 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/50 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          REAL-TIME API
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 font-mono">
                        Neural Core @ 480M+ ops/sec • Google Search Grounding
                      </p>
                    </div>
                  </div>
                  <button
                    disabled={webLoading}
                    onClick={() => handleFetchWebIntel('World Wide Web Verification and Breaking Headlines')}
                    className="px-2.5 py-1 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 text-[11px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>{webLoading ? 'Verifying...' : 'Verify Now'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  RODEX is verified to the World Wide Web, streaming live information with citations, market data, and breaking global updates. He activates only when called (<span className="text-cyan-300 font-mono">"Hey RODEX"</span>).
                </p>
              </div>

              {/* Instant Search Presets */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-neutral-400">
                  Curated Web Streams & Presets:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '🇺🇬 Kingdom of Tooro', query: 'What recently happened to the Kingdom of Tooro in Uganda following the death of King Oyo?' },
                    { label: '🕒 Real-Time Clock', query: 'What is the current date and time in Uganda (EAT) and globally?' },
                    { label: 'Breaking News', query: 'What is the top breaking world news right now?' },
                    { label: 'AI & Quantum', query: 'What are the latest AI and quantum computing developments today?' },
                    { label: 'Space & NASA', query: 'Recent major space exploration missions and astronomical discoveries' },
                    { label: 'Financial Markets', query: 'Current global stock market trends and key financial highlights' },
                    { label: 'Weather Alerts', query: 'What is the current global weather outlook and major climate events?' },
                    { label: 'Sports & Scores', query: 'Latest global sports news and recent match scores' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setWebQuery(preset.query);
                        setWebTopic(preset.label);
                      }}
                      className="text-xs px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-cyan-500/50 hover:bg-neutral-900 text-neutral-300 transition-all flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Conversation Grounded Sources (if any) */}
              {currentSources && currentSources.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-neutral-950 border border-cyan-900/50 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-cyan-400 font-medium flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      <span>Active Conversation Sources</span>
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {currentSources.length} verified links
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {currentSources.map((src, idx) => (
                      <a
                        key={`modal-src-${idx}`}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-cyan-500/50 transition-colors block"
                      >
                        <div className="flex items-center justify-between text-[10px] text-cyan-400 mb-0.5">
                          <span className="truncate">{src.domain || 'Source'}</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
                        </div>
                        <p className="text-xs text-neutral-200 truncate">{src.title || src.url}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Web Query Input */}
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={webQuery}
                    onChange={(e) => setWebQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSendWebQuery();
                      }
                    }}
                    placeholder="Search anything across the World Wide Web..."
                    className="w-full bg-neutral-950 text-neutral-200 text-sm pl-10 pr-4 py-3 rounded-xl border border-neutral-800 focus:border-cyan-500 focus:outline-none placeholder:text-neutral-600"
                  />
                  <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={!webQuery.trim()}
                    onClick={() => handleSendWebQuery()}
                    className="py-2.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-semibold disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Ask RODEX Aloud</span>
                  </button>
                  <button
                    disabled={webLoading}
                    onClick={() => handleFetchWebIntel(webQuery || webTopic)}
                    className="py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 hover:border-cyan-500/50 text-xs font-medium disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Globe className={`w-3.5 h-3.5 text-cyan-400 ${webLoading ? 'animate-spin' : ''}`} />
                    <span>{webLoading ? 'Scanning Web...' : 'Briefing Intel'}</span>
                  </button>
                </div>
              </div>

              {/* Web Intel Live Results Card */}
              {webIntelResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-semibold text-neutral-200">
                        Web Intelligence Briefing
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                      {webIntelResult.topic || 'Web Synthesis'}
                    </span>
                  </div>

                  {webIntelResult.summary && (
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      {webIntelResult.summary}
                    </p>
                  )}

                  {webIntelResult.searchQueries && webIntelResult.searchQueries.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-[10px] text-neutral-400 pt-1">
                      <span className="text-cyan-400 font-medium">Search query:</span>
                      {webIntelResult.searchQueries.map((q, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 border border-neutral-800"
                        >
                          "{q}"
                        </span>
                      ))}
                    </div>
                  )}

                  {webIntelResult.sources && webIntelResult.sources.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-neutral-900">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-400">
                        Citations & Web Sources ({webIntelResult.sources.length}):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {webIntelResult.sources.map((src, sIdx) => (
                          <a
                            key={`${src.url}-${sIdx}`}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-cyan-500/50 transition-all block"
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] font-semibold text-cyan-400 truncate">
                                {src.domain || 'web source'}
                              </span>
                              <ExternalLink className="w-3 h-3 text-neutral-500 group-hover:text-cyan-400 shrink-0 transition-colors" />
                            </div>
                            <p className="text-xs text-neutral-200 group-hover:text-cyan-200 line-clamp-2 leading-tight">
                              {src.title || src.url}
                            </p>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          )}
          {/* IMAGE MODE */}
          {mode === 'image' && (
            <div className="space-y-4">
              <p className="text-xs text-neutral-400">
                Transmit a photo or visual artifact for multimodal neural inspection by RODEX.
              </p>

              {imagePreview ? (
                <div className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950">
                  <img
                    src={imagePreview}
                    alt="Upload preview"
                    className="max-h-64 w-full object-contain mx-auto"
                  />
                  <button
                    onClick={() => {
                      setImagePreview(null);
                      setImagePayload(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 text-neutral-300 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-neutral-800 hover:border-cyan-500/60 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-neutral-950/60 hover:bg-neutral-900/40 transition-all">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-cyan-400 mb-3">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-medium text-neutral-200">
                    Upload or Capture Photo
                  </span>
                  <span className="text-xs text-neutral-500 mt-1">Supports PNG, JPG, WEBP</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}

              <input
                type="text"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="What should RODEX analyze about this image? (optional)"
                className="w-full bg-neutral-950 text-neutral-200 text-sm px-4 py-3 rounded-xl border border-neutral-800 focus:border-cyan-500 focus:outline-none"
              />

              <button
                disabled={!imagePayload}
                onClick={handleSendImage}
                className="w-full py-3 rounded-xl bg-cyan-500 text-black font-semibold hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 transition-all"
              >
                Analyze with RODEX
              </button>
            </div>
          )}

          {/* FILE MODE */}
          {mode === 'file' && (
            <div className="space-y-4">
              <p className="text-xs text-neutral-400">
                Load documents, code files, or logs for RODEX to review and summarize aloud.
              </p>

              {fileName ? (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileCode className="w-5 h-5 text-cyan-400" />
                    <div>
                      <div className="text-xs font-medium text-neutral-200">{fileName}</div>
                      <div className="text-[10px] text-neutral-500">
                        {fileContent?.length} characters loaded
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setFileName(null);
                      setFileContent(null);
                    }}
                    className="text-neutral-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-neutral-800 hover:border-cyan-500/60 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-neutral-950/60 hover:bg-neutral-900/40 transition-all">
                  <Upload className="w-8 h-8 text-cyan-400 mb-2" />
                  <span className="text-sm font-medium text-neutral-200">
                    Select Text or Code File
                  </span>
                  <span className="text-xs text-neutral-500 mt-1">.txt, .md, .dart, .ts, .json, .py</span>
                  <input
                    type="file"
                    accept=".txt,.md,.json,.js,.ts,.py,.dart,.html,.css"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}

              <input
                type="text"
                value={filePrompt}
                onChange={(e) => setFilePrompt(e.target.value)}
                placeholder="What would you like RODEX to check or extract?"
                className="w-full bg-neutral-950 text-neutral-200 text-sm px-4 py-3 rounded-xl border border-neutral-800 focus:border-cyan-500 focus:outline-none"
              />

              <button
                disabled={!fileContent}
                onClick={handleSendFile}
                className="w-full py-3 rounded-xl bg-cyan-500 text-black font-semibold hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 transition-all"
              >
                Inspect File with RODEX
              </button>
            </div>
          )}

          {/* CODE MODE */}
          {mode === 'code' && (
            <div className="space-y-4">
              <p className="text-xs text-neutral-400">
                Generate tailored Android, Flutter, Dart, Python, or TypeScript code directly with RODEX.
              </p>

              <div className="flex flex-wrap gap-2">
                {[
                  'Build an Android Flutter voice orb widget',
                  'Write a Python script to call Gemini Live API',
                  'Create an Android BroadcastReceiver for hotword',
                  'Generate a TypeScript WebAudio visualizer',
                ].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setCodePrompt(preset)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-300 hover:border-cyan-500/50 transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <textarea
                rows={4}
                value={codePrompt}
                onChange={(e) => setCodePrompt(e.target.value)}
                placeholder="Describe the code or architecture you want RODEX to build..."
                className="w-full bg-neutral-950 text-neutral-200 text-sm p-4 rounded-xl border border-neutral-800 focus:border-cyan-500 focus:outline-none resize-none"
              />

              <button
                disabled={!codePrompt.trim()}
                onClick={handleSendCode}
                className="w-full py-3 rounded-xl bg-cyan-500 text-black font-semibold hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 transition-all"
              >
                Synthesize Code
              </button>
            </div>
          )}

          {/* MORE MODE: Android APK & Flutter Export + Spotify PC */}
          {mode === 'more' && (
            <div className="space-y-4">
              {/* Spotify PC Controller Quick Launch */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-neutral-900 border border-emerald-800/70 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-900/90 border border-emerald-700/80 flex items-center justify-center text-emerald-400 shrink-0">
                    <Music2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Spotify PC Controller</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                        DIRECT PC ACCESS
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Stream, search, volume, and voice control Spotify on Mr. Robert's PC.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSpotify?.();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold shrink-0 transition-all active:scale-95 shadow-md shadow-emerald-500/20"
                >
                  Open &rarr;
                </button>
              </div>

              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <p className="text-xs text-cyan-200 leading-relaxed">
                  <strong>Android APK Packaging Guide:</strong> You can build this RODEX prototype into a real standalone Android APK immediately using the Flutter source files provided below.
                </p>
              </div>

              {/* Navigation Tabs */}
              <div className="flex rounded-xl bg-neutral-950 p-1 border border-neutral-900">
                {[
                  { id: 'guide', label: 'APK Guide' },
                  { id: 'main', label: 'main.dart' },
                  { id: 'pubspec', label: 'pubspec.yaml' },
                  { id: 'manifest', label: 'AndroidManifest.xml' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFlutterTab(tab.id as any)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      activeFlutterTab === tab.id
                        ? 'bg-neutral-800 text-cyan-400 shadow-sm'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeFlutterTab === 'guide' && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      Build Commands (VS Code / Android Studio)
                    </span>
                    <button
                      onClick={() => handleCopyCode('guide', FLUTTER_RUN_INSTRUCTIONS)}
                      className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                    >
                      {copiedFile === 'guide' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>Copy Guide</span>
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono text-neutral-300 bg-black p-3 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed border border-neutral-800">
                    {FLUTTER_RUN_INSTRUCTIONS}
                  </pre>
                </div>
              )}

              {activeFlutterTab === 'main' && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">lib/main.dart</span>
                    <button
                      onClick={() => handleCopyCode('main', FLUTTER_MAIN)}
                      className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                    >
                      {copiedFile === 'main' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>Copy Code</span>
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono text-neutral-300 bg-black p-3 rounded-lg max-h-72 overflow-y-auto whitespace-pre border border-neutral-800">
                    {FLUTTER_MAIN}
                  </pre>
                </div>
              )}

              {activeFlutterTab === 'pubspec' && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">pubspec.yaml</span>
                    <button
                      onClick={() => handleCopyCode('pubspec', FLUTTER_PUBSPEC)}
                      className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                    >
                      {copiedFile === 'pubspec' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>Copy Config</span>
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono text-neutral-300 bg-black p-3 rounded-lg overflow-y-auto whitespace-pre border border-neutral-800">
                    {FLUTTER_PUBSPEC}
                  </pre>
                </div>
              )}

              {activeFlutterTab === 'manifest' && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      android/app/src/main/AndroidManifest.xml
                    </span>
                    <button
                      onClick={() => handleCopyCode('manifest', FLUTTER_MANIFEST)}
                      className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                    >
                      {copiedFile === 'manifest' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>Copy XML</span>
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono text-neutral-300 bg-black p-3 rounded-lg overflow-y-auto whitespace-pre border border-neutral-800">
                    {FLUTTER_MANIFEST}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
