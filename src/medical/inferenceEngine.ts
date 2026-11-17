import {
  PatientProfile,
  SymptomAnswers,
  MedicalHistory,
  EmergencySigns,
  ConfirmedLabValues,
  InferenceResult,
  TriggeredRule,
  AdditionalTestRecommendation,
  AnemiaStatus,
  DifferentialCandidate,
  SuspicionLevel,
} from '../types';
import {
  KNOWLEDGE_BASE_RULES,
  getLowRef,
  getHighRef,
  hasImpairedKidneyFunction,
  hasNeurologicalSigns,
} from './knowledgeBase';

export interface SymptomEvaluation {
  status: 'NO_CLEAR_PATTERN' | 'POSSIBLE_ANEMIA' | 'NON_SPECIFIC_SYMPTOMS';
  statusAr: string;
  statusEn: string;
  score: number;
  reportedCardinalSymptoms: string[];
  reportedGeneralSymptoms: string[];
  reportedSpecificSymptoms: string[];
  reasoningAr: string;
  recommendedNextStepAr: string;
}

export type TargetedPathway = 'b12_folate' | 'iron' | 'other_normocytic' | 'normal_hb_check' | 'none';

export function evaluateSymptoms(
  symptoms: SymptomAnswers,
  history: MedicalHistory,
  profile?: PatientProfile
): SymptomEvaluation {
  const cardinalMap: Record<string, string> = {
    fatigue: 'Fatigue',
    weakness: 'General weakness',
    pallor_skin: 'Pale skin',
    dyspnea_exertion: 'Shortness of breath',
    palpitations: 'Heart palpitations',
    cold_extremities: 'Cold hands and feet',
    dizziness: 'Dizziness',
    brittle_nails: 'Brittle nails',
    pica_cravings: 'Pica cravings (ice/non-food)',
    neuropathy_numbness: 'Numbness or tingling',
    glossitis_tongue: 'Sore or smooth tongue',
  };

  const generalMap: Record<string, string> = {
    headaches: 'Headache',
    poor_concentration: 'Difficulty concentrating',
    low_exercise_tolerance: 'Reduced exercise tolerance',
    hair_loss: 'Hair loss',
    jaundice_eyes: 'Yellowing of eyes',
    dark_urine: 'Dark urine',
  };

  const reportedCardinal: string[] = [];
  const reportedGeneral: string[] = [];
  const reportedSpecific: string[] = [];

  let score = 0;

  Object.entries(symptoms).forEach(([key, val]) => {
    if (val === 'yes' || val === 'sometimes') {
      const weight = val === 'yes' ? 1.0 : 0.5;
      if (cardinalMap[key]) {
        reportedCardinal.push(cardinalMap[key]);
        score += 2 * weight;
        if (key === 'pallor_skin' || key === 'brittle_nails' || key === 'pica_cravings') {
          reportedSpecific.push(cardinalMap[key]);
        }
      } else if (generalMap[key]) {
        reportedGeneral.push(generalMap[key]);
        score += 1 * weight;
      }
    }
  });

  if (profile?.symptomDuration === 'more_than_month') score += 1.5;
  else if (profile?.symptomDuration === 'one_to_four_weeks') score += 0.5;

  if (history.heavyMenstrualBleeding === 'yes') score += 1.5;
  if (history.bloodInStool === 'yes' || history.blackTarStool === 'yes') score += 2.0;

  if (score >= 4 || reportedCardinal.length >= 2) {
    return {
      status: 'POSSIBLE_ANEMIA',
      statusAr: 'Initial symptoms warrant Complete Blood Count (CBC) evaluation',
      statusEn: 'Initial Symptoms Warrant CBC Evaluation',
      score,
      reportedCardinalSymptoms: reportedCardinal,
      reportedGeneralSymptoms: reportedGeneral,
      reportedSpecificSymptoms: reportedSpecific,
      reasoningAr:
        'Reported symptoms may be associated with reduced oxygen delivery or a blood disorder, but symptoms alone are never sufficient to confirm or classify anemia without a Complete Blood Count (CBC).',
      recommendedNextStepAr: 'Obtain a Complete Blood Count (CBC) before classifying any anemia type or starting supplements.',
    };
  }

  if (score >= 1 || reportedGeneral.length >= 1 || reportedCardinal.length === 1) {
    return {
      status: 'NON_SPECIFIC_SYMPTOMS',
      statusAr: 'Nonspecific symptoms — CBC required for laboratory assessment',
      statusEn: 'Nonspecific Symptoms — CBC Required for Assessment',
      score,
      reportedCardinalSymptoms: reportedCardinal,
      reportedGeneralSymptoms: reportedGeneral,
      reportedSpecificSymptoms: reportedSpecific,
      reasoningAr:
        'Reported symptoms are non-specific and can overlap with many non-hematological conditions. A CBC test is required before classifying anemia.',
      recommendedNextStepAr: 'Discuss obtaining a CBC test with your physician for objective laboratory evaluation.',
    };
  }

  return {
    status: 'NO_CLEAR_PATTERN',
    statusAr: 'No clear symptom pattern currently reported',
    statusEn: 'No Clear Symptom Pattern Reported',
    score,
    reportedCardinalSymptoms: reportedCardinal,
    reportedGeneralSymptoms: reportedGeneral,
    reportedSpecificSymptoms: reportedSpecific,
    reasoningAr:
      'No active symptoms were reported; however, absence of symptoms does not exclude anemia on lab testing, making CBC the essential baseline.',
    recommendedNextStepAr: 'Routine follow-up or a baseline CBC if advised by your physician.',
  };
}

export function determineTargetedPathway(
  labs: ConfirmedLabValues,
  result: InferenceResult | null
): TargetedPathway {
  if (!labs['hb']) return 'none';

  const mcv = labs['mcv']?.value;
  const hasAnyVitaminMarker = Boolean(
    labs['b12'] || labs['folate'] || labs['rbc_folate'] || labs['mma'] || labs['homocysteine']
  );

  if (
    (mcv !== undefined && mcv > 98) ||
    hasAnyVitaminMarker ||
    result?.status === 'POSSIBLE_B12_DEFICIENCY_ANEMIA' ||
    result?.status === 'POSSIBLE_FOLATE_DEFICIENCY_ANEMIA' ||
    result?.status === 'POSSIBLE_COMBINED_B12_FOLATE_ANEMIA'
  ) {
    return 'b12_folate';
  }

  const mch = labs['mch']?.value;
  const ferritin = labs['ferritin']?.value;
  if (
    (mcv !== undefined && mcv < getLowRef(labs['mcv'], 80)) ||
    (mch !== undefined && mch < getLowRef(labs['mch'], 27)) ||
    (ferritin !== undefined && ferritin < 30) ||
    result?.status === 'POSSIBLE_IRON_DEFICIENCY_ANEMIA' ||
    result?.status === 'POSSIBLE_THALASSEMIA_SUSPICION'
  ) {
    return 'iron';
  }

  if (result?.isAnemiaDetected) {
    return 'other_normocytic';
  }

  return 'normal_hb_check';
}

function suspicionLabel(level: SuspicionLevel): { ar: string; en: string } {
  switch (level) {
    case 'high':
      return { ar: 'High Suspicion', en: 'High Suspicion' };
    case 'moderate':
      return { ar: 'Moderate / Consistent', en: 'Moderate / Consistent' };
    case 'low':
      return { ar: 'Low Suspicion', en: 'Low Suspicion' };
    default:
      return { ar: 'Insufficient Evidence', en: 'Insufficient Evidence' };
  }
}

