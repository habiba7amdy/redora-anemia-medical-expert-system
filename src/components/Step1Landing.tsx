import React from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, FileText, AlertTriangle, Sparkles } from 'lucide-react';

interface Step1LandingProps {
  onStart: () => void;
}

export const Step1Landing: React.FC<Step1LandingProps> = ({ onStart }) => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
      {/* Hero Badge */}
      <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#8B3A4A] bg-[#FDF2F4] border border-[#F8E7EB] py-1.5 px-3.5 rounded-full w-fit mx-auto mb-6">
        <Sparkles className="w-3.5 h-3.5 text-[#8B3A4A]" />
        <span>Rule-Based Medical Knowledge System · WHO 2024 Standards</span>
      </div>

      {/* Main Headline */}
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#6A2434] tracking-tight leading-tight mb-4">
          Understand your symptoms. <span className="text-[#8B3A4A]">Explore your blood results.</span>
        </h1>
        <p className="text-lg md:text-xl text-[#94384B] font-medium mb-3">
          "Beyond Iron. Beyond Symptoms."
        </p>
        <p className="text-base text-stone-600 leading-relaxed max-w-2xl mx-auto mb-8">
          Anemia has multiple distinct causes beyond iron deficiency—including Vitamin B12 deficiency, Folate deficiency, Thalassemia, Anemia of Chronic Disease, Hemolytic Anemia, and acute or chronic blood loss. <strong>Redora</strong> guides you from initial symptoms through blood test interpretation using transparent medical rules.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-center mb-12">
          <button
            onClick={onStart}
            className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-[#8B3A4A] to-[#6A2434] hover:from-[#782E3C] hover:to-[#571B28] text-white font-bold rounded-2xl shadow-lg shadow-[#8B3A4A]/25 transition-all flex items-center justify-center gap-2.5 group cursor-pointer text-base"
          >
            <span>Start My Assessment</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* 3 Pillars of Medical Reasoning */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        <div className="p-5 bg-white border border-stone-200 rounded-2xl shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#FDF2F4] text-[#8B3A4A] flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-stone-900 mb-1">Immediate Safety Screening</h3>
          <p className="text-xs text-stone-500 leading-relaxed">
            Early check for urgent warning signs to direct cases requiring prompt medical attention without delay.
          </p>
        </div>

        <div className="p-5 bg-white border border-stone-200 rounded-2xl shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#FDF2F4] text-[#8B3A4A] flex items-center justify-center mb-3">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-stone-900 mb-1">Streamlined 5-Question Intake</h3>
          <p className="text-xs text-stone-500 leading-relaxed">
            Short initial screening, with targeted follow-up questions and lab panels requested only when relevant to your CBC pattern.
          </p>
        </div>

        <div className="p-5 bg-white border border-stone-200 rounded-2xl shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#FDF2F4] text-[#8B3A4A] flex items-center justify-center mb-3">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-stone-900 mb-1">Explainable Differential Report</h3>
          <p className="text-xs text-stone-500 leading-relaxed">
            Comprehensive evaluation across all six major anemia categories and blood loss with transparent IF-THEN rules and print support.
          </p>
        </div>
      </div>

      {/* Strict Medical Disclaimer Box */}
      <div className="p-5 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-3.5">
        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <strong className="block text-sm font-bold mb-1 text-amber-950">
            Important Medical Disclaimer
          </strong>
          <strong>Redora</strong> is an educational medical decision-support prototype designed for preliminary guidance and structured exploration. It does not provide a definitive medical diagnosis, prescribe medications or supplement dosages, or replace evaluation by a licensed physician or hematologist. Do not initiate treatment based solely on this report.
        </div>
      </div>
    </div>
  );
};
