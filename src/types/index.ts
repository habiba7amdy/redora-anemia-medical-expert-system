export type BiologicalSex = 'female' | 'male';

export type PregnancyStatus = 'not_pregnant' | 'first_trimester' | 'second_trimester' | 'third_trimester' | 'postpartum_recent';

export type AnswerChoice = 'yes' | 'no' | 'sometimes' | 'not_sure';

export type SymptomDuration = 'less_than_week' | 'one_to_four_weeks' | 'more_than_month';

export interface PatientProfile {
  age: number | null;
  sex: BiologicalSex | null;
  pregnancyStatus: PregnancyStatus;
  symptomDuration?: SymptomDuration | null;
  isSmoker: boolean;
  smokingDetails?: string;
  hadRecentTransfusion: boolean; // Blood transfusion within last 3 months
  transfusionDate?: string;
  hasPreviousAnemia: boolean;
  previousAnemiaType?: string;
  hasKnownThalassemia: boolean;
  takingSupplements: boolean;
  currentSupplements: string[];
  chronicDiseases: string[];
  notes?: string;
}

export interface SymptomItem {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  category: 'general' | 'specific';
  hasIllustration?: boolean;
  illustrationType?: 'pallor' | 'conjunctiva' | 'dizziness' | 'nails' | 'tongue' | 'pica' | 'cold_hands' | 'fatigue';
}

export type SymptomAnswers = Record<string, AnswerChoice>;

export interface MedicalHistory {
  // Menstrual & Reproductive
  heavyMenstrualBleeding?: AnswerChoice;
  prolongedPeriod?: AnswerChoice;
  irregularBleeding?: AnswerChoice;
  recentChildbirth?: AnswerChoice;

  // Bleeding history
  frequentNosebleeds?: AnswerChoice;
  bloodInStool?: AnswerChoice;
  blackTarStool?: AnswerChoice;
  visibleBloodInUrine?: AnswerChoice;
  recentSurgeryOrBloodLoss?: AnswerChoice;

  // Diet
  vegetarianOrVegan?: AnswerChoice;
  lowIronDiet?: AnswerChoice;
  restrictedDiet?: AnswerChoice;
  knownNutritionalDeficiency?: AnswerChoice;

  // Medical conditions
  chronicKidneyDisease?: AnswerChoice;
  chronicInflammationOrAutoimmune?: AnswerChoice;
  giDisordersOrIBD?: AnswerChoice;
  celiacOrMalabsorption?: AnswerChoice;
  priorGastricSurgery?: AnswerChoice;

  // Neurological / Balance
  balanceProblems?: AnswerChoice;

  // Family history
  familyThalassemia?: AnswerChoice;
  familySickleCell?: AnswerChoice;
  familyOtherBloodDisorder?: AnswerChoice;

  // Medications
  takingIronSupplements?: AnswerChoice;
  takingB12Supplements?: AnswerChoice;
  takingFolateSupplements?: AnswerChoice;
  takingNsaidsOrBloodThinners?: AnswerChoice;
}

export interface EmergencySigns {
  severeDyspneaAtRest: boolean;
  chestPain: boolean;
  syncopeOrFainting: boolean;
  activeHeavyBleeding: boolean;
  severeWeaknessWithConfusion: boolean;
}

export interface LabParameterDef {
  id: string;
  nameAr: string;
  nameEn: string;
  shortName: string;
  category: 'cbc' | 'iron_studies' | 'vitamins' | 'additional';
  inputType?: 'numeric' | 'select';
  selectOptions?: { value: string; labelAr: string; labelEn: string }[];
  standardUnit: string;
  allowedUnits: string[];
  adultFemaleNormalRange: [number, number];
  adultMaleNormalRange: [number, number];
  descriptionAr: string;
  medicalSignificanceAr: string;
}

export interface LabValueItem {
  id: string;
  parameterId: string;
  nameAr: string;
  nameEn: string;
  value: number;
  qualitativeResult?: string;
  unit: string;
  refRangeLow?: number;
  refRangeHigh?: number;
  originalRefRangeLow?: number;
  originalRefRangeHigh?: number;
  refRangeUnit?: string;
  refRangeRaw?: string;
  testDate?: string;
  isEntered: boolean;
  confidence: 'high' | 'medium' | 'low';
  isAmbiguous?: boolean;
  ambiguityReason?: string;
  flag?: 'low' | 'normal' | 'high' | 'abnormal' | 'unknown';
  originalValue?: number;
  originalUnit?: string;
  wasConverted?: boolean;
  conversionNote?: string;
}

