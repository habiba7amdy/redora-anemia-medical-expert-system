import React, { useState } from 'react';
import {
  PatientProfile,
  SymptomAnswers,
  EmergencySigns,
  SymptomDuration,
} from '../types';
import { INITIAL_MAIN_SYMPTOMS } from '../medical/parameters';
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  AlertOctagon,
  PhoneCall,
  ShieldAlert,
  Check,
} from 'lucide-react';

interface Step2InitialAssessmentProps {
  profile: PatientProfile;
  symptoms: SymptomAnswers;
  emergency: EmergencySigns;
  onChangeProfile: (updated: PatientProfile) => void;
  onChangeSymptoms: (updated: SymptomAnswers) => void;
  onChangeEmergency: (updated: EmergencySigns) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step2InitialAssessment: React.FC<Step2InitialAssessmentProps> = ({
  profile,
  symptoms,
  emergency,
  onChangeProfile,
  onChangeSymptoms,
  onChangeEmergency,
  onNext,
  onBack,
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedSymptomIds = INITIAL_MAIN_SYMPTOMS.filter(s => symptoms[s.id] === 'yes').map(s => s.id);
  const hasNoSymptomsFlag = symptoms['no_symptoms'] === 'yes';

  const hasWarningSymptoms =
    emergency.chestPain ||
    emergency.syncopeOrFainting ||
    emergency.severeDyspneaAtRest ||
    emergency.activeHeavyBleeding;

  const [warningChoice, setWarningChoice] = useState<'yes' | 'no' | null>(
    hasWarningSymptoms ? 'yes' : null
  );

  const [pregnancyAnswered, setPregnancyAnswered] = useState<boolean>(
    profile.sex === 'female' &&
      (profile.pregnancyStatus !== 'not_pregnant' ||
        Boolean(profile.symptomDuration) ||
        Object.keys(symptoms).length > 0)
  );

  const handleToggleSymptom = (id: string) => {
    const next: SymptomAnswers = { ...symptoms };
    delete next['no_symptoms'];
    if (next[id] === 'yes') {
      delete next[id];
    } else {
      next[id] = 'yes';
    }
    onChangeSymptoms(next);
    if (errors.symptoms) setErrors(prev => ({ ...prev, symptoms: '' }));
  };

  const handleSelectNoSymptoms = () => {
    const cleared: SymptomAnswers = { ...symptoms };
    INITIAL_MAIN_SYMPTOMS.forEach(s => {
      delete cleared[s.id];
    });
    if (hasNoSymptomsFlag) {
      delete cleared['no_symptoms'];
    } else {
      cleared['no_symptoms'] = 'yes';
    }
    onChangeSymptoms(cleared);
    if (errors.symptoms) setErrors(prev => ({ ...prev, symptoms: '' }));
  };

  const handleSelectWarning = (choice: 'yes' | 'no') => {
    setWarningChoice(choice);
    if (choice === 'no') {
      onChangeEmergency({
        chestPain: false,
        syncopeOrFainting: false,
        severeDyspneaAtRest: false,
        activeHeavyBleeding: false,
        severeWeaknessWithConfusion: false,
      });
    } else if (!hasWarningSymptoms) {
      onChangeEmergency({
        ...emergency,
        chestPain: true,
      });
    }
    if (errors.warning) setErrors(prev => ({ ...prev, warning: '' }));
  };

  const toggleSpecificWarning = (key: keyof EmergencySigns) => {
    const next = { ...emergency, [key]: !emergency[key] };
    onChangeEmergency(next);
  };

  const validateAndProceed = () => {
    const err: Record<string, string> = {};
    if (profile.age === null || profile.age <= 0 || isNaN(profile.age)) {
      err.age = 'Please enter a valid age.';
    }
    if (!profile.sex) {
      err.sex = 'Please select your gender.';
    }
    if (profile.sex === 'female' && !pregnancyAnswered) {
      err.pregnancy = 'Please indicate whether you are currently pregnant.';
    }
    if (selectedSymptomIds.length === 0 && !hasNoSymptomsFlag) {
      err.symptoms = 'Please select your main symptoms or choose "No symptoms".';
    }
    if (!hasNoSymptomsFlag && !profile.symptomDuration) {
      err.duration = 'Please select symptom duration.';
    }
    if (warningChoice === null && !hasWarningSymptoms) {
      err.warning = 'Please answer the warning symptoms question to proceed safely.';
    }

    setErrors(err);
    if (Object.keys(err).length > 0) return;

    if (warningChoice === 'yes' || hasWarningSymptoms) {
      return;
    }

    onNext();
  };

  const isUrgentBlocked = warningChoice === 'yes' || hasWarningSymptoms;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <span className="text-xs font-semibold text-[#8B3A4A] tracking-wider uppercase">
          Step 1: Initial Assessment (5 Short Questions)
        </span>
        <h2 className="text-2xl font-bold text-stone-900 mt-1">Initial Profile &amp; Main Symptoms</h2>
        <p className="text-sm text-stone-600 mt-1">
          Answer these 5 brief questions so we can guide your Complete Blood Count (CBC) evaluation safely.
        </p>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-7">
        {/* Question 1 & 2: Age & Gender */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Q1: Age */}
          <div>
            <label className="block text-sm font-bold text-stone-900 mb-2">
              1. Age <span className="text-rose-600">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="120"
              value={profile.age ?? ''}
              onChange={e => {
                const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                onChangeProfile({ ...profile, age: val });
                if (errors.age) setErrors(prev => ({ ...prev, age: '' }));
              }}
              placeholder="e.g. 28"
              className={`w-full px-3.5 py-2.5 bg-stone-50 border rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B3A4A]/20 focus:border-[#8B3A4A] ${
                errors.age ? 'border-rose-400 bg-rose-50/30' : 'border-stone-300'
              }`}
            />
            {errors.age && (
              <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.age}</span>
              </p>
            )}
            {profile.age !== null && profile.age < 18 && (
              <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  Notice: For individuals under 18 years old, hemoglobin cutoffs differ from adult ranges and require pediatric evaluation.
                </span>
              </div>
            )}
          </div>

          {/* Q2: Gender */}
          <div>
            <label className="block text-sm font-bold text-stone-900 mb-2">
              2. Gender <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onChangeProfile({ ...profile, sex: 'male', pregnancyStatus: 'not_pregnant' });
                  setPregnancyAnswered(false);
                  setErrors(prev => ({ ...prev, sex: '', pregnancy: '' }));
                }}
                className={`py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                  profile.sex === 'male'
                    ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#8B3A4A] shadow-xs'
                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                }`}
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeProfile({ ...profile, sex: 'female' });
                  if (errors.sex) setErrors(prev => ({ ...prev, sex: '' }));
                }}
                className={`py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                  profile.sex === 'female'
                    ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#8B3A4A] shadow-xs'
                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                }`}
              >
                Female
              </button>
            </div>
            {errors.sex && (
              <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.sex}</span>
              </p>
            )}
          </div>
        </div>

        {/* Conditional Pregnancy Question for Female Users */}
        {profile.sex === 'female' && (
          <div className="pt-4 border-t border-stone-100 space-y-3">
            <div>
              <label className="block text-sm font-bold text-stone-900 mb-1">
                Are you currently pregnant? <span className="text-rose-600">*</span>
              </label>
              <p className="text-xs text-stone-500">
                Pregnancy adjusts hemoglobin reference thresholds (WHO 2024 standards).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 max-w-md">
              <button
                type="button"
                onClick={() => {
                  setPregnancyAnswered(true);
                  onChangeProfile({ ...profile, pregnancyStatus: 'not_pregnant' });
                  if (errors.pregnancy) setErrors(prev => ({ ...prev, pregnancy: '' }));
                }}
                className={`py-2.5 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  pregnancyAnswered && profile.pregnancyStatus === 'not_pregnant'
                    ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434] shadow-xs'
                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                }`}
              >
                No, not pregnant
              </button>
              <button
                type="button"
                onClick={() => {
                  setPregnancyAnswered(true);
                  onChangeProfile({
                    ...profile,
                    pregnancyStatus:
                      profile.pregnancyStatus !== 'not_pregnant'
                        ? profile.pregnancyStatus
                        : 'first_trimester',
                  });
                  if (errors.pregnancy) setErrors(prev => ({ ...prev, pregnancy: '' }));
                }}
                className={`py-2.5 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  pregnancyAnswered && profile.pregnancyStatus !== 'not_pregnant'
                    ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434] shadow-xs'
                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                }`}
              >
                Yes, pregnant
              </button>
            </div>

            {pregnancyAnswered && profile.pregnancyStatus !== 'not_pregnant' && (
              <div className="pt-1 space-y-1.5">
                <span className="text-xs font-semibold text-stone-700 block">
                  Select trimester (optional — adjusts Hb cutoff):
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'first_trimester' as const, label: '1st Trimester (Weeks 1–12)' },
                    { id: 'second_trimester' as const, label: '2nd Trimester (Weeks 13–26)' },
                    { id: 'third_trimester' as const, label: '3rd Trimester (Weeks 27+)' },
                  ].map(tri => (
                    <button
                      key={tri.id}
                      type="button"
                      onClick={() => onChangeProfile({ ...profile, pregnancyStatus: tri.id })}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                        profile.pregnancyStatus === tri.id
                          ? 'border-[#8B3A4A] bg-[#8B3A4A] text-white'
                          : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {tri.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {errors.pregnancy && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.pregnancy}</span>
              </p>
            )}
          </div>
        )}

        {/* Q3: Main Symptoms (Multiple Selections) */}
        <div className="pt-4 border-t border-stone-100">
          <label className="block text-sm font-bold text-stone-900 mb-1">
            3. Main Symptoms <span className="text-rose-600">*</span>
          </label>
          <p className="text-xs text-stone-500 mb-3">Select all that apply, or choose &ldquo;No symptoms&rdquo;.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {INITIAL_MAIN_SYMPTOMS.map(sym => {
              const isSelected = symptoms[sym.id] === 'yes';
              return (
                <button
                  key={sym.id}
                  type="button"
                  onClick={() => handleToggleSymptom(sym.id)}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434] font-bold shadow-xs'
                      : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <span className="text-xs">{sym.nameEn}</span>
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                      isSelected ? 'border-[#8B3A4A] bg-[#8B3A4A] text-white' : 'border-stone-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleSelectNoSymptoms}
              className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                hasNoSymptomsFlag
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold shadow-xs'
                  : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
              }`}
            >
              <span className="text-xs">No symptoms</span>
              <div
                className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                  hasNoSymptomsFlag ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-300 bg-white'
                }`}
              >
                {hasNoSymptomsFlag && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </button>
          </div>

          {errors.symptoms && (
            <p className="text-xs text-rose-600 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{errors.symptoms}</span>
            </p>
          )}
        </div>

        {/* Q4: Duration */}
        <div className="pt-4 border-t border-stone-100">
          <label className="block text-sm font-bold text-stone-900 mb-2">
            4. Duration {!hasNoSymptomsFlag && <span className="text-rose-600">*</span>}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              { id: 'less_than_week' as SymptomDuration, labelEn: 'Less than one week' },
              { id: 'one_to_four_weeks' as SymptomDuration, labelEn: '1–4 weeks' },
              { id: 'more_than_month' as SymptomDuration, labelEn: 'More than one month' },
            ].map(dur => {
              const selected = profile.symptomDuration === dur.id;
              return (
                <button
                  key={dur.id}
                  type="button"
                  onClick={() => {
                    onChangeProfile({ ...profile, symptomDuration: dur.id });
                    if (errors.duration) setErrors(prev => ({ ...prev, duration: '' }));
                  }}
                  className={`py-2.5 px-4 rounded-xl border text-center transition-all cursor-pointer ${
                    selected
                      ? 'border-[#8B3A4A] bg-[#FDF2F4] text-[#6A2434] font-bold shadow-xs'
                      : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <span className="text-xs">{dur.labelEn}</span>
                </button>
              );
            })}
          </div>
          {errors.duration && (
            <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{errors.duration}</span>
            </p>
          )}
        </div>

        {/* Q5: Urgent Warning Symptoms */}
        <div className="pt-4 border-t border-stone-100 space-y-3">
          <div>
            <label className="block text-sm font-bold text-stone-900 mb-1">
              5. Warning Symptoms <span className="text-rose-600">*</span>
            </label>
            <p className="text-xs text-stone-600 leading-relaxed">
              Are you currently experiencing: <strong>chest pain</strong>, <strong>fainting</strong>,{' '}
              <strong>severe shortness of breath at rest</strong>, or <strong>active significant bleeding</strong>?
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleSelectWarning('no')}
              className={`py-3 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                warningChoice === 'no' && !hasWarningSymptoms
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-xs'
                  : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
              }`}
            >
              No, I do not have any of these symptoms
            </button>
            <button
              type="button"
              onClick={() => handleSelectWarning('yes')}
              className={`py-3 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isUrgentBlocked
                  ? 'border-rose-500 bg-rose-50 text-rose-900 shadow-xs'
                  : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
              }`}
            >
              Yes, I am experiencing one or more of these
            </button>
          </div>

          {errors.warning && (
            <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{errors.warning}</span>
            </p>
          )}

          {/* Urgent Safety Blocking Banner */}
          {isUrgentBlocked && (
            <div className="mt-4 bg-rose-50 border-2 border-rose-500 rounded-2xl p-5 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                  <AlertOctagon className="w-6 h-6" />
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="text-base font-bold text-rose-900">
                    Urgent Safety Notice: Immediate Medical Evaluation Recommended
                  </h3>
                  <p className="text-xs text-rose-800 leading-relaxed">
                    The warning symptoms reported (chest pain, fainting, severe shortness of breath at rest, or active significant bleeding) require urgent medical evaluation rather than continuing an ordinary self-assessment.
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {[
                      { key: 'chestPain' as const, label: 'Chest pain' },
                      { key: 'syncopeOrFainting' as const, label: 'Fainting' },
                      { key: 'severeDyspneaAtRest' as const, label: 'Severe shortness of breath at rest' },
                      { key: 'activeHeavyBleeding' as const, label: 'Active significant bleeding' },
                    ].map(flag => (
                      <button
                        key={flag.key}
                        type="button"
                        onClick={() => toggleSpecificWarning(flag.key)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border cursor-pointer ${
                          emergency[flag.key]
                            ? 'bg-rose-600 text-white border-rose-700 font-bold'
                            : 'bg-white text-rose-900 border-rose-200'
                        }`}
                      >
                        {flag.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-3 bg-white/90 rounded-xl border border-rose-200 flex items-center gap-2 text-rose-900 font-bold text-xs">
                    <PhoneCall className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Contact emergency services or go to the nearest emergency department immediately.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 border border-stone-300 hover:bg-stone-100 rounded-xl text-stone-700 text-sm font-semibold flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {isUrgentBlocked ? (
          <div className="text-xs font-bold text-rose-700 px-4 py-2.5 bg-rose-100 border border-rose-300 rounded-xl">
            Ordinary self-assessment paused — Please seek urgent medical evaluation
          </div>
        ) : (
          <button
            type="button"
            onClick={validateAndProceed}
            className="px-7 py-2.5 bg-gradient-to-r from-[#8B3A4A] to-[#6A2434] hover:from-[#782E3C] hover:to-[#571B28] text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <span>Continue to CBC Evaluation</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
