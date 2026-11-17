import React, { useState, useMemo } from 'react';
import {
  ConfirmedLabValues,
  PatientProfile,
  SymptomAnswers,
  MedicalHistory,
  EmergencySigns,
  AdditionalTestRecommendation,
  AnswerChoice,
  LabValueItem,
  SuspicionLevel,
} from '../types';
import { LAB_PARAMETERS } from '../medical/parameters';
import { convertLabValue, convertReferenceRange } from '../medical/unitConversion';
import { runInferenceEngine, determineTargetedPathway, TargetedPathway } from '../medical/inferenceEngine';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  AlertTriangle,
  Brain,
  Droplets,
  Activity,
  RefreshCw,
  Stethoscope,
  Layers,
} from 'lucide-react';

interface StepFollowUpLabProps {
  profile: PatientProfile;
  symptoms: SymptomAnswers;
  history: MedicalHistory;
  emergency: EmergencySigns;
  currentLabs: ConfirmedLabValues;
  recommendedTests: AdditionalTestRecommendation[];
  onCompleteWithAdditionalLabs: (
    updatedLabs: ConfirmedLabValues,
    updatedSymptoms: SymptomAnswers,
    updatedHistory: MedicalHistory
  ) => void;
  onSkipToFinalReport: () => void;
  onBack: () => void;
}

interface PanelEntryState {
  availability: 'available' | 'not_available' | null;
  value: string;
  qualitativeResult: string;
  unit: string;
  refLow: string;
  refHigh: string;
}

const ADAPTIVE_PANEL_PARAM_IDS = [
  'ferritin',
  'iron',
  'tibc',
  'tsat',
  'rdw',
  'hb_electrophoresis',
  'crp',
  'creatinine',
  'egfr',
  'reticulocytes',
  'ldh',
  'bilirubin_indirect',
  'haptoglobin',
  'peripheral_smear',
  'dat_test',
] as const;

function buildLabItem(
  paramId: string,
  rawStr: string,
  unit: string,
  sex: PatientProfile['sex'],
  refLowStr?: string,
  refHighStr?: string,
  qualitativeResult?: string
): LabValueItem | null {
  const paramDef = LAB_PARAMETERS.find(p => p.id === paramId);
  if (!paramDef) return null;

  if (paramDef.inputType === 'select') {
    if (!qualitativeResult || qualitativeResult.trim() === '') return null;
    const isNormal = qualitativeResult === 'normal' || qualitativeResult === 'negative';
    return {
      id: `followup_${paramId}_${Date.now()}`,
      parameterId: paramId,
      nameAr: paramDef.nameAr,
      nameEn: paramDef.nameEn,
      value: 0,
      qualitativeResult,
      unit: paramDef.standardUnit,
      isEntered: true,
      confidence: 'high',
      flag: isNormal ? 'normal' : 'abnormal',
    };
  }

  const rawNum = parseFloat(rawStr);
  if (rawStr.trim() === '' || isNaN(rawNum)) {
    if (paramDef.selectOptions && qualitativeResult && qualitativeResult.trim() !== '') {
      const isNormal = qualitativeResult === 'normal' || qualitativeResult === 'negative';
      return {
        id: `followup_${paramId}_${Date.now()}`,
        parameterId: paramId,
        nameAr: paramDef.nameAr,
        nameEn: paramDef.nameEn,
        value: 0,
        qualitativeResult,
        unit: paramDef.standardUnit,
        isEntered: true,
        confidence: 'high',
        flag: isNormal ? 'normal' : 'abnormal',
      };
    }
    return null;
  }

  const inputUnit = unit || paramDef.standardUnit;
  const conv = convertLabValue(paramId, rawNum, inputUnit);
  const defaultRange = sex === 'male' ? paramDef.adultMaleNormalRange : paramDef.adultFemaleNormalRange;

  const origLow = refLowStr && refLowStr.trim() !== '' ? parseFloat(refLowStr) : undefined;
  const origHigh = refHighStr && refHighStr.trim() !== '' ? parseFloat(refHighStr) : undefined;
  const convRef = convertReferenceRange(paramId, origLow, origHigh, inputUnit);

  const refRangeLow = convRef.low !== undefined ? convRef.low : defaultRange[0];
  const refRangeHigh = convRef.high !== undefined ? convRef.high : defaultRange[1];

  let flag: 'low' | 'normal' | 'high' = 'normal';
  if (conv.convertedValue < refRangeLow) flag = 'low';
  else if (conv.convertedValue > refRangeHigh) flag = 'high';

  return {
    id: `followup_${paramId}_${Date.now()}`,
    parameterId: paramId,
    nameAr: paramDef.nameAr,
    nameEn: paramDef.nameEn,
    value: conv.convertedValue,
    unit: conv.standardUnit,
    originalValue: rawNum,
    originalUnit: inputUnit,
    wasConverted: conv.wasConverted,
    conversionNote: conv.conversionNoteEn || conv.conversionNoteAr,
    refRangeLow,
    refRangeHigh,
    originalRefRangeLow: origLow,
    originalRefRangeHigh: origHigh,
    refRangeUnit: origLow !== undefined || origHigh !== undefined ? inputUnit : conv.standardUnit,
    refRangeRaw: `${refRangeLow} - ${refRangeHigh} ${conv.standardUnit}`,
    isEntered: true,
    confidence: 'high',
    flag,
  };
}

function getSuspicionBadgeClass(level: SuspicionLevel): string {
  switch (level) {
    case 'high':
      return 'bg-[#8B3A4A] text-white border-[#6A2434]';
    case 'moderate':
      return 'bg-amber-100 text-amber-900 border-amber-300';
    case 'insufficient':
      return 'bg-stone-100 text-stone-700 border-stone-300';
    default:
      return 'bg-white text-stone-500 border-stone-200';
  }
}

