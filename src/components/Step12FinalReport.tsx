import React, { useRef } from 'react';
import {
  PatientProfile,
  SymptomAnswers,
  MedicalHistory,
  ConfirmedLabValues,
  InferenceResult,
  SuspicionLevel,
} from '../types';
import { LAB_PARAMETERS, SYMPTOM_DEFINITIONS, INITIAL_MAIN_SYMPTOMS } from '../medical/parameters';
import {
  Printer,
  RotateCcw,
  AlertTriangle,
  FileText,
  Activity,
  Layers,
  Utensils,
  HelpCircle,
  AlertCircle,
  ArrowUpRight,
  GitCompare,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface Step12FinalReportProps {
  profile: PatientProfile;
  symptoms: SymptomAnswers;
  history: MedicalHistory;
  labs: ConfirmedLabValues;
  result: InferenceResult;
  onRestart: () => void;
}

export const Step12FinalReport: React.FC<Step12FinalReportProps> = ({
  profile,
  symptoms,
  history,
  labs,
  result,
  onRestart,
}) => {
  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const getStatusColor = () => {
    switch (result.status) {
      case 'POSSIBLE_IRON_DEFICIENCY_ANEMIA':
      case 'POSSIBLE_B12_DEFICIENCY_ANEMIA':
      case 'POSSIBLE_FOLATE_DEFICIENCY_ANEMIA':
      case 'POSSIBLE_COMBINED_B12_FOLATE_ANEMIA':
      case 'POSSIBLE_COMBINED_ANEMIA_CAUSES':
      case 'POSSIBLE_OTHER_ANEMIA':
      case 'POSSIBLE_THALASSEMIA_SUSPICION':
      case 'POSSIBLE_ANEMIA_OF_CHRONIC_DISEASE':
      case 'POSSIBLE_HEMOLYTIC_ANEMIA':
      case 'POSSIBLE_BLOOD_LOSS_ANEMIA':
        return 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]';
      case 'ANEMIA_INDICATORS_DETECTED':
      case 'POSSIBLE_ANEMIA':
      case 'INSUFFICIENT_DATA_TO_CLASSIFY':
        return 'border-amber-400 bg-amber-50 text-amber-950';
      case 'CONFLICTING_DATA_DETECTED':
        return 'border-purple-400 bg-purple-50 text-purple-950';
      case 'NO_ANEMIA_DETECTED':
        return 'border-emerald-400 bg-emerald-50 text-emerald-950';
      default:
        return 'border-stone-300 bg-stone-50 text-stone-900';
    }
  };

  const getSuspicionStyle = (level: SuspicionLevel) => {
    switch (level) {
      case 'high':
        return 'bg-[#8B3A4A] text-white border-[#6A2434]';
      case 'moderate':
        return 'bg-amber-100 text-amber-950 border-amber-300';
      case 'insufficient':
        return 'bg-stone-100 text-stone-700 border-stone-300';
      default:
        return 'bg-white text-stone-500 border-stone-200';
    }
  };

  const getQualitativeLabel = (paramId: string, qualVal?: string): string | null => {
    if (!qualVal) return null;
    const def = LAB_PARAMETERS.find(p => p.id === paramId);
    const opt = def?.selectOptions?.find(o => o.value === qualVal);
    return opt ? opt.labelEn : qualVal;
  };

  const symptomLabelMap = new Map<string, string>();
  INITIAL_MAIN_SYMPTOMS.forEach(s => symptomLabelMap.set(s.id, s.nameEn));
  SYMPTOM_DEFINITIONS.forEach(s => {
    if (!symptomLabelMap.has(s.id)) symptomLabelMap.set(s.id, s.nameEn);
  });

  const reportedSymptomsList = Object.entries(symptoms)
    .filter(([key, val]) => key !== 'no_symptoms' && (val === 'yes' || val === 'sometimes'))
    .map(([key, val]) => ({
      key,
      label: symptomLabelMap.get(key) || key,
      isRegular: val === 'yes',
    }));

  const durationLabels: Record<string, string> = {
    less_than_week: 'Less than one week',
    one_to_four_weeks: '1–4 weeks',
    more_than_month: 'More than one month',
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Top Action Bar */}
      <div className="no-print flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div>
          <span className="text-xs font-semibold text-[#8B3A4A] tracking-wider uppercase">
            Final Expert System Output
          </span>
          <h2 className="text-2xl font-bold text-stone-900">Comprehensive Differential Report</h2>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save Report PDF</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Assessment</span>
          </button>
        </div>
      </div>

      {/* Printable Report Container */}
      <div
        ref={reportRef}
        className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-10 shadow-sm space-y-7 print:border-none print:shadow-none print:p-0"
      >
        {/* Header */}
        <div className="border-b border-stone-200 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#8B3A4A] to-[#6A2434] text-white flex items-center justify-center shadow-sm">
              <Activity className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#6A2434] tracking-tight">Redora Expert System Report</h1>
              <span className="text-xs text-stone-500 font-medium">Anemia Differential Diagnosis &amp; Decision Support</span>
            </div>
          </div>

          <div className="text-xs text-stone-500 space-y-1 font-mono">
            <div>
              <strong>Assessment Date:</strong> {result.evaluationDate}
            </div>
            <div>
              <strong>Reference Standards:</strong> WHO 2024 / BSH Guidelines
            </div>
          </div>
        </div>

        {/* Basic Context Bar */}
        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-stone-400 block mb-0.5">Age:</span>
            <span className="font-bold text-stone-900">{profile.age ? `${profile.age} years` : 'Not specified'}</span>
          </div>
          <div>
            <span className="text-stone-400 block mb-0.5">Gender:</span>
            <span className="font-bold text-stone-900">
              {profile.sex === 'female' ? 'Female' : profile.sex === 'male' ? 'Male' : 'Not specified'}
            </span>
          </div>
          <div>
            <span className="text-stone-400 block mb-0.5">Symptom Duration:</span>
            <span className="font-bold text-stone-900">
              {profile.symptomDuration ? durationLabels[profile.symptomDuration] : 'Not specified'}
            </span>
          </div>
        </div>

        {/* 1. Preliminary Assessment + Primary Outcome */}
        <div className={`p-6 sm:p-8 rounded-3xl border-2 ${getStatusColor()} space-y-4`}>
          <div className="p-3.5 bg-white/75 rounded-xl border border-black/10 text-xs space-y-1">
            <span className="font-bold uppercase tracking-wider opacity-75 block">
              Preliminary CBC Classification:
            </span>
            <span className="font-bold text-sm block">{result.cbcClassificationEn || result.preliminaryAssessmentEn}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider block opacity-75">
                Primary Assessment Outcome
              </span>
              <h2 className="text-2xl font-extrabold tracking-tight mt-0.5">{result.statusTitleAr}</h2>
            </div>

            {result.severityLevel && result.severityLevel !== 'none' && result.severityLevel !== 'unknown' && (
              <span className="text-xs font-bold px-3 py-1 bg-white/80 rounded-full border border-stone-300 w-fit">
                Hb Tier:{' '}
                {result.severityLevel === 'severe'
                  ? 'Severe (<8.0 g/dL)'
                  : result.severityLevel === 'moderate'
                  ? 'Moderate (8.0–10.9 g/dL)'
                  : 'Mild (11.0+ g/dL)'}
              </span>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold block">Explanation</span>
            <p className="text-sm sm:text-base leading-relaxed opacity-95 font-medium">{result.summaryAr}</p>
          </div>

          {result.comparativeReasoningAr && (
            <div className="p-3.5 bg-white/80 rounded-xl border border-black/10 text-xs space-y-1 leading-relaxed">
              <strong className="block font-bold">Comparative Reasoning:</strong>
              <p className="opacity-95">{result.comparativeReasoningAr}</p>
            </div>
          )}

          {result.overlappingConditionsAr && result.overlappingConditionsAr.length > 0 && (
            <div className="p-3.5 bg-purple-50/90 rounded-xl border border-purple-300 text-xs text-purple-950 space-y-1">
              <strong className="block font-bold">Overlapping / Mixed Causes Detected:</strong>
              <ul className="list-disc list-inside space-y-0.5">
                {result.overlappingConditionsAr.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {result.hemoglobinValue !== undefined && result.hemoglobinThreshold !== undefined && (
            <div className="p-3 bg-white/80 rounded-xl border border-stone-200 text-xs font-mono flex flex-wrap items-center justify-between gap-2">
              <span>
                Hemoglobin: <strong>{result.hemoglobinValue} g/dL</strong>
              </span>
              <span>
                Reference Cutoff: <strong>{result.hemoglobinThreshold} g/dL</strong>
              </span>
            </div>
          )}
        </div>

        {/* Folic Acid Monotherapy Safety Warning */}
        {result.folateSafetyWarningAr && (
          <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-3 text-xs text-amber-950 leading-relaxed">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-sm font-bold text-amber-900 mb-1">
                Folic Acid Safety Warning
              </strong>
              <p>{result.folateSafetyWarningAr}</p>
            </div>
          </div>
        )}

        {/* 2B. Comprehensive Differential Diagnosis Matrix */}
        {result.differentialCandidates && result.differentialCandidates.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-stone-900 mb-3 flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-[#8B3A4A]" />
              <span>Differential Diagnosis Comparison Matrix</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {result.differentialCandidates.map(cand => (
                <div
                  key={cand.categoryId}
                  className={`p-4 rounded-2xl border text-xs space-y-2.5 ${
                    cand.suspicionLevel === 'high'
                      ? 'bg-[#FDF8F9] border-[#8B3A4A]/50'
                      : cand.suspicionLevel === 'moderate'
                      ? 'bg-amber-50/40 border-amber-300'
                      : 'bg-stone-50/70 border-stone-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-sm text-stone-900">{cand.nameEn}</div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold shrink-0 ${getSuspicionStyle(
                        cand.suspicionLevel
                      )}`}
                    >
                      {cand.suspicionLabelEn}
                    </span>
                  </div>

                  <p className="text-stone-700 leading-relaxed">{cand.reasoningAr}</p>

                  {cand.supportingFindings.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-black/5">
                      <span className="font-bold text-emerald-800 flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Supporting Findings:</span>
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {cand.supportingFindings.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-white border border-emerald-200 rounded text-[10px] text-emerald-950">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {cand.contradictingFindings.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-black/5">
                      <span className="font-bold text-rose-800 flex items-center gap-1 text-[11px]">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Contradicting / Less Likely Findings:</span>
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {cand.contradictingFindings.map((c, i) => (
                          <span key={i} className="px-2 py-0.5 bg-white border border-rose-200 rounded text-[10px] text-rose-950">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {cand.missingTests.length > 0 && (
                    <div className="text-[10px] text-amber-900 pt-1 border-t border-black/5">
                      <strong>Missing Tests:</strong> {cand.missingTests.join(', ')}
                    </div>
                  )}

                  {cand.activatedRuleIds.length > 0 && (
                    <div className="text-[10px] font-mono text-stone-500 pt-1">
                      Activated Rules: {cand.activatedRuleIds.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Relevant Laboratory Findings */}
        {Object.keys(labs).length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-stone-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#8B3A4A]" />
              <span>Relevant Laboratory Findings</span>
            </h3>

            <div className="border border-stone-200 rounded-2xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 font-bold text-stone-700">
                  <tr>
                    <th className="py-2.5 px-4">Laboratory Test</th>
                    <th className="py-2.5 px-4">Result &amp; Unit</th>
                    <th className="py-2.5 px-4">Reference Range</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium font-mono">
                  {Object.values(labs).map(lab => {
                    const qualLabel = getQualitativeLabel(lab.parameterId, lab.qualitativeResult);
                    return (
                      <tr key={lab.id} className="hover:bg-stone-50">
                        <td className="py-2.5 px-4 font-sans font-bold text-stone-900">
                          {lab.nameEn}
                        </td>
                        <td className="py-2.5 px-4">
                          {qualLabel ? (
                            <span className="font-sans font-bold text-xs text-stone-900">{qualLabel}</span>
                          ) : (
                            <>
                              <span className="font-bold text-sm text-stone-900">
                                {lab.value} {lab.unit}
                              </span>
                              {lab.wasConverted && lab.originalUnit && (
                                <div className="text-[10px] text-stone-500 font-sans">
                                  (Entered: {lab.originalValue} {lab.originalUnit})
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-stone-600">
                          {qualLabel
                            ? 'Qualitative'
                            : lab.refRangeLow !== undefined && lab.refRangeHigh !== undefined
                            ? `${lab.refRangeLow} - ${lab.refRangeHigh} ${lab.unit}`
                            : lab.refRangeRaw || '—'}
                        </td>
                        <td className="py-2.5 px-4 font-sans">
                          {lab.flag === 'low' ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                              Low
                            </span>
                          ) : lab.flag === 'high' ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                              High
                            </span>
                          ) : lab.flag === 'abnormal' ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                              Abnormal
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. Activated Inference Rules */}
        <div>
          <h3 className="text-sm font-bold text-stone-900 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#8B3A4A]" />
            <span>Activated IF-THEN Inference Rules</span>
          </h3>

          {result.triggeredRules.length > 0 ? (
            <div className="space-y-3">
              {result.triggeredRules.map(rule => (
                <div
                  key={rule.ruleId}
                  className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-2 text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="font-bold text-stone-900 text-sm">{rule.nameEn}</div>
                    <span className="font-mono text-[10px] text-stone-600 bg-white px-2 py-0.5 rounded border border-stone-200 w-fit">
                      {rule.ruleId}
                    </span>
                  </div>

                  {rule.conditionEn && (
                    <div className="p-2 bg-white border border-stone-200/80 rounded-lg text-[11px] text-stone-700 font-mono">
                      <strong className="text-[#8B3A4A]">Logic Rule: </strong>
                      <span>{rule.conditionEn}</span>
                    </div>
                  )}

                  <p className="text-stone-700 leading-relaxed">{rule.explanationAr}</p>

                  {rule.supportingEvidence.length > 0 && (
                    <div className="pt-1.5 border-t border-stone-200/60">
                      <span className="font-bold text-stone-800 block mb-1">Supporting Evidence:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {rule.supportingEvidence.map((ev, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-white border border-stone-200 rounded text-[11px] text-stone-800"
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] font-mono text-stone-500 pt-1">
                    Reference: {rule.referenceSource}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-600">
              No specific pathological rules were triggered based on current inputs.
            </div>
          )}
        </div>

        {/* 6. Missing Tests or Conflicting Evidence */}
        {(result.missingData.length > 0 || result.conflictingFindings.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.missingData.length > 0 && (
              <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <HelpCircle className="w-4 h-4 text-amber-700" />
                  <span>Missing Tests</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-amber-900/90">
                  {result.missingData.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.conflictingFindings.length > 0 && (
              <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-purple-900">
                  <AlertCircle className="w-4 h-4 text-purple-700" />
                  <span>Conflicting or Confounded Evidence</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-purple-900/90">
                  {result.conflictingFindings.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Symptoms & Targeted History Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 text-xs space-y-2">
            <span className="font-bold text-stone-900 block">Reported Symptoms:</span>
            {reportedSymptomsList.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {reportedSymptomsList.map((item, idx) => (
                  <span key={idx} className="px-2 py-1 bg-white border border-stone-200 rounded text-stone-800">
                    {item.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-stone-500 italic">No active symptoms reported.</p>
            )}
          </div>

          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 text-xs space-y-2">
            <span className="font-bold text-stone-900 block">Targeted History &amp; Risk Factors:</span>
            <ul className="list-disc list-inside space-y-1 text-stone-700">
              {history.recentSurgeryOrBloodLoss === 'yes' && <li>Recent acute blood loss or surgery.</li>}
              {history.heavyMenstrualBleeding === 'yes' && <li>Heavy or prolonged menstrual bleeding.</li>}
              {(history.blackTarStool === 'yes' || history.bloodInStool === 'yes') && (
                <li>Possible gastrointestinal bleeding indicators.</li>
              )}
              {history.frequentNosebleeds === 'yes' && <li>Frequent nosebleeds.</li>}
              {history.visibleBloodInUrine === 'yes' && <li>Visible blood in urine.</li>}
              {history.vegetarianOrVegan === 'yes' && <li>Vegan/vegetarian or restricted diet.</li>}
              {history.lowIronDiet === 'yes' && <li>Low dietary iron intake.</li>}
              {history.chronicKidneyDisease === 'yes' && <li>Known chronic kidney impairment.</li>}
              {history.chronicInflammationOrAutoimmune === 'yes' && <li>Chronic inflammatory or autoimmune disease.</li>}
              {history.familyThalassemia === 'yes' && <li>Family history of thalassemia trait.</li>}
              {history.balanceProblems === 'yes' && <li>Balance difficulty or neurological symptoms.</li>}
              {!history.recentSurgeryOrBloodLoss &&
                !history.heavyMenstrualBleeding &&
                !history.blackTarStool &&
                !history.bloodInStool &&
                !history.frequentNosebleeds &&
                !history.visibleBloodInUrine &&
                !history.vegetarianOrVegan &&
                !history.lowIronDiet &&
                !history.chronicKidneyDisease &&
                !history.chronicInflammationOrAutoimmune &&
                !history.familyThalassemia &&
                !history.balanceProblems && (
                  <li className="list-none text-stone-500 italic">No additional risk factors recorded.</li>
                )}
            </ul>
          </div>
        </div>

        {/* 7. Recommended Next Steps */}
        <div className="space-y-4">
          <div className="p-4 bg-[#FDF8F9] border border-[#F0D5DA] rounded-2xl text-xs space-y-1.5">
            <h3 className="text-sm font-bold text-[#6A2434] flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4" />
              <span>Recommended Next Steps</span>
            </h3>
            <p className="text-stone-800 leading-relaxed font-medium">{result.followUpAdviceAr}</p>
          </div>

          {result.recommendedTests.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {result.recommendedTests.map(t => (
                <div key={t.testId} className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-stone-900">{t.nameEn}</div>
                  <p className="text-stone-600 leading-relaxed text-[11px] mt-1">{t.rationaleAr}</p>
                </div>
              ))}
            </div>
          )}

          {/* Evidence-Based Nutritional Guidance */}
          <div className="p-5 bg-stone-50 border border-stone-200 rounded-2xl space-y-2.5">
            <div className="flex items-center gap-2 text-[#8B3A4A]">
              <Utensils className="w-4 h-4" />
              <h3 className="text-xs font-bold text-stone-900">Nutritional Education &amp; Guidance</h3>
            </div>
            <ul className="space-y-1.5 text-xs text-stone-700 leading-relaxed">
              {result.dietaryGuidanceAr.map((guide, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8B3A4A] shrink-0 mt-1.5" />
                  <span>{guide}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 8. Medical Disclaimer */}
        <div className="p-4 bg-amber-50/80 border border-amber-300 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-950 leading-relaxed space-y-1">
            <strong className="block text-sm font-bold text-amber-900">Medical Disclaimer</strong>
            <p>{result.disclaimerAr}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
