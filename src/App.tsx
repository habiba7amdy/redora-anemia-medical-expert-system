import React, { useState, useEffect } from 'react';
import {
  PatientProfile,
  SymptomAnswers,
  MedicalHistory,
  EmergencySigns,
  ConfirmedLabValues,
  InferenceResult,
} from './types';
import { runInferenceEngine } from './medical/inferenceEngine';
import { SplashScreen } from './components/SplashScreen';
import { Navbar } from './components/Navbar';
import { ProgressTracker } from './components/ProgressTracker';
import { Step1Landing } from './components/Step1Landing';
import { Step2InitialAssessment } from './components/Step2InitialAssessment';
import { Step7CbcQuestion } from './components/Step7CbcQuestion';
import { Step10ManualLabEntry } from './components/Step10ManualLabEntry';
import { StepFollowUpLab } from './components/StepFollowUpLab';
import { Step12FinalReport } from './components/Step12FinalReport';
import { KnowledgeBaseModal } from './components/KnowledgeBaseModal';

const STORAGE_KEY = 'redora_patient_session_v3_en';
const LEGACY_STORAGE_KEYS = ['redora_patient_session_v1', 'redora_patient_session_v2'];
const VALID_STEPS = new Set([1, 2, 7, 10, 11, 12]);

const DEFAULT_PROFILE: PatientProfile = {
  age: null,
  sex: null,
  pregnancyStatus: 'not_pregnant',
  isSmoker: false,
  hadRecentTransfusion: false,
  hasPreviousAnemia: false,
  hasKnownThalassemia: false,
  takingSupplements: false,
  currentSupplements: [],
  chronicDiseases: [],
};

const DEFAULT_EMERGENCY: EmergencySigns = {
  severeDyspneaAtRest: false,
  chestPain: false,
  syncopeOrFainting: false,
  activeHeavyBleeding: false,
  severeWeaknessWithConfusion: false,
};

