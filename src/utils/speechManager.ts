// RODEX Speech Manager Compatibility Bridge
// Single authoritative controller mapped to VoiceLifecycleManager
import {
  globalVoiceManager,
  VoiceLifecycleManager,
  VoiceManagerCallbacks,
} from './voiceLifecycleManager';
import { VoiceEngineState } from '../types';

export type RecognitionState =
  | 'idle'
  | 'listening_wake'
  | 'wake_detected'
  | 'listening_command'
  | 'ready_for_followup'
  | 'processing'
  | 'speaking'
  | 'error'
  | VoiceEngineState;

export type SpeechManagerCallbacks = VoiceManagerCallbacks;

export const globalSpeechManager = globalVoiceManager;
export { VoiceLifecycleManager as SpeechRecognitionManager };
