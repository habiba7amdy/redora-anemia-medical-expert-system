/**
 * Medical Unit Conversion & Normalization Engine for Redora
 * 
 * Standard Internal Units:
 * - WBC: ×10³/µL
 * - RBC: ×10⁶/µL
 * - Hemoglobin (HGB): g/dL
 * - Hematocrit (HCT): %
 * - MCV: fL
 * - MCH: pg
 * - MCHC: g/dL
 * - RDW: %
 * - Platelets (PLT): ×10³/µL
 * - Ferritin: ng/mL
 * - Iron / TIBC: µg/dL
 * - Vitamin B12: pg/mL
 * - Folate: ng/mL
 */

export interface UnitConversionResult {
  rawValue: number;
  fromUnit: string;
  convertedValue: number;
  standardUnit: string;
  wasConverted: boolean;
  conversionNoteAr?: string;
  conversionNoteEn?: string;
  heuristicApplied?: boolean;
}

// Exact standard internal unit mapping for every laboratory test
export const STANDARD_LAB_UNITS: Record<string, string> = {
  wbc: '×10³/µL',
  rbc: '×10⁶/µL',
  hb: 'g/dL',
  hct: '%',
  mcv: 'fL',
  mch: 'pg',
  mchc: 'g/dL',
  rdw: '%',
  plt: '×10³/µL',
  ferritin: 'ng/mL',
  iron: 'µg/dL',
  tibc: 'µg/dL',
  tsat: '%',
  b12: 'pg/mL',
  folate: 'ng/mL',
  rbc_folate: 'ng/mL',
  mma: 'µmol/L',
  homocysteine: 'µmol/L',
  reticulocytes: '%',
  crp: 'mg/L',
  creatinine: 'mg/dL',
  egfr: 'mL/min/1.73m²',
  ldh: 'U/L',
  bilirubin_indirect: 'mg/dL',
  bilirubin_total: 'mg/dL',
  haptoglobin: 'mg/dL',
  hb_electrophoresis: '%',
};

/**
 * Normalizes unit string for reliable matching across variations
 * Handles superscripts, greek letters, slash variations, case, and whitespace
 */
export function normalizeUnitString(unit: string): string {
  if (!unit) return '';
  return unit
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/µ/g, 'u')
    .replace(/³/g, '^3')
    .replace(/⁶/g, '^6')
    .replace(/⁹/g, '^9')
    .replace(/¹²/g, '^12')
    .replace(/×/g, 'x')
    .replace(/\*/g, 'x');
}

/**
 * Converts a raw numerical lab value and input unit to the official Standard Internal Unit.
 * Also performs safe heuristic validation (e.g. raw counts entered without unit change).
 */
