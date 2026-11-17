import {
  PatientProfile,
  MedicalHistory,
  ConfirmedLabValues,
  EmergencySigns,
  SymptomAnswers,
  LabValueItem,
} from '../types';

export interface MedicalRuleDefinition {
  ruleId: string;
  nameAr: string;
  nameEn: string;
  conditionAr: string;
  conditionEn: string;
  category: 'SAFETY' | 'PATHWAY' | 'DETECTION' | 'CLASSIFICATION' | 'CONFLICT';
  targetCondition?:
    | 'iron_deficiency'
    | 'b12_deficiency'
    | 'folate_deficiency'
    | 'thalassemia'
    | 'chronic_disease'
    | 'hemolytic'
    | 'blood_loss'
    | 'general';
  evaluate: (context: {
    profile: PatientProfile;
    history: MedicalHistory;
    labs: ConfirmedLabValues;
    emergency: EmergencySigns;
    symptoms?: SymptomAnswers;
  }) => {
    triggered: boolean;
    conclusionAr?: string;
    conclusionEn?: string;
    explanationAr?: string;
    explanationEn?: string;
    supportingEvidence?: string[];
    missingEvidence?: string[];
    contradictions?: string[];
    safetyNotesAr?: string;
  };
  referenceSource: string;
}

// Helper: Use supplied lab reference range whenever available (stored in standard internal units)
export function getLowRef(lab: LabValueItem | undefined, defaultLow: number): number {
  if (lab && typeof lab.refRangeLow === 'number' && !isNaN(lab.refRangeLow)) {
    return lab.refRangeLow;
  }
  return defaultLow;
}

export function getHighRef(lab: LabValueItem | undefined, defaultHigh: number): number {
  if (lab && typeof lab.refRangeHigh === 'number' && !isNaN(lab.refRangeHigh)) {
    return lab.refRangeHigh;
  }
  return defaultHigh;
}

export function formatLabReading(lab: LabValueItem, defaultLow: number, defaultHigh: number): string {
  const low = getLowRef(lab, defaultLow);
  const high = getHighRef(lab, defaultHigh);
  const base = `${lab.value} ${lab.unit} (Ref: ${low} - ${high} ${lab.unit})`;
  if (lab.wasConverted && lab.originalValue !== undefined && lab.originalUnit) {
    return `${base} [Entered: ${lab.originalValue} ${lab.originalUnit}]`;
  }
  return base;
}

export function hasImpairedKidneyFunction(
  labs: ConfirmedLabValues,
  history: MedicalHistory,
  profile: PatientProfile
): { impaired: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const egfr = labs['egfr'];
  const creat = labs['creatinine'];
  const creatUpper = profile.sex === 'male' ? 1.3 : 1.1;

  if (history.chronicKidneyDisease === 'yes') {
    reasons.push('Known history of chronic kidney disease');
  }
  if (profile.chronicDiseases.some(d => d.toLowerCase().includes('ckd') || d.toLowerCase().includes('kidney') || d.toLowerCase().includes('renal'))) {
    reasons.push('Recorded chronic kidney condition');
  }
  if (egfr && egfr.value < 60) {
    reasons.push(`Reduced eGFR (${egfr.value} < 60 mL/min/1.73m²)`);
  }
  if (creat && creat.value > getHighRef(creat, creatUpper)) {
    reasons.push(`Elevated Serum Creatinine (${creat.value} > ${getHighRef(creat, creatUpper)} mg/dL)`);
  }

  return { impaired: reasons.length > 0, reasons };
}

export function hasNeurologicalSigns(symptoms?: SymptomAnswers, history?: MedicalHistory): boolean {
  return (
    symptoms?.['neuropathy_numbness'] === 'yes' ||
    symptoms?.['neuropathy_numbness'] === 'sometimes' ||
    history?.balanceProblems === 'yes' ||
    history?.balanceProblems === 'sometimes'
  );
}