export const StepFollowUpLab: React.FC<StepFollowUpLabProps> = ({
  profile,
  symptoms,
  history,
  emergency,
  currentLabs,
  onCompleteWithAdditionalLabs,
  onBack,
}) => {
  const initialInference = useMemo(
    () =>
      runInferenceEngine({
        profile,
        symptoms,
        history,
        emergency,
        hasCbc: true,
        labs: currentLabs,
      }),
    [profile, symptoms, history, emergency, currentLabs]
  );

  const defaultPathway = useMemo(
    () => determineTargetedPathway(currentLabs, initialInference),
    [currentLabs, initialInference]
  );

  const [selectedPathway, setSelectedPathway] = useState<TargetedPathway>(
    defaultPathway === 'none' ? 'other_normocytic' : defaultPathway
  );
  const [showPathwaySwitcher, setShowPathwaySwitcher] = useState<boolean>(false);
  const [showExtraVitaminTests, setShowExtraVitaminTests] = useState<boolean>(false);
  const [showExtraMicroTests, setShowExtraMicroTests] = useState<boolean>(false);
  const [showExtraNormoTests, setShowExtraNormoTests] = useState<boolean>(false);

  const [localSymptoms, setLocalSymptoms] = useState<SymptomAnswers>(symptoms);
  const [localHistory, setLocalHistory] = useState<MedicalHistory>(history);

  // --- B12 / Folate Differential State ---
  const [hasDoneB12, setHasDoneB12] = useState<boolean | null>(currentLabs['b12'] ? true : null);
  const [b12Value, setB12Value] = useState<string>(
    currentLabs['b12'] ? String(currentLabs['b12'].originalValue ?? currentLabs['b12'].value) : ''
  );
  const [b12Unit, setB12Unit] = useState<string>(currentLabs['b12']?.originalUnit || 'pg/mL');
  const [b12RefLow, setB12RefLow] = useState<string>(
    currentLabs['b12']?.originalRefRangeLow !== undefined ? String(currentLabs['b12'].originalRefRangeLow) : ''
  );
  const [b12RefHigh, setB12RefHigh] = useState<string>(
    currentLabs['b12']?.originalRefRangeHigh !== undefined ? String(currentLabs['b12'].originalRefRangeHigh) : ''
  );

  const [hasDoneFolate, setHasDoneFolate] = useState<boolean | null>(currentLabs['folate'] ? true : null);
  const [folateValue, setFolateValue] = useState<string>(
    currentLabs['folate'] ? String(currentLabs['folate'].originalValue ?? currentLabs['folate'].value) : ''
  );
  const [folateUnit, setFolateUnit] = useState<string>(currentLabs['folate']?.originalUnit || 'ng/mL');
  const [folateRefLow, setFolateRefLow] = useState<string>(
    currentLabs['folate']?.originalRefRangeLow !== undefined ? String(currentLabs['folate'].originalRefRangeLow) : ''
  );
  const [folateRefHigh, setFolateRefHigh] = useState<string>(
    currentLabs['folate']?.originalRefRangeHigh !== undefined ? String(currentLabs['folate'].originalRefRangeHigh) : ''
  );

  const [hasDoneRbcFolate, setHasDoneRbcFolate] = useState<boolean | null>(currentLabs['rbc_folate'] ? true : null);
  const [rbcFolateValue, setRbcFolateValue] = useState<string>(
    currentLabs['rbc_folate'] ? String(currentLabs['rbc_folate'].originalValue ?? currentLabs['rbc_folate'].value) : ''
  );
  const [rbcFolateUnit, setRbcFolateUnit] = useState<string>(currentLabs['rbc_folate']?.originalUnit || 'ng/mL');
  const [rbcFolateRefLow, setRbcFolateRefLow] = useState<string>(
    currentLabs['rbc_folate']?.originalRefRangeLow !== undefined ? String(currentLabs['rbc_folate'].originalRefRangeLow) : ''
  );
  const [rbcFolateRefHigh, setRbcFolateRefHigh] = useState<string>(
    currentLabs['rbc_folate']?.originalRefRangeHigh !== undefined ? String(currentLabs['rbc_folate'].originalRefRangeHigh) : ''
  );

  const [hasDoneMma, setHasDoneMma] = useState<boolean | null>(currentLabs['mma'] ? true : null);
  const [mmaValue, setMmaValue] = useState<string>(
    currentLabs['mma'] ? String(currentLabs['mma'].originalValue ?? currentLabs['mma'].value) : ''
  );
  const [mmaUnit, setMmaUnit] = useState<string>(currentLabs['mma']?.originalUnit || 'µmol/L');
  const [mmaRefLow, setMmaRefLow] = useState<string>(
    currentLabs['mma']?.originalRefRangeLow !== undefined ? String(currentLabs['mma'].originalRefRangeLow) : ''
  );
  const [mmaRefHigh, setMmaRefHigh] = useState<string>(
    currentLabs['mma']?.originalRefRangeHigh !== undefined ? String(currentLabs['mma'].originalRefRangeHigh) : ''
  );

  const [hasDoneHomocysteine, setHasDoneHomocysteine] = useState<boolean | null>(
    currentLabs['homocysteine'] ? true : null
  );
  const [homocysteineValue, setHomocysteineValue] = useState<string>(
    currentLabs['homocysteine']
      ? String(currentLabs['homocysteine'].originalValue ?? currentLabs['homocysteine'].value)
      : ''
  );
  const [hcyRefLow, setHcyRefLow] = useState<string>(
    currentLabs['homocysteine']?.originalRefRangeLow !== undefined
      ? String(currentLabs['homocysteine'].originalRefRangeLow)
      : ''
  );
  const [hcyRefHigh, setHcyRefHigh] = useState<string>(
    currentLabs['homocysteine']?.originalRefRangeHigh !== undefined
      ? String(currentLabs['homocysteine'].originalRefRangeHigh)
      : ''
  );

  const [creatinineValue, setCreatinineValue] = useState<string>(
    currentLabs['creatinine'] ? String(currentLabs['creatinine'].originalValue ?? currentLabs['creatinine'].value) : ''
  );
  const [creatinineUnit, setCreatinineUnit] = useState<string>(currentLabs['creatinine']?.originalUnit || 'mg/dL');
  const [egfrValue, setEgfrValue] = useState<string>(
    currentLabs['egfr'] ? String(currentLabs['egfr'].originalValue ?? currentLabs['egfr'].value) : ''
  );

  // --- Adaptive Comprehensive Panel State ---
  const [panelInputs, setPanelInputs] = useState<Record<string, PanelEntryState>>(() => {
    const initial: Record<string, PanelEntryState> = {};
    ADAPTIVE_PANEL_PARAM_IDS.forEach(pid => {
      const def = LAB_PARAMETERS.find(p => p.id === pid);
      const existing = currentLabs[pid];
      initial[pid] = {
        availability: existing ? 'available' : null,
        value: existing && !existing.qualitativeResult ? String(existing.originalValue ?? existing.value) : '',
        qualitativeResult: existing?.qualitativeResult || '',
        unit: existing?.originalUnit || def?.standardUnit || '',
        refLow:
          existing?.originalRefRangeLow !== undefined ? String(existing.originalRefRangeLow) : '',
        refHigh:
          existing?.originalRefRangeHigh !== undefined ? String(existing.originalRefRangeHigh) : '',
      };
    });
    return initial;
  });

  const updatePanelEntry = (paramId: string, patch: Partial<PanelEntryState>) => {
    setPanelInputs(prev => ({
      ...prev,
      [paramId]: {
        ...prev[paramId],
        ...patch,
      },
    }));
  };

  const buildMergedLabs = (): ConfirmedLabValues => {
    const updated: ConfirmedLabValues = { ...currentLabs };

    if (hasDoneB12 === true) {
      const item = buildLabItem('b12', b12Value, b12Unit, profile.sex, b12RefLow, b12RefHigh);
      if (item) updated['b12'] = item;
    } else if (hasDoneB12 === false) {
      delete updated['b12'];
    }

    if (hasDoneFolate === true) {
      const item = buildLabItem('folate', folateValue, folateUnit, profile.sex, folateRefLow, folateRefHigh);
      if (item) updated['folate'] = item;
    } else if (hasDoneFolate === false) {
      delete updated['folate'];
    }

    if (hasDoneRbcFolate === true) {
      const item = buildLabItem(
        'rbc_folate',
        rbcFolateValue,
        rbcFolateUnit,
        profile.sex,
        rbcFolateRefLow,
        rbcFolateRefHigh
      );
      if (item) updated['rbc_folate'] = item;
    } else if (hasDoneRbcFolate === false) {
      delete updated['rbc_folate'];
    }

    if (hasDoneMma === true) {
      const item = buildLabItem('mma', mmaValue, mmaUnit, profile.sex, mmaRefLow, mmaRefHigh);
      if (item) updated['mma'] = item;
    } else if (hasDoneMma === false) {
      delete updated['mma'];
    }

    if (hasDoneHomocysteine === true) {
      const item = buildLabItem('homocysteine', homocysteineValue, 'µmol/L', profile.sex, hcyRefLow, hcyRefHigh);
      if (item) updated['homocysteine'] = item;
    } else if (hasDoneHomocysteine === false) {
      delete updated['homocysteine'];
    }

    ADAPTIVE_PANEL_PARAM_IDS.forEach(pid => {
      const entry = panelInputs[pid];
      if (!entry) return;
      if (entry.availability === 'available') {
        const item = buildLabItem(
          pid,
          entry.value,
          entry.unit,
          profile.sex,
          entry.refLow,
          entry.refHigh,
          entry.qualitativeResult
        );
        if (item) updated[pid] = item;
      } else if (entry.availability === 'not_available') {
        delete updated[pid];
      }
    });

    if (creatinineValue.trim() !== '' && panelInputs['creatinine']?.availability !== 'not_available') {
      const creatItem = buildLabItem('creatinine', creatinineValue, creatinineUnit, profile.sex);
      if (creatItem) updated['creatinine'] = creatItem;
    }
    if (egfrValue.trim() !== '' && panelInputs['egfr']?.availability !== 'not_available') {
      const egfrItem = buildLabItem('egfr', egfrValue, 'mL/min/1.73m²', profile.sex);
      if (egfrItem) updated['egfr'] = egfrItem;
    }

    return updated;
  };

  const liveDifferentialResult = useMemo(() => {
    const mergedLabs = buildMergedLabs();
    return runInferenceEngine({
      profile,
      symptoms: localSymptoms,
      history: localHistory,
      emergency,
      hasCbc: true,
      labs: mergedLabs,
    });
  }, [
    profile,
    localSymptoms,
    localHistory,
    emergency,
    currentLabs,
    hasDoneB12,
    b12Value,
    b12Unit,
    b12RefLow,
    b12RefHigh,
    hasDoneFolate,
    folateValue,
    folateUnit,
    folateRefLow,
    folateRefHigh,
    hasDoneRbcFolate,
    rbcFolateValue,
    rbcFolateUnit,
    rbcFolateRefLow,
    rbcFolateRefHigh,
    hasDoneMma,
    mmaValue,
    mmaUnit,
    mmaRefLow,
    mmaRefHigh,
    hasDoneHomocysteine,
    homocysteineValue,
    hcyRefLow,
    hcyRefHigh,
    creatinineValue,
    creatinineUnit,
    egfrValue,
    panelInputs,
  ]);

  const getLiveCardColors = () => {
    switch (liveDifferentialResult.status) {
      case 'POSSIBLE_B12_DEFICIENCY_ANEMIA':
        return 'border-amber-400 bg-amber-50 text-amber-950';
      case 'POSSIBLE_FOLATE_DEFICIENCY_ANEMIA':
        return 'border-teal-400 bg-teal-50 text-teal-950';
      case 'POSSIBLE_COMBINED_B12_FOLATE_ANEMIA':
      case 'POSSIBLE_COMBINED_ANEMIA_CAUSES':
        return 'border-purple-400 bg-purple-50 text-purple-950';
      case 'CONFLICTING_DATA_DETECTED':
        return 'border-rose-400 bg-rose-50 text-rose-950';
      case 'POSSIBLE_IRON_DEFICIENCY_ANEMIA':
      case 'POSSIBLE_THALASSEMIA_SUSPICION':
      case 'POSSIBLE_ANEMIA_OF_CHRONIC_DISEASE':
      case 'POSSIBLE_HEMOLYTIC_ANEMIA':
      case 'POSSIBLE_BLOOD_LOSS_ANEMIA':
      case 'POSSIBLE_OTHER_ANEMIA':
        return 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]';
      case 'NO_ANEMIA_DETECTED':
        return 'border-emerald-400 bg-emerald-50 text-emerald-950';
      default:
        return 'border-stone-300 bg-stone-50 text-stone-900';
    }
  };

  const handleProceed = () => {
    const mergedLabs = buildMergedLabs();
    onCompleteWithAdditionalLabs(mergedLabs, localSymptoms, localHistory);
  };

  const setTargetedHistory = (field: keyof MedicalHistory, val: AnswerChoice) => {
    setLocalHistory(prev => ({ ...prev, [field]: val }));
  };

  const setTargetedNeuro = (val: AnswerChoice) => {
    setLocalSymptoms(prev => ({ ...prev, neuropathy_numbness: val }));
    setLocalHistory(prev => ({ ...prev, balanceProblems: val }));
  };

  const renderAdaptiveTestCard = (paramId: string, helperNoteEn?: string) => {
    const paramDef = LAB_PARAMETERS.find(p => p.id === paramId);
    const entry = panelInputs[paramId];
    if (!paramDef || !entry) return null;

    const defaultRange =
      profile.sex === 'male' ? paramDef.adultMaleNormalRange : paramDef.adultFemaleNormalRange;
    const rawNum = parseFloat(entry.value);
    const liveConv =
      paramDef.inputType !== 'select' && !isNaN(rawNum) && entry.value.trim() !== ''
        ? convertLabValue(paramId, rawNum, entry.unit || paramDef.standardUnit)
        : null;

    return (
      <div key={paramId} className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-stone-900">{paramDef.nameEn}</h4>
            {paramDef.inputType !== 'select' && (
              <span className="text-[10px] font-mono text-stone-500">
                Default Ref: {defaultRange[0]} - {defaultRange[1]} {paramDef.standardUnit}
              </span>
            )}
            {helperNoteEn && <p className="text-[11px] text-stone-600 mt-0.5">{helperNoteEn}</p>}
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => updatePanelEntry(paramId, { availability: 'available' })}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                entry.availability === 'available'
                  ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]'
                  : 'border-stone-200 bg-stone-50 text-stone-700'
              }`}
            >
              Available
            </button>
            <button
              type="button"
              onClick={() =>
                updatePanelEntry(paramId, {
                  availability: 'not_available',
                  value: '',
                  qualitativeResult: '',
                })
              }
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                entry.availability === 'not_available'
                  ? 'border-stone-400 bg-stone-100 text-stone-900'
                  : 'border-stone-200 bg-stone-50 text-stone-700'
              }`}
            >
              Not Available
            </button>
          </div>
        </div>

        {entry.availability === 'available' && (
          <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-2.5">
            {paramDef.inputType === 'select' && paramDef.selectOptions ? (
              <select
                value={entry.qualitativeResult}
                onChange={e => updatePanelEntry(paramId, { qualitativeResult: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs font-semibold text-stone-800 focus:outline-none focus:border-[#8B3A4A]"
              >
                <option value="">— Select reported result —</option>
                {paramDef.selectOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.labelEn}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder={`Value (${paramDef.shortName})`}
                    value={entry.value}
                    onChange={e => updatePanelEntry(paramId, { value: e.target.value })}
                    className="w-32 px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono font-bold"
                  />
                  {paramDef.allowedUnits.length > 1 ? (
                    <select
                      value={entry.unit}
                      onChange={e => updatePanelEntry(paramId, { unit: e.target.value })}
                      className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono"
                    >
                      {paramDef.allowedUnits.map(u => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono text-stone-700">
                      {paramDef.standardUnit}
                    </span>
                  )}

                  {entry.value && (
                    <span className="text-[11px] font-mono text-stone-700 bg-white px-2.5 py-1 rounded border border-stone-200">
                      {entry.value} {entry.unit} (Ref: {entry.refLow || defaultRange[0]}–{entry.refHigh || defaultRange[1]})
                    </span>
                  )}
                </div>

                {paramDef.selectOptions && (
                  <div className="pt-1">
                    <label className="text-[10px] text-stone-600 block mb-1">
                      Or select qualitative result (if HbA2 % is not reported numerically):
                    </label>
                    <select
                      value={entry.qualitativeResult}
                      onChange={e => updatePanelEntry(paramId, { qualitativeResult: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-[11px] font-semibold text-stone-800"
                    >
                      <option value="">— Optional: Qualitative pattern —</option>
                      {paramDef.selectOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 text-[10px] text-stone-500">
                  <span>Lab Ref ({entry.unit}) if available:</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={String(defaultRange[0])}
                    value={entry.refLow}
                    onChange={e => updatePanelEntry(paramId, { refLow: e.target.value })}
                    className="w-16 px-1.5 py-0.5 bg-white border border-stone-200 rounded font-mono"
                  />
                  <span>-</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={String(defaultRange[1])}
                    value={entry.refHigh}
                    onChange={e => updatePanelEntry(paramId, { refHigh: e.target.value })}
                    className="w-16 px-1.5 py-0.5 bg-white border border-stone-200 rounded font-mono"
                  />
                  {liveConv && liveConv.wasConverted && (
                    <span className="text-emerald-700 flex items-center gap-1 font-mono">
                      <RefreshCw className="w-3 h-3" />
                      {liveConv.convertedValue} {liveConv.standardUnit}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const hb = currentLabs['hb']?.value;
  const mcv = currentLabs['mcv']?.value;
  const rbc = currentLabs['rbc']?.value;
  const mentzerIdx = mcv !== undefined && rbc && rbc > 0 ? mcv / rbc : undefined;

  const getLivePanelNumber = (paramId: string): number | undefined => {
    const entry = panelInputs[paramId];
    if (!entry || entry.availability !== 'available' || entry.value.trim() === '') return undefined;
    const raw = parseFloat(entry.value);
    if (isNaN(raw)) return undefined;
    return convertLabValue(paramId, raw, entry.unit || '').convertedValue;
  };

  // Conditional visibility flags — B12 / Folate pathway
  const liveB12Num =
    hasDoneB12 === true && b12Value.trim() !== '' && !isNaN(parseFloat(b12Value))
      ? convertLabValue('b12', parseFloat(b12Value), b12Unit).convertedValue
      : undefined;
  const liveFolateNum =
    hasDoneFolate === true && folateValue.trim() !== '' && !isNaN(parseFloat(folateValue))
      ? convertLabValue('folate', parseFloat(folateValue), folateUnit).convertedValue
      : undefined;
  const liveMmaNum =
    hasDoneMma === true && mmaValue.trim() !== '' && !isNaN(parseFloat(mmaValue))
      ? convertLabValue('mma', parseFloat(mmaValue), mmaUnit).convertedValue
      : undefined;

  const showRbcFolate =
    hasDoneFolate === false ||
    (liveFolateNum !== undefined && liveFolateNum >= 3.0 && liveFolateNum <= 5.5) ||
    hasDoneRbcFolate === true ||
    showExtraVitaminTests;

  const showMmaAndHcy =
    (liveB12Num !== undefined && liveB12Num >= 200 && liveB12Num < 350) ||
    (liveFolateNum !== undefined && liveFolateNum < 4.0 && (liveB12Num === undefined || liveB12Num >= 200)) ||
    (liveB12Num !== undefined &&
      liveB12Num >= 200 &&
      liveFolateNum !== undefined &&
      liveFolateNum >= 4.0 &&
      mcv !== undefined &&
      mcv > 98) ||
    hasDoneB12 === false ||
    hasDoneFolate === false ||
    hasDoneMma === true ||
    hasDoneHomocysteine === true ||
    showExtraVitaminTests;

  const showMmaKidneyInputs =
    (liveMmaNum !== undefined && liveMmaNum > 0.56) ||
    localHistory.chronicKidneyDisease === 'yes' ||
    creatinineValue.trim() !== '' ||
    egfrValue.trim() !== '';

  const showMacroRetic =
    (mcv !== undefined &&
      mcv > 98 &&
      liveB12Num !== undefined &&
      liveB12Num >= 200 &&
      liveFolateNum !== undefined &&
      liveFolateNum >= 4.0) ||
    panelInputs['reticulocytes']?.availability === 'available' ||
    showExtraVitaminTests;

  // Conditional visibility flags — Microcytic / Iron pathway
  const liveFerritinNum = getLivePanelNumber('ferritin');
  const ferritinNotAvail = panelInputs['ferritin']?.availability === 'not_available';

  const showMicroTsat =
    ferritinNotAvail ||
    (liveFerritinNum !== undefined && liveFerritinNum >= 15) ||
    localHistory.chronicInflammationOrAutoimmune === 'yes' ||
    panelInputs['tsat']?.availability === 'available' ||
    showExtraMicroTests;

  const showMicroHbElectro =
    ferritinNotAvail ||
    (liveFerritinNum !== undefined && liveFerritinNum >= 25) ||
    localHistory.familyThalassemia === 'yes' ||
    (mentzerIdx !== undefined && mentzerIdx < 13) ||
    panelInputs['hb_electrophoresis']?.availability === 'available' ||
    panelInputs['rdw']?.availability === 'available' ||
    showExtraMicroTests;

  const showMicroCrp =
    (liveFerritinNum !== undefined && liveFerritinNum >= 30) ||
    localHistory.chronicInflammationOrAutoimmune === 'yes' ||
    panelInputs['crp']?.availability === 'available' ||
    showExtraMicroTests;

  // Conditional visibility flags — Normocytic / Hemolysis / Blood Loss pathway
  const liveReticNum = getLivePanelNumber('reticulocytes');
  const reticNotAvail = panelInputs['reticulocytes']?.availability === 'not_available';

  const showNormoIronAndCrp =
    localHistory.chronicInflammationOrAutoimmune === 'yes' ||
    (liveFerritinNum !== undefined && liveFerritinNum >= 30) ||
    ferritinNotAvail ||
    (liveReticNum !== undefined && liveReticNum <= 2.0) ||
    ['iron', 'tibc', 'tsat', 'crp'].some(id => panelInputs[id]?.availability === 'available') ||
    showExtraNormoTests;

  const showNormoKidney =
    localHistory.chronicKidneyDisease === 'yes' ||
    (liveReticNum !== undefined && liveReticNum <= 2.0 && liveFerritinNum !== undefined && liveFerritinNum >= 30) ||
    ['creatinine', 'egfr'].some(id => panelInputs[id]?.availability === 'available') ||
    showExtraNormoTests;

  const showNormoHemolysis =
    (liveReticNum !== undefined && liveReticNum > 2.0) ||
    localSymptoms['jaundice_eyes'] === 'yes' ||
    localSymptoms['dark_urine'] === 'yes' ||
    (reticNotAvail && localHistory.recentSurgeryOrBloodLoss !== 'yes') ||
    ['ldh', 'bilirubin_indirect', 'haptoglobin'].some(id => panelInputs[id]?.availability === 'available') ||
    showExtraNormoTests;

  const showNormoSmearAndDat =
    ['ldh', 'bilirubin_indirect', 'haptoglobin'].some(
      id => panelInputs[id]?.availability === 'available' && panelInputs[id].value.trim() !== ''
    ) ||
    (liveReticNum !== undefined && liveReticNum > 2.5 && localHistory.recentSurgeryOrBloodLoss !== 'yes') ||
    ['peripheral_smear', 'dat_test'].some(id => panelInputs[id]?.availability === 'available') ||
    showExtraNormoTests;

  const visibleCandidates = (liveDifferentialResult.differentialCandidates || []).filter(
    c => c.suspicionLevel !== 'low' || c.supportingFindings.length > 0
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Preliminary CBC Classification Banner */}
      <div className="mb-6 p-5 bg-white border-2 border-[#8B3A4A]/25 rounded-2xl shadow-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-[#8B3A4A] flex items-center gap-1.5">
            <Activity className="w-4 h-4" />
            <span>Preliminary CBC Classification</span>
          </span>
          {hb !== undefined && (
            <span className="text-[11px] font-mono bg-stone-100 px-2.5 py-0.5 rounded-lg text-stone-700 border border-stone-200">
              Hb: {hb} g/dL {mcv !== undefined ? `· MCV: ${mcv} fL` : ''}
            </span>
          )}
        </div>
        <p className="text-sm font-bold text-stone-900">{initialInference.preliminaryAssessmentEn}</p>
      </div>

      {/* Header + Adaptive Pathway Selector */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-[#8B3A4A] tracking-wider uppercase">
              Targeted Follow-Up Evaluation
            </span>
            <h2 className="text-2xl font-bold text-stone-900 mt-1">
              {selectedPathway === 'b12_folate'
                ? 'Vitamin B12 & Folate Differential Evaluation'
                : selectedPathway === 'iron'
                ? 'Iron Deficiency, Thalassemia & Microcytic Workup'
                : 'Normocytic, Chronic Disease, Hemolysis & Blood Loss Workup'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowPathwaySwitcher(!showPathwaySwitcher)}
            className="text-xs font-semibold text-[#8B3A4A] hover:underline self-start sm:self-auto cursor-pointer"
          >
            {showPathwaySwitcher ? 'Hide other pathways' : 'Need to check another pathway?'}
          </button>
        </div>
        <p className="text-xs text-stone-600">
          Only the tests needed for your CBC pattern are requested below. Additional tests appear automatically only if your initial values leave uncertainty.
        </p>

        {/* Pathway Quick Switcher (hidden by default to avoid clutter) */}
        {showPathwaySwitcher && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => setSelectedPathway('iron')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                selectedPathway === 'iron'
                  ? 'bg-[#8B3A4A] text-white border-[#8B3A4A] shadow-xs'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
              }`}
            >
              Iron &amp; Thalassemia Workup {defaultPathway === 'iron' && '★ Recommended'}
            </button>

            <button
              type="button"
              onClick={() => setSelectedPathway('b12_folate')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                selectedPathway === 'b12_folate'
                  ? 'bg-[#8B3A4A] text-white border-[#8B3A4A] shadow-xs'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
              }`}
            >
              B12, Folate &amp; MMA Workup {defaultPathway === 'b12_folate' && '★ Recommended'}
            </button>

            <button
              type="button"
              onClick={() => setSelectedPathway('other_normocytic')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                selectedPathway === 'other_normocytic'
                  ? 'bg-[#8B3A4A] text-white border-[#8B3A4A] shadow-xs'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
              }`}
            >
              Hemolysis, Chronic Disease &amp; Blood Loss{' '}
              {(defaultPathway === 'other_normocytic' || defaultPathway === 'normal_hb_check') && '★ Recommended'}
            </button>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 1. B12 / FOLATE DIFFERENTIAL MODULE                            */}
      {/* ============================================================== */}
      {selectedPathway === 'b12_folate' && (
        <div className="space-y-4 mb-6">
          {/* Folic Acid Monotherapy Safety Warning */}
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-xs text-amber-950 leading-relaxed">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold text-amber-900 mb-0.5">
                Folic Acid Safety Warning
              </strong>
              <span>
                Taking folic acid alone can mask blood count changes while allowing neurological injury from untreated Vitamin B12 deficiency to progress. Always evaluate B12 status with your physician first.
              </span>
            </div>
          </div>

          {/* 1. Serum Vitamin B12 */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-stone-900">1. Serum Vitamin B12</h3>
                <span className="text-[11px] font-mono text-stone-500">Default Reference: 200 - 900 pg/mL</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setHasDoneB12(true)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                    hasDoneB12 === true
                      ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]'
                      : 'border-stone-200 bg-stone-50 text-stone-700'
                  }`}
                >
                  Available
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHasDoneB12(false);
                    setB12Value('');
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                    hasDoneB12 === false
                      ? 'border-stone-400 bg-stone-100 text-stone-900'
                      : 'border-stone-200 bg-stone-50 text-stone-700'
                  }`}
                >
                  Not Available
                </button>
              </div>
            </div>

            {hasDoneB12 === true && (
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Value (e.g. 165)"
                    value={b12Value}
                    onChange={e => setB12Value(e.target.value)}
                    className="w-32 px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono font-bold"
                  />
                  <select
                    value={b12Unit}
                    onChange={e => setB12Unit(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono"
                  >
                    <option value="pg/mL">pg/mL</option>
                    <option value="pmol/L">pmol/L</option>
                  </select>
                  {b12Value && (
                    <span className="text-[11px] font-mono text-stone-700 bg-white px-2.5 py-1 rounded border border-stone-200">
                      {b12Value} {b12Unit} (Ref: {b12RefLow || (b12Unit === 'pmol/L' ? '148' : '200')}–{b12RefHigh || (b12Unit === 'pmol/L' ? '664' : '900')} {b12Unit})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-stone-500">
                  <span>Lab Ref ({b12Unit}) if available:</span>
                  <input
                    type="number"
                    placeholder="Low"
                    value={b12RefLow}
                    onChange={e => setB12RefLow(e.target.value)}
                    className="w-16 px-1.5 py-0.5 bg-white border border-stone-200 rounded font-mono"
                  />
                  <span>-</span>
                  <input
                    type="number"
                    placeholder="High"
                    value={b12RefHigh}
                    onChange={e => setB12RefHigh(e.target.value)}
                    className="w-16 px-1.5 py-0.5 bg-white border border-stone-200 rounded font-mono"
                  />
                  {b12Unit === 'pmol/L' && b12Value && (
                    <span className="text-emerald-700 flex items-center gap-1 font-mono">
                      <RefreshCw className="w-3 h-3" />
                      {convertLabValue('b12', parseFloat(b12Value), b12Unit).convertedValue} pg/mL
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. Serum Folate */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-stone-900">2. Serum Folate</h3>
                <span className="text-[11px] font-mono text-stone-500">Default Reference: 4.0 - 20.0 ng/mL</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setHasDoneFolate(true)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                    hasDoneFolate === true
                      ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]'
                      : 'border-stone-200 bg-stone-50 text-stone-700'
                  }`}
                >
                  Available
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHasDoneFolate(false);
                    setFolateValue('');
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                    hasDoneFolate === false
                      ? 'border-stone-400 bg-stone-100 text-stone-900'
                      : 'border-stone-200 bg-stone-50 text-stone-700'
                  }`}
                >
                  Not Available
                </button>
              </div>
            </div>

            {hasDoneFolate === true && (
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Value (e.g. 2.8)"
                    value={folateValue}
                    onChange={e => setFolateValue(e.target.value)}
                    className="w-32 px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono font-bold"
                  />
                  <select
                    value={folateUnit}
                    onChange={e => setFolateUnit(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono"
                  >
                    <option value="ng/mL">ng/mL</option>
                    <option value="nmol/L">nmol/L</option>
                  </select>
                  {folateValue && (
                    <span className="text-[11px] font-mono text-stone-700 bg-white px-2.5 py-1 rounded border border-stone-200">
                      {folateValue} {folateUnit} (Ref: {folateRefLow || (folateUnit === 'nmol/L' ? '9.1' : '4.0')}–{folateRefHigh || (folateUnit === 'nmol/L' ? '45.3' : '20.0')} {folateUnit})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-stone-500">
                  <span>Lab Ref ({folateUnit}):</span>
                  <input
                    type="number"
                    placeholder="Low"
                    value={folateRefLow}
                    onChange={e => setFolateRefLow(e.target.value)}
                    className="w-16 px-1.5 py-0.5 bg-white border border-stone-200 rounded font-mono"
                  />
                  <span>-</span>
                  <input
                    type="number"
                    placeholder="High"
                    value={folateRefHigh}
                    onChange={e => setFolateRefHigh(e.target.value)}
                    className="w-16 px-1.5 py-0.5 bg-white border border-stone-200 rounded font-mono"
                  />
                  {folateUnit === 'nmol/L' && folateValue && (
                    <span className="text-emerald-700 flex items-center gap-1 font-mono">
                      <RefreshCw className="w-3 h-3" />
                      {convertLabValue('folate', parseFloat(folateValue), folateUnit).convertedValue} ng/mL
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. RBC Folate (Only when Serum Folate is unavailable or borderline) */}
          {showRbcFolate && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">3. RBC Folate</h3>
                  <span className="text-[11px] font-mono text-stone-500">Default Reference: 140 - 628 ng/mL</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setHasDoneRbcFolate(true)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                      hasDoneRbcFolate === true
                        ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]'
                        : 'border-stone-200 bg-stone-50 text-stone-700'
                    }`}
                  >
                    Available
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHasDoneRbcFolate(false);
                      setRbcFolateValue('');
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                      hasDoneRbcFolate === false
                        ? 'border-stone-400 bg-stone-100 text-stone-900'
                        : 'border-stone-200 bg-stone-50 text-stone-700'
                    }`}
                  >
                    Not Available
                  </button>
                </div>
              </div>

              {hasDoneRbcFolate === true && (
                <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Value (e.g. 110)"
                      value={rbcFolateValue}
                      onChange={e => setRbcFolateValue(e.target.value)}
                      className="w-32 px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono font-bold"
                    />
                    <select
                      value={rbcFolateUnit}
                      onChange={e => setRbcFolateUnit(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono"
                    >
                      <option value="ng/mL">ng/mL</option>
                      <option value="nmol/L">nmol/L</option>
                    </select>
                    {rbcFolateValue && (
                      <span className="text-[11px] font-mono text-stone-700 bg-white px-2.5 py-1 rounded border border-stone-200">
                        {rbcFolateValue} {rbcFolateUnit} (Ref: {rbcFolateRefLow || (rbcFolateUnit === 'nmol/L' ? '317' : '140')}–{rbcFolateRefHigh || (rbcFolateUnit === 'nmol/L' ? '1422' : '628')} {rbcFolateUnit})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-stone-500">
                    <span>Lab Ref ({rbcFolateUnit}):</span>
                    <input
                      type="number"
                      placeholder="Low"
                      value={rbcFolateRefLow}
                      onChange={e => setRbcFolateRefLow(e.target.value)}
                      className="w-16 px-1.5 py-0.5 bg-white border border-stone-200 rounded font-mono"
                    />
                    <span>-</span>
                    <input
                      type="number"
                      placeholder="High"
                      value={rbcFolateRefHigh}
                      onChange={e => setRbcFolateRefHigh(e.target.value)}
                      className="w-16 px-1.5 py-0.5 bg-white border border-stone-200 rounded font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. Methylmalonic Acid (MMA) — shown only when needed to resolve B12 vs Folate */}
          {showMmaAndHcy && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-stone-900">4. Methylmalonic Acid (MMA)</h3>
                <p className="text-[11px] text-stone-500">
                  Supports B12 deficiency when elevated and isolated folate deficiency when normal (consider kidney function).
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setHasDoneMma(true)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                    hasDoneMma === true
                      ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]'
                      : 'border-stone-200 bg-stone-50 text-stone-700'
                  }`}
                >
                  Available
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHasDoneMma(false);
                    setMmaValue('');
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                    hasDoneMma === false
                      ? 'border-stone-400 bg-stone-100 text-stone-900'
                      : 'border-stone-200 bg-stone-50 text-stone-700'
                  }`}
                >
                  Not Available
                </button>
              </div>
            </div>

            {hasDoneMma === true && (
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Value (e.g. 0.85)"
                    value={mmaValue}
                    onChange={e => setMmaValue(e.target.value)}
                    className="w-32 px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono font-bold"
                  />
                  <select
                    value={mmaUnit}
                    onChange={e => setMmaUnit(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono"
                  >
                    <option value="µmol/L">µmol/L</option>
                    <option value="nmol/L">nmol/L</option>
                  </select>
                  {mmaValue && (
                    <span className="text-[11px] font-mono text-stone-700 bg-white px-2.5 py-1 rounded border border-stone-200">
                      {mmaValue} {mmaUnit} (Ref: {mmaRefLow || (mmaUnit === 'nmol/L' ? '80' : '0.08')}–{mmaRefHigh || (mmaUnit === 'nmol/L' ? '560' : '0.56')} {mmaUnit})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-stone-500">
                  <span>Lab Ref ({mmaUnit}):</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Low"
                    value={mmaRefLow}
                    onChange={e => setMmaRefLow(e.target.value)}
                    className="w-16 px-1.5 py-0.5 bg-white border border-stone-200 rounded font-mono"
                  />
                  <span>-</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="High"
                    value={mmaRefHigh}
                    onChange={e => setMmaRefHigh(e.target.value)}
                    className="w-16 px-1.5 py-0.5 bg-white border border-stone-200 rounded font-mono"
                  />
                  {mmaUnit === 'nmol/L' && mmaValue && (
                    <span className="text-emerald-700 flex items-center gap-1 font-mono">
                      <RefreshCw className="w-3 h-3" />
                      {convertLabValue('mma', parseFloat(mmaValue), mmaUnit).convertedValue} µmol/L
                    </span>
                  )}
                </div>
                </div>
              )}
            </div>
          )}

          {/* 5. Homocysteine — shown only when needed */}
          {showMmaAndHcy && (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">5. Total Homocysteine</h3>
                  <p className="text-[11px] text-stone-500">
                    Shared supportive indicator (elevates in both B12 and folate deficiencies; does not distinguish them alone).
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setHasDoneHomocysteine(true)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                      hasDoneHomocysteine === true
                        ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]'
                        : 'border-stone-200 bg-stone-50 text-stone-700'
                    }`}
                  >
                    Available
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHasDoneHomocysteine(false);
                      setHomocysteineValue('');
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                      hasDoneHomocysteine === false
                        ? 'border-stone-400 bg-stone-100 text-stone-900'
                        : 'border-stone-200 bg-stone-50 text-stone-700'
                    }`}
                  >
                    Not Available
                  </button>
                </div>
              </div>

              {hasDoneHomocysteine === true && (
                <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Value (e.g. 22)"
                      value={homocysteineValue}
                      onChange={e => setHomocysteineValue(e.target.value)}
                      className="w-32 px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono font-bold"
                    />
                    <span className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono text-stone-700">
                      µmol/L
                    </span>
                    {homocysteineValue && (
                      <span className="text-[11px] font-mono text-stone-700 bg-white px-2.5 py-1 rounded border border-stone-200">
                        {homocysteineValue} µmol/L (Ref: {hcyRefLow || '5.0'}–{hcyRefHigh || '15.0'} µmol/L)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-stone-500">
                    <span>Lab Ref (µmol/L):</span>
                    <input
                      type="number"
                      placeholder="5.0"
                      value={hcyRefLow}
                      onChange={e => setHcyRefLow(e.target.value)}
                      className="w-16 px-1.5 py-0.5 bg-white border border-stone-200 rounded font-mono"
                    />
                    <span>-</span>
                    <input
                      type="number"
                      placeholder="15.0"
                      value={hcyRefHigh}
                      onChange={e => setHcyRefHigh(e.target.value)}
                      className="w-16 px-1.5 py-0.5 bg-white border border-stone-200 rounded font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 6. Reticulocytes — only when macrocytosis is unexplained by B12/Folate */}
          {showMacroRetic &&
            renderAdaptiveTestCard(
              'reticulocytes',
              'Requested because B12 and Folate were normal despite macrocytosis — evaluates reticulocytosis or hemolysis.'
            )}

          {(!showMmaAndHcy || !showRbcFolate || !showMacroRetic) && (
            <button
              type="button"
              onClick={() => setShowExtraVitaminTests(!showExtraVitaminTests)}
              className="text-xs font-semibold text-[#8B3A4A] hover:underline cursor-pointer"
            >
              {showExtraVitaminTests
                ? 'Hide optional extra tests'
                : '+ Already have MMA, Homocysteine, RBC Folate, or Reticulocyte results? Add them'}
            </button>
          )}

          {/* 7. Targeted Questions (Neurological, Dietary, Kidney Function) */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#8B3A4A]" />
              <h3 className="text-sm font-bold text-stone-900">Targeted Questions for B12, Folate &amp; MMA Context</h3>
            </div>

            <div className="space-y-2 pb-3 border-b border-stone-100">
              <p className="text-xs text-stone-700 font-semibold">
                Are you experiencing numbness, tingling in hands/feet, or balance difficulties?
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setTargetedNeuro('yes')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                    localSymptoms['neuropathy_numbness'] === 'yes'
                      ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]'
                      : 'border-stone-200 bg-stone-50 text-stone-700'
                  }`}
                >
                  Yes, neurological symptoms present
                </button>
                <button
                  type="button"
                  onClick={() => setTargetedNeuro('no')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                    localSymptoms['neuropathy_numbness'] === 'no'
                      ? 'border-stone-400 bg-stone-100 text-stone-900'
                      : 'border-stone-200 bg-stone-50 text-stone-700'
                  }`}
                >
                  No neurological symptoms
                </button>
              </div>
            </div>

            <div className="space-y-2 pb-3 border-b border-stone-100">
              <p className="text-xs text-stone-700 font-semibold">
                Do you follow a strict vegan/vegetarian diet, have dietary restrictions, or prior stomach/GI surgery?
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setTargetedHistory('vegetarianOrVegan', 'yes')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                    localHistory.vegetarianOrVegan === 'yes'
                      ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]'
                      : 'border-stone-200 bg-stone-50 text-stone-700'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setTargetedHistory('vegetarianOrVegan', 'no')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                    localHistory.vegetarianOrVegan === 'no'
                      ? 'border-stone-400 bg-stone-100 text-stone-900'
                      : 'border-stone-200 bg-stone-50 text-stone-700'
                  }`}
                >
                  No
                </button>
              </div>
            </div>

            {showMmaAndHcy && (
              <div className="space-y-2 pt-3 border-t border-stone-100">
                <p className="text-xs text-stone-700 font-semibold">
                  Do you have known kidney impairment? (Important when interpreting elevated MMA)
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTargetedHistory('chronicKidneyDisease', 'yes')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                      localHistory.chronicKidneyDisease === 'yes'
                        ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]'
                        : 'border-stone-200 bg-stone-50 text-stone-700'
                    }`}
                  >
                    Yes, known kidney impairment
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetedHistory('chronicKidneyDisease', 'no')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                      localHistory.chronicKidneyDisease === 'no'
                        ? 'border-stone-400 bg-stone-100 text-stone-900'
                        : 'border-stone-200 bg-stone-50 text-stone-700'
                    }`}
                  >
                    No / Normal kidney function
                  </button>
                </div>

                {showMmaKidneyInputs && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                    <div className="flex items-center gap-2 bg-stone-50 p-2 rounded-xl border border-stone-200">
                      <span className="text-[11px] text-stone-600 shrink-0">Creatinine (Optional):</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="1.0"
                        value={creatinineValue}
                        onChange={e => setCreatinineValue(e.target.value)}
                        className="w-20 px-2 py-1 bg-white border border-stone-300 rounded text-xs font-mono"
                      />
                      <select
                        value={creatinineUnit}
                        onChange={e => setCreatinineUnit(e.target.value)}
                        className="px-1.5 py-1 bg-white border border-stone-300 rounded text-[11px] font-mono"
                      >
                        <option value="mg/dL">mg/dL</option>
                        <option value="µmol/L">µmol/L</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 bg-stone-50 p-2 rounded-xl border border-stone-200">
                      <span className="text-[11px] text-stone-600 shrink-0">eGFR (Optional):</span>
                      <input
                        type="number"
                        step="1"
                        placeholder="> 90"
                        value={egfrValue}
                        onChange={e => setEgfrValue(e.target.value)}
                        className="w-20 px-2 py-1 bg-white border border-stone-300 rounded text-xs font-mono"
                      />
                      <span className="text-[10px] font-mono text-stone-500">mL/min</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. MICROCYTIC / IRON & THALASSEMIA TARGETED MODULE             */}
      {/* ============================================================== */}
      {selectedPathway === 'iron' && (
        <div className="space-y-4 mb-6">
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-[#8B3A4A]">
              <Droplets className="w-4 h-4" />
              <h3 className="text-sm font-bold text-stone-900">
                Targeted Questions for Iron Deficiency, Blood Loss, Thalassemia &amp; Chronic Disease
              </h3>
            </div>

            {profile.sex === 'female' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
                <span className="text-xs font-semibold text-stone-800">Do you experience heavy or prolonged menstrual bleeding?</span>
                <div className="flex gap-2">
                  {(['yes', 'no'] as const).map(choice => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setTargetedHistory('heavyMenstrualBleeding', choice)}
                      className={`px-3 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
                        localHistory.heavyMenstrualBleeding === choice
                          ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]'
                          : 'border-stone-200 bg-stone-50 text-stone-700'
                      }`}
                    >
                      {choice === 'yes' ? 'Yes' : 'No'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <span className="text-xs font-semibold text-stone-800">
                Have you noticed signs of chronic blood loss (dark/tarry stools, blood in stool, or frequent nosebleeds)?
              </span>
              <div className="flex gap-2">
                {(['yes', 'no'] as const).map(choice => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setTargetedHistory('blackTarStool', choice)}
                    className={`px-3 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
                      localHistory.blackTarStool === choice
                        ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]'
                        : 'border-stone-200 bg-stone-50 text-stone-700'
                    }`}
                  >
                    {choice === 'yes' ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <span className="text-xs font-semibold text-stone-800">Do you follow a restricted or low-iron diet?</span>
              <div className="flex gap-2">
                {(['yes', 'no'] as const).map(choice => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setTargetedHistory('lowIronDiet', choice)}
                    className={`px-3 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
                      localHistory.lowIronDiet === choice
                        ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]'
                        : 'border-stone-200 bg-stone-50 text-stone-700'
                    }`}
                  >
                    {choice === 'yes' ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <span className="text-xs font-semibold text-stone-800">Do you have a family history of thalassemia or inherited anemia?</span>
              <div className="flex gap-2">
                {(['yes', 'no'] as const).map(choice => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setTargetedHistory('familyThalassemia', choice)}
                    className={`px-3 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
                      localHistory.familyThalassemia === choice
                        ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]'
                        : 'border-stone-200 bg-stone-50 text-stone-700'
                    }`}
                  >
                    {choice === 'yes' ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-semibold text-stone-800">
                Do you have a chronic inflammatory, autoimmune, or kidney condition?
              </span>
              <div className="flex gap-2">
                {(['yes', 'no'] as const).map(choice => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setTargetedHistory('chronicInflammationOrAutoimmune', choice)}
                    className={`px-3 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
                      localHistory.chronicInflammationOrAutoimmune === choice
                        ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]'
                        : 'border-stone-200 bg-stone-50 text-stone-700'
                    }`}
                  >
                    {choice === 'yes' ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#8B3A4A]">
              <Sparkles className="w-4 h-4" />
              <span>Iron Studies (Requested for Microcytic Pattern)</span>
            </div>
            {renderAdaptiveTestCard(
              'ferritin',
              'Primary marker of iron stores — low ferritin strongly supports Iron Deficiency Anemia.'
            )}
            {renderAdaptiveTestCard(
              'iron',
              'Decreases in both Iron Deficiency Anemia and Anemia of Chronic Disease.'
            )}
            {renderAdaptiveTestCard(
              'tibc',
              'Typically elevated in Iron Deficiency Anemia; low or normal in Anemia of Chronic Disease.'
            )}
            {showMicroTsat &&
              renderAdaptiveTestCard(
                'tsat',
                'Values < 20% with ferritin 30–100 ng/mL and inflammation suggest coexisting iron deficiency.'
              )}

            {showMicroHbElectro && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#8B3A4A]">
                  <Layers className="w-4 h-4" />
                  <span>
                    Suspected Thalassemia Workup
                    {mentzerIdx !== undefined && mentzerIdx < 13
                      ? ` (Mentzer Index ${mentzerIdx.toFixed(1)} < 13)`
                      : ''}
                  </span>
                </div>
                {renderAdaptiveTestCard(
                  'hb_electrophoresis',
                  'Enter HbA2 (%) and/or select the Hemoglobin Electrophoresis / HPLC pattern to evaluate beta- or alpha-thalassemia trait.'
                )}
                {renderAdaptiveTestCard(
                  'rdw',
                  'Conditional clue: normal RDW supports thalassemia trait, whereas elevated RDW favors iron deficiency.'
                )}
              </div>
            )}

            {showMicroCrp && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#8B3A4A]">
                  <Stethoscope className="w-4 h-4" />
                  <span>Suspected Chronic Inflammation Workup</span>
                </div>
                {renderAdaptiveTestCard(
                  'crp',
                  'Helps detect active inflammation that can falsely elevate ferritin in Anemia of Chronic Disease.'
                )}
              </div>
            )}

            {(!showMicroTsat || !showMicroHbElectro || !showMicroCrp) && (
              <button
                type="button"
                onClick={() => setShowExtraMicroTests(!showExtraMicroTests)}
                className="text-xs font-semibold text-[#8B3A4A] hover:underline cursor-pointer"
              >
                {showExtraMicroTests
                  ? 'Hide optional extra microcytic tests'
                  : '+ Already have TSAT, HbA2 / Electrophoresis, RDW, or CRP results? Add them'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. NORMOCYTIC / HEMOLYSIS / ACD / BLOOD LOSS MODULE            */}
      {/* ============================================================== */}
      {(selectedPathway === 'other_normocytic' || selectedPathway === 'normal_hb_check') && (
        <div className="space-y-4 mb-6">
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-[#8B3A4A]">
              <Stethoscope className="w-4 h-4" />
              <h3 className="text-sm font-bold text-stone-900">
                Targeted Questions for Normocytic, Hemolytic, Chronic Disease &amp; Blood Loss Causes
              </h3>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <span className="text-xs font-semibold text-stone-800">
                Have you had recent acute blood loss (surgery, injury, childbirth, or acute bleeding)?
              </span>
              <div className="flex gap-2">
                {(['yes', 'no'] as const).map(choice => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setTargetedHistory('recentSurgeryOrBloodLoss', choice)}
                    className={`px-3 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
                      localHistory.recentSurgeryOrBloodLoss === choice
                        ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]'
                        : 'border-stone-200 bg-stone-50 text-stone-700'
                    }`}
                  >
                    {choice === 'yes' ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <span className="text-xs font-semibold text-stone-800">
                Have you experienced ongoing blood loss (heavy periods, blood/dark stool, frequent nosebleeds, or hematuria)?
              </span>
              <div className="flex gap-2">
                {(['yes', 'no'] as const).map(choice => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => {
                      setTargetedHistory('bloodInStool', choice);
                      if (profile.sex === 'female') {
                        setTargetedHistory('heavyMenstrualBleeding', choice);
                      }
                    }}
                    className={`px-3 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
                      localHistory.bloodInStool === choice || localHistory.heavyMenstrualBleeding === choice
                        ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]'
                        : 'border-stone-200 bg-stone-50 text-stone-700'
                    }`}
                  >
                    {choice === 'yes' ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <span className="text-xs font-semibold text-stone-800">
                Do you have a chronic inflammatory, infectious, or autoimmune condition?
              </span>
              <div className="flex gap-2">
                {(['yes', 'no'] as const).map(choice => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setTargetedHistory('chronicInflammationOrAutoimmune', choice)}
                    className={`px-3 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
                      localHistory.chronicInflammationOrAutoimmune === choice
                        ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]'
                        : 'border-stone-200 bg-stone-50 text-stone-700'
                    }`}
                  >
                    {choice === 'yes' ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <span className="text-xs font-semibold text-stone-800">
                Do you have a known history of chronic kidney disease?
              </span>
              <div className="flex gap-2">
                {(['yes', 'no'] as const).map(choice => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setTargetedHistory('chronicKidneyDisease', choice)}
                    className={`px-3 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
                      localHistory.chronicKidneyDisease === choice
                        ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]'
                        : 'border-stone-200 bg-stone-50 text-stone-700'
                    }`}
                  >
                    {choice === 'yes' ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-semibold text-stone-800">
                Have you noticed yellowing of the eyes (jaundice) or dark tea-colored urine?
              </span>
              <div className="flex gap-2">
                {(['yes', 'no'] as const).map(choice => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() =>
                      setLocalSymptoms(prev => ({ ...prev, jaundice_eyes: choice, dark_urine: choice }))
                    }
                    className={`px-3 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
                      localSymptoms['jaundice_eyes'] === choice
                        ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434]'
                        : 'border-stone-200 bg-stone-50 text-stone-700'
                    }`}
                  >
                    {choice === 'yes' ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#8B3A4A]">
              <Sparkles className="w-4 h-4" />
              <span>Primary Normocytic Tests (Start with Reticulocytes &amp; Ferritin)</span>
            </div>
            {renderAdaptiveTestCard(
              'reticulocytes',
              'Distinguishes decreased bone marrow production from increased response in hemolysis or blood loss.'
            )}
            {renderAdaptiveTestCard(
              'ferritin',
              'Normal/high ferritin with low iron points toward chronic disease; low ferritin supports iron deficiency.'
            )}

            {showNormoIronAndCrp && (
              <>
                {renderAdaptiveTestCard('iron')}
                {renderAdaptiveTestCard('tibc', 'Low or normal in chronic disease; elevated in iron deficiency.')}
                {renderAdaptiveTestCard('tsat', 'TSAT < 20% with inflammation supports coexisting functional or true iron deficiency.')}
                {renderAdaptiveTestCard('crp')}
              </>
            )}

            {showNormoKidney && (
              <>
                {renderAdaptiveTestCard('creatinine')}
                {renderAdaptiveTestCard('egfr')}
              </>
            )}
          </div>

          {showNormoHemolysis && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#8B3A4A]">
                <Layers className="w-4 h-4" />
                <span>Targeted Hemolysis Workup Panel</span>
              </div>
              <p className="text-[11px] text-stone-600">
                Triggered by elevated reticulocytes, hemolytic signs, or unavailable reticulocyte count. Redora requires at least two concordant markers to suggest hemolysis:
              </p>
              {renderAdaptiveTestCard('ldh')}
              {renderAdaptiveTestCard('bilirubin_indirect')}
              {renderAdaptiveTestCard('haptoglobin')}
              {showNormoSmearAndDat && (
                <>
                  {renderAdaptiveTestCard('peripheral_smear')}
                  {renderAdaptiveTestCard('dat_test')}
                </>
              )}
            </div>
          )}

          {(!showNormoIronAndCrp || !showNormoKidney || !showNormoHemolysis || !showNormoSmearAndDat) && (
            <button
              type="button"
              onClick={() => setShowExtraNormoTests(!showExtraNormoTests)}
              className="text-xs font-semibold text-[#8B3A4A] hover:underline cursor-pointer"
            >
              {showExtraNormoTests
                ? 'Hide optional extra normocytic / hemolysis tests'
                : '+ Already have Iron Profile, CRP, Kidney, or Hemolysis panel results? Add them'}
            </button>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* UNIVERSAL LIVE DIFFERENTIAL EVALUATION CARD                    */}
      {/* ============================================================== */}
      <div className={`mb-8 p-5 rounded-2xl border-2 transition-all shadow-sm space-y-3 ${getLiveCardColors()}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold tracking-wider uppercase font-mono">
            Live Differential Evaluation
          </span>
          <span className="text-xs font-bold px-3 py-0.5 rounded-full bg-white/80 border border-current">
            {liveDifferentialResult.statusTitleEn}
          </span>
        </div>

        <h4 className="text-base font-extrabold">{liveDifferentialResult.statusTitleAr}</h4>
        <p className="text-xs leading-relaxed opacity-90">{liveDifferentialResult.summaryAr}</p>

        {liveDifferentialResult.comparativeReasoningAr && (
          <div className="p-3 bg-white/70 rounded-xl border border-black/10 text-xs leading-relaxed">
            <strong className="block mb-0.5">Why this pathway ranks ahead of alternatives</strong>
            <span>{liveDifferentialResult.comparativeReasoningAr}</span>
          </div>
        )}

        {liveDifferentialResult.overlappingConditionsAr && liveDifferentialResult.overlappingConditionsAr.length > 0 && (
          <div className="p-3 bg-white/80 rounded-xl border border-purple-300 text-xs space-y-1">
            <strong className="block text-purple-900">Overlapping / Mixed Causes Detected:</strong>
            {liveDifferentialResult.overlappingConditionsAr.map((ov, idx) => (
              <div key={idx} className="text-purple-950">• {ov}</div>
            ))}
          </div>
        )}

        {visibleCandidates.length > 0 && (
          <div className="pt-2 border-t border-black/10 space-y-1.5">
            <strong className="block text-xs">Candidate Comparison Matrix:</strong>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {visibleCandidates.slice(0, 6).map(cand => (
                <div
                  key={cand.categoryId}
                  className="p-2.5 bg-white/75 rounded-xl border border-black/10 text-[11px] flex items-center justify-between gap-2"
                >
                  <span className="font-bold text-stone-900">{cand.nameEn}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full border text-[10px] font-bold shrink-0 ${getSuspicionBadgeClass(
                      cand.suspicionLevel
                    )}`}
                  >
                    {cand.suspicionLabelEn}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {liveDifferentialResult.triggeredRules.filter(
          r => r.category === 'CLASSIFICATION' || r.category === 'CONFLICT'
        ).length > 0 && (
          <div className="pt-2 border-t border-black/10 text-[11px] space-y-1">
            <strong className="block">Currently Activated Differential Rules:</strong>
            {liveDifferentialResult.triggeredRules
              .filter(r => r.category === 'CLASSIFICATION' || r.category === 'CONFLICT')
              .map(r => (
                <div key={r.ruleId} className="bg-white/60 px-2.5 py-1 rounded-lg">
                  • {r.nameEn}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 border border-stone-300 hover:bg-stone-100 rounded-xl text-stone-700 text-sm font-semibold flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to CBC Results</span>
        </button>

        <button
          type="button"
          onClick={handleProceed}
          className="px-8 py-3 bg-gradient-to-r from-[#8B3A4A] to-[#6A2434] hover:from-[#782E3C] hover:to-[#571B28] text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Generate Final Expert System Report</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
