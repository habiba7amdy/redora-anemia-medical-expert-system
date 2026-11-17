import React, { useEffect, useState } from 'react';
import { Activity, ShieldCheck, ArrowRight } from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onFinish, 300);
          return 100;
        }
        return prev + 5;
      });
    }, 70);

    return () => clearInterval(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-[#6A2434] via-[#7D2C3D] to-[#4A1622] text-white p-6 select-none animate-in fade-in duration-500 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Background Decorative Rings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full border border-white/20 blur-sm" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full border border-white/20 blur-sm" />
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-sm w-full text-center">
        {/* Animated Icon */}
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl relative">
            <Activity className="w-12 h-12 text-[#FDF2F4] animate-pulse" />
          </div>
          <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-[#C27D8C] to-[#8B3A4A] opacity-30 blur-md -z-10 animate-pulse" />
        </div>

        {/* Brand Name */}
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-2">
          Redora
        </h1>

        {/* Tagline */}
        <p className="text-base sm:text-lg text-[#FCE8EC] font-medium mb-8">
          "Beyond Iron. Beyond Symptoms."
        </p>

        {/* Diagnostic Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs text-[#FDF2F4] mb-8 backdrop-blur-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-[#F8C9B9]" />
          <span>Rule-Based Anemia Differential Diagnosis System</span>
        </div>

        {/* Loading Progress Bar */}
        <div className="w-full bg-white/15 h-1.5 rounded-full overflow-hidden mb-3">
          <div
            className="bg-gradient-to-r from-[#F8C9B9] to-white h-full transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between w-full text-[11px] text-white/60 font-mono mb-6">
          <span>Initializing medical rules...</span>
          <span>{progress}%</span>
        </div>

        {/* Skip button */}
        <button
          type="button"
          onClick={onFinish}
          className="text-xs text-white/80 hover:text-white px-4 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <span>Skip & Start Now</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
