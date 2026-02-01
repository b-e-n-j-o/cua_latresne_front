import { Check } from "lucide-react";
import type { HistoryPipeline } from "./HistoryPipelineCard";

const STEPS = [
  { id: 1, label: "Dossier reçu" },
  { id: 2, label: "Dossier traité" },
  { id: 3, label: "Dossier validé/corrigé" },
  { id: 4, label: "CUA délivré" },
] as const;

type Props = {
  pipeline: HistoryPipeline;
  onSuiviChange: (suivi: number) => void;
};

export default function SuiviInstructionCard({ pipeline, onSuiviChange }: Props) {
  const currentStep = Math.min(4, Math.max(1, pipeline.suivi ?? 2));

  const handleToggle = (stepId: number) => {
    if (stepId <= currentStep) {
      if (stepId > 1) onSuiviChange(stepId - 1);
    } else {
      if (stepId === currentStep + 1) onSuiviChange(stepId);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-teal-200 p-3 shadow-sm">
      <h3 className="text-sm font-semibold text-teal-800 mb-3">Suivi du dossier</h3>
      <div className="flex flex-col">
        {STEPS.map((step, index) => {
          const isDone = step.id <= currentStep;
          const isNext = step.id === currentStep + 1;
          const isLocked = step.id > currentStep + 1;

          return (
            <div key={step.id} className="flex items-start gap-3 py-0.5">
              {/* Frise : trait vertical + cercle cliquable */}
              <div className="flex flex-col items-center shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggle(step.id)}
                  disabled={isLocked}
                  className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors shrink-0 ${
                    isLocked
                      ? "border-gray-200 bg-gray-50 cursor-not-allowed"
                      : isDone
                      ? "border-teal-600 bg-teal-600 text-white hover:bg-teal-700"
                      : isNext
                      ? "border-teal-300 bg-white hover:border-teal-500 cursor-pointer"
                      : "border-gray-300 bg-white"
                  }`}
                  title={
                    isLocked
                      ? "Étape non débloquée"
                      : isDone
                      ? "Cliquer pour revenir en arrière"
                      : "Cliquer pour valider"
                  }
                >
                  {isDone ? <Check size={14} strokeWidth={3} /> : null}
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-0.5 flex-1 min-h-[12px] ${
                      isDone ? "bg-teal-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>

              <div className="flex items-center flex-1 min-w-0 pt-0.5">
                <span
                  className={`text-sm ${
                    isDone ? "text-teal-700 font-medium" : isLocked ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
