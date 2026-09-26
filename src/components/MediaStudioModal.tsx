import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Video,
  Image as ImageIcon,
  Sparkles,
  Play,
  Upload,
  Download,
  MapPin,
  Search,
  Globe,
  ExternalLink,
  Layers,
  Save,
  Check,
  RefreshCw,
  Film,
  Camera,
  Wand2,
  Cloud,
} from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';
import { auth, saveCreationToFirestore, loadUserCreationsFromFirestore, AICreationRecord } from '../services/firebase';

interface MediaStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'video' | 'image' | 'maps' | 'search' | 'gallery';
}

export const MediaStudioModal: React.FC<MediaStudioModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'video',
}) => {
  const [activeTab, setActiveTab] = useState<'video' | 'image' | 'maps' | 'search' | 'gallery'>(initialTab);

  // Veo Video States
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoImageSource, setVideoImageSource] = useState<{ data: string; mimeType: string; preview: string } | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<{ url: string; prompt: string; ratio: string } | null>(null);

  // Image Creation & Editing States
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageAspectRatio, setImageAspectRatio] = useState<'1:1' | '16:9' | '9:16'>('1:1');
  const [sourceImageToEdit, setSourceImageToEdit] = useState<{ data: string; mimeType: string; preview: string } | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<{ url: string; prompt: string; isEdit: boolean } | null>(null);

  // Google Search Grounding States (gemini-3.5-flash)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    text: string;
    sources: Array<{ title: string; url: string; domain?: string }>;
    searchQueries: string[];
    modelUsed: string;
  } | null>(null);

  // Google Maps Grounding States (gemini-3.5-flash)
  const [mapsQuery, setMapsQuery] = useState('');
  const [mapsLoading, setMapsLoading] = useState(false);
  const [mapsResult, setMapsResult] = useState<{
    text: string;
    sources: Array<{ title: string; url: string; domain?: string }>;
    places?: Array<{ title?: string; address?: string; uri?: string }>;
    modelUsed: string;
  } | null>(null);

  // Saved Creations in Firebase Firestore
  const [savedCreations, setSavedCreations] = useState<AICreationRecord[]>([]);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
      loadSavedCreations();
    }
  }, [isOpen, initialTab]);

  const loadSavedCreations = async () => {
    const user = auth.currentUser;
    if (user) {
      const items = await loadUserCreationsFromFirestore(user.uid);
      setSavedCreations(items);
    }
  };

  // Video Upload Handler
  const handleVideoImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      setVideoImageSource({
        data: base64Data,
        mimeType: file.type || 'image/jpeg',
        preview: result,
      });
    };
    reader.readAsDataURL(file);
  };

  // Image Edit Upload Handler
  const handleImageEditUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      setSourceImageToEdit({
        data: base64Data,
        mimeType: file.type || 'image/jpeg',
        preview: result,
      });
    };
    reader.readAsDataURL(file);
  };

  // Generate Veo Video
  const handleGenerateVideo = async () => {
    if (!videoPrompt.trim() && !videoImageSource) return;
    triggerHaptic('tap');
    setVideoLoading(true);
    setGeneratedVideo(null);

    try {
      const payload: any = {
        prompt: videoPrompt.trim() || 'Animate this scene with fluid, cinematic motion',
        aspectRatio: videoAspectRatio,
      };
      if (videoImageSource) {
        payload.image = {
          data: videoImageSource.data,
          mimeType: videoImageSource.mimeType,
        };
      }

      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.videoUrl) {
        setGeneratedVideo({
          url: data.videoUrl,
          prompt: videoPrompt,
          ratio: videoAspectRatio,
        });

        // Automatically save to Firestore if user signed in
        const user = auth.currentUser;
        if (user) {
          await saveCreationToFirestore(user.uid, {
            type: 'video',
            prompt: videoPrompt || 'Image Animation',
            mediaUrl: data.videoUrl,
            aspectRatio: videoAspectRatio,
            model: 'veo-3.1-fast-generate-preview',
          });
          loadSavedCreations();
        }
      }
    } catch (err: any) {
      console.error('Video generation error', err);
    } finally {
      setVideoLoading(false);
    }
  };

  // Generate or Edit Image with gemini-3.1-flash-image-preview
  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    triggerHaptic('tap');
    setImageLoading(true);
    setGeneratedImage(null);

    try {
      const payload: any = {
        prompt: imagePrompt.trim(),
        aspectRatio: imageAspectRatio,
      };
      if (sourceImageToEdit) {
        payload.sourceImage = {
          data: sourceImageToEdit.data,
          mimeType: sourceImageToEdit.mimeType,
        };
      }

      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.imageUrl) {
        setGeneratedImage({
          url: data.imageUrl,
          prompt: imagePrompt,
          isEdit: Boolean(data.isEdit),
        });

        // Automatically save to Firestore if user signed in
        const user = auth.currentUser;
        if (user) {
          await saveCreationToFirestore(user.uid, {
            type: data.isEdit ? 'edited_image' : 'image',
            prompt: imagePrompt,
            mediaUrl: data.imageUrl,
            aspectRatio: imageAspectRatio,
            model: data.modelUsed || 'gemini-3.1-flash-lite-image',
          });
          loadSavedCreations();
        }
      }
    } catch (err: any) {
      console.error('Image generation error', err);
    } finally {
      setImageLoading(false);
    }
  };

  // Execute Google Search Grounding with gemini-3.5-flash
  const handleExecuteSearch = async (override?: string) => {
    const q = override || searchQuery;
    if (!q.trim()) return;
    triggerHaptic('tap');
    setSearchLoading(true);
    setSearchResult(null);

    try {
      const res = await fetch('/api/search/grounded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.trim() }),
      });
      const data = await res.json();
      setSearchResult(data);
    } catch (err) {
      console.error('Search grounding error', err);
    } finally {
      setSearchLoading(false);
    }
  };

  // Execute Google Maps Grounding with gemini-3.5-flash
  const handleExecuteMaps = async (override?: string) => {
    const q = override || mapsQuery;
    if (!q.trim()) return;
    triggerHaptic('tap');
    setMapsLoading(true);
    setMapsResult(null);

    try {
      const res = await fetch('/api/maps/grounded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.trim() }),
      });
      const data = await res.json();
      setMapsResult(data);
    } catch (err) {
      console.error('Maps grounding error', err);
    } finally {
      setMapsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        id="rodex-media-studio-modal"
        initial={{ opacity: 0, y: '30%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '30%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col justify-between overflow-hidden"
      >
        {/* Header */}
        <header className="px-5 py-4 border-b border-neutral-900 flex items-center justify-between bg-black/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wider">RODEX MULTIMODAL STUDIO</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  VEO 3 & GROUNDING
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 font-mono">
                Veo 3.1 &bull; Image Studio &bull; Google Maps & Search &bull; Firebase
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHaptic('tap');
              onClose();
            }}
            className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 pb-1 border-b border-neutral-900/60 bg-neutral-950 flex gap-2 overflow-x-auto">
          {[
            { id: 'video', label: 'Veo 3 Video Studio', icon: Video },
            { id: 'image', label: 'Create & Edit Images', icon: ImageIcon },
            { id: 'maps', label: 'Google Maps Grounding', icon: MapPin },
            { id: 'search', label: 'Google Search Data', icon: Globe },
            { id: 'gallery', label: 'Firebase Cloud Gallery', icon: Cloud },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  triggerHaptic('tap');
                  setActiveTab(tab.id as any);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/60'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 max-w-4xl mx-auto w-full space-y-6">
          {/* TAB 1: VEO 3 VIDEO STUDIO */}
          {activeTab === 'video' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-700 flex items-center justify-center text-cyan-400">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Veo 3.1 Video Generation & Animation</h3>
                    <p className="text-[11px] text-neutral-400">
                      Generate videos from text prompts or animate uploaded photos using <span className="text-cyan-300 font-mono">veo-3.1-fast-generate-preview</span>.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {videoAspectRatio}
                </span>
              </div>

              {/* Aspect Ratio Selector (16:9 Landscape / 9:16 Portrait) */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400 font-medium">Aspect Ratio:</span>
                <button
                  onClick={() => setVideoAspectRatio('16:9')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    videoAspectRatio === '16:9'
                      ? 'bg-cyan-500 text-black shadow-sm'
                      : 'bg-neutral-900 text-neutral-300 border border-neutral-800'
                  }`}
                >
                  16:9 Landscape
                </button>
                <button
                  onClick={() => setVideoAspectRatio('9:16')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    videoAspectRatio === '9:16'
                      ? 'bg-cyan-500 text-black shadow-sm'
                      : 'bg-neutral-900 text-neutral-300 border border-neutral-800'
                  }`}
                >
                  9:16 Portrait (Reels / Shorts)
                </button>
              </div>

              {/* Image Input for "Animate image into video" */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>Photo to Animate (Optional for Image-to-Video):</span>
                  {videoImageSource && (
                    <button
                      onClick={() => setVideoImageSource(null)}
                      className="text-red-400 hover:text-red-300 text-[11px]"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>

                {videoImageSource ? (
                  <div className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950 max-h-48 flex items-center justify-center">
                    <img src={videoImageSource.preview} alt="Source" className="max-h-48 object-contain" />
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 text-[10px] text-cyan-300 font-mono">
                      Image attached for Veo animation
                    </span>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-neutral-800 hover:border-cyan-500/60 rounded-2xl p-4 flex items-center justify-center gap-3 cursor-pointer bg-neutral-950/60 hover:bg-neutral-900/40 transition-all">
                    <Upload className="w-5 h-5 text-cyan-400" />
                    <span className="text-xs text-neutral-300">
                      Upload photo to animate into Veo video (PNG, JPG)
                    </span>
                    <input type="file" accept="image/*" onChange={handleVideoImageUpload} className="hidden" />
                  </label>
                )}
              </div>

              {/* Text Prompt */}
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  placeholder="Describe the video or motion (e.g. 'A futuristic sleek hovercar speeding across neon city skyline, cinematic lighting, 4K')..."
                  className="w-full bg-neutral-950 text-neutral-200 text-sm p-4 rounded-xl border border-neutral-800 focus:border-cyan-500 focus:outline-none resize-none"
                />

                <button
                  disabled={videoLoading || (!videoPrompt.trim() && !videoImageSource)}
                  onClick={handleGenerateVideo}
                  className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  <Video className={`w-4 h-4 ${videoLoading ? 'animate-spin' : ''}`} />
                  <span>{videoLoading ? 'Synthesizing with Veo 3.1...' : 'Generate Veo Video'}</span>
                </button>
              </div>

              {/* Generated Video Player */}
              {generatedVideo && (
                <div className="p-4 rounded-2xl bg-neutral-950 border border-cyan-900/60 space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Veo 3 Generated Video ({generatedVideo.ratio})</span>
                    </span>
                    <a
                      href={generatedVideo.url}
                      download="rodex_veo_video.mp4"
                      className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-cyan-400 text-xs flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </a>
                  </div>

                  <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center">
                    <video src={generatedVideo.url} controls autoPlay loop className="max-h-96 w-full rounded-xl" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CREATE & EDIT IMAGES */}
          {activeTab === 'image' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-700 flex items-center justify-center text-cyan-400">
                    <Wand2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Create & Edit Images (Gemini Image Intelligence)</h3>
                    <p className="text-[11px] text-neutral-400">
                      Generate pristine images from text or transform existing photos with natural language instructions.
                    </p>
                  </div>
                </div>
              </div>

              {/* Ratio Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400 font-medium">Aspect Ratio:</span>
                {(['1:1', '16:9', '9:16'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setImageAspectRatio(r)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                      imageAspectRatio === r
                        ? 'bg-cyan-500 text-black'
                        : 'bg-neutral-900 text-neutral-300 border border-neutral-800'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* Image to Edit Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>Source Image (Upload to Edit & Transform):</span>
                  {sourceImageToEdit && (
                    <button
                      onClick={() => setSourceImageToEdit(null)}
                      className="text-red-400 hover:text-red-300 text-[11px]"
                    >
                      Clear Source
                    </button>
                  )}
                </div>

                {sourceImageToEdit ? (
                  <div className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950 max-h-48 flex items-center justify-center">
                    <img src={sourceImageToEdit.preview} alt="Edit Source" className="max-h-48 object-contain" />
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 text-[10px] text-purple-300 font-mono">
                      Image loaded for editing
                    </span>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-neutral-800 hover:border-cyan-500/60 rounded-2xl p-4 flex items-center justify-center gap-3 cursor-pointer bg-neutral-950/60 hover:bg-neutral-900/40 transition-all">
                    <Camera className="w-5 h-5 text-purple-400" />
                    <span className="text-xs text-neutral-300">
                      Upload photo to edit (or leave empty to create from scratch)
                    </span>
                    <input type="file" accept="image/*" onChange={handleImageEditUpload} className="hidden" />
                  </label>
                )}
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder={
                    sourceImageToEdit
                      ? "Describe the edits (e.g. 'Add a glowing cybernetic overlay, adjust lighting to sunset, change background to mountains')..."
                      : "Describe the image to create (e.g. 'An ultra-realistic futuristic AI laboratory with holographic interfaces')..."
                  }
                  className="w-full bg-neutral-950 text-neutral-200 text-sm p-4 rounded-xl border border-neutral-800 focus:border-cyan-500 focus:outline-none resize-none"
                />

                <button
                  disabled={imageLoading || !imagePrompt.trim()}
                  onClick={handleGenerateImage}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-90 text-black font-bold text-sm disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  <Wand2 className={`w-4 h-4 ${imageLoading ? 'animate-spin' : ''}`} />
                  <span>
                    {imageLoading
                      ? 'Generating visual image...'
                      : sourceImageToEdit
                      ? 'Apply AI Image Edits'
                      : 'Create New Image'}
                  </span>
                </button>
              </div>

              {/* Result Preview */}
              {generatedImage && (
                <div className="p-4 rounded-2xl bg-neutral-950 border border-cyan-900/60 space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{generatedImage.isEdit ? 'AI Edited Image' : 'AI Created Image'}</span>
                    </span>
                    <a
                      href={generatedImage.url}
                      download="rodex_ai_image.png"
                      className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-cyan-400 text-xs flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Save</span>
                    </a>
                  </div>

                  <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center p-2">
                    <img src={generatedImage.url} alt="Result" className="max-h-96 rounded-xl object-contain" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GOOGLE MAPS GROUNDING */}
          {activeTab === 'maps' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-700 flex items-center justify-center text-emerald-400">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Google Maps Grounding (gemini-3.5-flash)</h3>
                    <p className="text-[11px] text-neutral-400">
                      Real-time geographical grounding, addresses, navigation routes, and places of interest.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Preset Queries */}
              <div className="flex flex-wrap gap-2">
                {[
                  'Directions from Fort Portal Karuzika Palace to Kampala',
                  'Top landmark attractions in Entebbe, Uganda',
                  'Tech innovation hubs and universities around Kampala',
                  'Hotels near Kibale National Park for chimpanzee tracking',
                ].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setMapsQuery(preset);
                      handleExecuteMaps(preset);
                    }}
                    className="text-xs px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-emerald-500/50 text-neutral-300 transition-all flex items-center gap-1.5"
                  >
                    <MapPin className="w-3 h-3 text-emerald-400" />
                    <span>{preset}</span>
                  </button>
                ))}
              </div>

              {/* Maps Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={mapsQuery}
                  onChange={(e) => setMapsQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleExecuteMaps()}
                  placeholder="Search locations, routes, or places via Google Maps..."
                  className="flex-1 bg-neutral-950 text-neutral-200 text-sm px-4 py-3 rounded-xl border border-neutral-800 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  disabled={mapsLoading || !mapsQuery.trim()}
                  onClick={() => handleExecuteMaps()}
                  className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs disabled:opacity-40 transition-all flex items-center gap-1.5"
                >
                  <MapPin className={`w-4 h-4 ${mapsLoading ? 'animate-spin' : ''}`} />
                  <span>{mapsLoading ? 'Mapping...' : 'Search Maps'}</span>
                </button>
              </div>

              {/* Maps Results Card */}
              {mapsResult && (
                <div className="p-4 rounded-2xl bg-neutral-950 border border-emerald-900/60 space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Google Maps Verified Result</span>
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">{mapsResult.modelUsed}</span>
                  </div>

                  <p className="text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap">{mapsResult.text}</p>

                  {mapsResult.places && mapsResult.places.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-neutral-900">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        Google Maps Locations:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {mapsResult.places.map((place, pIdx) => (
                          <a
                            key={pIdx}
                            href={place.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-emerald-500/50 transition-all block"
                          >
                            <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-400 mb-0.5">
                              <span>{place.title || 'Location'}</span>
                              <ExternalLink className="w-3 h-3" />
                            </div>
                            {place.address && <p className="text-[10px] text-neutral-400 truncate">{place.address}</p>}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: GOOGLE SEARCH GROUNDING */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-700 flex items-center justify-center text-cyan-400">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Google Search Grounding (gemini-3.5-flash)</h3>
                    <p className="text-[11px] text-neutral-400">
                      Real-time Google search indexing with URL citations and live world intelligence.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleExecuteSearch()}
                  placeholder="Ask any current world topic or fact..."
                  className="flex-1 bg-neutral-950 text-neutral-200 text-sm px-4 py-3 rounded-xl border border-neutral-800 focus:border-cyan-500 focus:outline-none"
                />
                <button
                  disabled={searchLoading || !searchQuery.trim()}
                  onClick={() => handleExecuteSearch()}
                  className="px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs disabled:opacity-40 transition-all flex items-center gap-1.5"
                >
                  <Search className={`w-4 h-4 ${searchLoading ? 'animate-spin' : ''}`} />
                  <span>{searchLoading ? 'Searching...' : 'Google Search'}</span>
                </button>
              </div>

              {searchResult && (
                <div className="p-4 rounded-2xl bg-neutral-950 border border-cyan-900/60 space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      <span>Search Grounded Intelligence</span>
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">{searchResult.modelUsed}</span>
                  </div>

                  <p className="text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap">{searchResult.text}</p>

                  {searchResult.sources && searchResult.sources.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-neutral-900">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-400">
                        Citations & Web Sources ({searchResult.sources.length}):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {searchResult.sources.map((src, sIdx) => (
                          <a
                            key={sIdx}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-cyan-500/50 transition-all block"
                          >
                            <div className="flex items-center justify-between text-[10px] font-semibold text-cyan-400 mb-0.5">
                              <span className="truncate">{src.domain || 'Source'}</span>
                              <ExternalLink className="w-3 h-3 text-neutral-500" />
                            </div>
                            <p className="text-xs text-neutral-200 truncate">{src.title || src.url}</p>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: FIREBASE CLOUD GALLERY */}
          {activeTab === 'gallery' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-700 flex items-center justify-center text-cyan-400">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Firebase Firestore Cloud Creations</h3>
                    <p className="text-[11px] text-neutral-400">
                      Persistent storage for your Veo videos, created images, and AI artwork.
                    </p>
                  </div>
                </div>
                <button
                  onClick={loadSavedCreations}
                  className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {savedCreations.length === 0 ? (
                <div className="p-8 rounded-2xl bg-neutral-950/60 border border-neutral-900 text-center space-y-2">
                  <Film className="w-8 h-8 text-neutral-600 mx-auto" />
                  <p className="text-xs text-neutral-400">No saved creations yet.</p>
                  <p className="text-[11px] text-neutral-500">
                    Generate a Veo video or create an image above and it will automatically sync to your Firestore account!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {savedCreations.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-cyan-500/50 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between text-[10px] text-cyan-400 font-mono">
                        <span className="uppercase">{item.type}</span>
                        <span>{item.aspectRatio}</span>
                      </div>

                      {item.type === 'video' ? (
                        <video src={item.mediaUrl} controls className="w-full h-36 rounded-xl object-cover bg-black" />
                      ) : (
                        <img src={item.mediaUrl} alt="Creation" className="w-full h-36 rounded-xl object-cover bg-black" />
                      )}

                      <p className="text-xs text-neutral-300 line-clamp-2 leading-tight">{item.prompt}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