export default function App() {
  // Splash Screen State
  const [showSplash, setShowSplash] = useState<boolean>(true);

  // Workflow Step:
  // 1: Welcome Landing
  // 2: Initial Assessment (5 short questions + Warning Symptoms check)
  // 7: CBC Availability Evaluation
  // 10: CBC & Manual Laboratory Entry
  // 11: Preliminary Classification, Targeted Additional Tests & Differential Diagnosis
  // 12: Final Expert System Report
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Core Medical Assessment State
  const [profile, setProfile] = useState<PatientProfile>(DEFAULT_PROFILE);
  const [emergencySigns, setEmergencySigns] = useState<EmergencySigns>(DEFAULT_EMERGENCY);
  const [symptoms, setSymptoms] = useState<SymptomAnswers>({});
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory>({});
  const [hasCbc, setHasCbc] = useState<boolean>(false);
  const [confirmedLabs, setConfirmedLabs] = useState<ConfirmedLabValues>({});
  const [inferenceResult, setInferenceResult] = useState<InferenceResult | null>(null);

  // Modal
  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState(false);

  // Load saved session on initial mount if available (purging any legacy cached Arabic state)
  useEffect(() => {
    try {
      LEGACY_STORAGE_KEYS.forEach(legacyKey => {
        try {
          localStorage.removeItem(legacyKey);
        } catch {
          // ignore
        }
      });
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        if (/[\u0600-\u06FF]/.test(saved)) {
          localStorage.removeItem(STORAGE_KEY);
          return;
        }
        const parsed = JSON.parse(saved);
        if (parsed.profile) setProfile(parsed.profile);
        if (parsed.emergencySigns) setEmergencySigns(parsed.emergencySigns);
        if (parsed.symptoms) setSymptoms(parsed.symptoms);
        if (parsed.medicalHistory) setMedicalHistory(parsed.medicalHistory);
        if (parsed.hasCbc !== undefined) setHasCbc(parsed.hasCbc);
        if (parsed.confirmedLabs) setConfirmedLabs(parsed.confirmedLabs);
        if (parsed.currentStep && VALID_STEPS.has(parsed.currentStep) && parsed.currentStep > 1) {
          setCurrentStep(parsed.currentStep);
        }
        if (parsed.inferenceResult) setInferenceResult(parsed.inferenceResult);
      }
    } catch (e) {
      console.warn('Failed to restore session:', e);
    }
  }, []);

  // Save session state to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          currentStep,
          profile,
          emergencySigns,
          symptoms,
          medicalHistory,
          hasCbc,
          confirmedLabs,
          inferenceResult,
        })
      );
    } catch (e) {
      console.warn('Failed to persist session:', e);
    }
  }, [currentStep, profile, emergencySigns, symptoms, medicalHistory, hasCbc, confirmedLabs, inferenceResult]);

  // Scroll to top on every page/step transition
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [currentStep, showSplash]);

  // Reset Assessment Completely
  const handleReset = () => {
    setProfile(DEFAULT_PROFILE);
    setEmergencySigns(DEFAULT_EMERGENCY);
    setSymptoms({});
    setMedicalHistory({});
    setHasCbc(false);
    setConfirmedLabs({});
    setInferenceResult(null);
    setCurrentStep(1);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  // Run Client-Side Rule-Based Inference Engine
  const executeInference = (
    labsToUse: ConfirmedLabValues,
    cbcAvailable: boolean,
    symptomsOverride?: SymptomAnswers,
    historyOverride?: MedicalHistory
  ) => {
    const res = runInferenceEngine({
      profile,
      symptoms: symptomsOverride ?? symptoms,
      history: historyOverride ?? medicalHistory,
      emergency: emergencySigns,
      hasCbc: cbcAvailable,
      labs: labsToUse,
    });
    setInferenceResult(res);
    return res;
  };

  return (
    <>
      {/* Splash Screen */}
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
        {/* Top Navigation */}
        <Navbar
          currentStep={currentStep}
          onNavigateStep={step => setCurrentStep(VALID_STEPS.has(step) ? step : 1)}
          onOpenKnowledgeBase={() => setIsKnowledgeBaseOpen(true)}
          onResetAssessment={handleReset}
        />

        {/* Progress Tracker */}
        <ProgressTracker currentStep={currentStep} />

        {/* Main Multi-Step Workflow Router */}
        <main className="flex-1">
          {/* Step 1: Welcome & Landing Page */}
          {currentStep === 1 && (
            <Step1Landing onStart={() => setCurrentStep(2)} />
          )}

          {/* Step 2: Streamlined 5-Question Initial Assessment */}
          {currentStep === 2 && (
            <Step2InitialAssessment
              profile={profile}
              symptoms={symptoms}
              emergency={emergencySigns}
              onChangeProfile={setProfile}
              onChangeSymptoms={setSymptoms}
              onChangeEmergency={setEmergencySigns}
              onNext={() => setCurrentStep(7)}
              onBack={() => setCurrentStep(1)}
            />
          )}

          {/* Step 7: CBC Availability Evaluation */}
          {currentStep === 7 && (
            <Step7CbcQuestion
              onYesHaveReport={() => {
                setHasCbc(true);
                setCurrentStep(10);
              }}
              onNoNoReport={() => {
                setHasCbc(false);
                const res = executeInference({}, false);
                setInferenceResult(res);
                setCurrentStep(12);
              }}
              onBack={() => setCurrentStep(2)}
            />
          )}

          {/* Step 10: Direct Manual Laboratory Entry */}
          {currentStep === 10 && (
            <Step10ManualLabEntry
              userSex={profile.sex}
              initialValues={confirmedLabs}
              onSubmit={confirmed => {
                setConfirmedLabs(confirmed);
                setHasCbc(true);
                const res = executeInference(confirmed, true);
                if (res.recommendedTests.length > 0 || res.isAnemiaDetected) {
                  setCurrentStep(11);
                } else {
                  setCurrentStep(12);
                }
              }}
              onBack={() => setCurrentStep(7)}
            />
          )}

          {/* Step 11: Preliminary Classification, Targeted Questions & Differential Diagnosis */}
          {currentStep === 11 && (
            <StepFollowUpLab
              profile={profile}
              symptoms={symptoms}
              history={medicalHistory}
              emergency={emergencySigns}
              currentLabs={confirmedLabs}
              recommendedTests={inferenceResult?.recommendedTests || []}
              onCompleteWithAdditionalLabs={(updatedLabs, updatedSymptoms, updatedHistory) => {
                setConfirmedLabs(updatedLabs);
                setSymptoms(updatedSymptoms);
                setMedicalHistory(updatedHistory);
                executeInference(updatedLabs, true, updatedSymptoms, updatedHistory);
                setCurrentStep(12);
              }}
              onSkipToFinalReport={() => setCurrentStep(12)}
              onBack={() => setCurrentStep(10)}
            />
          )}

          {/* Step 12: Final Medical Expert System Report */}
          {currentStep === 12 && inferenceResult && (
            <Step12FinalReport
              profile={profile}
              symptoms={symptoms}
              history={medicalHistory}
              labs={confirmedLabs}
              result={inferenceResult}
              onRestart={handleReset}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="no-print border-t border-stone-200 bg-white py-6 mt-12 text-center text-xs text-stone-500">
          <div className="max-w-5xl mx-auto px-4 flex items-center justify-center">
            <div className="flex flex-wrap items-center justify-center gap-2 font-mono">
              <span className="text-stone-700 font-semibold">Redora Medical Expert System</span>
              <span>·</span>
              <span>WHO 2024 Hemoglobin Standards</span>
            </div>
          </div>
        </footer>

        {/* Knowledge Base Modal */}
        <KnowledgeBaseModal
          isOpen={isKnowledgeBaseOpen}
          onClose={() => setIsKnowledgeBaseOpen(false)}
        />
      </div>
    </>
  );
}
