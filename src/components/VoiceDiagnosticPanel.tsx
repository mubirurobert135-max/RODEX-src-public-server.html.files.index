import React, { useState, useEffect } from 'react';
import { globalLiveConversationService, LiveMetrics, DetailedAudioDiagnostics } from '../services/liveConversationService';

interface VoiceDiagnosticPanelProps {
  assistantState: string;
  lastTranscript?: string;
  wakeMatched?: boolean;
  capturedCommand?: string;
  aiRequestState?: string;
  aiResponseState?: string;
  ttsState?: string;
}

export const VoiceDiagnosticPanel: React.FC<VoiceDiagnosticPanelProps> = ({
  assistantState,
}) => {
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics>(globalLiveConversationService.getMetrics());
  const [diag, setDiag] = useState<DetailedAudioDiagnostics>(globalLiveConversationService.getDiagnosticState());
  const [liveLogs, setLiveLogs] = useState<Array<{ id: string; time: string; text: string }>>([]);
  const [lastActionFeedback, setLastActionFeedback] = useState<string>('NONE');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveMetrics(globalLiveConversationService.getMetrics());
      setDiag(globalLiveConversationService.getDiagnosticState());
      setLiveLogs(globalLiveConversationService.getDiagnosticLogs());
    }, 80);

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) {
    return (
      <button
        type="button"
        onClick={() => setIsVisible(true)}
        className="fixed bottom-3 right-3 z-[99999] px-3 py-1.5 bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs font-mono rounded shadow-lg hover:bg-emerald-900 cursor-pointer pointer-events-auto"
      >
        [VOICE-LIVE-006]
      </button>
    );
  }

  const getStatusBadge = (val: 'WAITING' | 'RUNNING' | 'PASS' | 'FAIL' | string) => {
    if (val === 'PASS') {
      return <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-500/60 rounded font-bold text-[9px]">PASS</span>;
    }
    if (val === 'RUNNING') {
      return <span className="px-1.5 py-0.2 bg-cyan-950 text-cyan-300 border border-cyan-500/60 rounded font-bold text-[9px] animate-pulse">RUNNING</span>;
    }
    if (val === 'FAIL') {
      return <span className="px-1.5 py-0.2 bg-rose-950 text-rose-300 border border-rose-500/60 rounded font-bold text-[9px]">FAIL</span>;
    }
    return <span className="px-1.5 py-0.2 bg-neutral-900 text-neutral-400 border border-neutral-700 rounded text-[9px]">{val || 'WAITING'}</span>;
  };

  const handleStartNormalOrbVoice = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLastActionFeedback('START NORMAL ORB VOICE CLICKED');
    try {
      // The click is a trusted gesture: unlock input/output audio even when
      // automatic startup already has the microphone stream open.
      void globalLiveConversationService.unlockVoiceAudio();
      await globalLiveConversationService.startNormalOrbVoice();
    } catch (err: any) {
      console.error('[Start Normal Orb Error]', err);
    }
  };

  const handleSpeakerTestClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLastActionFeedback('TEST SPEAKER CLICKED');
    try {
      await globalLiveConversationService.testSpeaker();
    } catch (err: any) {
      console.error('[Speaker Test Error]', err);
    }
  };

  const handleGeneratedAudioClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLastActionFeedback('TEST GENERATED AUDIO CLICKED');
    try {
      await globalLiveConversationService.testGeneratedAudio();
    } catch (err: any) {
      console.error('[Generated Audio Error]', err);
    }
  };

  const handleLiveTextResponseClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLastActionFeedback('TEST LIVE TEXT RESPONSE CLICKED');
    setIsProcessing(true);
    try {
      void globalLiveConversationService.unlockVoiceAudio();
      await globalLiveConversationService.testLiveTextResponse('Say exactly: RODEX AUDIO TEST');
    } catch (err: any) {
      console.error('[Live Text Response Error]', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePlayAgainClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLastActionFeedback('PLAY LAST RESPONSE AGAIN CLICKED');
    try {
      await globalLiveConversationService.playLastResponseAgain();
    } catch (err: any) {
      console.error('[Play Again Error]', err);
    }
  };

  return (
    <div
      style={{ pointerEvents: 'auto' }}
      className="fixed bottom-2 right-2 w-[510px] max-w-[97vw] max-h-[96vh] z-[99999] bg-neutral-950/95 border-2 border-cyan-500/70 text-emerald-300 font-mono text-[11px] p-3 rounded-lg shadow-2xl overflow-y-auto flex flex-col gap-2 backdrop-blur-md select-none"
    >
      {/* Header Banner */}
      <div className="flex items-center justify-between pb-1.5 border-b border-cyan-900/80 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-bold text-white text-xs tracking-wider">RODEX LIVE VOICE ACTIVATION</span>
          <span className="px-1.5 py-0.5 bg-cyan-950/90 text-cyan-200 text-[10px] rounded font-bold border border-cyan-400">
            VOICE-LIVE-006
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsVisible(false)}
          className="text-neutral-400 hover:text-white text-xs cursor-pointer px-1 py-0.5 border border-neutral-700 rounded bg-neutral-900"
          title="Minimize diagnostic panel"
        >
          ✕ MIN
        </button>
      </div>

      {/* Normal Orb Live Voice Real-Time State Diagnostics (Requirement 10) */}
      <div className="bg-cyan-950/40 border border-cyan-500/50 p-2 rounded flex flex-col gap-1 text-[9.5px] shrink-0">
        <div className="flex justify-between items-center border-b border-cyan-900/60 pb-1">
          <span className="text-cyan-300 font-bold uppercase tracking-wider">Normal Orb Engine State</span>
          <span className="text-amber-300 font-bold">WAKE MATCH: {diag.wakeMatch ? 'TRUE' : 'FALSE'}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-0.5">
          <div>
            <span className="text-neutral-400">ORB VOICE STATE: </span>
            <span className="text-cyan-200 font-bold">{diag.orbVoiceState || assistantState.toUpperCase()}</span>
          </div>
          <div>
            <span className="text-neutral-400">VOICE ENGINE: </span>
            <span className="text-emerald-300 font-bold">{diag.voiceEngine}</span>
          </div>
          <div className="col-span-2 truncate">
            <span className="text-neutral-400">LAST WAKE TRANSCRIPT: </span>
            <span className="text-amber-200 font-semibold">{diag.lastWakeTranscript}</span>
          </div>
          <div className="col-span-2 truncate">
            <span className="text-neutral-400">LAST COMMAND: </span>
            <span className="text-cyan-200 font-semibold">{diag.lastCommand}</span>
          </div>
          <div>
            <span className="text-neutral-400">LIVE CONNECTION: </span>
            <span className={diag.liveConnection === 'PASS' ? 'text-emerald-300 font-bold' : 'text-amber-400 font-bold'}>
              {diag.liveConnection}
            </span>
          </div>
          <div>
            <span className="text-neutral-400">MIC STREAM: </span>
            <span className="text-emerald-300 font-mono">{diag.micStreamId}</span>
          </div>
          <div>
            <span className="text-neutral-400">LIVE UPSTREAM: </span>
            <span className={diag.upstreamConnected ? 'text-emerald-300 font-bold' : diag.liveConnection === 'FAIL' ? 'text-rose-300 font-bold' : 'text-amber-300 font-bold'}>
              {diag.upstreamConnected ? 'READY' : diag.liveConnection === 'FAIL' ? 'FAIL' : 'WAITING'}
            </span>
          </div>
          <div>
            <span className="text-neutral-400">WAKE RECOGNIZER: </span>
            <span className={diag.wakeRecognizerState === 'LISTENING' ? 'text-emerald-300 font-bold' : diag.wakeRecognizerState.startsWith('ERROR') || diag.wakeRecognizerState === 'UNAVAILABLE' ? 'text-rose-300 font-bold' : 'text-amber-300 font-bold'}>
              {diag.wakeRecognizerState}
            </span>
          </div>
          <div>
            <span className="text-neutral-400">INPUT AUDIO CTX: </span>
            <span className={diag.inputAudioContextState === 'running' ? 'text-emerald-300' : 'text-amber-300'}>
              {diag.inputAudioContextState.toUpperCase()}
            </span>
          </div>
          <div>
            <span className="text-neutral-400">MIC TRACK: </span>
            <span className={diag.micTrackState === 'LIVE' ? 'text-emerald-300' : 'text-amber-300'}>
              {diag.micTrackState}
            </span>
          </div>
          <div>
            <span className="text-neutral-400">AUDIO FRAMES: </span>
            <span className="text-cyan-200">{diag.audioChunksSent}</span>
          </div>
          <div>
            <span className="text-neutral-400">MIC LEVEL: </span>
            <span className={diag.micInputLevel > 0.01 ? 'text-emerald-300' : 'text-amber-300'}>
              {diag.micInputLevel.toFixed(3)}
            </span>
          </div>
          <div className="col-span-2 truncate">
            <span className="text-neutral-400">LAST SPEECH TRANSCRIPT: </span>
            <span className="text-cyan-200">{diag.lastRecognizedTranscript}</span>
          </div>
        </div>
      </div>

      {/* Immediate Visible Feedback of Last Action */}
      <div className="flex items-center justify-between px-2 py-1 bg-cyan-950/70 border border-cyan-500/50 rounded shrink-0">
        <span className="text-neutral-300 text-[9.5px]">LAST ACTION:</span>
        <span className="text-cyan-200 font-bold text-[10px] tracking-wide animate-pulse truncate max-w-[340px]">
          {lastActionFeedback !== 'NONE' ? lastActionFeedback : diag.lastAction}
        </span>
      </div>

      {/* Error Alert Banner if any exception occurs */}
      {diag.lastErrorMessage && (
        <div className="px-2 py-1 bg-rose-950/90 border border-rose-500 text-rose-200 text-[10px] font-bold rounded shrink-0 flex items-center justify-between">
          <span>{diag.lastErrorMessage}</span>
          <button
            type="button"
            onClick={() => {
              diag.lastErrorMessage = null;
            }}
            className="text-rose-300 hover:text-white text-[9px] px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Action Controls: Developer Auto-Start & Tests (Requirements 1, 6, 11) */}
      <div className="grid grid-cols-2 gap-1.5 shrink-0 pt-0.5">
        <button
          type="button"
          onClick={handleStartNormalOrbVoice}
          className="col-span-2 py-2 px-2 bg-emerald-900 hover:bg-emerald-800 active:bg-emerald-700 border-2 border-emerald-400 text-emerald-100 text-[10.5px] font-bold rounded cursor-pointer transition-all text-center uppercase tracking-wider shadow-lg active:scale-98"
        >
          ► START NORMAL ORB VOICE (AUTO-START TEST)
        </button>

        <button
          type="button"
          onClick={handleSpeakerTestClick}
          className="py-1.5 px-2 bg-amber-950 hover:bg-amber-900 active:bg-amber-800 border border-amber-500 text-amber-200 text-[9.5px] font-bold rounded cursor-pointer transition-all text-center uppercase tracking-wider active:scale-98"
        >
          1. TEST SPEAKER
        </button>

        <button
          type="button"
          onClick={handleGeneratedAudioClick}
          className="py-1.5 px-2 bg-purple-950 hover:bg-purple-900 active:bg-purple-800 border border-purple-500 text-purple-200 text-[9.5px] font-bold rounded cursor-pointer transition-all text-center uppercase tracking-wider active:scale-98"
        >
          2. TEST GENERATED AUDIO
        </button>

        <button
          type="button"
          onClick={handleLiveTextResponseClick}
          className="py-1.5 px-2 bg-cyan-950 hover:bg-cyan-900 active:bg-cyan-800 border border-cyan-400 text-cyan-100 text-[9.5px] font-bold rounded cursor-pointer transition-all text-center uppercase tracking-wider active:scale-98"
        >
          3. TEST LIVE TEXT
        </button>

        <button
          type="button"
          onClick={handlePlayAgainClick}
          className="py-1.5 px-2 bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 border border-neutral-600 text-neutral-200 text-[9.5px] font-bold rounded cursor-pointer transition-all text-center uppercase tracking-wider active:scale-98"
        >
          4. PLAY LAST RESPONSE
        </button>
      </div>

      {/* Stage Verification Status Matrix */}
      <div className="bg-neutral-900/90 p-1.5 rounded border border-neutral-800 shrink-0 flex flex-col gap-0.5 text-[9.5px]">
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-0.5">
          <div className="flex items-center justify-between p-0.5 px-1 bg-black/50 rounded border border-neutral-800">
            <span className="text-neutral-400">AUDIO DATA RECV:</span>
            {getStatusBadge(diag.audioDataReceived)}
          </div>
          <div className="flex items-center justify-between p-0.5 px-1 bg-black/50 rounded border border-neutral-800">
            <span className="text-neutral-400">AUDIO DATA VALID:</span>
            {getStatusBadge(diag.audioDataValid)}
          </div>

          <div className="flex items-center justify-between p-0.5 px-1 bg-black/50 rounded border border-neutral-800">
            <span className="text-neutral-400">AUDIO GRAPH:</span>
            {getStatusBadge(diag.audioGraphActive)}
          </div>
          <div className="flex items-center justify-between p-0.5 px-1 bg-black/50 rounded border border-neutral-800">
            <span className="text-neutral-400">OUTPUT SIGNAL:</span>
            {getStatusBadge(diag.outputSignalDetected)}
          </div>

          <div className="flex items-center justify-between p-0.5 px-1 bg-black/50 rounded border border-neutral-800">
            <span className="text-neutral-400">PLAYBACK START:</span>
            {getStatusBadge(diag.playbackStarted)}
          </div>
          <div className="flex items-center justify-between p-0.5 px-1 bg-black/50 rounded border border-neutral-800">
            <span className="text-neutral-400">PLAYBACK END:</span>
            {getStatusBadge(diag.playbackEnded)}
          </div>
        </div>
      </div>

      {/* Live Event Stream Box */}
      <div className="flex-1 flex flex-col gap-1 min-h-[110px] max-h-[140px] bg-black/95 p-1.5 rounded border border-cyan-950 overflow-hidden text-[9px]">
        <div className="text-neutral-400 text-[8.5px] uppercase tracking-wider border-b border-neutral-800 pb-0.5 shrink-0 flex justify-between">
          <span>Live Response Trace ({liveLogs.length} events)</span>
          <span className="text-neutral-600">Auto-scrolling</span>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 pr-1 font-mono">
          {liveLogs.length === 0 ? (
            <span className="italic text-neutral-600 py-2 text-center">Waiting for audio events...</span>
          ) : (
            liveLogs.map((log) => (
              <div key={log.id} className="leading-snug text-neutral-300 break-words">
                <span className="text-cyan-600 mr-1.5">[{log.time}]</span>
                <span
                  className={
                    log.text.includes('CONNECTED') || log.text.includes('OUTPUT SOURCE') || log.text.includes('VERIFIED') || log.text.includes('WAKE MATCH = TRUE')
                      ? 'text-emerald-300 font-bold'
                      : log.text.includes('CLICKED') || log.text.includes('WAKE') || log.text.includes('ORB') || log.text.includes('VOICE ENGINE')
                      ? 'text-amber-300 font-bold'
                      : log.text.includes('AUDIO BYTES') || log.text.includes('MODEL') || log.text.includes('TRANSCRIPT') || log.text.includes('COMMAND')
                      ? 'text-cyan-300 font-semibold'
                      : log.text.includes('ERROR') || log.text.includes('FAILURE') || log.text.includes('SILENT') || log.text.includes('NO STORED')
                      ? 'text-rose-400 font-bold'
                      : 'text-neutral-300'
                  }
                >
                  {log.text}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