export type ConfirmedLabValues = Record<string, LabValueItem>;

export interface TriggeredRule {
  ruleId: string;
  category?: 'DETECTION' | 'CLASSIFICATION' | 'SAFETY' | 'PATHWAY' | 'CONFLICT';
  targetCondition?:
    | 'iron_deficiency'
    | 'b12_deficiency'
    | 'folate_deficiency'
    | 'thalassemia'
    | 'chronic_disease'
    | 'hemolytic'
    | 'blood_loss'
    | 'general';
  nameAr: string;
  nameEn: string;
  conditionAr?: string;
  conditionEn?: string;
  conclusionAr: string;
  conclusionEn: string;
  explanationAr: string;
  explanationEn: string;
  supportingEvidence: string[];
  missingEvidence: string[];
  contradictions: string[];
  safetyNotesAr: string;
  referenceSource: string;
}

export type SuspicionLevel = 'high' | 'moderate' | 'low' | 'insufficient';

export type DifferentialCategoryId =
  | 'iron_deficiency'
  | 'b12_deficiency'
  | 'folate_deficiency'
  | 'thalassemia'
  | 'chronic_disease'
  | 'hemolytic'
  | 'blood_loss';

export interface DifferentialCandidate {
  categoryId: DifferentialCategoryId;
  nameAr: string;
  nameEn: string;
  suspicionLevel: SuspicionLevel;
  suspicionLabelAr: string;
  suspicionLabelEn: string;
  score: number;
  supportingFindings: string[];
  contradictingFindings: string[];
  missingTests: string[];
  activatedRuleIds: string[];
  reasoningAr: string;
  reasoningEn: string;
}

export type AnemiaStatus =
  | 'NO_ANEMIA_DETECTED'
  | 'ANEMIA_INDICATORS_DETECTED'
  | 'POSSIBLE_ANEMIA'
  | 'POSSIBLE_IRON_DEFICIENCY_ANEMIA'
  | 'POSSIBLE_B12_DEFICIENCY_ANEMIA'
  | 'POSSIBLE_FOLATE_DEFICIENCY_ANEMIA'
  | 'POSSIBLE_COMBINED_B12_FOLATE_ANEMIA'
  | 'POSSIBLE_COMBINED_ANEMIA_CAUSES'
  | 'POSSIBLE_OTHER_ANEMIA'
  | 'POSSIBLE_THALASSEMIA_SUSPICION'
  | 'POSSIBLE_ANEMIA_OF_CHRONIC_DISEASE'
  | 'POSSIBLE_HEMOLYTIC_ANEMIA'
  | 'POSSIBLE_BLOOD_LOSS_ANEMIA'
  | 'INSUFFICIENT_DATA_TO_CLASSIFY'
  | 'CONFLICTING_DATA_DETECTED'
  | 'SPECIAL_PATHWAY_PREGNANCY'
  | 'SPECIAL_PATHWAY_PEDIATRIC';

export interface AdditionalTestRecommendation {
  testId: string;
  nameAr: string;
  nameEn: string;
  urgency: 'high' | 'moderate' | 'consider';
  rationaleAr: string;
  rationaleEn: string;
  relevantFindings: string[];
}

export interface InferenceResult {
  status: AnemiaStatus;
  statusTitleAr: string;
  statusTitleEn: string;
  preliminaryAssessmentAr: string;
  preliminaryAssessmentEn: string;
  cbcClassificationAr?: string;
  cbcClassificationEn?: string;
  summaryAr: string;
  summaryEn: string;
  comparativeReasoningAr?: string;
  comparativeReasoningEn?: string;
  overlappingConditionsAr?: string[];
  differentialCandidates?: DifferentialCandidate[];
  isAnemiaDetected: boolean | null;
  severityLevel?: 'mild' | 'moderate' | 'severe' | 'none' | 'unknown';
  hemoglobinValue?: number;
  hemoglobinThreshold?: number;
  morphologyAr?: string;
  morphologyEn?: string;
  triggeredRules: TriggeredRule[];
  supportingEvidence: string[];
  missingData: string[];
  conflictingFindings: string[];
  recommendedTests: AdditionalTestRecommendation[];
  dietaryGuidanceAr: string[];
  folateSafetyWarningAr?: string;
  followUpAdviceAr: string;
  disclaimerAr: string;
  evaluationDate: string;
}