function evaluateDifferentialCandidates(params: {
  profile: PatientProfile;
  symptoms: SymptomAnswers;
  history: MedicalHistory;
  labs: ConfirmedLabValues;
  triggeredRules: TriggeredRule[];
  isAnemiaDetected: boolean;
}): {
  candidates: DifferentialCandidate[];
  overlappingConditionsAr: string[];
  comparativeReasoningAr: string;
  comparativeReasoningEn: string;
} {
  const { profile, symptoms, history, labs, triggeredRules, isAnemiaDetected } = params;

  const hb = labs['hb'];
  const mcv = labs['mcv'];
  const mch = labs['mch'];
  const rbc = labs['rbc'];
  const rdw = labs['rdw'];
  const ferritin = labs['ferritin'];
  const iron = labs['iron'];
  const tibc = labs['tibc'];
  const tsat = labs['tsat'];
  const b12 = labs['b12'];
  const folate = labs['folate'];
  const rbcFolate = labs['rbc_folate'];
  const mma = labs['mma'];
  const hcy = labs['homocysteine'];
  const retics = labs['reticulocytes'];
  const ldh = labs['ldh'];
  const biliInd = labs['bilirubin_indirect'];
  const hapto = labs['haptoglobin'];
  const crp = labs['crp'];
  const hbElectro = labs['hb_electrophoresis'];
  const smear = labs['peripheral_smear'];
  const dat = labs['dat_test'];

  const mcvLow = getLowRef(mcv, 80);
  const mcvHigh = getHighRef(mcv, 100);
  const isMicro = mcv !== undefined && mcv.value < mcvLow;
  const isMacro = mcv !== undefined && mcv.value > mcvHigh;

  const renal = hasImpairedKidneyFunction(labs, history, profile);
  const neuro = hasNeurologicalSigns(symptoms, history);
  const hasRule = (id: string) => triggeredRules.some(r => r.ruleId === id);

  // 1. Iron Deficiency Anemia Candidate
  const idaSupport: string[] = [];
  const idaContra: string[] = [];
  const idaMissing: string[] = [];
  let idaScore = 0;

  if (isMicro) {
    idaSupport.push(`Microcytosis (MCV: ${mcv!.value} fL)`);
    idaScore += 15;
  } else if (isMacro) {
    idaContra.push(`Macrocytosis (MCV: ${mcv!.value} fL) is atypical for isolated iron deficiency`);
    idaScore -= 10;
  }
  if (mch && mch.value < getLowRef(mch, 27)) {
    idaSupport.push(`Low MCH (${mch.value} pg)`);
    idaScore += 10;
  }
  if (rdw && rdw.value > getHighRef(rdw, 14.5)) {
    idaSupport.push(`Elevated RDW (${rdw.value}%) supporting red cell size variation`);
    idaScore += 10;
  }
  if (ferritin !== undefined) {
    if (ferritin.value < getLowRef(ferritin, 30)) {
      idaSupport.push(`Low Ferritin (${ferritin.value} ${ferritin.unit})`);
      idaScore += 45;
    } else if (ferritin.value > 100) {
      idaContra.push(`Adequate/elevated Ferritin (${ferritin.value} ${ferritin.unit}) argues against uncomplicated iron deficiency`);
      idaScore -= 25;
    } else {
      idaSupport.push(`Indeterminate Ferritin (${ferritin.value} ${ferritin.unit})`);
    }
  } else {
    idaMissing.push('Serum Ferritin');
  }
  if (iron !== undefined) {
    if (iron.value < getLowRef(iron, profile.sex === 'male' ? 65 : 50)) {
      idaSupport.push(`Low Serum Iron (${iron.value} ${iron.unit})`);
      idaScore += 15;
    } else {
      idaContra.push(`Serum Iron not low (${iron.value} ${iron.unit})`);
      idaScore -= 10;
    }
  } else {
    idaMissing.push('Serum Iron');
  }
  if (tibc !== undefined) {
    if (tibc.value > getHighRef(tibc, 450)) {
      idaSupport.push(`Elevated TIBC (${tibc.value} ${tibc.unit})`);
      idaScore += 15;
    } else if (tibc.value < getLowRef(tibc, 240)) {
      idaContra.push(`Low TIBC (${tibc.value} ${tibc.unit}) leans toward Anemia of Chronic Disease`);
      idaScore -= 10;
    }
  }
  if (tsat !== undefined) {
    if (tsat.value < getLowRef(tsat, 20)) {
      idaSupport.push(`Low TSAT (${tsat.value}%)`);
      idaScore += 20;
    } else {
      idaContra.push(`Normal TSAT (${tsat.value}%)`);
      idaScore -= 10;
    }
  } else {
    idaMissing.push('Transferrin Saturation (TSAT)');
  }
  if (history.heavyMenstrualBleeding === 'yes' || history.lowIronDiet === 'yes' || history.bloodInStool === 'yes' || history.blackTarStool === 'yes') {
    idaSupport.push('Consistent risk factors (chronic bleeding or low dietary iron)');
    idaScore += 10;
  }

  let idaLevel: SuspicionLevel = 'low';
  if (hasRule('RULE_POSSIBLE_IRON_DEFICIENCY') && idaScore >= 40) idaLevel = 'high';
  else if (idaScore >= 25) idaLevel = 'moderate';
  else if (ferritin === undefined && tsat === undefined && iron === undefined && isMicro) idaLevel = 'insufficient';

  // 2. Vitamin B12 Deficiency Candidate
  const b12Support: string[] = [];
  const b12Contra: string[] = [];
  const b12Missing: string[] = [];
  let b12Score = 0;

  if (isMacro) {
    b12Support.push(`Macrocytosis (MCV: ${mcv!.value} fL)`);
    b12Score += 15;
  }
  if (b12 !== undefined) {
    const b12Low = getLowRef(b12, 200);
    if (b12.value < b12Low) {
      b12Support.push(`Low Vitamin B12 (${b12.value} ${b12.unit})`);
      b12Score += 45;
    } else if (b12.value < 300) {
      b12Support.push(`Borderline Vitamin B12 (${b12.value} ${b12.unit})`);
      b12Score += 20;
    } else if (b12.value >= 400) {
      b12Contra.push(`Adequate Vitamin B12 (${b12.value} ${b12.unit})`);
      b12Score -= 30;
    }
  } else {
    b12Missing.push('Serum Vitamin B12');
  }
  if (mma !== undefined) {
    if (mma.value > getHighRef(mma, 0.56)) {
      if (renal.impaired) {
        b12Support.push(`Elevated MMA (${mma.value} ${mma.unit}) — interpret cautiously due to impaired kidney function`);
        b12Score += 10;
      } else {
        b12Support.push(`Elevated MMA (${mma.value} ${mma.unit})`);
        b12Score += 35;
      }
    } else if (mma.value <= 0.35) {
      b12Contra.push(`Strictly normal MMA (${mma.value} ${mma.unit}) does not support cellular B12 deficiency`);
      b12Score -= 25;
    }
  } else if (isMacro || (b12 !== undefined && b12.value < 300)) {
    b12Missing.push('Methylmalonic Acid (MMA)');
  }
  if (hcy !== undefined && hcy.value > getHighRef(hcy, 15)) {
    b12Support.push(`Elevated Homocysteine (${hcy.value} ${hcy.unit}) — non-specific supportive marker`);
    b12Score += 10;
  }
  if (neuro) {
    b12Support.push('Neurological symptoms reported (numbness/tingling or balance difficulties)');
    b12Score += 10;
  }
  if (smear?.qualitativeResult === 'megaloblastic') {
    b12Support.push('Hypersegmented neutrophils / macro-ovalocytes on blood smear');
    b12Score += 15;
  }

  let b12Level: SuspicionLevel = 'low';
  if (hasRule('RULE_B12_HIGH_SUSPICION') || (hasRule('RULE_COMBINED_B12_FOLATE_DEFICIENCY') && b12Score >= 40)) b12Level = 'high';
  else if (b12Score >= 25) b12Level = 'moderate';
  else if ((isMacro || neuro) && b12 === undefined && mma === undefined) b12Level = 'insufficient';

  // 3. Folate Deficiency Candidate
  const folSupport: string[] = [];
  const folContra: string[] = [];
  const folMissing: string[] = [];
  let folScore = 0;

  if (isMacro) {
    folSupport.push(`Macrocytosis (MCV: ${mcv!.value} fL)`);
    folScore += 15;
  }
  if (folate !== undefined) {
    if (folate.value < getLowRef(folate, 4.0)) {
      folSupport.push(`Low Serum Folate (${folate.value} ${folate.unit})`);
      folScore += 45;
    } else {
      folContra.push(`Normal Serum Folate (${folate.value} ${folate.unit})`);
      folScore -= 20;
    }
  } else {
    folMissing.push('Serum Folate');
  }
  if (rbcFolate !== undefined) {
    if (rbcFolate.value < getLowRef(rbcFolate, 140)) {
      folSupport.push(`Low RBC Folate (${rbcFolate.value} ${rbcFolate.unit})`);
      folScore += 45;
    } else {
      folContra.push(`Normal RBC Folate (${rbcFolate.value} ${rbcFolate.unit})`);
      folScore -= 15;
    }
  }
  if (mma !== undefined) {
    if (mma.value <= getHighRef(mma, 0.56)) {
      folSupport.push(`Normal MMA (${mma.value} ${mma.unit}) supports isolated folate deficiency when folate is low`);
      folScore += 10;
    } else if (!renal.impaired && (b12 === undefined || b12.value < 300)) {
      folContra.push('Elevated MMA points toward B12 deficiency (isolated or combined)');
    }
  }
  if (hcy !== undefined && hcy.value > getHighRef(hcy, 15)) {
    folSupport.push(`Elevated Homocysteine (${hcy.value} ${hcy.unit})`);
    folScore += 10;
  }

  let folLevel: SuspicionLevel = 'low';
  if (hasRule('RULE_FOLATE_HIGH_SUSPICION') || (hasRule('RULE_COMBINED_B12_FOLATE_DEFICIENCY') && folScore >= 40)) folLevel = 'high';
  else if (folScore >= 25) folLevel = 'moderate';
  else if (isMacro && folate === undefined && rbcFolate === undefined) folLevel = 'insufficient';

  // 4. Thalassemia Candidate
  const thalSupport: string[] = [];
  const thalContra: string[] = [];
  const thalMissing: string[] = [];
  let thalScore = 0;

  const mentzer = mcv && rbc && rbc.value > 0 ? mcv.value / rbc.value : null;
  if (isMicro) {
    thalSupport.push(`Marked microcytosis (MCV: ${mcv!.value} fL)`);
    thalScore += 15;
  } else if (mcv && mcv.value >= 85) {
    thalContra.push(`MCV (${mcv.value} fL) is not microcytic`);
    thalScore -= 25;
  }
  if (rbc && rbc.value >= 4.6 && isMicro) {
    thalSupport.push(`Preserved or relatively high RBC count (${rbc.value} ×10⁶/µL)`);
    thalScore += 15;
  }
  if (mentzer !== null && mentzer < 13) {
    thalSupport.push(`Mentzer Index screening clue (${mentzer.toFixed(1)} < 13 — clue only)`);
    thalScore += 10;
  }
  if (rdw && rdw.value <= getHighRef(rdw, 14.5) && isMicro) {
    thalSupport.push(`Normal uniform RDW (${rdw.value}%)`);
    thalScore += 10;
  }
  if (ferritin !== undefined) {
    if (ferritin.value >= getLowRef(ferritin, 30)) {
      thalSupport.push(`Adequate iron stores (Ferritin: ${ferritin.value} ${ferritin.unit})`);
      thalScore += 20;
    } else {
      thalContra.push(`Low Ferritin (${ferritin.value} ${ferritin.unit}) indicates depleted iron stores`);
    }
  } else if (isMicro) {
    thalMissing.push('Serum Ferritin');
  }
  if (history.familyThalassemia === 'yes' || profile.hasKnownThalassemia) {
    thalSupport.push('Known family or personal history of thalassemia');
    thalScore += 15;
  }
  if (smear?.qualitativeResult === 'target_microcytic') {
    thalSupport.push('Target cells on peripheral blood smear');
    thalScore += 15;
  }
  if (hbElectro !== undefined) {
    if (
      (typeof hbElectro.value === 'number' && hbElectro.value > getHighRef(hbElectro, 3.5) && !hbElectro.qualitativeResult) ||
      hbElectro.qualitativeResult === 'beta_thal_trait' ||
      hbElectro.qualitativeResult === 'variant_or_alpha'
    ) {
      thalSupport.push('Hemoglobin Electrophoresis / HPLC consistent with thalassemia');
      thalScore += 50;
    } else if (hbElectro.qualitativeResult === 'normal' || (hbElectro.value >= 1.5 && hbElectro.value <= 3.5)) {
      thalContra.push('Normal Hb Electrophoresis (reduces beta-thalassemia likelihood, though alpha-trait may still require genetic testing)');
      thalScore -= 20;
    }
  } else if (isMicro) {
    thalMissing.push('Hemoglobin Electrophoresis / HPLC');
  }

  let thalLevel: SuspicionLevel = 'low';
  if (hasRule('RULE_MICROCYTIC_THALASSEMIA_SUSPICION') && thalScore >= 55) thalLevel = 'high';
  else if (hasRule('RULE_MICROCYTIC_THALASSEMIA_SUSPICION') || thalScore >= 30) thalLevel = 'moderate';
  else if (hasRule('RULE_THALASSEMIA_MENTZER_CLUE')) thalLevel = 'insufficient';

  // 5. Anemia of Chronic Disease / Inflammation Candidate
  const acdSupport: string[] = [];
  const acdContra: string[] = [];
  const acdMissing: string[] = [];
  let acdScore = 0;

  if (!isMacro && mcv) {
    acdScore += 10;
  }
  if (iron && iron.value < getLowRef(iron, profile.sex === 'male' ? 65 : 50)) {
    acdSupport.push(`Low Serum Iron (${iron.value} ${iron.unit})`);
    acdScore += 15;
  }
  if (tibc && tibc.value <= getHighRef(tibc, 360)) {
    acdSupport.push(`Low or normal TIBC (${tibc.value} ${tibc.unit})`);
    acdScore += 20;
  } else if (tibc && tibc.value > getHighRef(tibc, 450)) {
    acdContra.push(`Elevated TIBC (${tibc.value} ${tibc.unit}) leans toward iron deficiency`);
    acdScore -= 15;
  }
  if (ferritin !== undefined) {
    if (ferritin.value >= 100) {
      acdSupport.push(`Normal/elevated Ferritin (${ferritin.value} ${ferritin.unit})`);
      acdScore += 25;
    } else if (ferritin.value >= 30) {
      acdSupport.push(`Non-depleted Ferritin (${ferritin.value} ${ferritin.unit})`);
      acdScore += 15;
    } else {
      acdContra.push('Low Ferritin (< 30 ng/mL) reflects depleted iron stores');
      acdScore -= 15;
    }
  } else {
    acdMissing.push('Serum Ferritin');
  }
  if (crp && crp.value > getHighRef(crp, 5.0)) {
    acdSupport.push(`Elevated inflammatory marker CRP (${crp.value} ${crp.unit})`);
    acdScore += 25;
  } else if (crp === undefined && isAnemiaDetected) {
    acdMissing.push('C-Reactive Protein (CRP)');
  }
  if (history.chronicInflammationOrAutoimmune === 'yes' || renal.impaired || profile.chronicDiseases.length > 0) {
    acdSupport.push('Underlying chronic inflammation, autoimmune condition, or renal impairment');
    acdScore += 25;
  }

  let acdLevel: SuspicionLevel = 'low';
  if (hasRule('RULE_NORMOCYTIC_ACD_CHRONIC_DISEASE') && acdScore >= 50) acdLevel = 'high';
  else if (hasRule('RULE_NORMOCYTIC_ACD_CHRONIC_DISEASE') || acdScore >= 30) acdLevel = 'moderate';

  // 6. Hemolytic Anemia Candidate (Must NEVER rely on single marker)
  const hemSupport: string[] = [];
  const hemContra: string[] = [];
  const hemMissing: string[] = [];
  let hemMarkerCount = 0;

  if (retics !== undefined) {
    if (retics.value > getHighRef(retics, 2.5)) {
      hemSupport.push(`Elevated Reticulocytes (${retics.value}%)`);
      hemMarkerCount++;
    } else {
      hemContra.push(`Reticulocytes not elevated (${retics.value}%)`);
    }
  } else {
    hemMissing.push('Reticulocyte Count');
  }
  if (ldh !== undefined) {
    if (ldh.value > getHighRef(ldh, 280)) {
      hemSupport.push(`Elevated LDH (${ldh.value} U/L)`);
      hemMarkerCount++;
    } else {
      hemContra.push(`Normal LDH (${ldh.value} U/L)`);
    }
  } else {
    hemMissing.push('Lactate Dehydrogenase (LDH)');
  }
  if (biliInd !== undefined) {
    if (biliInd.value > getHighRef(biliInd, 0.8)) {
      hemSupport.push(`Elevated Indirect Bilirubin (${biliInd.value} ${biliInd.unit})`);
      hemMarkerCount++;
    } else {
      hemContra.push(`Normal Indirect Bilirubin (${biliInd.value} ${biliInd.unit})`);
    }
  } else {
    hemMissing.push('Indirect Bilirubin');
  }
  if (hapto !== undefined) {
    if (hapto.value < getLowRef(hapto, 30)) {
      hemSupport.push(`Low Haptoglobin (${hapto.value} ${hapto.unit})`);
      hemMarkerCount++;
    } else {
      hemContra.push(`Normal Haptoglobin (${hapto.value} ${hapto.unit})`);
    }
  } else {
    hemMissing.push('Serum Haptoglobin');
  }
  if (smear?.qualitativeResult === 'hemolytic_features') {
    hemSupport.push('Hemolytic features on peripheral blood smear');
    hemMarkerCount++;
  }
  if (dat?.qualitativeResult === 'positive') {
    hemSupport.push('Positive Direct Antiglobulin Test (DAT)');
    hemMarkerCount++;
  }
  if (symptoms.jaundice_eyes === 'yes' || symptoms.dark_urine === 'yes') {
    hemSupport.push('Consistent symptoms (jaundice or dark urine)');
  }

  const hemScore = hemMarkerCount >= 2 ? 35 + hemMarkerCount * 15 : hemMarkerCount === 1 ? 15 : 0;
  let hemLevel: SuspicionLevel = 'low';
  if (hemMarkerCount >= 3) hemLevel = 'high';
  else if (hemMarkerCount === 2) hemLevel = 'moderate';
  else if (hemMarkerCount === 1) hemLevel = 'insufficient';

  // 7. Acute & Chronic Blood Loss Candidate
  const blSupport: string[] = [];
  const blContra: string[] = [];
  const blMissing: string[] = [];
  let blScore = 0;

  if (hasRule('RULE_ACUTE_BLOOD_LOSS')) {
    blSupport.push('Recent acute bleeding, surgery, or childbirth with low hemoglobin');
    blScore += 55;
  }
  if (hasRule('RULE_CHRONIC_BLOOD_LOSS')) {
    blSupport.push('Chronic/recurrent bleeding history (heavy menses, GI bleeding, hematuria, or nosebleeds)');
    blScore += 50;
  }
  if (retics !== undefined && retics.value > getHighRef(retics, 2.5) && (hasRule('RULE_ACUTE_BLOOD_LOSS') || hasRule('RULE_CHRONIC_BLOOD_LOSS'))) {
    blSupport.push(`Compensatory reticulocyte response (${retics.value}%)`);
    blScore += 15;
  }
  if (hb && isAnemiaDetected && retics === undefined) {
    blMissing.push('Reticulocyte Count');
  }

  let blLevel: SuspicionLevel = 'low';
  if (blScore >= 50) blLevel = 'high';
  else if (blScore >= 25) blLevel = 'moderate';

  const rawCandidates: DifferentialCandidate[] = [
    {
      categoryId: 'iron_deficiency',
      nameAr: 'Iron Deficiency Anemia',
      nameEn: 'Iron Deficiency Anemia',
      suspicionLevel: idaLevel,
      suspicionLabelAr: suspicionLabel(idaLevel).ar,
      suspicionLabelEn: suspicionLabel(idaLevel).en,
      score: Math.max(0, idaScore),
      supportingFindings: idaSupport,
      contradictingFindings: idaContra,
      missingTests: Array.from(new Set(idaMissing)),
      activatedRuleIds: triggeredRules.filter(r => r.targetCondition === 'iron_deficiency').map(r => r.ruleId),
      reasoningAr:
        idaSupport.length > 0
          ? `Supporting evidence: ${idaSupport.slice(0, 3).join('; ')}.`
          : 'No current laboratory evidence indicating iron deficiency.',
      reasoningEn: idaSupport.length > 0 ? 'Evaluated from ferritin, iron, TIBC, TSAT, and red cell indices.' : 'No current evidence of iron deficiency.',
    },
    {
      categoryId: 'b12_deficiency',
      nameAr: 'Vitamin B12 Deficiency Anemia',
      nameEn: 'Vitamin B12 Deficiency Anemia',
      suspicionLevel: b12Level,
      suspicionLabelAr: suspicionLabel(b12Level).ar,
      suspicionLabelEn: suspicionLabel(b12Level).en,
      score: Math.max(0, b12Score),
      supportingFindings: b12Support,
      contradictingFindings: b12Contra,
      missingTests: Array.from(new Set(b12Missing)),
      activatedRuleIds: triggeredRules.filter(r => r.targetCondition === 'b12_deficiency').map(r => r.ruleId),
      reasoningAr:
        b12Support.length > 0
          ? `Supporting evidence: ${b12Support.slice(0, 3).join('; ')}.`
          : 'No current laboratory evidence indicating Vitamin B12 deficiency.',
      reasoningEn: b12Support.length > 0 ? 'Evaluated from serum B12, MMA (renal-adjusted), homocysteine, and CBC.' : 'No current evidence of B12 deficiency.',
    },
    {
      categoryId: 'folate_deficiency',
      nameAr: 'Folate Deficiency Anemia',
      nameEn: 'Folate Deficiency Anemia',
      suspicionLevel: folLevel,
      suspicionLabelAr: suspicionLabel(folLevel).ar,
      suspicionLabelEn: suspicionLabel(folLevel).en,
      score: Math.max(0, folScore),
      supportingFindings: folSupport,
      contradictingFindings: folContra,
      missingTests: Array.from(new Set(folMissing)),
      activatedRuleIds: triggeredRules.filter(r => r.targetCondition === 'folate_deficiency' || r.ruleId === 'RULE_COMBINED_B12_FOLATE_DEFICIENCY').map(r => r.ruleId),
      reasoningAr:
        folSupport.length > 0
          ? `Supporting evidence: ${folSupport.slice(0, 3).join('; ')}.`
          : 'No current laboratory evidence indicating folate deficiency.',
      reasoningEn: folSupport.length > 0 ? 'Evaluated from serum/RBC folate alongside B12 and MMA.' : 'No current evidence of folate deficiency.',
    },
    {
      categoryId: 'thalassemia',
      nameAr: 'Thalassemia / Thalassemia Trait',
      nameEn: 'Thalassemia',
      suspicionLevel: thalLevel,
      suspicionLabelAr: suspicionLabel(thalLevel).ar,
      suspicionLabelEn: suspicionLabel(thalLevel).en,
      score: Math.max(0, thalScore),
      supportingFindings: thalSupport,
      contradictingFindings: thalContra,
      missingTests: Array.from(new Set(thalMissing)),
      activatedRuleIds: triggeredRules.filter(r => r.targetCondition === 'thalassemia').map(r => r.ruleId),
      reasoningAr:
        thalSupport.length > 0
          ? `Supporting evidence: ${thalSupport.slice(0, 3).join('; ')}.`
          : 'No current laboratory evidence indicating thalassemia.',
      reasoningEn: thalSupport.length > 0 ? 'Evaluated from MCV, RBC count, RDW, ferritin, family history, and Hb electrophoresis.' : 'No current evidence of thalassemia.',
    },
    {
      categoryId: 'chronic_disease',
      nameAr: 'Anemia of Chronic Disease / Inflammation',
      nameEn: 'Anemia of Chronic Disease / Inflammation',
      suspicionLevel: acdLevel,
      suspicionLabelAr: suspicionLabel(acdLevel).ar,
      suspicionLabelEn: suspicionLabel(acdLevel).en,
      score: Math.max(0, acdScore),
      supportingFindings: acdSupport,
      contradictingFindings: acdContra,
      missingTests: Array.from(new Set(acdMissing)),
      activatedRuleIds: triggeredRules.filter(r => r.targetCondition === 'chronic_disease').map(r => r.ruleId),
      reasoningAr:
        acdSupport.length > 0
          ? `Supporting evidence: ${acdSupport.slice(0, 3).join('; ')}.`
          : 'No current evidence indicating Anemia of Chronic Disease.',
      reasoningEn: acdSupport.length > 0 ? 'Evaluated from ferritin, serum iron, TIBC, TSAT, CRP, and chronic disease history.' : 'No current evidence of ACD.',
    },
    {
      categoryId: 'hemolytic',
      nameAr: 'Hemolytic Anemia',
      nameEn: 'Hemolytic Anemia',
      suspicionLevel: hemLevel,
      suspicionLabelAr: suspicionLabel(hemLevel).ar,
      suspicionLabelEn: suspicionLabel(hemLevel).en,
      score: Math.max(0, hemScore),
      supportingFindings: hemSupport,
      contradictingFindings: hemContra,
      missingTests: Array.from(new Set(hemMissing)),
      activatedRuleIds: triggeredRules.filter(r => r.targetCondition === 'hemolytic').map(r => r.ruleId),
      reasoningAr:
        hemMarkerCount >= 2
          ? `${hemMarkerCount} concordant hemolysis markers detected: ${hemSupport.slice(0, 3).join('; ')}.`
          : hemMarkerCount === 1
          ? `Only one marker was found (${hemSupport[0]}), which is insufficient to classify hemolytic anemia without completing the panel.`
          : 'No concordant laboratory markers indicating hemolysis.',
      reasoningEn:
        hemMarkerCount >= 2
          ? `${hemMarkerCount} concordant hemolysis indicators support possible hemolysis.`
          : 'Hemolytic anemia requires at least 2 concordant hemolysis markers.',
    },
    {
      categoryId: 'blood_loss',
      nameAr: 'Acute or Chronic Blood Loss Anemia',
      nameEn: 'Acute or Chronic Blood Loss Anemia',
      suspicionLevel: blLevel,
      suspicionLabelAr: suspicionLabel(blLevel).ar,
      suspicionLabelEn: suspicionLabel(blLevel).en,
      score: Math.max(0, blScore),
      supportingFindings: blSupport,
      contradictingFindings: blContra,
      missingTests: Array.from(new Set(blMissing)),
      activatedRuleIds: triggeredRules.filter(r => r.targetCondition === 'blood_loss').map(r => r.ruleId),
      reasoningAr:
        blSupport.length > 0
          ? `Supporting evidence: ${blSupport.join('; ')}.`
          : 'No acute or chronic blood loss indicators reported.',
      reasoningEn: blSupport.length > 0 ? 'Evaluated from acute/chronic bleeding history, CBC, reticulocytes, and iron stores.' : 'No bleeding history reported.',
    },
  ];

  const rankOrder: Record<SuspicionLevel, number> = { high: 4, moderate: 3, insufficient: 2, low: 1 };
  const candidates = [...rawCandidates].sort((a, b) => {
    if (rankOrder[b.suspicionLevel] !== rankOrder[a.suspicionLevel]) {
      return rankOrder[b.suspicionLevel] - rankOrder[a.suspicionLevel];
    }
    return b.score - a.score;
  });

  const overlappingConditionsAr: string[] = [];
  const highOrMod = candidates.filter(c => c.suspicionLevel === 'high' || c.suspicionLevel === 'moderate');
  const hasId = (id: string) => highOrMod.some(c => c.categoryId === id);

  if (hasId('b12_deficiency') && hasId('folate_deficiency')) {
    overlappingConditionsAr.push('Concurrent suspicion of Vitamin B12 and Folate deficiencies (Possible Combined Deficiency).');
  }
  if (hasId('iron_deficiency') && hasId('chronic_disease')) {
    overlappingConditionsAr.push('Possible coexistence of Iron Deficiency Anemia and Anemia of Chronic Disease (Mixed IDA + ACD).');
  }
  if (hasId('iron_deficiency') && (hasId('b12_deficiency') || hasId('folate_deficiency'))) {
    overlappingConditionsAr.push('Mixed nutritional anemia (Iron deficiency + B12/Folate deficiency — opposing effects can mask MCV changes).');
  }
  if (hasId('iron_deficiency') && hasId('thalassemia')) {
    overlappingConditionsAr.push('Possible coexisting Thalassemia trait with Iron Deficiency.');
  }
  if (hasId('iron_deficiency') && hasId('blood_loss')) {
    overlappingConditionsAr.push('Acute or chronic blood loss coexisting with depleted iron stores.');
  }

  const top = candidates[0];
  const runnerUp = candidates[1];
  let comparativeReasoningAr = '';
  let comparativeReasoningEn = '';

  if (highOrMod.length >= 2) {
    comparativeReasoningAr = `Evidence concurrently supports more than one possible cause (${highOrMod
      .map(c => `${c.nameEn} [${c.suspicionLabelEn}]`)
      .join(' + ')}); therefore Redora preserves all coexisting pathways rather than forcing a single cause.`;
    comparativeReasoningEn = comparativeReasoningAr;
  } else if (top && (top.suspicionLevel === 'high' || top.suspicionLevel === 'moderate')) {
    const contrast =
      runnerUp && runnerUp.contradictingFindings.length > 0
        ? ` In contrast, ${runnerUp.nameEn} is less likely due to: ${runnerUp.contradictingFindings[0]}.`
        : runnerUp && runnerUp.missingTests.length > 0
        ? ` Meanwhile, ${runnerUp.nameEn} still needs verification (${runnerUp.missingTests[0]}).`
        : '';
    comparativeReasoningAr = `${top.nameEn} (${top.suspicionLabelEn}) ranks highest based on ${top.supportingFindings.slice(0, 3).join('; ')}.${contrast}`;
    comparativeReasoningEn = comparativeReasoningAr;
  } else {
    comparativeReasoningAr = 'Current laboratory data are insufficient to rank one etiology conclusively over alternatives.';
    comparativeReasoningEn = comparativeReasoningAr;
  }

  return {
    candidates,
    overlappingConditionsAr,
    comparativeReasoningAr,
    comparativeReasoningEn,
  };
}

