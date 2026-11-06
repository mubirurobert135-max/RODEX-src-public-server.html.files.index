import React from 'react';

interface AndroidFrameProps {
  children: React.ReactNode;
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({ children }) => {
  return (
    <div
      id="rodex-app-root"
      className="w-full h-[100dvh] min-h-0 bg-black text-white flex flex-col relative select-none overflow-hidden"
    >
      {/* Subtle deep ambient background glow that dynamically spans the screen */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0">
        <div className="w-[85vw] max-w-[1000px] h-[85vw] max-h-[1000px] rounded-full bg-cyan-950/25 blur-[160px] opacity-50 transition-all duration-1000" />
      </div>

      {/* Full screen assistant window adapting fluidly to whatever screen accesses it */}
      <div
        id="rodex-assistant-window"
        className="w-full h-full min-h-0 flex-1 flex flex-col overflow-hidden relative z-10"
      >
        {children}
      </div>
    </div>
  );
};


