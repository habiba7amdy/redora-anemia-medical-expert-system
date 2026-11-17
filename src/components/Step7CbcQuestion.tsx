import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, FileCheck, FileQuestion, CheckCircle2, BookmarkCheck } from 'lucide-react';
import { LAB_PARAMETERS } from '../medical/parameters';

interface Step7CbcQuestionProps {
  onYesHaveReport: () => void;
  onNoNoReport: () => void;
  onBack: () => void;
}

export const Step7CbcQuestion: React.FC<Step7CbcQuestionProps> = ({
  onYesHaveReport,
  onNoNoReport,
  onBack,
}) => {
  const [showNoReportDetails, setShowNoReportDetails] = useState(false);

  const coreCbcIds = new Set(['hb', 'mcv', 'mch', 'rbc']);
  const cbcParameters = LAB_PARAMETERS.filter(p => coreCbcIds.has(p.id));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="mb-6">
        <span className="text-xs font-semibold text-[#8B3A4A] tracking-wider uppercase">Essential Laboratory Step</span>
        <h2 className="text-2xl font-bold text-stone-900 mt-1">Have you already completed a Complete Blood Count (CBC)?</h2>
        <p className="text-sm text-stone-600 mt-1">
          A Complete Blood Count (CBC) is required to measure hemoglobin and red blood cell indices before classifying anemia.
        </p>
      </div>

      {!showNoReportDetails ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
          {/* Option A: Yes */}
          <button
            type="button"
            onClick={onYesHaveReport}
            className="p-6 bg-white hover:bg-[#FDF2F4]/50 border-2 border-stone-200 hover:border-[#8B3A4A] rounded-2xl text-left transition-all flex flex-col justify-between group shadow-sm cursor-pointer"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#FDF2F4] text-[#8B3A4A] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <FileCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-stone-900 group-hover:text-[#6A2434] mb-2">
                Yes, I have CBC results
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Enter just 4 core CBC values (Hb, MCV, MCH, RBC) with automatic unit conversion and preliminary classification.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs font-bold text-[#8B3A4A]">
              <span>Continue to Basic CBC Entry</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Option B: No */}
          <button
            type="button"
            onClick={() => setShowNoReportDetails(true)}
            className="p-6 bg-white hover:bg-stone-50 border-2 border-stone-200 hover:border-stone-400 rounded-2xl text-left transition-all flex flex-col justify-between group shadow-sm cursor-pointer"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <FileQuestion className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-stone-900 mb-2">
                No, I don't have CBC results yet
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Learn what a CBC measures, why it is needed before classifying anemia, and generate a preliminary summary to bring to your physician.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs font-bold text-stone-700">
              <span>View CBC Details &amp; Guidance</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
      ) : (
        <div className="space-y-6 mb-8 animate-in fade-in">
          <div className="p-6 bg-white border border-stone-200 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-stone-900">
                  What is a Complete Blood Count (CBC) and why is it required first?
                </h3>
                <span className="text-xs text-stone-500 font-mono">Complete Blood Count (CBC / FBC)</span>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
                Standard First-Line Blood Test
              </span>
            </div>

            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              A CBC is a routine blood test from a small venous sample that measures hemoglobin concentration and red cell indices. Symptoms alone cannot confirm or classify anemia—Redora uses 4 core CBC values first to guide targeted differential testing.
            </p>

            {/* Key CBC Parameters */}
            <div>
              <h4 className="text-xs font-bold text-stone-900 mb-2.5">4 Core Indices Used for Initial Classification:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {cbcParameters.map(param => (
                  <div key={param.id} className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#8B3A4A] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-stone-900 block">{param.nameEn}</span>
                      <span className="text-[10px] text-stone-500 mt-0.5 block">{param.descriptionAr}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-[#FDF2F4] border border-[#F8E7EB] rounded-xl text-xs text-[#6A2434] leading-relaxed">
              <strong>Important Medical Note:</strong> Redora never claims anemia is confirmed based on symptoms alone. Please obtain a CBC through your physician or laboratory and return to enter your results.
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={onNoNoReport}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[#8B3A4A] to-[#6A2434] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <BookmarkCheck className="w-4 h-4" />
                <span>View Preliminary Summary & CBC Recommendation</span>
              </button>

              <button
                type="button"
                onClick={() => setShowNoReportDetails(false)}
                className="text-xs font-semibold text-stone-600 hover:text-stone-900 underline cursor-pointer"
              >
                Change Answer (I have CBC results to enter now)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back Button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 border border-stone-300 hover:bg-stone-100 rounded-xl text-stone-700 text-sm font-semibold flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Initial Assessment</span>
        </button>
      </div>
    </div>
  );
};