export function convertLabValue(
  parameterId: string,
  rawValue: number,
  fromUnit: string
): UnitConversionResult {
  const standardUnit = STANDARD_LAB_UNITS[parameterId] || fromUnit;

  if (isNaN(rawValue) || rawValue === null || rawValue === undefined) {
    return {
      rawValue: 0,
      fromUnit,
      convertedValue: 0,
      standardUnit,
      wasConverted: false,
    };
  }

  const normUnit = normalizeUnitString(fromUnit);
  let converted = rawValue;
  let wasConverted = false;
  let noteAr = '';
  let noteEn = '';
  let heuristicApplied = false;

  switch (parameterId) {
    // ==========================================
    // WBC (Standard: ×10³/µL)
    // ==========================================
    case 'wbc': {
      // 1. Explicit unit conversions
      if (
        normUnit === '/ul' ||
        normUnit === 'cells/ul' ||
        normUnit === '/mm^3' ||
        normUnit === '/mm3' ||
        normUnit === 'cells/mm^3' ||
        normUnit === 'cells/mm3' ||
        normUnit === 'perul' ||
        normUnit === 'permm3'
      ) {
        converted = rawValue / 1000;
        wasConverted = true;
        noteEn = `Converted from ${rawValue} /µL to ${converted.toFixed(2)} ×10³/µL`;
        noteAr = noteEn;
      } else if (normUnit === '/l' || normUnit === 'cells/l') {
        converted = rawValue / 1000000;
        wasConverted = true;
        noteEn = `Converted from ${rawValue} /L to ${converted.toFixed(2)} ×10³/µL`;
        noteAr = noteEn;
      } else if (
        normUnit === 'x10^3/ul' ||
        normUnit === '10^3/ul' ||
        normUnit === 'k/ul' ||
        normUnit === 'x10^9/l' ||
        normUnit === '10^9/l' ||
        normUnit === 'g/l'
      ) {
        // Standard equivalent formats (1:1)
        converted = rawValue;
        wasConverted = false;
      }

      // 2. Heuristic check: User entered 6500 with unit set to standard ×10³/µL
      if (!wasConverted && rawValue > 300) {
        converted = rawValue / 1000;
        wasConverted = true;
        heuristicApplied = true;
        noteEn = `Detected raw absolute count (${rawValue} /µL) and auto-converted to ${converted.toFixed(2)} ×10³/µL`;
        noteAr = noteEn;
      }
      break;
    }

    // ==========================================
    // RBC (Standard: ×10⁶/µL)
    // ==========================================
    case 'rbc': {
      // 1. Explicit unit conversions
      if (
        normUnit === '/ul' ||
        normUnit === 'cells/ul' ||
        normUnit === '/mm^3' ||
        normUnit === '/mm3' ||
        normUnit === 'perul'
      ) {
        converted = rawValue / 1000000;
        wasConverted = true;
        noteEn = `Converted from ${rawValue.toLocaleString()} /µL to ${converted.toFixed(2)} ×10⁶/µL`;
        noteAr = noteEn;
      } else if (normUnit === 'x10^3/ul' || normUnit === 'k/ul') {
        converted = rawValue / 1000;
        wasConverted = true;
        noteEn = `Converted from ${rawValue} ×10³/µL to ${converted.toFixed(2)} ×10⁶/µL`;
        noteAr = noteEn;
      } else if (
        normUnit === 'x10^6/ul' ||
        normUnit === '10^6/ul' ||
        normUnit === 'million/ul' ||
        normUnit === 'm/ul' ||
        normUnit === 'x10^12/l' ||
        normUnit === '10^12/l' ||
        normUnit === 't/l'
      ) {
        converted = rawValue;
        wasConverted = false;
      }

      // 2. Heuristic check: User entered 4500000 or 4500
      if (!wasConverted) {
        if (rawValue > 50000) {
          converted = rawValue / 1000000;
          wasConverted = true;
          heuristicApplied = true;
          noteEn = `Detected absolute RBC count (${rawValue.toLocaleString()} /µL) and converted to ${converted.toFixed(2)} ×10⁶/µL`;
          noteAr = noteEn;
        } else if (rawValue > 1000 && rawValue < 10000) {
          converted = rawValue / 1000;
          wasConverted = true;
          heuristicApplied = true;
          noteEn = `Auto-converted from ${rawValue} k/µL to ${converted.toFixed(2)} ×10⁶/µL`;
          noteAr = noteEn;
        }
      }
      break;
    }

    // ==========================================
    // Hemoglobin (Standard: g/dL)
    // ==========================================
    case 'hb': {
      if (normUnit === 'g/l') {
        converted = rawValue / 10;
        wasConverted = true;
        noteEn = `Converted from ${rawValue} g/L to ${converted.toFixed(1)} g/dL`;
        noteAr = noteEn;
      } else if (normUnit === 'mmol/l') {
        // 1 mmol/L of Hb ≈ 1.6114 g/dL
        converted = rawValue * 1.6114;
        wasConverted = true;
        noteEn = `Converted from ${rawValue} mmol/L to ${converted.toFixed(1)} g/dL`;
        noteAr = noteEn;
      } else if (normUnit === 'mg/dl') {
        converted = rawValue / 1000;
        wasConverted = true;
        noteEn = `Converted from ${rawValue} mg/dL to ${converted.toFixed(1)} g/dL`;
        noteAr = noteEn;
      } else if (normUnit === 'g/dl' || normUnit === 'g/100ml' || normUnit === 'g%') {
        converted = rawValue;
        wasConverted = false;
      }

      // Heuristic: user entered 120 or 135 in g/dL field without switching unit
      if (!wasConverted && rawValue >= 45 && rawValue <= 250) {
        converted = rawValue / 10;
        wasConverted = true;
        heuristicApplied = true;
        noteEn = `Detected g/L format and auto-converted to ${converted.toFixed(1)} g/dL`;
        noteAr = noteEn;
      }
      break;
    }

    // ==========================================
    // Hematocrit (Standard: %)
    // ==========================================
    case 'hct': {
      if (
        normUnit === 'l/l' ||
        normUnit === 'fraction' ||
        normUnit === 'ratio' ||
        normUnit === 'decimal' ||
        normUnit === 'decimalratio'
      ) {
        converted = rawValue * 100;
        wasConverted = true;
        noteEn = `Converted decimal ratio ${rawValue} to ${converted.toFixed(1)}%`;
        noteAr = noteEn;
      } else if (normUnit === '%') {
        converted = rawValue;
        wasConverted = false;
      }

      // Heuristic: entered 0.42 instead of 42%
      if (!wasConverted && rawValue > 0 && rawValue <= 1.0) {
        converted = rawValue * 100;
        wasConverted = true;
        heuristicApplied = true;
        noteEn = `Detected decimal fraction (${rawValue}) and auto-converted to ${converted.toFixed(1)}%`;
        noteAr = noteEn;
      }
      break;
    }

    // ==========================================
    // MCV (Standard: fL)
    // ==========================================
    case 'mcv': {
      // fL and µm³ are equivalent (1 fL = 1 µm³)
      converted = rawValue;
      wasConverted = false;
      break;
    }

    // ==========================================
    // MCH (Standard: pg)
    // ==========================================
    case 'mch': {
      if (normUnit === 'fmol') {
        // 1 pg ≈ 0.06206 fmol -> pg = fmol * 16.114
        converted = rawValue * 16.114;
        wasConverted = true;
        noteEn = `Converted from ${rawValue} fmol to ${converted.toFixed(1)} pg`;
        noteAr = noteEn;
      } else {
        converted = rawValue;
        wasConverted = false;
      }
      break;
    }

    // ==========================================
    // MCHC (Standard: g/dL)
    // ==========================================
    case 'mchc': {
      if (normUnit === 'g/l') {
        converted = rawValue / 10;
        wasConverted = true;
        noteEn = `Converted from ${rawValue} g/L to ${converted.toFixed(1)} g/dL`;
        noteAr = noteEn;
      } else if (normUnit === 'mmol/l') {
        converted = rawValue * 1.6114;
        wasConverted = true;
        noteEn = `Converted from ${rawValue} mmol/L to ${converted.toFixed(1)} g/dL`;
        noteAr = noteEn;
      } else if (normUnit === 'g/dl' || normUnit === '%' || normUnit === 'g/100ml') {
        converted = rawValue;
        wasConverted = false;
      }

      // Heuristic: entered 330 instead of 33
      if (!wasConverted && rawValue >= 150) {
        converted = rawValue / 10;
        wasConverted = true;
        heuristicApplied = true;
        noteEn = `Detected g/L format and auto-converted to ${converted.toFixed(1)} g/dL`;
        noteAr = noteEn;
      }
      break;
    }

    // ==========================================
    // RDW (Standard: %)
    // ==========================================
    case 'rdw': {
      if (normUnit === 'decimalratio' || normUnit === 'decimal' || normUnit === 'fraction' || normUnit === 'ratio') {
        converted = rawValue * 100;
        wasConverted = true;
        noteEn = `Converted from ratio ${rawValue} to ${converted.toFixed(1)}%`;
        noteAr = noteEn;
      } else if (normUnit === '%' || normUnit === 'rdw-cv%') {
        converted = rawValue;
        wasConverted = false;
      }

      // Heuristic: entered 0.14 instead of 14%
      if (!wasConverted && rawValue > 0 && rawValue <= 0.4) {
        converted = rawValue * 100;
        wasConverted = true;
        heuristicApplied = true;
        noteEn = `Detected decimal fraction (${rawValue}) and auto-converted to ${converted.toFixed(1)}%`;
        noteAr = noteEn;
      }
      break;
    }

    // ==========================================
    // Platelets (PLT) (Standard: ×10³/µL)
    // ==========================================
    case 'plt': {
      // 1. Explicit unit conversions
      if (
        normUnit === '/ul' ||
        normUnit === 'cells/ul' ||
        normUnit === '/mm^3' ||
        normUnit === '/mm3' ||
        normUnit === 'cells/mm^3' ||
        normUnit === 'cells/mm3' ||
        normUnit === 'perul' ||
        normUnit === 'permm3'
      ) {
        converted = rawValue / 1000;
        wasConverted = true;
        noteEn = `Converted from ${rawValue.toLocaleString()} /µL to ${Math.round(converted)} ×10³/µL`;
        noteAr = noteEn;
      } else if (
        normUnit === 'x10^3/ul' ||
        normUnit === '10^3/ul' ||
        normUnit === 'k/ul' ||
        normUnit === 'x10^9/l' ||
        normUnit === '10^9/l' ||
        normUnit === 'g/l'
      ) {
        converted = rawValue;
        wasConverted = false;
      } else if (normUnit === 'x10^6/ul' || normUnit === 'million/ul') {
        converted = rawValue * 1000;
        wasConverted = true;
        noteEn = `Converted from ${rawValue} ×10⁶/µL to ${Math.round(converted)} ×10³/µL`;
        noteAr = noteEn;
      }

      // 2. Heuristic check: User entered 420000 with unit set to standard ×10³/µL
      if (!wasConverted && rawValue >= 2000) {
        converted = rawValue / 1000;
        wasConverted = true;
        heuristicApplied = true;
        noteEn = `Detected absolute platelet count (${rawValue.toLocaleString()} /µL) and auto-converted to ${Math.round(converted)} ×10³/µL`;
        noteAr = noteEn;
      }
      break;
    }

    // ==========================================
    // Ferritin (Standard: ng/mL)
    // ==========================================
    case 'ferritin': {
      if (normUnit === 'pmol/l') {
        // 1 ng/mL ≈ 2.247 pmol/L
        converted = rawValue / 2.247;
        wasConverted = true;
        noteEn = `Converted from ${rawValue} pmol/L to ${converted.toFixed(1)} ng/mL`;
        noteAr = noteEn;
      } else if (normUnit === 'ng/ml' || normUnit === 'ug/l' || normUnit === 'mcg/l') {
        // 1 ng/mL = 1 µg/L
        converted = rawValue;
        wasConverted = false;
      }
      break;
    }

    // ==========================================
    // Serum Iron & TIBC (Standard: µg/dL)
    // ==========================================
    case 'iron':
    case 'tibc': {
      if (normUnit === 'umol/l') {
        // 1 µmol/L Fe ≈ 5.587 µg/dL
        converted = rawValue * 5.587;
        wasConverted = true;
        noteEn = `Converted from ${rawValue} µmol/L to ${converted.toFixed(1)} µg/dL`;
        noteAr = noteEn;
      } else {
        converted = rawValue;
        wasConverted = false;
      }
      break;
    }

    // ==========================================
    // Vitamin B12 (Standard: pg/mL)
    // ==========================================
    case 'b12': {
      if (normUnit === 'pmol/l') {
        // 1 pg/mL ≈ 0.738 pmol/L -> pg/mL = pmol/L / 0.738
        converted = rawValue / 0.738;
        wasConverted = true;
        noteEn = `Converted from ${rawValue} pmol/L to ${Math.round(converted)} pg/mL`;
        noteAr = noteEn;
      } else if (normUnit === 'pg/ml' || normUnit === 'ng/l') {
        converted = rawValue;
        wasConverted = false;
      }
      break;
    }

    // ==========================================
    // Serum Folate & RBC Folate (Standard: ng/mL)
    // ==========================================
    case 'folate':
    case 'rbc_folate': {
      if (normUnit === 'nmol/l') {
        // 1 ng/mL ≈ 2.266 nmol/L -> ng/mL = nmol/L / 2.266
        converted = rawValue / 2.266;
        wasConverted = true;
        noteEn = `Converted from ${rawValue} nmol/L to ${converted.toFixed(1)} ng/mL`;
        noteAr = noteEn;
      } else if (normUnit === 'ng/ml' || normUnit === 'ug/l' || normUnit === 'mcg/l') {
        converted = rawValue;
        wasConverted = false;
      }
      break;
    }

    // ==========================================
    // Methylmalonic Acid (MMA) (Standard: µmol/L)
    // ==========================================
    case 'mma': {
      if (normUnit === 'nmol/l') {
        converted = rawValue / 1000;
        wasConverted = true;
        noteEn = `Converted from ${rawValue} nmol/L to ${converted.toFixed(3)} µmol/L`;
        noteAr = noteEn;
      } else {
        converted = rawValue;
        wasConverted = false;
      }
      break;
    }

    // ==========================================
    // Homocysteine (Standard: µmol/L)
    // ==========================================
    case 'homocysteine': {
      converted = rawValue;
      wasConverted = false;
      break;
    }

    // ==========================================
    // Creatinine (Standard: mg/dL)
    // ==========================================
    case 'creatinine': {
      if (normUnit === 'umol/l') {
        // 1 mg/dL ≈ 88.4 µmol/L
        converted = rawValue / 88.4;
        wasConverted = true;
        noteEn = `Converted from ${rawValue} µmol/L to ${converted.toFixed(2)} mg/dL`;
        noteAr = noteEn;
      } else {
        converted = rawValue;
        wasConverted = false;
      }
      break;
    }

    // ==========================================
    // CRP (Standard: mg/L)
    // ==========================================
    case 'crp': {
      if (normUnit === 'mg/dl') {
        converted = rawValue * 10;
        wasConverted = true;
        noteEn = `Converted from ${rawValue} mg/dL to ${converted.toFixed(1)} mg/L`;
        noteAr = noteEn;
      } else {
        converted = rawValue;
        wasConverted = false;
      }
      break;
    }

    // ==========================================
    // Bilirubin Total / Indirect (Standard: mg/dL)
    // ==========================================
    case 'bilirubin_total':
    case 'bilirubin_indirect': {
      if (normUnit === 'umol/l') {
        // 1 mg/dL = 17.1 µmol/L
        converted = rawValue / 17.1;
        wasConverted = true;
        noteEn = `Converted from ${rawValue} µmol/L to ${converted.toFixed(2)} mg/dL`;
        noteAr = noteEn;
      } else {
        converted = rawValue;
        wasConverted = false;
      }
      break;
    }

    // ==========================================
    // Haptoglobin (Standard: mg/dL)
    // ==========================================
    case 'haptoglobin': {
      if (normUnit === 'g/l') {
        // 1 g/L = 100 mg/dL
        converted = rawValue * 100;
        wasConverted = true;
        noteEn = `Converted from ${rawValue} g/L to ${converted.toFixed(1)} mg/dL`;
        noteAr = noteEn;
      } else {
        converted = rawValue;
        wasConverted = false;
      }
      break;
    }

    default:
      converted = rawValue;
      wasConverted = false;
  }

  // Round converted value reasonably (3 decimals for small values like MMA, 2 otherwise)
  const precision = parameterId === 'mma' ? 1000 : 100;
  const finalValue = Math.round(converted * precision) / precision;

  return {
    rawValue,
    fromUnit,
    convertedValue: finalValue,
    standardUnit,
    wasConverted,
    conversionNoteAr: noteAr,
    conversionNoteEn: noteEn,
    heuristicApplied,
  };
}

/**
 * Converts a user-supplied laboratory reference range into the standard internal unit
 * so all threshold comparisons strictly occur in matching units.
 */
export function convertReferenceRange(
  parameterId: string,
  low: number | undefined,
  high: number | undefined,
  fromUnit: string
): { low?: number; high?: number; standardUnit: string } {
  const standardUnit = STANDARD_LAB_UNITS[parameterId] || fromUnit;
  const convertedLow =
    low !== undefined && !isNaN(low)
      ? convertLabValue(parameterId, low, fromUnit).convertedValue
      : undefined;
  const convertedHigh =
    high !== undefined && !isNaN(high)
      ? convertLabValue(parameterId, high, fromUnit).convertedValue
      : undefined;

  return {
    low: convertedLow,
    high: convertedHigh,
    standardUnit,
  };
}