export const KNOWLEDGE_BASE_RULES: MedicalRuleDefinition[] = [
  // --- RULE 1: Safety Emergency Screening ---
  {
    ruleId: 'RULE_SAFETY_EMERGENCY',
    nameAr: 'Critical Warning Signs & Emergency Screening',
    nameEn: 'Critical Warning Signs & Emergency Screening',
    conditionAr: 'IF chest pain OR severe shortness of breath at rest OR fainting OR active heavy bleeding THEN halt ordinary assessment and recommend urgent medical evaluation',
    conditionEn: 'IF chest pain OR severe shortness of breath at rest OR fainting OR active heavy bleeding THEN halt ordinary assessment and recommend urgent medical evaluation',
    category: 'SAFETY',
    referenceSource: 'NICE Medical Guidelines: Assessment of acute anemia and cardiopulmonary compromise',
    evaluate: ({ emergency }) => {
      const redFlags: string[] = [];
      if (emergency.chestPain) redFlags.push('Chest pain or pressure');
      if (emergency.severeDyspneaAtRest) redFlags.push('Severe shortness of breath at rest');
      if (emergency.syncopeOrFainting) redFlags.push('Fainting or sudden loss of consciousness');
      if (emergency.activeHeavyBleeding) redFlags.push('Active significant bleeding');
      if (emergency.severeWeaknessWithConfusion) redFlags.push('Severe weakness with confusion');

      if (redFlags.length > 0) {
        return {
          triggered: true,
          conclusionAr: 'Urgent warning symptoms requiring immediate medical evaluation',
          conclusionEn: 'Urgent warning symptoms requiring immediate medical evaluation',
          explanationAr: `Reported urgent warning signs (${redFlags.join(', ')}). Immediate medical evaluation is required instead of ordinary self-assessment.`,
          explanationEn: `Reported urgent warning signs (${redFlags.join(', ')}). Immediate medical evaluation is required instead of ordinary self-assessment.`,
          supportingEvidence: redFlags,
          safetyNotesAr: 'Stop self-assessment and proceed immediately to the nearest emergency department or contact local emergency services.',
        };
      }
      return { triggered: false };
    },
  },

  // --- RULE 2: Special Demographic Pathway - Pediatric (<18) ---
  {
    ruleId: 'RULE_SPECIAL_PATHWAY_PEDIATRIC',
    nameAr: 'Pediatric Reference Thresholds Pathway (<18 Years)',
    nameEn: 'Pediatric Reference Thresholds Pathway (<18 Years)',
    conditionAr: 'IF age < 18 THEN do not apply adult hemoglobin cutoffs and route to pediatric evaluation notice',
    conditionEn: 'IF age < 18 THEN do not apply adult hemoglobin cutoffs and route to pediatric evaluation notice',
    category: 'PATHWAY',
    referenceSource: 'WHO 2024 Pediatric Hemoglobin Reference Standards & AAP Guidelines',
    evaluate: ({ profile }) => {
      if (profile.age !== null && profile.age < 18) {
        return {
          triggered: true,
          conclusionAr: 'Pediatric pathway applied — adult reference cutoffs do not apply',
          conclusionEn: 'Pediatric specific pathway applied — adult reference cutoffs do not apply',
          explanationAr: `Patient age (${profile.age} years) is under 18. Pediatric hemoglobin and red cell thresholds vary by age and growth stage.`,
          explanationEn: `Patient age (${profile.age}) is under 18. Pediatric hemoglobin cutoffs differ by age and growth stage.`,
          supportingEvidence: [`Age: ${profile.age} years`],
          safetyNotesAr: 'Consult a pediatrician to interpret results using age-specific pediatric reference charts.',
        };
      }
      return { triggered: false };
    },
  },

  // --- RULE 3: Special Demographic Pathway - Pregnancy ---
  {
    ruleId: 'RULE_SPECIAL_PATHWAY_PREGNANCY',
    nameAr: 'Maternal Pregnancy Hemoglobin Pathway',
    nameEn: 'Maternal Pregnancy Hemoglobin Pathway',
    conditionAr: 'IF pregnant female THEN apply pregnancy hemoglobin cutoffs (10.5 - 11.0 g/dL)',
    conditionEn: 'IF pregnant female THEN apply pregnancy hemoglobin cutoffs (10.5 - 11.0 g/dL)',
    category: 'PATHWAY',
    referenceSource: 'WHO 2024 Guidelines on Anemia in Pregnancy & ACOG Practice Bulletin',
    evaluate: ({ profile, labs }) => {
      if (profile.sex === 'female' && profile.pregnancyStatus !== 'not_pregnant') {
        const hbItem = labs['hb'];
        let threshold = 11.0;
        if (profile.pregnancyStatus === 'second_trimester') threshold = 10.5;

        return {
          triggered: true,
          conclusionAr: `Pregnancy pathway active (Hb cutoff: ${threshold} g/dL)`,
          conclusionEn: `Pregnancy pathway active (Hb cutoff: ${threshold} g/dL)`,
          explanationAr: `Physiological plasma volume expansion during pregnancy lowers the accepted hemoglobin cutoff to ${threshold} g/dL.`,
          explanationEn: `Hemodilution during pregnancy shifts the physiological hemoglobin threshold to ${threshold} g/dL.`,
          supportingEvidence: [
            hbItem ? `Hemoglobin: ${formatLabReading(hbItem, threshold, 15.0)}` : 'Hemoglobin not entered yet',
          ],
          safetyNotesAr: 'Anemia evaluation during pregnancy requires regular follow-up with an obstetrician.',
        };
      }
      return { triggered: false };
    },
  },

  // --- RULE 4: Adult Detection - Female Non-Pregnant ---
  {
    ruleId: 'RULE_ANEMIA_DETECTION_ADULT_FEMALE',
    nameAr: 'Adult Female Low Hemoglobin Detection (WHO 2024)',
    nameEn: 'Adult Female Low Hemoglobin Detection (WHO 2024)',
    conditionAr: 'IF adult non-pregnant female AND Hb < reference lower limit (12.0 g/dL) THEN flag laboratory anemia indicators',
    conditionEn: 'IF adult non-pregnant female AND Hb < reference lower limit (12.0 g/dL) THEN flag laboratory anemia indicators',
    category: 'DETECTION',
    referenceSource: 'World Health Organization (WHO) 2024: Hemoglobin concentrations for anemia assessment',
    evaluate: ({ profile, labs }) => {
      if (profile.sex === 'female' && profile.pregnancyStatus === 'not_pregnant' && (profile.age === null || profile.age >= 18)) {
        const hbItem = labs['hb'];
        if (hbItem && typeof hbItem.value === 'number') {
          const threshold = getLowRef(hbItem, 12.0);
          if (hbItem.value < threshold) {
            const severityEn = hbItem.value < 8.0 ? 'Severe' : hbItem.value < 11.0 ? 'Moderate' : 'Mild';

            return {
              triggered: true,
              conclusionAr: `Laboratory indicators of low hemoglobin (${severityEn})`,
              conclusionEn: `Laboratory indicators of low hemoglobin (${severityEn})`,
              explanationAr: `Hemoglobin level ${formatLabReading(hbItem, 12.0, 16.0)} is below the reference threshold (${threshold} g/dL).`,
              explanationEn: `Hemoglobin (${hbItem.value} g/dL) is below the adult non-pregnant female threshold (${threshold} g/dL).`,
              supportingEvidence: [`Hemoglobin: ${formatLabReading(hbItem, 12.0, 16.0)}`, `Severity tier: ${severityEn}`],
              safetyNotesAr: 'Low hemoglobin requires further causal classification and physician review.',
            };
          }
        }
      }
      return { triggered: false };
    },
  },

  // --- RULE 5: Adult Detection - Male ---
  {
    ruleId: 'RULE_ANEMIA_DETECTION_ADULT_MALE',
    nameAr: 'Adult Male Low Hemoglobin Detection (WHO 2024)',
    nameEn: 'Adult Male Low Hemoglobin Detection (WHO 2024)',
    conditionAr: 'IF adult male AND Hb < reference lower limit (13.0 g/dL) THEN flag laboratory anemia indicators',
    conditionEn: 'IF adult male AND Hb < reference lower limit (13.0 g/dL) THEN flag laboratory anemia indicators',
    category: 'DETECTION',
    referenceSource: 'World Health Organization (WHO) 2024: Hemoglobin concentrations for anemia assessment',
    evaluate: ({ profile, labs }) => {
      if (profile.sex === 'male' && (profile.age === null || profile.age >= 18)) {
        const hbItem = labs['hb'];
        if (hbItem && typeof hbItem.value === 'number') {
          const threshold = getLowRef(hbItem, 13.0);
          if (hbItem.value < threshold) {
            const severityEn = hbItem.value < 8.0 ? 'Severe' : hbItem.value < 11.0 ? 'Moderate' : 'Mild';

            return {
              triggered: true,
              conclusionAr: `Laboratory indicators of low hemoglobin (${severityEn})`,
              conclusionEn: `Laboratory indicators of low hemoglobin (${severityEn})`,
              explanationAr: `Hemoglobin level ${formatLabReading(hbItem, 13.0, 17.5)} is below the reference threshold (${threshold} g/dL).`,
              explanationEn: `Hemoglobin (${hbItem.value} g/dL) is below the adult male threshold (${threshold} g/dL).`,
              supportingEvidence: [`Hemoglobin: ${formatLabReading(hbItem, 13.0, 17.5)}`, `Severity tier: ${severityEn}`],
              safetyNotesAr: 'Low hemoglobin in adult males warrants medical investigation for occult blood loss or an underlying cause.',
            };
          }
        }
      }
      return { triggered: false };
    },
  },

  // --- RULE 6: Normal Hemoglobin Detection ---
  {
    ruleId: 'RULE_NO_ANEMIA_NORMAL_HB',
    nameAr: 'Hemoglobin Within Normal Reference Range',
    nameEn: 'Hemoglobin Within Normal Reference Range',
    conditionAr: 'IF Hb >= reference lower limit THEN no current laboratory evidence of anemia based on hemoglobin',
    conditionEn: 'IF Hb >= reference lower limit THEN no current laboratory evidence of anemia based on hemoglobin',
    category: 'DETECTION',
    referenceSource: 'WHO 2024 Hemoglobin Reference Standards',
    evaluate: ({ profile, labs }) => {
      const hbItem = labs['hb'];
      if (hbItem && typeof hbItem.value === 'number') {
        const defaultThreshold = profile.sex === 'male' ? 13.0 : profile.pregnancyStatus === 'second_trimester' ? 10.5 : profile.pregnancyStatus !== 'not_pregnant' ? 11.0 : 12.0;
        const threshold = getLowRef(hbItem, defaultThreshold);
        const defaultHigh = profile.sex === 'male' ? 17.5 : 16.0;

        if (hbItem.value >= threshold) {
          return {
            triggered: true,
            conclusionAr: 'No current laboratory evidence of anemia in hemoglobin',
            conclusionEn: 'No current laboratory evidence of anemia in hemoglobin',
            explanationAr: `Hemoglobin level ${formatLabReading(hbItem, defaultThreshold, defaultHigh)} meets or exceeds the reference cutoff (${threshold} g/dL).`,
            explanationEn: `Hemoglobin (${hbItem.value} g/dL) meets or exceeds the reference cutoff (${threshold} g/dL).`,
            supportingEvidence: [`Hemoglobin: ${formatLabReading(hbItem, defaultThreshold, defaultHigh)}`],
            safetyNotesAr: 'Normal hemoglobin rules out anemia on this test, though early iron, B12, or folate depletion can still occur before hemoglobin drops.',
          };
        }
      }
      return { triggered: false };
    },
  },

  // --- RULE 7: Combined B12 & Folate Deficiency ---
  {
    ruleId: 'RULE_COMBINED_B12_FOLATE_DEFICIENCY',
    nameAr: 'Possible Combined Vitamin B12 and Folate Deficiency',
    nameEn: 'Possible Combined Vitamin B12 and Folate Deficiency',
    conditionAr: 'IF (B12 is low OR borderline with elevated MMA) AND (Serum Folate is low OR RBC Folate is low) THEN consider combined B12 and Folate deficiency',
    conditionEn: 'IF (B12 is low OR borderline with elevated MMA) AND (Serum Folate is low OR RBC Folate is low) THEN consider combined B12 and Folate deficiency',
    category: 'CLASSIFICATION',
    targetCondition: 'b12_deficiency',
    referenceSource: 'British Society for Haematology: Cobalamin and Folate Guidelines',
    evaluate: ({ labs, history, profile }) => {
      const b12 = labs['b12'];
      const folate = labs['folate'];
      const rbcFolate = labs['rbc_folate'];
      const mma = labs['mma'];
      const hcy = labs['homocysteine'];
      const mcv = labs['mcv'];

      const b12LowCutoff = getLowRef(b12, 200);
      const folateLowCutoff = getLowRef(folate, 4.0);
      const rbcFolateLowCutoff = getLowRef(rbcFolate, 140.0);
      const mmaHighCutoff = getHighRef(mma, 0.56);

      const renal = hasImpairedKidneyFunction(labs, history, profile);

      const isB12Low = b12 !== undefined && b12.value < b12LowCutoff;
      const isB12Borderline = b12 !== undefined && b12.value >= b12LowCutoff && b12.value < 300;
      const isMmaHigh = mma !== undefined && mma.value > mmaHighCutoff;
      const isB12DeficientSignal = isB12Low || (isB12Borderline && isMmaHigh && !renal.impaired);

      const isSerumFolateLow = folate !== undefined && folate.value < folateLowCutoff;
      const isRbcFolateLow = rbcFolate !== undefined && rbcFolate.value < rbcFolateLowCutoff;
      const isAnyFolateLow = isSerumFolateLow || isRbcFolateLow;

      if (isB12DeficientSignal && isAnyFolateLow) {
        const evidence: string[] = [];
        if (b12) evidence.push(`Vitamin B12: ${formatLabReading(b12, 200, 900)}`);
        if (folate && isSerumFolateLow) evidence.push(`Low Serum Folate: ${formatLabReading(folate, 4.0, 20.0)}`);
        if (rbcFolate && isRbcFolateLow) evidence.push(`Low RBC Folate: ${formatLabReading(rbcFolate, 140, 628)}`);
        if (mma && isMmaHigh) evidence.push(`Elevated MMA: ${formatLabReading(mma, 0.08, 0.56)}`);
        if (hcy && hcy.value > getHighRef(hcy, 15)) evidence.push(`Elevated Homocysteine: ${formatLabReading(hcy, 5, 15)}`);
        if (mcv) evidence.push(`MCV: ${formatLabReading(mcv, 80, 100)}`);

        return {
          triggered: true,
          conclusionAr: 'Possible Combined B12 and Folate Deficiency',
          conclusionEn: 'Possible Combined B12 and Folate Deficiency',
          explanationAr: 'Concurrent low indicators for both Vitamin B12 and folate suggest a possible combined deficiency requiring comprehensive medical evaluation before supplementation.',
          explanationEn: 'Concurrent low indicators for both vitamin B12 and folate suggest possible combined deficiency.',
          supportingEvidence: evidence,
          safetyNotesAr: 'Critical safety warning: Taking folic acid alone can mask hematological abnormalities while allowing neurological damage from untreated Vitamin B12 deficiency to progress. Consult a physician before starting supplements.',
        };
      }
      return { triggered: false };
    },
  },

  // --- RULE 8: High Suspicion of Vitamin B12 Deficiency ---
  {
    ruleId: 'RULE_B12_HIGH_SUSPICION',
    nameAr: 'High Suspicion of Vitamin B12 Deficiency',
    nameEn: 'High Suspicion of Vitamin B12 Deficiency',
    conditionAr: 'IF (B12 is low AND MMA is elevated) OR (B12 is low with adequate folate) OR (B12 is borderline with elevated MMA and intact kidney function) THEN increase suspicion of Vitamin B12 deficiency',
    conditionEn: 'IF (B12 is low AND MMA is elevated) OR (B12 is low with adequate folate) OR (B12 is borderline with elevated MMA and intact kidney function) THEN increase suspicion of Vitamin B12 deficiency',
    category: 'CLASSIFICATION',
    targetCondition: 'b12_deficiency',
    referenceSource: 'British Society for Haematology: Diagnosis and treatment of cobalamin and folate disorders',
    evaluate: ({ labs, history, profile, symptoms }) => {
      const b12 = labs['b12'];
      const folate = labs['folate'];
      const rbcFolate = labs['rbc_folate'];
      const mma = labs['mma'];
      const hcy = labs['homocysteine'];
      const mcv = labs['mcv'];
      const hb = labs['hb'];

      const b12LowCutoff = getLowRef(b12, 200);
      const folateLowCutoff = getLowRef(folate, 4.0);
      const rbcFolateLowCutoff = getLowRef(rbcFolate, 140.0);
      const mmaHighCutoff = getHighRef(mma, 0.56);
      const hcyHighCutoff = getHighRef(hcy, 15.0);

      const renal = hasImpairedKidneyFunction(labs, history, profile);
      const neuro = hasNeurologicalSigns(symptoms, history);

      const isB12Low = b12 !== undefined && b12.value < b12LowCutoff;
      const isB12Borderline = b12 !== undefined && b12.value >= b12LowCutoff && b12.value < 300;
      const isB12HighNormal = b12 !== undefined && b12.value >= 400;

      const isMmaHigh = mma !== undefined && mma.value > mmaHighCutoff;
      const isMmaStrictlyLowNormal = mma !== undefined && mma.value <= 0.35;

      const isAnyFolateLow =
        (folate !== undefined && folate.value < folateLowCutoff) ||
        (rbcFolate !== undefined && rbcFolate.value < rbcFolateLowCutoff);

      if (isAnyFolateLow) return { triggered: false };
      if (isB12Low && isMmaStrictlyLowNormal) return { triggered: false };
      if (isB12HighNormal && isMmaHigh) return { triggered: false };
      if (!isB12Low && isMmaHigh && renal.impaired) return { triggered: false };

      const ruleA_LowB12AndHighMma = isB12Low && isMmaHigh;
      const ruleB_LowB12WithNoContradiction = isB12Low && (mma === undefined || !isMmaStrictlyLowNormal);
      const ruleC_BorderlineB12WithHighMma = isB12Borderline && isMmaHigh && !renal.impaired;
      const ruleD_ElevatedMmaNoRenalB12MissingOrLow = b12 === undefined && isMmaHigh && !renal.impaired;

      if (ruleA_LowB12AndHighMma || ruleB_LowB12WithNoContradiction || ruleC_BorderlineB12WithHighMma || ruleD_ElevatedMmaNoRenalB12MissingOrLow) {
        const evidence: string[] = [];
        if (b12) evidence.push(`Vitamin B12: ${formatLabReading(b12, 200, 900)}`);
        if (mma && isMmaHigh) {
          evidence.push(`Elevated MMA: ${formatLabReading(mma, 0.08, 0.56)}`);
        }
        if (hcy && hcy.value > hcyHighCutoff) {
          evidence.push(`Elevated Homocysteine (non-specific supportive marker): ${formatLabReading(hcy, 5, 15)}`);
        }
        if (folate && folate.value >= folateLowCutoff) {
          evidence.push(`Serum Folate adequate: ${formatLabReading(folate, 4.0, 20.0)}`);
        }
        if (rbcFolate && rbcFolate.value >= rbcFolateLowCutoff) {
          evidence.push(`RBC Folate adequate: ${formatLabReading(rbcFolate, 140, 628)}`);
        }
        if (mcv) {
          evidence.push(`MCV: ${formatLabReading(mcv, 80, 100)}`);
        }
        if (hb) {
          evidence.push(`Hemoglobin: ${formatLabReading(hb, profile.sex === 'male' ? 13 : 12, profile.sex === 'male' ? 17.5 : 16)}`);
        }
        if (neuro) {
          evidence.push('Supportive neurological symptoms (numbness/tingling or balance difficulty)');
        }
        if (history.vegetarianOrVegan === 'yes') {
          evidence.push('Vegetarian or vegan dietary restriction (reduced B12 intake risk)');
        }
        if (history.priorGastricSurgery === 'yes' || history.giDisordersOrIBD === 'yes') {
          evidence.push('GI disorder or prior gastric surgery affecting B12 absorption');
        }

        const missing: string[] = [];
        if (folate === undefined && rbcFolate === undefined) {
          missing.push('Serum / RBC Folate to exclude combined deficiency');
        }
        if (mma === undefined && !isB12Low) {
          missing.push('Serum Methylmalonic Acid (MMA)');
        }

        return {
          triggered: true,
          conclusionAr: 'High Suspicion of Vitamin B12 Deficiency',
          conclusionEn: 'High Suspicion of Vitamin B12 Deficiency',
          explanationAr: isMmaHigh
            ? 'Low or borderline Vitamin B12 paired with elevated Methylmalonic Acid (MMA) without kidney confounding raises high suspicion of Vitamin B12 deficiency (note: macrocytosis or neurological symptoms may be present or absent).'
            : 'Vitamin B12 is below the reference range without folate discordance, raising high suspicion of Vitamin B12 deficiency.',
          explanationEn: 'Laboratory findings (low/borderline B12 and/or elevated MMA without renal confounding) raise high suspicion of Vitamin B12 deficiency.',
          supportingEvidence: evidence,
          missingEvidence: missing,
          safetyNotesAr: 'Important warning: Folic acid alone can improve blood counts superficially while allowing neurological damage from untreated B12 deficiency to worsen. Consult a physician before taking supplements.',
        };
      }
      return { triggered: false };
    },
  },

  // --- RULE 9: High Suspicion of Folate Deficiency ---
  {
    ruleId: 'RULE_FOLATE_HIGH_SUSPICION',
    nameAr: 'High Suspicion of Folate Deficiency',
    nameEn: 'High Suspicion of Folate Deficiency',
    conditionAr: 'IF Folate (Serum and/or RBC Folate) is low AND B12 is adequate AND MMA is normal THEN increase suspicion of isolated Folate deficiency',
    conditionEn: 'IF Folate (Serum and/or RBC Folate) is low AND B12 is adequate AND MMA is normal THEN increase suspicion of isolated Folate deficiency',
    category: 'CLASSIFICATION',
    targetCondition: 'folate_deficiency',
    referenceSource: 'British Society for Haematology: Diagnosis and treatment of cobalamin and folate disorders',
    evaluate: ({ labs }) => {
      const folate = labs['folate'];
      const rbcFolate = labs['rbc_folate'];
      const b12 = labs['b12'];
      const mma = labs['mma'];
      const hcy = labs['homocysteine'];
      const mcv = labs['mcv'];

      const folateLowCutoff = getLowRef(folate, 4.0);
      const rbcFolateLowCutoff = getLowRef(rbcFolate, 140.0);
      const b12LowCutoff = getLowRef(b12, 200.0);
      const mmaHighCutoff = getHighRef(mma, 0.56);
      const hcyHighCutoff = getHighRef(hcy, 15.0);

      const isSerumFolateLow = folate !== undefined && folate.value < folateLowCutoff;
      const isRbcFolateLow = rbcFolate !== undefined && rbcFolate.value < rbcFolateLowCutoff;
      const isAnyFolateLow = isSerumFolateLow || isRbcFolateLow;

      if (!isAnyFolateLow) return { triggered: false };

      if (
        folate !== undefined &&
        rbcFolate !== undefined &&
        ((folate.value >= 6.0 && rbcFolate.value < rbcFolateLowCutoff) ||
          (folate.value < folateLowCutoff && rbcFolate.value >= 250))
      ) {
        return { triggered: false };
      }

      if (b12 === undefined) return { triggered: false };
      if (b12.value < b12LowCutoff) return { triggered: false };

      const isB12Borderline = b12.value >= b12LowCutoff && b12.value < 300;
      const isMmaHigh = mma !== undefined && mma.value > mmaHighCutoff;
      const isMmaNormal = mma !== undefined && mma.value <= mmaHighCutoff;

      if (isMmaHigh) return { triggered: false };
      if (isB12Borderline && mma === undefined) return { triggered: false };

      const evidence: string[] = [];
      if (folate && isSerumFolateLow) evidence.push(`Low Serum Folate: ${formatLabReading(folate, 4.0, 20.0)}`);
      if (rbcFolate && isRbcFolateLow) evidence.push(`Low RBC Folate: ${formatLabReading(rbcFolate, 140, 628)}`);
      evidence.push(`Adequate Vitamin B12: ${formatLabReading(b12, 200, 900)}`);
      if (mma && isMmaNormal) {
        evidence.push(`Normal MMA: ${formatLabReading(mma, 0.08, 0.56)} (supports isolated folate deficiency)`);
      }
      if (hcy && hcy.value > hcyHighCutoff) {
        evidence.push(`Elevated Homocysteine: ${formatLabReading(hcy, 5, 15)}`);
      }
      if (mcv) evidence.push(`MCV: ${formatLabReading(mcv, 80, 100)}`);

      return {
        triggered: true,
        conclusionAr: 'High Suspicion of Folate Deficiency',
        conclusionEn: 'High Suspicion of Folate Deficiency',
        explanationAr: isMmaNormal
          ? 'Low folate (Serum and/or RBC Folate) with adequate Vitamin B12 and normal MMA strongly supports high suspicion of isolated Folate deficiency.'
          : 'Low folate coupled with clearly adequate Vitamin B12 raises high suspicion of isolated Folate deficiency.',
        explanationEn: 'Low folate coupled with adequate Vitamin B12 and normal MMA (when tested) raises high suspicion of isolated Folate deficiency.',
        supportingEvidence: evidence,
        missingEvidence: mma === undefined ? ['Methylmalonic Acid (MMA) to further verify intact cellular B12 pathway'] : [],
        safetyNotesAr: 'Safety reminder: Always verify adequate Vitamin B12 status before using folic acid alone, because folate can mask blood abnormalities while neurological injury progresses in unrecognized B12 deficiency.',
      };
    },
  },

  // --- RULE 10: Kidney Function Caution for MMA ---
  {
    ruleId: 'RULE_MMA_RENAL_CAUTION',
    nameAr: 'Renal Function Consideration for Elevated MMA',
    nameEn: 'Renal Function Consideration for Elevated MMA',
    conditionAr: 'IF MMA is elevated AND kidney impairment is present THEN note that elevated MMA is not exclusive to B12 deficiency',
    conditionEn: 'IF MMA is elevated AND kidney impairment is present THEN note that elevated MMA is not exclusive to B12 deficiency',
    category: 'CONFLICT',
    referenceSource: 'Laboratory Chemistry & BSH Cobalamin Guidelines: Renal Influence on Methylmalonic Acid',
    evaluate: ({ labs, history, profile }) => {
      const mma = labs['mma'];
      const mmaHighCutoff = getHighRef(mma, 0.56);
      const renal = hasImpairedKidneyFunction(labs, history, profile);

      if (mma && mma.value > mmaHighCutoff && renal.impaired) {
        return {
          triggered: true,
          conclusionAr: 'Elevated MMA requires kidney function correlation',
          conclusionEn: 'Elevated MMA requires kidney function correlation',
          explanationAr: `Methylmalonic Acid (${formatLabReading(mma, 0.08, 0.56)}) is elevated alongside indicators of impaired kidney function (${renal.reasons.join(', ')}). Elevated MMA supports B12 deficiency but is not exclusive to it, as reduced renal clearance raises MMA levels.`,
          explanationEn: 'Elevated MMA is not exclusive to B12 deficiency and can accumulate in impaired kidney function.',
          supportingEvidence: [
            `MMA: ${formatLabReading(mma, 0.08, 0.56)}`,
            ...renal.reasons,
          ],
          contradictions: labs['b12'] && labs['b12'].value >= 300
            ? ['Elevated MMA despite adequate Vitamin B12 in the setting of reduced kidney function requires physician correlation.']
            : [],
          safetyNotesAr: 'Evaluate direct Vitamin B12 levels (and holotranscobalamin if available) alongside renal function with your physician.',
        };
      }
      return { triggered: false };
    },
  },

  // --- RULE 11: Homocysteine Non-Specificity ---
  {
    ruleId: 'RULE_HOMOCYSTEINE_NONSPECIFIC',
    nameAr: 'Homocysteine Non-Specific Metabolic Marker Rule',
    nameEn: 'Homocysteine Non-Specific Metabolic Marker Rule',
    conditionAr: 'IF Homocysteine is elevated THEN treat as shared non-specific indicator rather than standalone proof of B12 deficiency',
    conditionEn: 'IF Homocysteine is elevated THEN treat as shared non-specific indicator rather than standalone proof of B12 deficiency',
    category: 'CLASSIFICATION',
    referenceSource: 'BSH Guidelines: Limitations of Total Homocysteine in Megaloblastic Differential',
    evaluate: ({ labs }) => {
      const hcy = labs['homocysteine'];
      const hcyHighCutoff = getHighRef(hcy, 15.0);
      if (hcy && hcy.value > hcyHighCutoff) {
        const missing: string[] = [];
        if (!labs['b12']) missing.push('Serum Vitamin B12');
        if (!labs['folate'] && !labs['rbc_folate']) missing.push('Serum / RBC Folate');
        if (!labs['mma']) missing.push('Methylmalonic Acid (MMA)');

        return {
          triggered: true,
          conclusionAr: 'Elevated Homocysteine is non-specific between B12 and Folate deficiency',
          conclusionEn: 'Elevated Homocysteine is non-specific between B12 and Folate deficiency',
          explanationAr: `Total Homocysteine (${formatLabReading(hcy, 5, 15)}) is elevated. Because homocysteine increases in both B12 and folate deficiencies (as well as kidney impairment), it is never classified automatically as B12 deficiency without B12, Folate, and MMA testing.`,
          explanationEn: 'Homocysteine elevates in both B12 and folate deficiencies and is not specific to either alone.',
          supportingEvidence: [`Homocysteine: ${formatLabReading(hcy, 5, 15)}`],
          missingEvidence: missing,
          safetyNotesAr: 'Always interpret homocysteine together with Serum Vitamin B12, Folate, and MMA.',
        };
      }
      return { triggered: false };
    },
  },

  // --- RULE 12: High Suspicion of Iron Deficiency Anemia ---
  {
    ruleId: 'RULE_POSSIBLE_IRON_DEFICIENCY',
    nameAr: 'High Suspicion of Iron Deficiency Anemia',
    nameEn: 'High Suspicion of Iron Deficiency Anemia',
    conditionAr: 'IF Ferritin < 30 ng/mL OR (low Serum Iron AND low TSAT < 20% AND elevated TIBC) OR (Ferritin < 100 in inflammation with TSAT < 20%) THEN classify as High Suspicion of Iron Deficiency Anemia',
    conditionEn: 'IF Ferritin < 30 ng/mL OR (low Serum Iron AND low TSAT < 20% AND elevated TIBC) OR (Ferritin < 100 in inflammation with TSAT < 20%) THEN classify as High Suspicion of Iron Deficiency Anemia',
    category: 'CLASSIFICATION',
    targetCondition: 'iron_deficiency',
    referenceSource: 'British Society for Haematology (BSH) Guidelines for Iron Deficiency Anemia',
    evaluate: ({ labs, history, profile }) => {
      const hb = labs['hb'];
      const mcv = labs['mcv'];
      const ferritin = labs['ferritin'];
      const iron = labs['iron'];
      const tibc = labs['tibc'];
      const tsat = labs['tsat'];
      const mch = labs['mch'];
      const rdw = labs['rdw'];
      const crp = labs['crp'];

      const ironLowCutoff = getLowRef(iron, profile.sex === 'male' ? 65 : 50);
      const tibcHighCutoff = getHighRef(tibc, 450);

      const ferritinLow = ferritin !== undefined && ferritin.value < getLowRef(ferritin, 30);
      const ironLow = iron !== undefined && iron.value < ironLowCutoff;
      const tibcHigh = tibc !== undefined && tibc.value > tibcHighCutoff;
      const tsatLow = tsat !== undefined && tsat.value < getLowRef(tsat, 20);

      const hasInflammation =
        (crp !== undefined && crp.value > getHighRef(crp, 5.0)) ||
        history.chronicInflammationOrAutoimmune === 'yes';

      const functionalOrMixedIronDef =
        hasInflammation &&
        ferritin !== undefined &&
        ferritin.value >= 30 &&
        ferritin.value < 100 &&
        tsatLow &&
        (ironLow || iron === undefined);

      const classicIronProfileWithoutFerritin =
        ferritin === undefined && ironLow && (tsatLow || tibcHigh);

      if (ferritinLow || functionalOrMixedIronDef || classicIronProfileWithoutFerritin) {
        const evidence: string[] = [];
        if (hb) evidence.push(`Hemoglobin: ${formatLabReading(hb, profile.sex === 'male' ? 13 : 12, profile.sex === 'male' ? 17.5 : 16)}`);
        if (mcv) evidence.push(`MCV: ${formatLabReading(mcv, 80, 100)}`);
        if (mch && mch.value < getLowRef(mch, 27)) evidence.push(`Low MCH: ${formatLabReading(mch, 27, 33)}`);
        if (rdw && rdw.value > getHighRef(rdw, 14.5)) evidence.push(`Elevated RDW: ${formatLabReading(rdw, 11.5, 14.5)}`);
        if (ferritin) evidence.push(`Ferritin: ${formatLabReading(ferritin, 15, 150)}`);
        if (iron && ironLow) evidence.push(`Low Serum Iron: ${formatLabReading(iron, 50, 170)}`);
        if (tibc && tibcHigh) evidence.push(`Elevated TIBC: ${formatLabReading(tibc, 240, 450)}`);
        if (tsat && tsatLow) evidence.push(`Low Transferrin Saturation (TSAT): ${formatLabReading(tsat, 20, 50)}`);

        let contextNote = '';
        if (functionalOrMixedIronDef) {
          contextNote = ' (Note: Active inflammation may raise ferritin into the 30–100 range, but low TSAT and serum iron indicate coexisting iron deficiency.)';
        }
        if (history.heavyMenstrualBleeding === 'yes') contextNote += ' Heavy menstrual bleeding reported.';
        if (history.bloodInStool === 'yes' || history.blackTarStool === 'yes') contextNote += ' Potential GI bleeding indicators reported.';

        return {
          triggered: true,
          conclusionAr: 'High Suspicion of Iron Deficiency Anemia',
          conclusionEn: 'High Suspicion of Iron Deficiency Anemia',
          explanationAr: `Depleted iron stores or reduced iron availability (low ferritin, low serum iron, low TSAT, elevated TIBC) raises high suspicion of Iron Deficiency Anemia.${contextNote}`,
          explanationEn: 'Depleted iron stores or reduced iron availability (low ferritin, low serum iron, low TSAT, elevated TIBC) raises high suspicion of Iron Deficiency Anemia.',
          supportingEvidence: evidence,
          missingEvidence: ferritin === undefined ? ['Serum Ferritin to directly assess storage iron'] : [],
          safetyNotesAr: 'Consult a physician to identify the underlying cause of iron deficiency (such as chronic blood loss or malabsorption) before starting iron supplementation.',
        };
      }
      return { triggered: false };
    },
  },

  // --- RULE 13: Microcytosis without Ferritin (Inconclusive) ---
  {
    ruleId: 'RULE_MICROCYTIC_MISSING_FERRITIN',
    nameAr: 'Microcytosis With Missing Iron Studies',
    nameEn: 'Microcytosis With Missing Iron Studies',
    conditionAr: 'IF MCV < reference lower limit AND Ferritin and Iron/TSAT are missing THEN request iron studies before classifying',
    conditionEn: 'IF MCV < reference lower limit AND Ferritin and Iron/TSAT are missing THEN request iron studies before classifying',
    category: 'CLASSIFICATION',
    targetCondition: 'general',
    referenceSource: 'AGA Guidelines on Evaluation of Microcytic Anemia',
    evaluate: ({ labs }) => {
      const mcv = labs['mcv'];
      const ferritin = labs['ferritin'];
      const iron = labs['iron'];
      const tsat = labs['tsat'];
      const hbElectro = labs['hb_electrophoresis'];

      if (
        mcv &&
        mcv.value < getLowRef(mcv, 80) &&
        ferritin === undefined &&
        tsat === undefined &&
        iron === undefined &&
        hbElectro === undefined
      ) {
        return {
          triggered: true,
          conclusionAr: 'Microcytic pattern — Inconclusive without Ferritin / Iron studies',
          conclusionEn: 'Microcytic pattern — Inconclusive without Ferritin / Iron studies',
          explanationAr: `Microcytosis (${formatLabReading(mcv, 80, 100)}) is present, but ferritin and iron studies are required to differentiate iron deficiency from thalassemia or anemia of chronic disease.`,
          explanationEn: 'Microcytosis is present, but ferritin and iron profile are required to differentiate iron deficiency, thalassemia, and chronic inflammation.',
          supportingEvidence: [`MCV: ${formatLabReading(mcv, 80, 100)}`],
          missingEvidence: ['Serum Ferritin', 'Complete Iron Profile (Serum Iron, TIBC, TSAT)'],
          safetyNotesAr: 'Do not start iron supplements before checking ferritin, as thalassemia trait shares a similar microcytic CBC pattern.',
        };
      }
      return { triggered: false };
    },
  },

  // --- RULE 14A: Mentzer Index Screening Clue ONLY (Never standalone diagnosis) ---
  {
    ruleId: 'RULE_THALASSEMIA_MENTZER_CLUE',
    nameAr: 'Mentzer Index Screening Clue (< 13)',
    nameEn: 'Mentzer Index Screening Clue (< 13)',
    conditionAr: 'IF MCV < 80 AND Mentzer Index < 13 WITHOUT ferritin or Hb electrophoresis THEN treat solely as screening clue and request confirmatory testing',
    conditionEn: 'IF MCV < 80 AND Mentzer Index < 13 WITHOUT ferritin or Hb electrophoresis THEN treat solely as screening clue and request confirmatory testing',
    category: 'PATHWAY',
    targetCondition: 'thalassemia',
    referenceSource: 'Mentzer Index Screening Criteria & WHO Thalassemia Guidelines',
    evaluate: ({ labs }) => {
      const mcv = labs['mcv'];
      const rbc = labs['rbc'];
      const ferritin = labs['ferritin'];
      const hbElectro = labs['hb_electrophoresis'];
      if (!mcv || !rbc || rbc.value <= 0) return { triggered: false };
      const mentzer = mcv.value / rbc.value;
      if (mcv.value < getLowRef(mcv, 80) && mentzer < 13 && ferritin === undefined && hbElectro === undefined) {
        return {
          triggered: true,
          conclusionAr: 'Low Mentzer Index (< 13) — Screening Clue Only',
          conclusionEn: 'Low Mentzer Index (< 13) — Screening Clue Only',
          explanationAr: `Mentzer Index (MCV/RBC = ${mentzer.toFixed(1)} < 13) is a screening clue only and cannot classify thalassemia alone; Serum Ferritin and Hemoglobin Electrophoresis are required.`,
          explanationEn: `Mentzer Index (${mentzer.toFixed(1)} < 13) is a screening clue only and cannot classify thalassemia alone; Ferritin and Hb Electrophoresis are required.`,
          supportingEvidence: [`Mentzer Index: ${mentzer.toFixed(1)} (< 13)`],
          missingEvidence: ['Serum Ferritin', 'Hemoglobin Electrophoresis / HPLC'],
          safetyNotesAr: 'Never rely on the Mentzer Index alone to diagnose or classify thalassemia.',
        };
      }
      return { triggered: false };
    },
  },

  // --- RULE 14B: Possible Thalassemia ---
  {
    ruleId: 'RULE_MICROCYTIC_THALASSEMIA_SUSPICION',
    nameAr: 'Possible Thalassemia',
    nameEn: 'Possible Thalassemia',
    conditionAr: 'IF Hb Electrophoresis/HPLC is abnormal OR (microcytosis AND adequate Ferritin >= 30 AND (preserved/elevated RBC OR normal RDW OR family history)) THEN classify as Possible Thalassemia',
    conditionEn: 'IF Hb Electrophoresis/HPLC is abnormal OR (microcytosis AND adequate Ferritin >= 30 AND (preserved/elevated RBC OR normal RDW OR family history)) THEN classify as Possible Thalassemia',
    category: 'CLASSIFICATION',
    targetCondition: 'thalassemia',
    referenceSource: 'WHO & BSH Guidelines for Investigation of Thalassemia and Hemoglobinopathies',
    evaluate: ({ labs, history, profile }) => {
      const mcv = labs['mcv'];
      const mch = labs['mch'];
      const rbc = labs['rbc'];
      const rdw = labs['rdw'];
      const ferritin = labs['ferritin'];
      const hbElectro = labs['hb_electrophoresis'];
      const smear = labs['peripheral_smear'];

      const mcvVal = mcv?.value;
      const rbcVal = rbc?.value;
      const mentzerIndex = mcvVal && rbcVal && rbcVal > 0 ? mcvVal / rbcVal : null;
      const hasFamilyHistory = history.familyThalassemia === 'yes' || profile.hasKnownThalassemia;

      const isMicrocytic = mcv !== undefined && mcv.value < getLowRef(mcv, 80);
      const isFerritinAdequate = ferritin !== undefined && ferritin.value >= getLowRef(ferritin, 30);
      const isRbcPreserved = rbcVal !== undefined && rbcVal >= 4.6;
      const isRdwNormal = rdw !== undefined && rdw.value <= getHighRef(rdw, 14.5);
      const isMentzerLow = mentzerIndex !== null && mentzerIndex < 13;
      const isSmearTargetCells = smear?.qualitativeResult === 'target_microcytic';

      const isHbElectroAbnormal =
        hbElectro !== undefined &&
        ((typeof hbElectro.value === 'number' && hbElectro.value > getHighRef(hbElectro, 3.5) && !hbElectro.qualitativeResult) ||
          hbElectro.qualitativeResult === 'beta_thal_trait' ||
          hbElectro.qualitativeResult === 'variant_or_alpha');

      const nonMentzerThalSupport = isRbcPreserved || isRdwNormal || hasFamilyHistory || isSmearTargetCells;
      const supportedWithoutElectro = isMicrocytic && isFerritinAdequate && (nonMentzerThalSupport || isMentzerLow);

      if (isHbElectroAbnormal || supportedWithoutElectro) {
        const evidence: string[] = [];
        if (mcv) evidence.push(`Marked microcytosis (MCV): ${formatLabReading(mcv, 80, 100)}`);
        if (mch && mch.value < getLowRef(mch, 27)) evidence.push(`Low MCH: ${formatLabReading(mch, 27, 33)}`);
        if (rbc) evidence.push(`Preserved/Elevated RBC count: ${formatLabReading(rbc, 3.8, 5.5)}`);
        if (rdw && isRdwNormal) evidence.push(`Normal RDW: ${formatLabReading(rdw, 11.5, 14.5)}`);
        if (mentzerIndex !== null && isMentzerLow) evidence.push(`Mentzer Index screening clue: ${mentzerIndex.toFixed(1)} (< 13)`);
        if (ferritin && isFerritinAdequate) evidence.push(`Adequate iron stores (Ferritin): ${formatLabReading(ferritin, 15, 150)}`);
        if (isHbElectroAbnormal && hbElectro) {
          evidence.push(
            hbElectro.qualitativeResult
              ? 'Hemoglobin Electrophoresis / HPLC pattern consistent with thalassemia'
              : `Elevated HbA2 fraction on Hemoglobin Electrophoresis: ${hbElectro.value}% (> 3.5%)`
          );
        }
        if (isSmearTargetCells) evidence.push('Target cells noted on peripheral blood smear');
        if (hasFamilyHistory) evidence.push('Known family history of thalassemia');

        return {
          triggered: true,
          conclusionAr: 'Possible Thalassemia',
          conclusionEn: 'Possible Thalassemia',
          explanationAr: isHbElectroAbnormal
            ? 'Hemoglobin analysis (Electrophoresis / HPLC) alongside microcytosis indicates a pattern consistent with thalassemia trait or hemoglobinopathy.'
            : 'Microcytosis combined with adequate iron stores (Ferritin), preserved RBC count or normal RDW, and/or family history supports possible thalassemia (using Mentzer Index solely as a screening clue).',
          explanationEn:
            'Microcytosis with adequate iron stores, preserved RBC count/normal RDW, family history, and/or abnormal hemoglobin fractions is consistent with possible thalassemia.',
          supportingEvidence: evidence,
          missingEvidence: hbElectro === undefined ? ['Hemoglobin Electrophoresis / HPLC to quantify Hb fractions'] : [],
          safetyNotesAr: 'Avoid unnecessary iron supplementation unless coexisting iron deficiency is documented; follow up with a hematologist.',
        };
      }
      return { triggered: false };
    },
  },

  // --- RULE 15: Anemia of Chronic Disease / Inflammation (ACD) ---
  {
    ruleId: 'RULE_NORMOCYTIC_ACD_CHRONIC_DISEASE',
    nameAr: 'Possible Anemia of Chronic Disease / Inflammation',
    nameEn: 'Possible Anemia of Chronic Disease / Inflammation',
    conditionAr: 'IF anemia present AND (low Serum Iron AND low/normal TIBC AND normal/elevated Ferritin) OR (inflammatory markers/chronic disease with Ferritin >= 30) THEN classify as Possible Anemia of Chronic Disease',
    conditionEn: 'IF anemia present AND (low Serum Iron AND low/normal TIBC AND normal/elevated Ferritin) OR (inflammatory markers/chronic disease with Ferritin >= 30) THEN classify as Possible Anemia of Chronic Disease',
    category: 'CLASSIFICATION',
    targetCondition: 'chronic_disease',
    referenceSource: 'KDIGO & BSH Guidelines for Anemia of Chronic Disease / Inflammation',
    evaluate: ({ labs, history, profile }) => {
      const hb = labs['hb'];
      const mcv = labs['mcv'];
      const ferritin = labs['ferritin'];
      const iron = labs['iron'];
      const tibc = labs['tibc'];
      const tsat = labs['tsat'];
      const crp = labs['crp'];
      const renal = hasImpairedKidneyFunction(labs, history, profile);

      if (!hb) return { triggered: false };
      const hbCutoff = getLowRef(hb, profile.sex === 'male' ? 13.0 : profile.pregnancyStatus === 'second_trimester' ? 10.5 : profile.pregnancyStatus !== 'not_pregnant' ? 11.0 : 12.0);
      if (hb.value >= hbCutoff) return { triggered: false };

      const hasChronicHistory =
        history.chronicInflammationOrAutoimmune === 'yes' ||
        history.giDisordersOrIBD === 'yes' ||
        renal.impaired ||
        profile.chronicDiseases.length > 0;

      const isCrpHigh = crp !== undefined && crp.value > getHighRef(crp, 5.0);
      const isFerritinNormalOrHigh = ferritin !== undefined && ferritin.value >= getLowRef(ferritin, 30);
      const isFerritinElevated = ferritin !== undefined && ferritin.value > 100;
      const isIronLow = iron !== undefined && iron.value < getLowRef(iron, profile.sex === 'male' ? 65 : 50);
      const isTibcLowOrNormal = tibc !== undefined && tibc.value <= getHighRef(tibc, 360);
      const isTsatLow = tsat !== undefined && tsat.value < getLowRef(tsat, 20);
      const isNormoOrMicro = !mcv || mcv.value <= getHighRef(mcv, 100);

      const classicAcdIronPattern = isIronLow && isTibcLowOrNormal && (ferritin === undefined || isFerritinNormalOrHigh);
      const chronicInflammatoryPattern = (isCrpHigh || hasChronicHistory || isFerritinElevated) && (ferritin === undefined || isFerritinNormalOrHigh);

      if (isNormoOrMicro && (classicAcdIronPattern || chronicInflammatoryPattern)) {
        const evidence: string[] = [`Low Hemoglobin: ${hb.value} g/dL`];
        if (mcv) evidence.push(`MCV: ${formatLabReading(mcv, 80, 100)}`);
        if (iron && isIronLow) evidence.push(`Low Serum Iron: ${formatLabReading(iron, 50, 170)}`);
        if (tibc && isTibcLowOrNormal) evidence.push(`Low/Normal TIBC: ${formatLabReading(tibc, 240, 450)}`);
        if (tsat && isTsatLow) evidence.push(`Low TSAT: ${formatLabReading(tsat, 20, 50)}`);
        if (ferritin) evidence.push(`Normal or elevated Ferritin: ${formatLabReading(ferritin, 15, 150)}`);
        if (crp && isCrpHigh) evidence.push(`Elevated CRP (inflammation): ${formatLabReading(crp, 0, 5)}`);
        if (renal.impaired) evidence.push(...renal.reasons);
        if (history.chronicInflammationOrAutoimmune === 'yes') evidence.push('History of chronic inflammatory or autoimmune disease');

        const coexistentIronNote =
          ferritin !== undefined && ferritin.value >= 30 && ferritin.value <= 100 && (isTsatLow || isIronLow)
            ? ' Important note: Ferritin between 30–100 with inflammation and low TSAT/Iron may indicate coexisting iron deficiency (Mixed IDA + ACD).'
            : '';

        const missing: string[] = [];
        if (ferritin === undefined) missing.push('Serum Ferritin');
        if (tsat === undefined) missing.push('Transferrin Saturation (TSAT)');
        if (crp === undefined) missing.push('C-Reactive Protein (CRP)');

        return {
          triggered: true,
          conclusionAr: 'Possible Anemia of Chronic Disease',
          conclusionEn: 'Possible Anemia of Chronic Disease',
          explanationAr: `Low serum iron with low/normal TIBC and normal or elevated ferritin alongside inflammatory or chronic disease indicators is consistent with possible Anemia of Chronic Disease.${coexistentIronNote}`,
          explanationEn:
            'Low serum iron with low/normal TIBC and normal or elevated ferritin alongside inflammatory/chronic disease indicators is consistent with Anemia of Chronic Disease.',
          supportingEvidence: evidence,
          missingEvidence: missing,
          safetyNotesAr: 'Management focuses on evaluating and treating the underlying chronic inflammatory, infectious, or renal condition with your physician.',
        };
      }
      return { triggered: false };
    },
  },

  // --- RULE 16A: Single Hemolysis Marker Caution ---
  {
    ruleId: 'RULE_SINGLE_HEMOLYSIS_MARKER_CAUTION',
    nameAr: 'Single Hemolytic Marker Caution — Panel Incomplete',
    nameEn: 'Single Hemolytic Marker Caution — Panel Incomplete',
    conditionAr: 'IF only 1 hemolysis marker is abnormal THEN do NOT classify as Hemolytic Anemia and request complete hemolysis panel',
    conditionEn: 'IF only 1 hemolysis marker is abnormal THEN do NOT classify as Hemolytic Anemia and request complete hemolysis panel',
    category: 'PATHWAY',
    targetCondition: 'hemolytic',
    referenceSource: 'BSH Hemolytic Anemia Investigation Standards',
    evaluate: ({ labs }) => {
      const retics = labs['reticulocytes'];
      const ldh = labs['ldh'];
      const indirectBili = labs['bilirubin_indirect'];
      const haptoglobin = labs['haptoglobin'];
      const smear = labs['peripheral_smear'];
      const dat = labs['dat_test'];

      const hits: string[] = [];
      if (retics !== undefined && retics.value > getHighRef(retics, 2.5)) hits.push(`Elevated Reticulocytes (${retics.value}%)`);
      if (ldh !== undefined && ldh.value > getHighRef(ldh, 280)) hits.push(`Elevated LDH (${ldh.value} U/L)`);
      if (indirectBili !== undefined && indirectBili.value > getHighRef(indirectBili, 0.8)) hits.push(`Elevated Indirect Bilirubin (${indirectBili.value} mg/dL)`);
      if (haptoglobin !== undefined && haptoglobin.value < getLowRef(haptoglobin, 30)) hits.push(`Low Haptoglobin (${haptoglobin.value} mg/dL)`);
      if (smear?.qualitativeResult === 'hemolytic_features') hits.push('Hemolytic smear morphology');
      if (dat?.qualitativeResult === 'positive') hits.push('Positive DAT (Coombs)');

      if (hits.length === 1) {
        return {
          triggered: true,
          conclusionAr: 'Single Hemolysis Marker — Insufficient Alone',
          conclusionEn: 'Single Hemolysis Marker — Insufficient Alone',
          explanationAr: `Only one hemolysis-related marker was found (${hits[0]}). Hemolytic anemia is never classified from a single marker alone because acute blood loss, liver strain, or Gilbert syndrome can isolate one abnormality.`,
          explanationEn: `Only one hemolysis-related marker (${hits[0]}) is present. Hemolytic anemia cannot be classified from a single marker alone.`,
          supportingEvidence: hits,
          missingEvidence: ['Reticulocyte Count', 'LDH', 'Indirect Bilirubin', 'Haptoglobin', 'Peripheral Blood Smear & DAT'],
          safetyNotesAr: 'Complete the full hemolysis laboratory panel with your physician before concluding hemolysis.',
        };
      }
      return { triggered: false };
    },
  },

  // --- RULE 16B: Possible Hemolytic Anemia (Requires >= 2 Concordant Markers) ---
  {
    ruleId: 'RULE_NORMOCYTIC_HEMOLYTIC_SUSPICION',
    nameAr: 'Possible Hemolytic Anemia',
    nameEn: 'Possible Hemolytic Anemia',
    conditionAr: 'IF >= 2 concordant hemolytic indicators (high reticulocytes, high LDH, high indirect bilirubin, low haptoglobin, hemolytic blood smear, positive DAT) THEN classify as Possible Hemolytic Anemia',
    conditionEn: 'IF >= 2 concordant hemolytic indicators (high reticulocytes, high LDH, high indirect bilirubin, low haptoglobin, hemolytic blood smear, positive DAT) THEN classify as Possible Hemolytic Anemia',
    category: 'CLASSIFICATION',
    targetCondition: 'hemolytic',
    referenceSource: 'BSH Guidelines on Investigation of Hemolytic Anemia',
    evaluate: ({ labs, symptoms }) => {
      const retics = labs['reticulocytes'];
      const ldh = labs['ldh'];
      const indirectBili = labs['bilirubin_indirect'];
      const haptoglobin = labs['haptoglobin'];
      const smear = labs['peripheral_smear'];
      const dat = labs['dat_test'];

      const isReticsHigh = retics !== undefined && retics.value > getHighRef(retics, 2.5);
      const isLdhHigh = ldh !== undefined && ldh.value > getHighRef(ldh, 280);
      const isBiliHigh = indirectBili !== undefined && indirectBili.value > getHighRef(indirectBili, 0.8);
      const isHaptoLow = haptoglobin !== undefined && haptoglobin.value < getLowRef(haptoglobin, 30);
      const isSmearHemolytic = smear?.qualitativeResult === 'hemolytic_features';
      const isDatPositive = dat?.qualitativeResult === 'positive';

      const markerCount = [isReticsHigh, isLdhHigh, isBiliHigh, isHaptoLow, isSmearHemolytic, isDatPositive].filter(Boolean).length;

      if (markerCount >= 2) {
        const evidence: string[] = [];
        if (isReticsHigh && retics) evidence.push(`Elevated Reticulocytes: ${formatLabReading(retics, 0.5, 2.5)}`);
        if (isLdhHigh && ldh) evidence.push(`Elevated LDH: ${formatLabReading(ldh, 140, 280)}`);
        if (isBiliHigh && indirectBili) evidence.push(`Elevated Indirect Bilirubin: ${formatLabReading(indirectBili, 0.1, 0.8)}`);
        if (isHaptoLow && haptoglobin) evidence.push(`Low Haptoglobin: ${formatLabReading(haptoglobin, 30, 200)}`);
        if (isSmearHemolytic) evidence.push('Peripheral blood smear shows hemolytic morphology (spherocytes/schistocytes)');
        if (isDatPositive) evidence.push('Positive Direct Antiglobulin Test (DAT) — suggests immune-mediated hemolysis');
        if (symptoms?.jaundice_eyes === 'yes') evidence.push('Jaundice supporting elevated bilirubin');
        if (symptoms?.dark_urine === 'yes') evidence.push('Dark urine consistent with red cell breakdown');

        const missing: string[] = [];
        if (smear === undefined) missing.push('Peripheral Blood Smear');
        if (dat === undefined) missing.push('Direct Antiglobulin Test (DAT / Coombs)');
        if (haptoglobin === undefined) missing.push('Serum Haptoglobin');

        return {
          triggered: true,
          conclusionAr: 'Possible Hemolytic Anemia',
          conclusionEn: 'Possible Hemolytic Anemia',
          explanationAr: `${markerCount} concordant laboratory markers of accelerated red cell breakdown are present, supporting possible hemolytic anemia.${isDatPositive ? ' Positive DAT points toward an immune-mediated mechanism.' : ''}`,
          explanationEn: `${markerCount} concordant hemolysis markers detected, consistent with possible hemolytic anemia.`,
          supportingEvidence: evidence,
          missingEvidence: missing,
          safetyNotesAr: 'Indicators of possible hemolytic anemia warrant prompt evaluation by a hematologist to determine the cause (immune, hereditary, or mechanical).',
        };
      }
      return { triggered: false };
    },
  },

  // --- RULE 16C: Acute Blood Loss Pathway ---
  {
    ruleId: 'RULE_ACUTE_BLOOD_LOSS',
    nameAr: 'Possible Acute Blood Loss-Related Anemia',
    nameEn: 'Possible Acute Blood Loss-Related Anemia',
    conditionAr: 'IF recent acute bleeding or surgery/childbirth AND low Hb (often normocytic initially) THEN consider Acute Blood Loss Anemia without automatically assuming Iron Deficiency',
    conditionEn: 'IF recent acute bleeding or surgery/childbirth AND low Hb (often normocytic initially) THEN consider Acute Blood Loss Anemia without automatically assuming Iron Deficiency',
    category: 'CLASSIFICATION',
    targetCondition: 'blood_loss',
    referenceSource: 'Hematological Standards: Evaluation of Acute Hemorrhagic Anemia',
    evaluate: ({ labs, history, profile }) => {
      const hb = labs['hb'];
      const mcv = labs['mcv'];
      const retics = labs['reticulocytes'];
      const ferritin = labs['ferritin'];

      if (!hb) return { triggered: false };
      const hbCutoff = getLowRef(hb, profile.sex === 'male' ? 13.0 : profile.pregnancyStatus === 'second_trimester' ? 10.5 : profile.pregnancyStatus !== 'not_pregnant' ? 11.0 : 12.0);
      const isAnemic = hb.value < hbCutoff;

      const hasAcuteBleedingHistory =
        history.recentSurgeryOrBloodLoss === 'yes' ||
        history.recentChildbirth === 'yes' ||
        profile.pregnancyStatus === 'postpartum_recent';

      if (isAnemic && hasAcuteBleedingHistory) {
        const evidence: string[] = [`Low Hemoglobin: ${hb.value} g/dL`];
        if (history.recentSurgeryOrBloodLoss === 'yes') evidence.push('Recent acute bleeding or surgery reported');
        if (history.recentChildbirth === 'yes' || profile.pregnancyStatus === 'postpartum_recent') evidence.push('Recent childbirth / postpartum period');
        if (mcv) evidence.push(`MCV: ${formatLabReading(mcv, 80, 100)}`);
        if (retics && retics.value > getHighRef(retics, 2.5)) evidence.push(`Compensatory reticulocyte response (${retics.value}%)`);
        if (ferritin) evidence.push(`Ferritin: ${formatLabReading(ferritin, 15, 150)}`);

        return {
          triggered: true,
          conclusionAr: 'Possible Blood Loss-Related Anemia (Acute)',
          conclusionEn: 'Possible Blood Loss-Related Anemia (Acute)',
          explanationAr: 'Recent acute blood loss, surgery, or childbirth alongside low hemoglobin (typically normocytic early on) supports acute blood loss-related anemia rather than automatically assuming iron deficiency.',
          explanationEn: 'Recent acute blood loss with low hemoglobin supports blood loss-related anemia; iron stores may initially remain normal.',
          supportingEvidence: evidence,
          missingEvidence: retics === undefined ? ['Reticulocyte Count'] : [],
          safetyNotesAr: 'Acute blood loss requires close medical monitoring of hemodynamic stability and serial hemoglobin levels.',
        };
      }
      return { triggered: false };
    },
  },

  // --- RULE 16D: Chronic Blood Loss Pathway ---
  {
    ruleId: 'RULE_CHRONIC_BLOOD_LOSS',
    nameAr: 'Possible Chronic Blood Loss-Related Anemia',
    nameEn: 'Possible Chronic Blood Loss-Related Anemia',
    conditionAr: 'IF chronic bleeding indicators AND low Hb THEN evaluate Chronic Blood Loss pathway and check whether iron stores are depleted or preserved',
    conditionEn: 'IF chronic bleeding indicators AND low Hb THEN evaluate Chronic Blood Loss pathway and check whether iron stores are depleted or preserved',
    category: 'CLASSIFICATION',
    targetCondition: 'blood_loss',
    referenceSource: 'BSG & BSH Guidelines for Gastrointestinal and Menstrual Blood Loss Anemia',
    evaluate: ({ labs, history, profile }) => {
      const hb = labs['hb'];
      const ferritin = labs['ferritin'];
      const retics = labs['reticulocytes'];

      if (!hb) return { triggered: false };
      const hbCutoff = getLowRef(hb, profile.sex === 'male' ? 13.0 : profile.pregnancyStatus === 'second_trimester' ? 10.5 : profile.pregnancyStatus !== 'not_pregnant' ? 11.0 : 12.0);
      if (hb.value >= hbCutoff) return { triggered: false };

      const chronicSources: string[] = [];
      if (history.heavyMenstrualBleeding === 'yes' || history.prolongedPeriod === 'yes') {
        chronicSources.push('Heavy or prolonged menstrual bleeding');
      }
      if (history.bloodInStool === 'yes' || history.blackTarStool === 'yes') {
        chronicSources.push('Signs of GI bleeding (blood in stool or dark tarry stools)');
      }
      if (history.frequentNosebleeds === 'yes') {
        chronicSources.push('Frequent nosebleeds');
      }
      if (history.visibleBloodInUrine === 'yes') {
        chronicSources.push('Visible blood in urine');
      }

      if (chronicSources.length > 0) {
        const ferritinDepleted = ferritin !== undefined && ferritin.value < getLowRef(ferritin, 30);
        const note = ferritinDepleted
          ? 'Chronic bleeding has concurrently depleted iron stores (secondary iron deficiency).'
          : ferritin !== undefined
          ? 'Iron stores have not yet dropped below 30 ng/mL, so chronic blood loss is tracked without automatically assuming iron deficiency.'
          : 'Serum ferritin is needed to determine whether iron stores have been depleted.';

        return {
          triggered: true,
          conclusionAr: 'Possible Blood Loss-Related Anemia (Chronic)',
          conclusionEn: 'Possible Blood Loss-Related Anemia (Chronic)',
          explanationAr: `Recurrent bleeding history (${chronicSources.join(', ')}) alongside anemia supports the chronic blood loss pathway. ${note}`,
          explanationEn: `Recurrent bleeding history (${chronicSources.join(', ')}) alongside anemia supports chronic blood loss-related anemia.`,
          supportingEvidence: [`Hemoglobin: ${hb.value} g/dL`, ...chronicSources],
          missingEvidence: [
            ...(ferritin === undefined ? ['Serum Ferritin & Iron Profile'] : []),
            ...(retics === undefined ? ['Reticulocyte Count'] : []),
          ],
          safetyNotesAr: 'Chronic blood loss (especially suspected GI bleeding in adults) requires physician evaluation to find and treat the bleeding source.',
        };
      }
      return { triggered: false };
    },
  },

  // --- RULE 17: Other Anemia (Non-IDA, Non-B12, Non-Folate) ---
  {
    ruleId: 'RULE_OTHER_ANEMIA_NON_DEFICIENCY',
    nameAr: 'Possible Other Anemia (Iron, B12, and Folate Adequate)',
    nameEn: 'Possible Other Anemia (Iron, B12, and Folate Adequate)',
    conditionAr: 'IF anemia is present AND Ferritin, B12, and Folate are adequate without conflict THEN classify as Possible Other Anemia',
    conditionEn: 'IF anemia is present AND Ferritin, B12, and Folate are adequate without conflict THEN classify as Possible Other Anemia',
    category: 'CLASSIFICATION',
    referenceSource: 'Hematological Differential Evaluation Protocol',
    evaluate: ({ labs, profile }) => {
      const hb = labs['hb'];
      const ferritin = labs['ferritin'];
      const b12 = labs['b12'];
      const folate = labs['folate'];
      const rbcFolate = labs['rbc_folate'];

      if (!hb) return { triggered: false };
      const hbCutoff = getLowRef(hb, profile.sex === 'male' ? 13.0 : profile.pregnancyStatus === 'second_trimester' ? 10.5 : profile.pregnancyStatus !== 'not_pregnant' ? 11.0 : 12.0);
      if (hb.value >= hbCutoff) return { triggered: false };

      const ironOk = ferritin !== undefined && ferritin.value >= getLowRef(ferritin, 30);
      const b12Ok = b12 !== undefined && b12.value >= getLowRef(b12, 200);
      const folateOk =
        (folate !== undefined && folate.value >= getLowRef(folate, 4.0)) ||
        (rbcFolate !== undefined && rbcFolate.value >= getLowRef(rbcFolate, 140));

      if (ironOk && b12Ok && folateOk) {
        return {
          triggered: true,
          conclusionAr: 'Possible Other Anemia',
          conclusionEn: 'Possible Other Anemia',
          explanationAr: 'Hemoglobin is low while Ferritin, Vitamin B12, and Folate are adequate, shifting consideration toward non-nutritional etiologies (chronic disease, inherited traits, hemolysis, or marrow disorders).',
          explanationEn: 'Anemia is present with adequate Ferritin, B12, and Folate, pointing toward non-nutritional etiologies.',
          supportingEvidence: [
            `Low Hemoglobin: ${hb.value} g/dL`,
            `Adequate Ferritin: ${ferritin.value} ${ferritin.unit}`,
            `Adequate Vitamin B12: ${b12.value} ${b12.unit}`,
            folate ? `Adequate Serum Folate: ${folate.value} ${folate.unit}` : `Adequate RBC Folate: ${rbcFolate!.value} ${rbcFolate!.unit}`,
          ],
          missingEvidence: ['Reticulocyte Count', 'Peripheral Blood Smear', 'Inflammation & Renal Panel (CRP, eGFR)'],
          safetyNotesAr: 'Consult a hematologist or internist to complete further differential investigations.',
        };
      }
      return { triggered: false };
    },
  },

  // --- RULE 18: Macrocytosis / Missing Differential Tests (Inconclusive) ---
  {
    ruleId: 'RULE_MISSING_IMPORTANT_TESTS_INCONCLUSIVE',
    nameAr: 'Important Results Missing — Inconclusive Assessment',
    nameEn: 'Important Results Missing — Inconclusive Assessment',
    conditionAr: 'IF differential indicators are present AND important tests (B12, Folate, MMA, or Ferritin) are missing THEN do not produce a classification and return Inconclusive – Further Testing Required',
    conditionEn: 'IF differential indicators are present AND important tests (B12, Folate, MMA, or Ferritin) are missing THEN do not produce a classification and return Inconclusive – Further Testing Required',
    category: 'CLASSIFICATION',
    referenceSource: 'BSH Diagnostic Safety Standards',
    evaluate: ({ labs, symptoms, history }) => {
      const mcv = labs['mcv'];
      const b12 = labs['b12'];
      const folate = labs['folate'];
      const rbcFolate = labs['rbc_folate'];
      const mma = labs['mma'];

      const b12LowCutoff = getLowRef(b12, 200);
      const folateLowCutoff = getLowRef(folate, 4.0);
      const rbcFolateLowCutoff = getLowRef(rbcFolate, 140.0);

      const isAnyFolateLow =
        (folate !== undefined && folate.value < folateLowCutoff) ||
        (rbcFolate !== undefined && rbcFolate.value < rbcFolateLowCutoff);
      const isB12Borderline = b12 !== undefined && b12.value >= b12LowCutoff && b12.value < 300;
      const neuro = hasNeurologicalSigns(symptoms, history);

      const reasons: string[] = [];
      const missing: string[] = [];

      if (mcv && mcv.value > getHighRef(mcv, 100) && b12 === undefined && folate === undefined && rbcFolate === undefined) {
        reasons.push(`Macrocytosis detected (MCV = ${mcv.value} fL) without Serum Vitamin B12 or Folate results.`);
        missing.push('Serum Vitamin B12', 'Serum / RBC Folate', 'Methylmalonic Acid (MMA)');
      }

      if (isB12Borderline && mma === undefined) {
        reasons.push(`Vitamin B12 is in the borderline range (${b12!.value} ${b12!.unit}); cellular B12 sufficiency cannot be determined without Methylmalonic Acid (MMA).`);
        missing.push('Serum Methylmalonic Acid (MMA)', 'Total Homocysteine');
      }

      if (isAnyFolateLow && b12 === undefined) {
        reasons.push('Low folate was entered, but Vitamin B12 is missing; isolated folate deficiency cannot be classified safely until B12 deficiency is excluded.');
        missing.push('Serum Vitamin B12', 'Methylmalonic Acid (MMA)');
      }

      if (neuro && b12 === undefined && mma === undefined) {
        reasons.push('Neurological symptoms (numbness/tingling or balance problems) were reported; symptoms alone cannot classify B12 deficiency without B12 and MMA lab testing.');
        missing.push('Serum Vitamin B12', 'Methylmalonic Acid (MMA)');
      }

      if (reasons.length > 0) {
        return {
          triggered: true,
          conclusionAr: 'Inconclusive – Further Testing Required',
          conclusionEn: 'Inconclusive – Further Testing Required',
          explanationAr: reasons.join(' '),
          explanationEn: 'Important differential tests are missing; further laboratory evaluation is required before classifying.',
          supportingEvidence: mcv ? [`MCV: ${mcv.value} fL`] : [],
          missingEvidence: Array.from(new Set(missing)),
          safetyNotesAr: 'Safety reminder: Avoid taking folic acid alone before ruling out Vitamin B12 deficiency, as folate can mask anemia while nerve damage worsens.',
        };
      }
      return { triggered: false };
    },
  },

  // --- RULE 19: Conflicting Laboratory Findings ---
  {
    ruleId: 'RULE_CONFLICTING_LAB_FINDINGS',
    nameAr: 'Conflicting Laboratory Findings Rule',
    nameEn: 'Conflicting Laboratory Findings Rule',
    conditionAr: 'IF laboratory results conflict THEN return Inconclusive – Further Testing Required and request re-evaluation',
    conditionEn: 'IF laboratory results conflict THEN return Inconclusive – Further Testing Required and request re-evaluation',
    category: 'CONFLICT',
    referenceSource: 'Laboratory Quality Standards & Hematological Concordance Protocols',
    evaluate: ({ labs, history, profile }) => {
      const hb = labs['hb'];
      const hct = labs['hct'];
      const mcv = labs['mcv'];
      const ferritin = labs['ferritin'];
      const iron = labs['iron'];
      const tsat = labs['tsat'];
      const rdw = labs['rdw'];
      const b12 = labs['b12'];
      const mma = labs['mma'];
      const folate = labs['folate'];
      const rbcFolate = labs['rbc_folate'];

      const conflicts: string[] = [];
      const renal = hasImpairedKidneyFunction(labs, history, profile);

      if (iron !== undefined && ferritin !== undefined && iron.value > getHighRef(iron, 160) && ferritin.value < 15) {
        conflicts.push(`Conflict between high Serum Iron (${iron.value} ${iron.unit}) and markedly low Ferritin (${ferritin.value} ${ferritin.unit}).`);
      }

      if (ferritin !== undefined && tsat !== undefined && ferritin.value < 15 && tsat.value > 50) {
        conflicts.push(`Conflict between severely low Ferritin (${ferritin.value} ${ferritin.unit}) and elevated TSAT (${tsat.value}%).`);
      }

      if (mcv !== undefined && mcv.value < 70 && rdw !== undefined && rdw.value < 10) {
        conflicts.push(`Marked microcytosis (${mcv.value} fL) with an unusually low RDW (${rdw.value}%).`);
      }

      if (hb !== undefined && hct !== undefined && hb.value > 0) {
        if (hct.value < hb.value * 2.0 || hct.value > hb.value * 4.5) {
          conflicts.push(`Mathematical mismatch between Hemoglobin (${hb.value} g/dL) and Hematocrit (${hct.value}%). Please verify values and units.`);
        }
      }

      if (b12 !== undefined && mma !== undefined) {
        const b12Low = getLowRef(b12, 200);
        const mmaHigh = getHighRef(mma, 0.56);

        if (b12.value < b12Low && mma.value <= 0.35) {
          conflicts.push(`Discordance between low Vitamin B12 (${b12.value} ${b12.unit}) and strictly low-normal MMA (${mma.value} ${mma.unit}). May reflect recent treatment or assay interference.`);
        }

        if (b12.value >= 400 && mma.value > mmaHigh) {
          if (renal.impaired) {
            conflicts.push(`Elevated MMA (${mma.value} ${mma.unit}) despite adequate B12 (${b12.value} ${b12.unit}) in the setting of impaired kidney function — likely renal rather than B12 deficiency.`);
          } else {
            conflicts.push(`Discordance between adequate B12 (${b12.value} ${b12.unit}) and elevated MMA (${mma.value} ${mma.unit}) — warrants kidney function check (Creatinine/eGFR) and physician review.`);
          }
        }
      }

      if (folate !== undefined && rbcFolate !== undefined) {
        const folateLow = getLowRef(folate, 4.0);
        const rbcFolateLow = getLowRef(rbcFolate, 140.0);
        if ((folate.value >= 6.0 && rbcFolate.value < rbcFolateLow) || (folate.value < folateLow && rbcFolate.value >= 250)) {
          conflicts.push(`Discordance between Serum Folate (${folate.value} ${folate.unit}) and RBC Folate (${rbcFolate.value} ${rbcFolate.unit}). May reflect recent dietary change and requires repeat evaluation.`);
        }
      }

      const tibc = labs['tibc'];
      if (ferritin !== undefined && tibc !== undefined && ferritin.value >= 150 && tibc.value > getHighRef(tibc, 450)) {
        conflicts.push(`Discordance between elevated Ferritin (${ferritin.value} ${ferritin.unit}) and elevated TIBC (${tibc.value} ${tibc.unit}).`);
      }

      const dat = labs['dat_test'];
      const retics = labs['reticulocytes'];
      const ldh = labs['ldh'];
      const bili = labs['bilirubin_indirect'];
      const hapto = labs['haptoglobin'];
      if (
        dat?.qualitativeResult === 'positive' &&
        retics !== undefined && retics.value <= getHighRef(retics, 2.5) &&
        ldh !== undefined && ldh.value <= getHighRef(ldh, 280) &&
        bili !== undefined && bili.value <= getHighRef(bili, 0.8) &&
        hapto !== undefined && hapto.value >= getLowRef(hapto, 30)
      ) {
        conflicts.push('Positive Direct Antiglobulin Test (DAT) with completely normal hemolysis markers (Reticulocytes, LDH, Indirect Bilirubin, Haptoglobin) — may reflect non-hemolytic antibody reactivity.');
      }

      if (conflicts.length > 0) {
        return {
          triggered: true,
          conclusionAr: 'Inconclusive – Further Testing Required (Conflicting Findings)',
          conclusionEn: 'Inconclusive – Further Testing Required (Conflicting Findings)',
          explanationAr: conflicts.join(' | '),
          explanationEn: 'Discordant laboratory results detected; further evaluation and verification are required.',
          supportingEvidence: conflicts,
          contradictions: conflicts,
          missingEvidence: ['Verify lab report values and review discordant markers with your physician'],
          safetyNotesAr: 'When lab results conflict, avoid definitive conclusions or starting supplements until verified by your physician and laboratory.',
        };
      }
      return { triggered: false };
    },
  },
];
