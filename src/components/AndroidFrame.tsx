import React, { useState, useEffect } from 'react';
import { Wifi, Battery, Smartphone, Maximize2 } from 'lucide-react';

interface AndroidFrameProps {
  children: React.ReactNode;
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({ children }) => {
  const [time, setTime] = useState('12:45');
  const [isFramed, setIsFramed] = useState(false); // Auto-detect mobile vs desktop

  useEffect(() => {
    // Check if on wide screen, default to framed view on desktop for mobile feel
    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 768) {
        setIsFramed(true);
      }
    }

    const updateClock = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative select-none">
      {/* Frame view switcher button (top right floating pill on wide screens) */}
      <div className="hidden md:flex fixed top-4 right-4 z-50 items-center gap-2 bg-neutral-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-neutral-800 text-xs text-neutral-400">
        <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
        <span>Android Prototype</span>
        <button
          onClick={() => setIsFramed(!isFramed)}
          className="ml-1 text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
        >
          <Maximize2 className="w-3 h-3" />
          <span>{isFramed ? 'Full Width' : 'Device Shell'}</span>
        </button>
      </div>

      {/* Main Container */}
      <div
        className={`w-full transition-all duration-300 relative flex flex-col overflow-hidden bg-black ${
          isFramed
            ? 'max-w-[412px] h-[892px] max-h-[92vh] rounded-[48px] border-[6px] border-neutral-800 shadow-[0_0_80px_rgba(6,182,212,0.15)] ring-1 ring-neutral-700/50'
            : 'max-w-md h-screen'
        }`}
      >
        {/* Android Status Bar */}
        <div className="h-10 px-6 flex items-center justify-between text-[13px] font-medium text-neutral-300 z-30 select-none bg-black">
          <span>{time}</span>

          {/* Android Punch Hole Camera */}
          <div className="w-4 h-4 rounded-full bg-neutral-950 border border-neutral-800/80 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
          </div>

          <div className="flex items-center gap-2 text-neutral-400">
            <span className="text-[10px] font-bold text-neutral-400 tracking-wider">5G</span>
            <Wifi className="w-3.5 h-3.5" />
            <div className="flex items-center gap-0.5">
              <Battery className="w-4 h-4 rotate-90" />
            </div>
          </div>
        </div>

        {/* Application Core View */}
        <div className="flex-1 relative flex flex-col overflow-hidden bg-black">
          {children}
        </div>

        {/* Android Gesture Navigation Bar */}
        <div className="h-4 bg-black flex items-center justify-center pb-1 z-30 select-none">
          <div className="w-32 h-1 bg-neutral-700/80 rounded-full" />
        </div>
      </div>
    </div>
  );
};
