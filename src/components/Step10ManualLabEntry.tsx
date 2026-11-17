import React, { useState } from 'react';
import { ConfirmedLabValues, BiologicalSex } from '../types';
import { LAB_PARAMETERS } from '../medical/parameters';
import { convertLabValue, convertReferenceRange } from '../medical/unitConversion';
import { ArrowLeft, ArrowRight, Check, AlertCircle, Info, RefreshCw, Sparkles } from 'lucide-react';

interface Step10ManualLabEntryProps {
  userSex: BiologicalSex | null;
  initialValues?: ConfirmedLabValues;
  onSubmit: (confirmed: ConfirmedLabValues) => void;
  onBack: () => void;
}

const BASIC_CBC_IDS = ['hb', 'mcv', 'mch', 'rbc'] as const;
const BASIC_CBC_PARAMS = BASIC_CBC_IDS.map(id => LAB_PARAMETERS.find(p => p.id === id)!).filter(Boolean);

export const Step10ManualLabEntry: React.FC<Step10ManualLabEntryProps> = ({
  userSex,
  initialValues = {},
  onSubmit,
  onBack,
}) => {
  const [formData, setFormData] = useState<
    Record<
      string,
      { value: string; unit: string; testDate?: string; refLow?: string; refHigh?: string }
    >
  >(() => {
    const initial: Record<
      string,
      { value: string; unit: string; testDate?: string; refLow?: string; refHigh?: string }
    > = {};
    BASIC_CBC_PARAMS.forEach(p => {
      const existing = initialValues[p.id];
      initial[p.id] = {
        value:
          existing && !existing.qualitativeResult ? String(existing.originalValue ?? existing.value) : '',
        unit: existing?.originalUnit || existing?.unit || p.standardUnit,
        testDate: existing?.testDate || '',
        refLow:
          existing?.originalRefRangeLow !== undefined
            ? String(existing.originalRefRangeLow)
            : existing?.refRangeLow !== undefined
            ? String(existing.refRangeLow)
            : '',
        refHigh:
          existing?.originalRefRangeHigh !== undefined
            ? String(existing.originalRefRangeHigh)
            : existing?.refRangeHigh !== undefined
            ? String(existing.refRangeHigh)
            : '',
      };
    });
    return initial;
  });

  const [testDateGlobal, setTestDateGlobal] = useState(() => {
    const firstDate = BASIC_CBC_PARAMS.map(p => initialValues[p.id]?.testDate).find(Boolean);
    return firstDate || '';
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showUnitGuide, setShowUnitGuide] = useState<boolean>(false);

  const updateField = (
    paramId: string,
    key: 'value' | 'unit' | 'refLow' | 'refHigh',
    val: string
  ) => {
    setFormData(prev => ({
      ...prev,
      [paramId]: {
        ...prev[paramId],
        [key]: val,
      },
    }));
    if (errorMsg) setErrorMsg(null);
  };

  const handleSaveAndProceed = () => {
    setErrorMsg(null);

    const missingFields = BASIC_CBC_PARAMS.filter(param => {
      const raw = formData[param.id]?.value;
      const num = parseFloat(raw);
      return !raw || raw.trim() === '' || isNaN(num) || num <= 0;
    });

    if (missingFields.length > 0) {
      setErrorMsg(
        `Please enter all four required Basic CBC values (${missingFields.map(p => p.shortName).join(', ')}) to perform preliminary classification.`
      );
      return;
    }

    // Preserve any conditional follow-up labs previously entered while updating Basic CBC entries
    const confirmed: ConfirmedLabValues = { ...initialValues };
    BASIC_CBC_PARAMS.forEach(param => {
      delete confirmed[param.id];
    });

    BASIC_CBC_PARAMS.forEach(param => {
      const entry = formData[param.id];
      if (!entry || entry.value.trim() === '') return;

      const rawNum = parseFloat(entry.value);
      if (isNaN(rawNum)) return;

      const inputUnit = entry.unit || param.standardUnit;
      const conv = convertLabValue(param.id, rawNum, inputUnit);
      const finalValue = conv.convertedValue;
      const standardUnit = conv.standardUnit;

      const defaultRange = userSex === 'male' ? param.adultMaleNormalRange : param.adultFemaleNormalRange;
      const origLow = entry.refLow && entry.refLow.trim() !== '' ? parseFloat(entry.refLow) : undefined;
      const origHigh = entry.refHigh && entry.refHigh.trim() !== '' ? parseFloat(entry.refHigh) : undefined;

      const convertedRef = convertReferenceRange(param.id, origLow, origHigh, inputUnit);
      const refRangeLow = convertedRef.low !== undefined ? convertedRef.low : defaultRange[0];
      const refRangeHigh = convertedRef.high !== undefined ? convertedRef.high : defaultRange[1];

      let flag: 'low' | 'normal' | 'high' = 'normal';
      if (finalValue < refRangeLow) flag = 'low';
      else if (finalValue > refRangeHigh) flag = 'high';

      confirmed[param.id] = {
        id: `manual_${param.id}_${Date.now()}`,
        parameterId: param.id,
        nameAr: param.nameEn,
        nameEn: param.nameEn,
        value: finalValue,
        unit: standardUnit,
        originalValue: rawNum,
        originalUnit: inputUnit,
        wasConverted: conv.wasConverted,
        conversionNote: conv.conversionNoteEn || conv.conversionNoteAr,
        refRangeLow,
        refRangeHigh,
        originalRefRangeLow: origLow,
        originalRefRangeHigh: origHigh,
        refRangeUnit: origLow !== undefined || origHigh !== undefined ? inputUnit : standardUnit,
        refRangeRaw: `${refRangeLow} - ${refRangeHigh} ${standardUnit}`,
        testDate: entry.testDate || testDateGlobal,
        isEntered: true,
        confidence: 'high',
        flag,
      };
    });

    onSubmit(confirmed);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-[#8B3A4A] tracking-wider uppercase">
            Basic CBC Evaluation
          </span>
          <h2 className="text-2xl font-bold text-stone-900 mt-1">Enter Basic CBC Parameters (4 Required Values)</h2>
          <p className="text-sm text-stone-600 mt-1">
            Enter only these four core CBC values. Redora will classify your pattern and request only the specific additional tests needed.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowUnitGuide(!showUnitGuide)}
          className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 self-start md:self-auto cursor-pointer transition-colors"
        >
          <Info className="w-4 h-4 text-[#8B3A4A]" />
          <span>{showUnitGuide ? 'Hide Unit Conversion Guide' : 'Standard Unit & Conversion Guide'}</span>
        </button>
      </div>

      {/* Unit Conversion Guide Panel */}
      {showUnitGuide && (
        <div className="mb-6 p-5 bg-gradient-to-br from-stone-50 to-[#FDF8F9] border border-[#F0D5DA] rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
            <Sparkles className="w-4 h-4 text-[#8B3A4A]" />
            <span>Standard Internal Units &amp; Automatic Conversions</span>
          </div>
          <p className="text-xs text-stone-600 leading-relaxed">
            Redora normalizes recognized laboratory unit formats to standard internal units automatically:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 text-stone-700 bg-white/70">
                  <th className="py-2 px-3">Basic CBC Parameter</th>
                  <th className="py-2 px-3 font-mono">Standard Internal Unit</th>
                  <th className="py-2 px-3">Supported Conversion Examples</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200/60 font-mono text-[11px] text-stone-700">
                <tr>
                  <td className="py-2 px-3 font-sans font-medium text-stone-900">1. Hemoglobin (Hb)</td>
                  <td className="py-2 px-3 text-[#8B3A4A] font-bold">g/dL</td>
                  <td className="py-2 px-3 font-sans">135 g/L → 13.5 g/dL (or 8.4 mmol/L → 13.5 g/dL)</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans font-medium text-stone-900">2. Mean Corpuscular Volume (MCV)</td>
                  <td className="py-2 px-3 text-[#8B3A4A] font-bold">fL</td>
                  <td className="py-2 px-3 font-sans">85 fL = 85 µm³</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans font-medium text-stone-900">3. Mean Corpuscular Hemoglobin (MCH)</td>
                  <td className="py-2 px-3 text-[#8B3A4A] font-bold">pg</td>
                  <td className="py-2 px-3 font-sans">28 pg (fmol supported)</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans font-medium text-stone-900">4. Red Blood Cell Count (RBC)</td>
                  <td className="py-2 px-3 text-[#8B3A4A] font-bold">×10⁶/µL</td>
                  <td className="py-2 px-3 font-sans">4,500,000 /µL → 4.5 ×10⁶/µL (or 4.5 ×10¹²/L)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Date of test */}
      <div className="mb-6 p-4 bg-white border border-stone-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <label className="text-xs font-bold text-stone-800 block">CBC Report Date (Optional)</label>
          <span className="text-[11px] text-stone-500">Helps document report timing in your summary.</span>
        </div>
        <input
          type="date"
          value={testDateGlobal}
          onChange={e => setTestDateGlobal(e.target.value)}
          className="px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono text-stone-800 focus:outline-none focus:border-[#8B3A4A]"
        />
      </div>

      {errorMsg && (
        <div className="mb-6 p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Basic 4 CBC Parameters Form */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm mb-8 space-y-4">
        <div className="text-xs font-bold text-stone-700 mb-2 flex flex-wrap items-center justify-between gap-2">
          <span>Required Basic CBC Indices</span>
          <span className="text-[11px] text-stone-500 font-normal">
            All 4 fields marked <span className="text-rose-600 font-bold">*</span> are required · Additional tests are requested later only if relevant
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {BASIC_CBC_PARAMS.map((param, idx) => {
            const entry = formData[param.id] || { value: '', unit: param.standardUnit };
            const defaultRange = userSex === 'male' ? param.adultMaleNormalRange : param.adultFemaleNormalRange;

            const rawNumber = parseFloat(entry.value);
            const liveConversion =
              !isNaN(rawNumber) && entry.value.trim() !== ''
                ? convertLabValue(param.id, rawNumber, entry.unit)
                : null;

            return (
              <div
                key={param.id}
                className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2.5 hover:border-stone-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-stone-900 block">
                      {idx + 1}. {param.nameEn} <span className="text-rose-600">*</span>
                    </label>
                    <span className="text-[11px] font-mono text-stone-500">
                      {param.shortName} · {param.standardUnit}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-stone-600 bg-white px-2 py-0.5 rounded border border-stone-200 shrink-0">
                    Ref: {defaultRange[0]} - {defaultRange[1]} {param.standardUnit}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder={`Enter ${param.shortName}`}
                    value={entry.value}
                    onChange={e => updateField(param.id, 'value', e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs font-mono font-bold text-stone-900 focus:outline-none focus:border-[#8B3A4A]"
                  />

                  <select
                    value={entry.unit}
                    onChange={e => updateField(param.id, 'unit', e.target.value)}
                    className="w-28 px-2 py-2 bg-white border border-stone-300 rounded-lg text-xs font-mono text-stone-700 focus:outline-none focus:border-[#8B3A4A]"
                  >
                    {param.allowedUnits.map(u => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Custom Lab Reference Range */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[10px] text-stone-500">
                  <div className="flex items-center gap-1.5">
                    <span>Lab Ref ({entry.unit}):</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={String(defaultRange[0])}
                      value={entry.refLow || ''}
                      onChange={e => updateField(param.id, 'refLow', e.target.value)}
                      className="w-14 px-1.5 py-0.5 bg-white border border-stone-200 rounded text-[10px] font-mono text-stone-800 focus:outline-none focus:border-[#8B3A4A]"
                      title="Lower reference limit from your lab report (optional)"
                    />
                    <span>-</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={String(defaultRange[1])}
                      value={entry.refHigh || ''}
                      onChange={e => updateField(param.id, 'refHigh', e.target.value)}
                      className="w-14 px-1.5 py-0.5 bg-white border border-stone-200 rounded text-[10px] font-mono text-stone-800 focus:outline-none focus:border-[#8B3A4A]"
                      title="Upper reference limit from your lab report (optional)"
                    />
                  </div>
                  {entry.value.trim() !== '' && (
                    <span className="font-mono font-semibold text-stone-700 bg-white px-2 py-0.5 rounded border border-stone-200">
                      {entry.value} {entry.unit} (Ref: {entry.refLow || defaultRange[0]}–{entry.refHigh || defaultRange[1]})
                    </span>
                  )}
                </div>

                {/* Real-time conversion feedback */}
                {liveConversion && liveConversion.wasConverted && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] flex items-center justify-between text-emerald-900">
                    <span className="flex items-center gap-1 font-semibold">
                      <RefreshCw className="w-3 h-3 text-emerald-700" />
                      <span>Standard internal value:</span>
                      <strong className="font-mono text-xs">{liveConversion.convertedValue} {liveConversion.standardUnit}</strong>
                    </span>
                    <span className="text-[10px] text-emerald-700">{liveConversion.conversionNoteEn}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 border border-stone-300 hover:bg-stone-100 rounded-xl text-stone-700 text-sm font-semibold flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={handleSaveAndProceed}
          className="px-7 py-2.5 bg-gradient-to-r from-[#8B3A4A] to-[#6A2434] hover:from-[#782E3C] hover:to-[#571B28] text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Analyze Basic CBC &amp; Continue</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
