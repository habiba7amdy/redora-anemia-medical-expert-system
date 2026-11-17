import React from 'react';
import { Check } from 'lucide-react';

interface ProgressTrackerProps {
  currentStep: number;
  totalSteps?: number;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ currentStep }) => {
  const stages = [
    { id: 2, label: 'Initial Assessment' },
    { id: 7, label: 'CBC Check' },
    { id: 10, label: 'Basic CBC' },
    { id: 11, label: 'Targeted Tests' },
    { id: 12, label: 'Final Report' },
  ];

  if (currentStep === 1) return null;

  return (
    <div className="bg-white border-b border-stone-200 py-3 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto flex items-center justify-between overflow-x-auto gap-2 no-scrollbar">
        {stages.map((stage, idx) => {
          const isPassed = currentStep > stage.id;
          const isCurrent =
            currentStep === stage.id ||
            (idx < stages.length - 1 && currentStep > stage.id && currentStep < stages[idx + 1].id);

          return (
            <div key={stage.id} className="flex items-center gap-2 whitespace-nowrap shrink-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  isPassed
                    ? 'bg-[#8B3A4A] text-white'
                    : isCurrent
                    ? 'bg-[#FDF2F4] text-[#8B3A4A] border-2 border-[#8B3A4A]'
                    : 'bg-stone-100 text-stone-400'
                }`}
              >
                {isPassed ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
              </div>
              <span
                className={`text-xs font-medium ${
                  isCurrent ? 'text-[#8B3A4A] font-bold' : isPassed ? 'text-stone-700' : 'text-stone-400'
                }`}
              >
                {stage.label}
              </span>
              {idx < stages.length - 1 && (
                <div className={`w-4 sm:w-8 h-[1px] ${isPassed ? 'bg-[#8B3A4A]' : 'bg-stone-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
