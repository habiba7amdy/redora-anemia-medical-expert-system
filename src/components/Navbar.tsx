import React from 'react';
import { Activity, BookOpen, RotateCcw } from 'lucide-react';

interface NavbarProps {
  currentStep: number;
  onNavigateStep: (step: number) => void;
  onOpenKnowledgeBase: () => void;
  onResetAssessment: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentStep,
  onNavigateStep,
  onOpenKnowledgeBase,
  onResetAssessment,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          onClick={() => onNavigateStep(1)}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 group focus:outline-none cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B3A4A] to-[#6A2434] flex items-center justify-center text-white shadow-sm shadow-[#8B3A4A]/20 group-hover:scale-105 transition-transform">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-[#6A2434]">
              Redora
            </span>
          </div>
        </button>

        {/* Zone 2: Clean Single-Line Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
          <button
            onClick={() => onNavigateStep(1)}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${currentStep === 1 ? 'text-[#8B3A4A] font-bold' : 'hover:text-stone-900'}`}
          >
            Home
          </button>
          <button
            onClick={() => onNavigateStep(2)}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${currentStep >= 2 && currentStep <= 12 ? 'text-[#8B3A4A] font-bold' : 'hover:text-stone-900'}`}
          >
            Anemia Assessment
          </button>
          <button
            onClick={onOpenKnowledgeBase}
            className="whitespace-nowrap shrink-0 hover:text-stone-900 transition-colors flex items-center gap-1.5 text-stone-700 cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-[#8B3A4A]" />
            <span>Medical Knowledge Base</span>
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onResetAssessment}
            className="px-3.5 py-2 text-xs font-semibold text-[#6A2434] bg-stone-100 hover:bg-[#FDF2F4] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            title="Reset and start a new assessment"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Assessment</span>
          </button>
        </div>
      </div>
    </header>
  );
};
