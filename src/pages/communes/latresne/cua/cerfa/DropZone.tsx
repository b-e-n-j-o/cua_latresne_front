import { useRef, useState } from "react";
import { X } from "lucide-react";

type Props = {
  file: File | null;
  onFileSelected: (file: File | null) => void;
  onAnalyse: () => void;
};

export function DropZone({ file, onFileSelected, onAnalyse }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClearFile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inputRef.current) inputRef.current.value = "";
    onFileSelected(null);
  };

  const handleVisualiser = () => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const newWindow = window.open(objectUrl, "_blank");
    if (newWindow) {
      newWindow.addEventListener("beforeunload", () => {
        URL.revokeObjectURL(objectUrl);
      });
    } else {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type === "application/pdf") {
      onFileSelected(dropped);
    }
  };

  return (
    <div className="space-y-3">
      <label
        htmlFor="cerfa-file"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition
          ${
            isDragging
              ? "border-amber-500 bg-amber-50 scale-[1.01]"
              : file
                ? "border-green-400 bg-green-50"
                : "border-gray-300 hover:bg-gray-50"
          }
        `}
      >
        <input
          ref={inputRef}
          id="cerfa-file"
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              onFileSelected(e.target.files[0]);
            }
          }}
        />

        {file && !isDragging && (
          <button
            type="button"
            onClick={handleClearFile}
            className="absolute top-1.5 right-1.5 z-10 p-1 rounded-full text-green-700/70 hover:text-red-600 hover:bg-red-50 transition"
            aria-label="Supprimer le fichier"
            title="Changer de fichier"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {isDragging ? (
          <>
            <span className="text-sm font-medium text-amber-600">
              Déposez le fichier ici
            </span>
            <span className="text-[11px] text-amber-500 mt-1">
              Relâchez pour sélectionner
            </span>
          </>
        ) : !file ? (
          <>
            <span className="text-xs text-gray-600">1. Déposez le PDF CERFA</span>
            <span className="text-[11px] text-gray-900 mt-1">
              Cliquez ou glissez un fichier ici
            </span>
          </>
        ) : (
          <>
            <span className="text-xs font-medium text-green-700">
              ✓ Fichier sélectionné
            </span>
            <span className="text-[11px] text-green-600 truncate max-w-[calc(100%-1.5rem)] px-4">
              {file.name}
            </span>
          </>
        )}
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleVisualiser}
          disabled={!file}
          className={`flex-1 text-xs font-semibold py-2 rounded-md transition
            ${
              file
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }
          `}
        >
          Visualiser
        </button>
        <button
          type="button"
          onClick={onAnalyse}
          disabled={!file}
          className={`flex-1 text-xs font-semibold py-2 rounded-md transition
            ${
              file
                ? "bg-amber-600 text-white hover:bg-amber-700"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }
          `}
        >
          2. Analyser le CERFA
        </button>
      </div>
    </div>
  );
}
