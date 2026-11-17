import React, { useState } from 'react';
import { KNOWLEDGE_BASE_RULES } from '../medical/knowledgeBase';
import { X, BookOpen, Search } from 'lucide-react';

interface KnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KnowledgeBaseModal: React.FC<KnowledgeBaseModalProps> = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  if (!isOpen) return null;

  const filteredRules = KNOWLEDGE_BASE_RULES.filter(rule => {
    const matchesSearch =
      rule.nameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.conditionEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.ruleId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.referenceSource.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'ALL' || rule.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categoryLabels: Record<string, string> = {
    ALL: 'All',
    DETECTION: 'Detection',
    CLASSIFICATION: 'Classification',
    SAFETY: 'Safety',
    PATHWAY: 'Pathways',
    CONFLICT: 'Conflicts',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FDF2F4] text-[#8B3A4A] flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#8B3A4A] tracking-wider uppercase block">
                Transparent Rule-Based Reasoning
              </span>
              <h2 className="text-xl font-bold text-stone-900">
                Redora Medical Knowledge Base
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 border-b border-stone-200 bg-white flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search medical rules, rule IDs, or reference guidelines..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#8B3A4A]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            {['ALL', 'DETECTION', 'CLASSIFICATION', 'SAFETY', 'PATHWAY', 'CONFLICT'].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'border-[#8B3A4A] bg-[#8B3A4A] text-white font-bold'
                    : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                }`}
              >
                {categoryLabels[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Rules List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredRules.map(rule => (
            <div
              key={rule.ruleId}
              className="p-5 bg-stone-50 border border-stone-200 rounded-2xl space-y-2.5 text-xs shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">{rule.nameEn}</h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[10px] font-bold text-[#8B3A4A] bg-[#FDF2F4] px-2 py-0.5 rounded border border-[#F8E7EB]">
                    {rule.category}
                  </span>
                  <span className="font-mono text-[10px] text-stone-600 bg-white px-2 py-0.5 rounded border border-stone-200">
                    {rule.ruleId}
                  </span>
                </div>
              </div>

              {rule.conditionEn && (
                <div className="p-3 bg-white rounded-xl border border-stone-200 text-stone-700 leading-relaxed text-xs">
                  <strong className="text-stone-900 block mb-0.5">IF / THEN Logic Rule:</strong>
                  <span>{rule.conditionEn}</span>
                </div>
              )}

              <div className="p-3 bg-white rounded-xl border border-stone-200 text-stone-700 leading-relaxed font-mono text-[11px]">
                <strong className="font-sans text-stone-900 block mb-0.5">Medical Reference:</strong>
                <span className="text-[#8B3A4A] font-semibold">{rule.referenceSource}</span>
              </div>
            </div>
          ))}

          {filteredRules.length === 0 && (
            <div className="p-10 text-center text-stone-500 text-xs">
              No medical rules match your search criteria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
