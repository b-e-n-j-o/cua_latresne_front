// components/NewDossierPanel.tsx
import React from "react";
import ProgressPanel from "./ProgressPanel";

interface Props {
  file: File | null;
  isOver: boolean;
  status: string;
  error: string | null;

  disabled: boolean;

  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onChooseFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
  onLaunch: () => void;

  showProgress: boolean;
}

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

export default function NewDossierPanel(props: Props) {
  const {
    file, isOver, status, error,
    disabled,
    onDrop, onChooseFile, onReset, onLaunch,
    showProgress,
  } = props;

  const getButtonText = () => {
    if (status === "uploading") return "Envoi…";
    if (status === "running") return "Analyse…";
    return "Lancer";
  };

  return (
    <div className="p-6 border-b border-[#d5e1e3] bg-[#d5e1e3]/10">
      <div className="max-w-[1200px] mx-auto">

        {showProgress ? (
          <ProgressPanel status={status as any} />
        ) : (
          <div>
            <h2 className="text-lg font-semibold mb-3">Nouveau dossier</h2>

            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDragLeave={() => {}}
              onDrop={onDrop}
              className={cx(
                "border-2 border-dashed rounded-lg p-6 transition text-center",
                isOver ? "border-[#0b131f] bg-[#d5e1e3]/30" : "border-[#d5e1e3]"
              )}
            >
              <p className="text-sm mb-2">Déposez un CERFA (PDF)</p>

              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-[#0b131f] text-white rounded-lg hover:bg-[#0b131f]/90 transition">
                <input type="file" accept="application/pdf" className="hidden" onChange={onChooseFile} />
                Choisir
              </label>

              {file && <p className="text-xs mt-2 text-[#0b131f]/60">{file.name}</p>}
              {error && <p className="text-xs mt-2 text-red-600">{error}</p>}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={onReset}
                className="px-4 py-2 text-sm border border-[#d5e1e3] rounded-lg hover:bg-[#d5e1e3]/20 transition"
              >
                Réinitialiser
              </button>

              <button
                onClick={onLaunch}
                disabled={disabled}
                className={cx(
                  "px-4 py-2 text-sm rounded-lg font-medium transition",
                  disabled ? "opacity-50 bg-[#0b131f] text-white" : "bg-[#0b131f] text-white hover:bg-[#0b131f]/90"
                )}
              >
                {getButtonText()}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
