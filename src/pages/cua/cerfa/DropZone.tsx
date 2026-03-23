type Props = {
    file: File | null;
    onFileSelected: (file: File) => void;
    onAnalyse: () => void;
  };
  
  export function DropZone({ file, onFileSelected, onAnalyse }: Props) {
    const handleVisualiser = () => {
      if (!file) return;
      
      // Créer une URL d'objet à partir du fichier
      const objectUrl = URL.createObjectURL(file);
      
      // Ouvrir le PDF dans un nouvel onglet
      const newWindow = window.open(objectUrl, '_blank');
      
      // Nettoyer l'URL après un délai pour libérer la mémoire
      // (le navigateur le fera aussi automatiquement quand la fenêtre se ferme)
      if (newWindow) {
        newWindow.addEventListener('beforeunload', () => {
          URL.revokeObjectURL(objectUrl);
        });
      } else {
        // Si la fenêtre n'a pas pu s'ouvrir (popup bloquée), nettoyer immédiatement
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
    };

    return (
      <div className="space-y-3">
        {/* Zone de drop */}
        <label
          htmlFor="cerfa-file"
          className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-md p-4 text-center cursor-pointer hover:bg-gray-50 transition"
        >
          <input
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
  
          {!file ? (
            <>
              <span className="text-xs text-gray-600">
                1. Déposez le PDF CERFA
              </span>
              <span className="text-[11px] text-gray-900 mt-1">
                Cliquez pour sélectionner un fichier
              </span>
            </>
          ) : (
            <>
              <span className="text-xs font-medium text-gray-800">
                Fichier sélectionné
              </span>
              <span className="text-[11px] text-gray-500 truncate max-w-full">
                {file.name}
              </span>
            </>
          )}
        </label>
  
        {/* Boutons d'action */}
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
  