export function runInferenceEngine(params: {
  profile: PatientProfile;
  symptoms: SymptomAnswers;
  history: MedicalHistory;
  emergency: EmergencySigns;
  hasCbc: boolean;
  labs: ConfirmedLabValues;
}): InferenceResult {
  const { profile, symptoms, history, emergency, hasCbc, labs } = params;

  const triggeredRules: TriggeredRule[] = [];
  const supportingEvidence: string[] = [];
  const missingData: string[] = [];
  const conflictingFindings: string[] = [];
  const recommendedTests: AdditionalTestRecommendation[] = [];

  for (const ruleDef of KNOWLEDGE_BASE_RULES) {
    const outcome = ruleDef.evaluate({ profile, history, labs, emergency, symptoms });
    if (outcome.triggered) {
      triggeredRules.push({
        ruleId: ruleDef.ruleId,
        category: ruleDef.category,
        targetCondition: ruleDef.targetCondition,
        nameAr: ruleDef.nameAr,
        nameEn: ruleDef.nameEn,
        conditionAr: ruleDef.conditionAr,
        conditionEn: ruleDef.conditionEn,
        conclusionAr: outcome.conclusionAr || '',
        conclusionEn: outcome.conclusionEn || '',
        explanationAr: outcome.explanationAr || '',
        explanationEn: outcome.explanationEn || '',
        supportingEvidence: outcome.supportingEvidence || [],
        missingEvidence: outcome.missingEvidence || [],
        contradictions: outcome.contradictions || [],
        safetyNotesAr: outcome.safetyNotesAr || '',
        referenceSource: ruleDef.referenceSource,
      });

      if (outcome.supportingEvidence) supportingEvidence.push(...outcome.supportingEvidence);
      if (outcome.missingEvidence) missingData.push(...outcome.missingEvidence);
      if (outcome.contradictions) conflictingFindings.push(...outcome.contradictions);
    }
  }

  const uniqueSupporting = Array.from(new Set(supportingEvidence));
  const uniqueMissing = Array.from(new Set(missingData));
  const uniqueConflicts = Array.from(new Set(conflictingFindings));

  const evaluationDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const folateSafetyWarningAr =
    'Important Medical Safety Note: Taking folic acid alone can mask blood count abnormalities while allowing neurological injury from untreated Vitamin B12 deficiency to progress. Always consult a physician before starting folate supplementation.';

  const hasEmergency = triggeredRules.some(r => r.ruleId === 'RULE_SAFETY_EMERGENCY');
  if (hasEmergency) {
    return {
      status: 'ANEMIA_INDICATORS_DETECTED',
      statusTitleAr: 'Urgent Warning Symptoms — Immediate Medical Evaluation Required',
      statusTitleEn: 'Urgent Warning Symptoms — Immediate Medical Evaluation Required',
      preliminaryAssessmentAr: 'Urgent warning signs detected; ordinary self-assessment halted.',
      preliminaryAssessmentEn: 'Urgent warning signs detected; ordinary self-assessment halted.',
      summaryAr:
        'Urgent warning symptoms were reported that require immediate emergency medical attention. Please visit the nearest emergency department or call emergency services right away.',
      summaryEn:
        'Urgent warning symptoms reported. Seek immediate emergency medical evaluation rather than continuing self-assessment.',
      isAnemiaDetected: null,
      triggeredRules,
      supportingEvidence: uniqueSupporting,
      missingData: uniqueMissing,
      conflictingFindings: uniqueConflicts,
      recommendedTests: [],
      dietaryGuidanceAr: ['This situation requires urgent medical evaluation before taking any medications or supplements.'],
      followUpAdviceAr: 'Proceed immediately to the nearest emergency department or contact local emergency services.',
      disclaimerAr: 'Redora is an educational decision-support system and is not a substitute for emergency medical care or physician evaluation.',
      evaluationDate,
    };
  }

  const isPediatric = triggeredRules.some(r => r.ruleId === 'RULE_SPECIAL_PATHWAY_PEDIATRIC');
  const isPregnancy = triggeredRules.some(r => r.ruleId === 'RULE_SPECIAL_PATHWAY_PREGNANCY');

  if (isPediatric) {
    return {
      status: 'SPECIAL_PATHWAY_PEDIATRIC',
      statusTitleAr: 'Pediatric Medical Pathway (<18 Years)',
      statusTitleEn: 'Pediatric Medical Pathway (<18 Years)',
      preliminaryAssessmentAr: 'Under 18 years — adult hemoglobin reference cutoffs do not apply.',
      preliminaryAssessmentEn: 'Under 18 years — adult hemoglobin reference cutoffs do not apply.',
      summaryAr:
        'Hemoglobin and red cell thresholds in children and adolescents vary by age and growth stage, so adult reference cutoffs cannot be applied.',
      summaryEn: 'Pediatric reference ranges vary by age; adult thresholds cannot be applied.',
      isAnemiaDetected: null,
      triggeredRules,
      supportingEvidence: uniqueSupporting,
      missingData: uniqueMissing,
      conflictingFindings: uniqueConflicts,
      recommendedTests: [
        {
          testId: 'pediatric_cbc',
          nameAr: 'Pediatric CBC & Physician Review',
          nameEn: 'Pediatric CBC & Physician Review',
          urgency: 'high',
          rationaleAr: 'Compare blood indices against age-adjusted pediatric reference charts.',
          rationaleEn: 'Age-adjusted pediatric hematological assessment.',
          relevantFindings: ['Age under 18 years'],
        },
      ],
      dietaryGuidanceAr: [
        'Maintain balanced nutrition and consult a pediatrician before giving any iron or vitamin supplements.',
      ],
      followUpAdviceAr: 'Please consult a pediatrician to interpret laboratory findings using pediatric age norms.',
      disclaimerAr: 'Redora is an educational decision-support tool and does not replace professional medical advice.',
      evaluationDate,
    };
  }

  const symptomEval = evaluateSymptoms(symptoms, history, profile);
  if (!hasCbc || !labs['hb']) {
    return {
      status: 'INSUFFICIENT_DATA_TO_CLASSIFY',
      statusTitleAr: 'Inconclusive – Further Testing Required (CBC Needed)',
      statusTitleEn: 'Inconclusive – Further Testing Required',
      preliminaryAssessmentAr: symptomEval.statusAr,
      preliminaryAssessmentEn: symptomEval.statusEn,
      summaryAr:
        'Anemia cannot be confirmed or classified from symptoms alone. A Complete Blood Count (CBC) is required first to measure hemoglobin and red blood cell indices.',
      summaryEn:
        'Anemia cannot be confirmed or classified from symptoms alone. A Complete Blood Count (CBC) is required before classifying.',
      isAnemiaDetected: null,
      triggeredRules,
      supportingEvidence: symptomEval.reportedCardinalSymptoms.concat(symptomEval.reportedGeneralSymptoms),
      missingData: ['Complete Blood Count (CBC: Hb, MCV, MCH, RDW, RBC)'],
      conflictingFindings: [],
      recommendedTests: [
        {
          testId: 'cbc_routine',
          nameAr: 'Complete Blood Count (CBC)',
          nameEn: 'Complete Blood Count (CBC)',
          urgency: 'high',
          rationaleAr: 'Required first-line test to measure hemoglobin and guide targeted differential investigations.',
          rationaleEn: 'Required first-line test before anemia classification.',
          relevantFindings: symptomEval.reportedCardinalSymptoms,
        },
      ],
      dietaryGuidanceAr: [
        'Maintain a balanced diet rich in iron, Vitamin B12, and folate.',
        'Do not start therapeutic iron or vitamin supplements before obtaining a CBC and consulting your physician.',
      ],
      followUpAdviceAr: symptomEval.recommendedNextStepAr,
      disclaimerAr: 'Anemia cannot be confirmed or excluded from symptoms alone. Please obtain a CBC and consult a physician.',
      evaluationDate,
    };
  }

  const hbItem = labs['hb'];
  const hbVal = hbItem.value;
  const mcvItem = labs['mcv'];
  const mcvVal = mcvItem?.value;
  const ferritinVal = labs['ferritin']?.value;

  const defaultThreshold =
    profile.sex === 'male'
      ? 13.0
      : profile.pregnancyStatus === 'second_trimester'
      ? 10.5
      : isPregnancy
      ? 11.0
      : 12.0;
  const threshold = getLowRef(hbItem, defaultThreshold);
  const isAnemiaDetected = hbVal < threshold;

  let severity: 'mild' | 'moderate' | 'severe' | 'none' = 'none';
  if (isAnemiaDetected) {
    if (hbVal < 8.0) severity = 'severe';
    else if (hbVal < 11.0) severity = 'moderate';
    else severity = 'mild';
  }

  let morphologyAr = 'Unspecified (MCV not entered)';
  let morphologyEn = 'Unspecified (MCV missing)';
  if (mcvVal !== undefined) {
    const mcvLow = getLowRef(mcvItem, 80);
    const mcvHigh = getHighRef(mcvItem, 100);
    if (mcvVal < mcvLow) {
      morphologyAr = `Microcytic (MCV ${mcvVal} fL)`;
      morphologyEn = `Microcytic (MCV ${mcvVal} fL)`;
    } else if (mcvVal > mcvHigh) {
      morphologyAr = `Macrocytic (MCV ${mcvVal} fL)`;
      morphologyEn = `Macrocytic (MCV ${mcvVal} fL)`;
    } else {
      morphologyAr = `Normocytic (MCV ${mcvVal} fL)`;
      morphologyEn = `Normocytic (MCV ${mcvVal} fL)`;
    }
  }

  const preliminaryAssessmentAr = isAnemiaDetected
    ? `Low Hemoglobin (${hbVal} g/dL < ${threshold} g/dL) · Morphology: ${morphologyEn}`
    : `Hemoglobin within reference range (${hbVal} g/dL >= ${threshold} g/dL) · ${morphologyEn}`;
  const preliminaryAssessmentEn = preliminaryAssessmentAr;

  const { candidates, overlappingConditionsAr, comparativeReasoningAr, comparativeReasoningEn } =
    evaluateDifferentialCandidates({
      profile,
      symptoms,
      history,
      labs,
      triggeredRules,
      isAnemiaDetected,
    });

  const cbcClassificationAr = isAnemiaDetected
    ? `Low Hemoglobin (${hbVal} < ${threshold} g/dL) · CBC Morphology: ${morphologyEn} (Note: MCV alone does not determine the final cause)`
    : `Hemoglobin within reference range (${hbVal} >= ${threshold} g/dL) · ${morphologyEn}`;
  const cbcClassificationEn = cbcClassificationAr;

  const hasConflict = triggeredRules.some(r => r.ruleId === 'RULE_CONFLICTING_LAB_FINDINGS');
  const hasRenalMmaCaution = triggeredRules.some(r => r.ruleId === 'RULE_MMA_RENAL_CAUTION');
  const hasCombinedB12Folate = triggeredRules.some(r => r.ruleId === 'RULE_COMBINED_B12_FOLATE_DEFICIENCY');
  const hasB12 = triggeredRules.some(r => r.ruleId === 'RULE_B12_HIGH_SUSPICION');
  const hasFolate = triggeredRules.some(r => r.ruleId === 'RULE_FOLATE_HIGH_SUSPICION');
  const hasIDA = triggeredRules.some(r => r.ruleId === 'RULE_POSSIBLE_IRON_DEFICIENCY');
  const hasThalassemia = triggeredRules.some(r => r.ruleId === 'RULE_MICROCYTIC_THALASSEMIA_SUSPICION');
  const hasACD = triggeredRules.some(r => r.ruleId === 'RULE_NORMOCYTIC_ACD_CHRONIC_DISEASE');
  const hasHemolysis = triggeredRules.some(r => r.ruleId === 'RULE_NORMOCYTIC_HEMOLYTIC_SUSPICION');
  const hasAcuteLoss = triggeredRules.some(r => r.ruleId === 'RULE_ACUTE_BLOOD_LOSS');
  const hasChronicLoss = triggeredRules.some(r => r.ruleId === 'RULE_CHRONIC_BLOOD_LOSS');
  const hasBloodLoss = hasAcuteLoss || hasChronicLoss;
  const hasOtherNonDeficiency = triggeredRules.some(r => r.ruleId === 'RULE_OTHER_ANEMIA_NON_DEFICIENCY');
  const hasMissingImportant = triggeredRules.some(r => r.ruleId === 'RULE_MISSING_IMPORTANT_TESTS_INCONCLUSIVE');
  const hasMicroMissingFerritin = triggeredRules.some(r => r.ruleId === 'RULE_MICROCYTIC_MISSING_FERRITIN');
  const hasSingleHemolysisOnly = triggeredRules.some(r => r.ruleId === 'RULE_SINGLE_HEMOLYSIS_MARKER_CAUTION');
  const hasMentzerClueOnly = triggeredRules.some(r => r.ruleId === 'RULE_THALASSEMIA_MENTZER_CLUE');
  const hasHcyElevated = triggeredRules.some(r => r.ruleId === 'RULE_HOMOCYSTEINE_NONSPECIFIC');

  const b12Item = labs['b12'];
  const isB12ClearlyLow = b12Item !== undefined && b12Item.value < getLowRef(b12Item, 200);
  const renalAmbiguity = hasRenalMmaCaution && !isB12ClearlyLow;

  let status: AnemiaStatus = 'NO_ANEMIA_DETECTED';
  let statusTitleAr = 'No Current Laboratory Evidence of Anemia';
  let statusTitleEn = 'No Current Laboratory Evidence of Anemia';
  let summaryAr = `Hemoglobin (${hbVal} g/dL) is within or above the reference threshold (${threshold} g/dL).`;
  let summaryEn = summaryAr;
  let includeFolateWarning = false;

  const activeMajorCauses: string[] = [];
  if (hasIDA) activeMajorCauses.push('Iron Deficiency');
  if (hasB12) activeMajorCauses.push('Vitamin B12 Deficiency');
  if (hasFolate) activeMajorCauses.push('Folate Deficiency');
  if (hasThalassemia) activeMajorCauses.push('Thalassemia');
  if (hasACD) activeMajorCauses.push('Anemia of Chronic Disease');
  if (hasHemolysis) activeMajorCauses.push('Hemolytic Anemia');
  if (hasBloodLoss) activeMajorCauses.push(hasAcuteLoss ? 'Acute Blood Loss' : 'Chronic Blood Loss');

  if (hasConflict || renalAmbiguity) {
    status = 'CONFLICTING_DATA_DETECTED';
    statusTitleAr = 'Inconclusive – Further Testing Required';
    statusTitleEn = 'Inconclusive – Further Testing Required';
    summaryAr =
      'Conflicting or confounded laboratory findings were detected (such as B12/MMA discordance, renal influence on MMA, folate assay discordance, iron mismatch, or isolated DAT reactivity). Further evaluation and verification are required.';
    summaryEn =
      'Conflicting or confounded laboratory findings were detected. Further evaluation and verification are required.';
    includeFolateWarning = Boolean(labs['folate'] || labs['rbc_folate'] || labs['b12'] || labs['mma']);
  } else if (hasCombinedB12Folate && activeMajorCauses.length <= 1) {
    status = 'POSSIBLE_COMBINED_B12_FOLATE_ANEMIA';
    statusTitleAr = 'Possible Combined B12 and Folate Deficiency';
    statusTitleEn = 'Possible Combined B12 and Folate Deficiency';
    summaryAr =
      'Concurrent low indicators of both Vitamin B12 and Folate suggest possible combined deficiency (regardless of MCV). Vitamin B12 status should always be addressed before or alongside folate.';
    summaryEn =
      'Concurrent low indicators of both Vitamin B12 and Folate suggest possible combined deficiency.';
    includeFolateWarning = true;
  } else if (activeMajorCauses.length >= 2 || (hasCombinedB12Folate && activeMajorCauses.length >= 1)) {
    const combinedList = hasCombinedB12Folate
      ? Array.from(new Set(['Vitamin B12 Deficiency', 'Folate Deficiency', ...activeMajorCauses]))
      : activeMajorCauses;
    status = 'POSSIBLE_COMBINED_ANEMIA_CAUSES';
    statusTitleAr = `Possible Combined Anemia Causes (${combinedList.join(' + ')})`;
    statusTitleEn = 'Possible Combined Anemia Causes';
    summaryAr = `Laboratory and history findings concurrently support overlapping causes (${combinedList.join(', ')}). Multiple active pathways are preserved rather than forcing a single cause.`;
    summaryEn = `Evidence concurrently supports multiple overlapping causes (${combinedList.join(', ')}), indicating possible combined anemia causes.`;
    includeFolateWarning = Boolean(hasB12 || hasFolate || hasCombinedB12Folate || labs['folate'] || labs['rbc_folate'] || labs['b12']);
  } else if (hasB12) {
    status = 'POSSIBLE_B12_DEFICIENCY_ANEMIA';
    statusTitleAr = 'High Suspicion of Vitamin B12 Deficiency';
    statusTitleEn = 'High Suspicion of Vitamin B12 Deficiency';
    summaryAr =
      'Laboratory indicators (low or borderline B12 and/or elevated MMA without renal confounding) raise high suspicion of Vitamin B12 deficiency (macrocytosis and neurological symptoms may be present or absent).';
    summaryEn =
      'Laboratory indicators raise high suspicion of Vitamin B12 deficiency (note: macrocytosis or neurological symptoms are not strictly required).';
    includeFolateWarning = true;
  } else if (hasFolate) {
    status = 'POSSIBLE_FOLATE_DEFICIENCY_ANEMIA';
    statusTitleAr = 'High Suspicion of Folate Deficiency';
    statusTitleEn = 'High Suspicion of Folate Deficiency';
    summaryAr =
      'Low folate (Serum and/or RBC Folate) alongside adequate Vitamin B12 and normal MMA (when measured) raises high suspicion of isolated Folate deficiency.';
    summaryEn =
      'Low folate alongside adequate Vitamin B12 and normal MMA (when measured) raises high suspicion of isolated Folate deficiency.';
    includeFolateWarning = true;
  } else if (hasIDA) {
    status = 'POSSIBLE_IRON_DEFICIENCY_ANEMIA';
    statusTitleAr = 'High Suspicion of Iron Deficiency Anemia';
    statusTitleEn = 'High Suspicion of Iron Deficiency Anemia';
    summaryAr =
      'Low hemoglobin coupled with depleted iron indicators (low ferritin, low serum iron, low TSAT, or elevated TIBC) raises high suspicion of Iron Deficiency Anemia.';
    summaryEn =
      'Low hemoglobin coupled with depleted iron indicators points to High Suspicion of Iron Deficiency Anemia.';
  } else if (hasThalassemia) {
    status = 'POSSIBLE_THALASSEMIA_SUSPICION';
    statusTitleAr = 'Possible Thalassemia';
    statusTitleEn = 'Possible Thalassemia';
    summaryAr =
      'Microcytosis with adequate iron stores, preserved RBC count or normal RDW, and/or abnormal hemoglobin fractions is consistent with possible thalassemia.';
    summaryEn =
      'Microcytosis with preserved iron stores, normal RDW/preserved RBC count, and/or Hb electrophoresis findings is consistent with possible thalassemia.';
  } else if (hasHemolysis) {
    status = 'POSSIBLE_HEMOLYTIC_ANEMIA';
    statusTitleAr = 'Possible Hemolytic Anemia';
    statusTitleEn = 'Possible Hemolytic Anemia';
    summaryAr =
      'Multiple concordant hemolysis markers (Reticulocytes, LDH, Indirect Bilirubin, Haptoglobin, Blood Smear, or DAT) indicate possible hemolytic anemia requiring hematology evaluation.';
    summaryEn =
      'Multiple concordant hemolytic markers indicate possible hemolytic anemia requiring hematology evaluation.';
  } else if (hasACD) {
    status = 'POSSIBLE_ANEMIA_OF_CHRONIC_DISEASE';
    statusTitleAr = 'Possible Anemia of Chronic Disease';
    statusTitleEn = 'Possible Anemia of Chronic Disease';
    summaryAr =
      'Low serum iron with low/normal TIBC and normal or elevated ferritin alongside chronic inflammation or kidney impairment is consistent with possible Anemia of Chronic Disease.';
    summaryEn =
      'Iron profile pattern and/or chronic inflammatory/renal context is consistent with possible Anemia of Chronic Disease.';
  } else if (hasBloodLoss) {
    status = 'POSSIBLE_BLOOD_LOSS_ANEMIA';
    statusTitleAr = hasAcuteLoss
      ? 'Possible Blood Loss-Related Anemia (Acute)'
      : 'Possible Blood Loss-Related Anemia (Chronic)';
    statusTitleEn = 'Possible Blood Loss-Related Anemia';
    summaryAr =
      'Reported acute or chronic bleeding alongside low hemoglobin is consistent with blood loss-related anemia without automatically assuming iron deficiency.';
    summaryEn =
      'Bleeding history alongside low hemoglobin is consistent with possible blood loss-related anemia without automatically assuming iron deficiency.';
  } else if (hasMissingImportant || hasMicroMissingFerritin || hasSingleHemolysisOnly || hasMentzerClueOnly) {
    status = 'INSUFFICIENT_DATA_TO_CLASSIFY';
    statusTitleAr = 'Inconclusive – Further Testing Required';
    statusTitleEn = 'Inconclusive – Further Testing Required';
    summaryAr =
      'Important differential tests are missing or incomplete (such as ferritin/iron profile, B12/Folate/MMA, Hb electrophoresis, or complete hemolysis panel); further testing is required before classifying.';
    summaryEn =
      'Important differential investigations are missing or incomplete (including single hemolysis markers or standalone Mentzer clues); further testing is required.';
    includeFolateWarning = Boolean(mcvVal && mcvVal > 98) || Boolean(labs['folate'] || labs['b12']);
  } else if (isAnemiaDetected) {
    if (hasOtherNonDeficiency) {
      status = 'POSSIBLE_OTHER_ANEMIA';
      statusTitleAr = 'Possible Other Anemia';
      statusTitleEn = 'Possible Other Anemia';
      summaryAr =
        'Anemia is present while iron stores, Vitamin B12, and Folate are adequate, pointing toward other hematological or systemic etiologies requiring reticulocytes, blood smear, and physician review.';
      summaryEn =
        'Anemia is present with adequate iron, B12, and folate, pointing toward other hematological or systemic etiologies.';
    } else {
      status = 'INSUFFICIENT_DATA_TO_CLASSIFY';
      statusTitleAr = 'Inconclusive – Further Testing Required';
      statusTitleEn = 'Inconclusive – Further Testing Required';
      summaryAr = `Low hemoglobin (${hbVal} g/dL) is present, but targeted differential tests are missing to identify the likely cause.`;
      summaryEn = `Low hemoglobin (${hbVal} g/dL) is present, but additional tests are missing to classify the likely cause.`;
    }
  } else {
    if (hasHcyElevated && (!labs['b12'] || (!labs['folate'] && !labs['rbc_folate']) || !labs['mma'])) {
      status = 'INSUFFICIENT_DATA_TO_CLASSIFY';
      statusTitleAr = 'Inconclusive – Further Testing Required';
      statusTitleEn = 'Inconclusive – Further Testing Required';
      summaryAr =
        'Hemoglobin is normal, but elevated homocysteine is non-specific and requires B12, Folate, and MMA testing for accurate interpretation.';
      summaryEn =
        'Hemoglobin is normal, but elevated homocysteine is non-specific and requires B12, Folate, and MMA testing.';
      includeFolateWarning = true;
    } else {
      status = 'NO_ANEMIA_DETECTED';
      statusTitleAr = 'No Current Laboratory Evidence of Anemia';
      statusTitleEn = 'No Current Laboratory Evidence of Anemia';
    }
  }

  // Adaptive Targeted Additional Test Recommendations
  const mcvLowCutoff = getLowRef(mcvItem, 80);
  const mcvHighCutoff = getHighRef(mcvItem, 100);
  const isMicrocytic = mcvVal !== undefined && mcvVal < mcvLowCutoff;
  const isMacrocytic = mcvVal !== undefined && mcvVal > mcvHighCutoff;
  const isNormocytic = mcvVal !== undefined && mcvVal >= mcvLowCutoff && mcvVal <= mcvHighCutoff;
  const rbcVal = labs['rbc']?.value;
  const mentzerIdx = mcvVal !== undefined && rbcVal && rbcVal > 0 ? mcvVal / rbcVal : undefined;
  const hasInflamHistory = history.chronicInflammationOrAutoimmune === 'yes';

  // Microcytic / Iron pathway — start with Ferritin; only request Iron/TIBC/TSAT or Electrophoresis when needed
  if ((isAnemiaDetected && !isMacrocytic) || isMicrocytic || (ferritinVal !== undefined && ferritinVal < 30)) {
    if (labs['ferritin'] === undefined) {
      recommendedTests.push({
        testId: 'ferritin_panel',
        nameAr: 'Serum Ferritin',
        nameEn: 'Serum Ferritin',
        urgency: 'high',
        rationaleAr: 'Primary test to assess body iron stores and separate iron deficiency from thalassemia or chronic disease.',
        rationaleEn: 'Primary marker of body iron stores.',
        relevantFindings: [mcvVal ? `MCV: ${mcvVal} fL` : 'Low Hemoglobin'],
      });
    }

    const needsFullIronProfile =
      hasInflamHistory ||
      (isMicrocytic && ferritinVal === undefined) ||
      (ferritinVal !== undefined && ferritinVal >= 15) ||
      (isNormocytic && ferritinVal !== undefined);

    if (needsFullIronProfile && (labs['iron'] === undefined || labs['tibc'] === undefined || labs['tsat'] === undefined)) {
      recommendedTests.push({
        testId: 'iron_profile',
        nameAr: 'Serum Iron, TIBC & TSAT',
        nameEn: 'Serum Iron, TIBC & TSAT',
        urgency: 'moderate',
        rationaleAr: 'Evaluates circulating iron and binding capacity to distinguish Iron Deficiency Anemia (high TIBC) from Anemia of Chronic Disease (low/normal TIBC).',
        rationaleEn: 'Differentiates iron deficiency from anemia of chronic disease.',
        relevantFindings: ['Microcytic or normocytic iron-metabolism evaluation'],
      });
    }
  }

  // Request HbA2 / Hb Electrophoresis and RDW only when Thalassemia is suspected
  const thalSuspected =
    isMicrocytic &&
    ((ferritinVal !== undefined && ferritinVal >= 25) ||
      history.familyThalassemia === 'yes' ||
      (mentzerIdx !== undefined && mentzerIdx < 13));

  if (thalSuspected && labs['hb_electrophoresis'] === undefined) {
    recommendedTests.push({
      testId: 'hb_electro',
      nameAr: 'Hemoglobin A2 (HbA2) / Electrophoresis / HPLC',
      nameEn: 'Hemoglobin A2 (HbA2) / Electrophoresis / HPLC',
      urgency: 'high',
      rationaleAr: 'Indicated to evaluate thalassemia trait (elevated HbA2 > 3.5% or abnormal variant) when Mentzer Index < 13, family history is present, or iron stores are adequate.',
      rationaleEn: 'Reference test for beta-thalassemia trait (HbA2) and hemoglobin variants.',
      relevantFindings: [mentzerIdx !== undefined && mentzerIdx < 13 ? `Mentzer Index: ${mentzerIdx.toFixed(1)} (< 13)` : `MCV: ${mcvVal} fL`],
    });
  }

  if (thalSuspected && labs['rdw'] === undefined) {
    recommendedTests.push({
      testId: 'rdw_assay',
      nameAr: 'Red Cell Distribution Width (RDW)',
      nameEn: 'Red Cell Distribution Width (RDW)',
      urgency: 'consider',
      rationaleAr: 'Requested conditionally in suspected thalassemia: normal RDW supports thalassemia trait, whereas elevated RDW suggests iron deficiency.',
      rationaleEn: 'Helps distinguish thalassemia trait (often normal RDW) from iron deficiency (elevated RDW).',
      relevantFindings: ['Microcytic differential clue'],
    });
  }

  // Vitamin B12 / Folate pathway — start with Serum B12 & Folate; request MMA/Hcy only when needed to resolve ambiguity
  const neuro = hasNeurologicalSigns(symptoms, history);
  const b12Val = labs['b12']?.value;
  const folateVal = labs['folate']?.value;
  const b12Borderline = b12Val !== undefined && b12Val >= 200 && b12Val < 350;
  const b12Adequate = b12Val !== undefined && b12Val >= 200;
  const folateLow = folateVal !== undefined && folateVal < 4.0;
  const folateAdequate = folateVal !== undefined && folateVal >= 4.0;

  const needsVitaminWorkup =
    isMacrocytic ||
    neuro ||
    Boolean(labs['b12'] || labs['folate'] || labs['rbc_folate'] || labs['mma'] || labs['homocysteine']);

  if (needsVitaminWorkup) {
    if (labs['b12'] === undefined) {
      recommendedTests.push({
        testId: 'b12_assay',
        nameAr: 'Serum Vitamin B12',
        nameEn: 'Serum Vitamin B12',
        urgency: 'high',
        rationaleAr: 'Essential first-line test to evaluate Vitamin B12 status.',
        rationaleEn: 'Essential first-line test to evaluate B12 status.',
        relevantFindings: [mcvVal ? `MCV: ${mcvVal} fL` : 'Vitamin deficiency workup'],
      });
    }
    if (labs['folate'] === undefined && labs['rbc_folate'] === undefined) {
      recommendedTests.push({
        testId: 'folate_assay',
        nameAr: 'Serum Folate',
        nameEn: 'Serum Folate',
        urgency: 'high',
        rationaleAr: 'Evaluates folate status alongside Vitamin B12.',
        rationaleEn: 'Evaluate folate status alongside Vitamin B12.',
        relevantFindings: [mcvVal ? `MCV: ${mcvVal} fL` : 'B12 vs Folate differentiation'],
      });
    }

    const needsMma =
      labs['mma'] === undefined &&
      (b12Borderline ||
        (folateLow && b12Adequate) ||
        (isMacrocytic && b12Adequate && folateAdequate));

    if (needsMma) {
      recommendedTests.push({
        testId: 'mma_assay',
        nameAr: 'Serum Methylmalonic Acid (MMA)',
        nameEn: 'Serum Methylmalonic Acid (MMA)',
        urgency: b12Borderline ? 'high' : 'moderate',
        rationaleAr: 'Requested when B12 is borderline or to distinguish isolated folate deficiency from functional B12 deficiency.',
        rationaleEn: 'Distinguishes B12 deficiency from isolated folate deficiency when initial levels are borderline.',
        relevantFindings: ['Resolve B12 vs Folate metabolic pathway'],
      });
    }

    if (labs['homocysteine'] === undefined && (b12Borderline || (isMacrocytic && b12Adequate && folateAdequate))) {
      recommendedTests.push({
        testId: 'homocysteine_assay',
        nameAr: 'Total Homocysteine',
        nameEn: 'Total Homocysteine',
        urgency: 'consider',
        rationaleAr: 'Helpful when initial B12 and folate levels remain borderline.',
        rationaleEn: 'Supportive marker when initial B12 and folate levels remain borderline.',
        relevantFindings: ['Methylation pathway assessment'],
      });
    }

    if (labs['mma'] !== undefined && labs['mma'].value > getHighRef(labs['mma'], 0.56) && labs['creatinine'] === undefined && labs['egfr'] === undefined) {
      recommendedTests.push({
        testId: 'kidney_function',
        nameAr: 'Kidney Function (Creatinine & eGFR)',
        nameEn: 'Kidney Function (Creatinine / eGFR)',
        urgency: 'high',
        rationaleAr: 'Kidney function must be checked because impaired renal clearance can elevate MMA independently of B12.',
        rationaleEn: 'Kidney function must be evaluated when interpreting elevated MMA.',
        relevantFindings: ['Elevated MMA requires ruling out renal accumulation'],
      });
    }
  }

  // Normocytic / Hemolysis / Blood Loss — request Reticulocytes first; Hemolysis panel only if clues or elevated reticulocytes
  const reticVal = labs['reticulocytes']?.value;
  const reticElevated = reticVal !== undefined && reticVal > getHighRef(labs['reticulocytes'], 2.0);
  const hasAnyHemolyticClue =
    hasSingleHemolysisOnly ||
    hasHemolysis ||
    symptoms.jaundice_eyes === 'yes' ||
    symptoms.dark_urine === 'yes' ||
    (reticElevated && !hasBloodLoss);

  const macroUnexplainedByVitamins = isMacrocytic && b12Adequate && folateAdequate;

  if (isAnemiaDetected && (isNormocytic || hasAnyHemolyticClue || hasBloodLoss || macroUnexplainedByVitamins)) {
    if (labs['reticulocytes'] === undefined) {
      recommendedTests.push({
        testId: 'retic_count',
        nameAr: 'Reticulocyte Count',
        nameEn: 'Reticulocyte Count',
        urgency: 'high',
        rationaleAr: 'Primary test to distinguish decreased marrow production from increased response in blood loss or hemolysis.',
        rationaleEn: 'Assesses bone marrow response in normocytic anemia or unexplained macrocytosis.',
        relevantFindings: ['Bone marrow response assessment'],
      });
    }
  }

  if (hasAnyHemolyticClue) {
    if (labs['ldh'] === undefined || labs['bilirubin_indirect'] === undefined || labs['haptoglobin'] === undefined) {
      recommendedTests.push({
        testId: 'hemolysis_panel',
        nameAr: 'Hemolysis Panel (LDH, Indirect Bilirubin, Haptoglobin)',
        nameEn: 'Hemolysis Panel (LDH, Indirect Bilirubin, Haptoglobin)',
        urgency: 'high',
        rationaleAr: 'Indicated due to elevated reticulocytes or hemolytic signs; a multi-marker panel prevents single-marker misclassification.',
        rationaleEn: 'Multi-marker hemolysis panel triggered by hemolytic clues or reticulocytosis.',
        relevantFindings: ['Evaluate possible hemolysis'],
      });
    }
    const anyHemolysisLabEntered =
      labs['ldh'] !== undefined || labs['bilirubin_indirect'] !== undefined || labs['haptoglobin'] !== undefined;
    if (anyHemolysisLabEntered && (labs['peripheral_smear'] === undefined || labs['dat_test'] === undefined)) {
      recommendedTests.push({
        testId: 'smear_and_dat',
        nameAr: 'Peripheral Blood Smear & Direct Antiglobulin Test (DAT)',
        nameEn: 'Peripheral Blood Smear & Direct Antiglobulin Test (DAT)',
        urgency: 'high',
        rationaleAr: 'Assesses red cell morphology and checks for immune-mediated hemolysis.',
        rationaleEn: 'Evaluates red cell morphology and immune-mediated hemolysis.',
        relevantFindings: ['Hemolysis etiology workup'],
      });
    }
  }

  const needsCrp =
    isAnemiaDetected &&
    labs['crp'] === undefined &&
    (hasInflamHistory || hasACD || (ferritinVal !== undefined && ferritinVal >= 30));

  if (needsCrp) {
    recommendedTests.push({
      testId: 'crp_assay',
      nameAr: 'C-Reactive Protein (CRP)',
      nameEn: 'C-Reactive Protein (CRP)',
      urgency: 'moderate',
      rationaleAr: 'Helps identify active inflammation when ferritin is normal or elevated.',
      rationaleEn: 'Detects active inflammation when ferritin is normal or elevated.',
      relevantFindings: ['Chronic inflammation assessment'],
    });
  }

  const uniqueTestsMap = new Map<string, AdditionalTestRecommendation>();
  for (const t of recommendedTests) {
    if (!uniqueTestsMap.has(t.testId)) {
      uniqueTestsMap.set(t.testId, t);
    }
  }

  const dietaryGuidanceAr: string[] = [
    'Iron sources: Lean red meat, poultry, fish, lentils, beans, and spinach (pair plant iron with Vitamin C and avoid tea or coffee with meals).',
    'Vitamin B12 sources: Eggs, fish, meat, dairy products, or B12-fortified foods.',
    'Folate sources: Dark leafy greens, legumes, and citrus fruits.',
    'Consult a physician before taking iron or vitamin supplements to select the right treatment and dose (avoid empirical iron if thalassemia or Anemia of Chronic Disease is suspected).',
  ];

  const hasKidneyNote = hasImpairedKidneyFunction(labs, history, profile).impaired;

  return {
    status,
    statusTitleAr,
    statusTitleEn,
    preliminaryAssessmentAr,
    preliminaryAssessmentEn,
    cbcClassificationAr,
    cbcClassificationEn,
    summaryAr,
    summaryEn,
    comparativeReasoningAr,
    comparativeReasoningEn,
    overlappingConditionsAr,
    differentialCandidates: candidates,
    isAnemiaDetected,
    severityLevel: severity,
    hemoglobinValue: hbVal,
    hemoglobinThreshold: threshold,
    morphologyAr,
    morphologyEn,
    triggeredRules,
    supportingEvidence: uniqueSupporting,
    missingData: uniqueMissing,
    conflictingFindings: uniqueConflicts,
    recommendedTests: Array.from(uniqueTestsMap.values()),
    dietaryGuidanceAr,
    folateSafetyWarningAr: includeFolateWarning ? folateSafetyWarningAr : undefined,
    followUpAdviceAr: hasKidneyNote
      ? 'Share these results with your physician and note that kidney function may influence markers such as MMA. Redora does not replace a physician.'
      : 'Share this report with your physician to review the differential evaluation and recommended tests before making treatment decisions.',
    disclaimerAr:
      'Redora is an educational preliminary decision-support expert system; it does not provide a medical diagnosis or replace a qualified physician.',
    evaluationDate,
  };
}
