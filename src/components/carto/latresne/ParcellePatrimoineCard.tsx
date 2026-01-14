import { FileText, CheckCircle, XCircle, ExternalLink } from "lucide-react";

type Props = {
  patrimoine: any;
  onClose: () => void;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t pt-3 mt-3">
      <h4 className="text-sm font-semibold mb-2">{title}</h4>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}

export default function ParcellePatrimoine({ patrimoine, onClose }: Props) {
  return (
    <div className="absolute top-20 left-80 z-50 bg-white shadow-xl rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-lg">Données patrimoine</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-xl leading-none"
        >
          ×
        </button>
      </div>

      {!patrimoine && (
        <p className="text-sm text-gray-500">
          Aucune donnée patrimoine disponible pour cette parcelle.
        </p>
      )}

      {patrimoine && (
        <>
          {/* ====================================================== */}
          {/* 🏗️ PROJET */}
          {/* ====================================================== */}
          <Section title="🏗️ Projet">
            {patrimoine.valable_projet != null && (
              <div>
                <span className="font-medium">Valable pour un projet :</span>{" "}
                <span className="ml-1">
                  {patrimoine.valable_projet} / 5
                </span>
              </div>
            )}

            {patrimoine.type_projet && (
              <div>
                <span className="font-medium">Type de projet :</span>{" "}
                <span className="ml-1">{patrimoine.type_projet}</span>
              </div>
            )}
          </Section>

          {/* ====================================================== */}
          {/* 🌿 ENVIRONNEMENT */}
          {/* ====================================================== */}
          <Section title="🌿 Environnement">
            {/* AOC */}
            <div className="flex items-center gap-2">
              {patrimoine.aoc === "Oui" ? (
                <CheckCircle size={16} className="text-green-600" />
              ) : (
                <XCircle size={16} className="text-gray-400" />
              )}
              <span className="font-medium">AOC</span>
            </div>

            {patrimoine.zaenr && (
              <div>
                <span className="font-medium">ZAEnR :</span>{" "}
                <span className="ml-1">{patrimoine.zaenr}</span>
              </div>
            )}

            {patrimoine.patrimoine_naturel && (
              <div>
                <span className="font-medium">Patrimoine naturel :</span>{" "}
                <span className="ml-1">
                  {Array.isArray(patrimoine.patrimoine_naturel)
                    ? patrimoine.patrimoine_naturel.join(", ")
                    : patrimoine.patrimoine_naturel}
                </span>
              </div>
            )}
          </Section>

          {/* ====================================================== */}
          {/* 📐 ZONAGES & CONTRAINTES */}
          {/* ====================================================== */}
          <Section title="📐 Zonages & contraintes">
            {patrimoine.zone_plu && (
              <div>
                <span className="font-medium">Zone PLU :</span>{" "}
                <span className="ml-1">
                  {Array.isArray(patrimoine.zone_plu)
                    ? patrimoine.zone_plu.join(", ")
                    : patrimoine.zone_plu}
                </span>
              </div>
            )}

            {(patrimoine.zonage_ppri || patrimoine.zonage_pprmvt) && (
              <div>
                <span className="font-medium">Zonage PPR :</span>{" "}
                <span className="ml-1">
                  {[patrimoine.zonage_ppri, patrimoine.zonage_pprmvt]
                    .filter(Boolean)
                    .flat()
                    .join(", ")}
                </span>
              </div>
            )}

            {Array.isArray(patrimoine.servitudes) &&
              patrimoine.servitudes.length > 0 && (
                <div>
                  <div className="font-medium mb-1">
                    Servitudes / prescriptions :
                  </div>
                  <ul className="list-disc list-inside text-xs space-y-1">
                    {patrimoine.servitudes.map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
          </Section>

          {/* ====================================================== */}
          {/* 📄 DOCUMENTS */}
          {/* ====================================================== */}
          <Section title="📄 Documents">
            {Array.isArray(patrimoine.cua) &&
              patrimoine.cua.length > 0 ? (
              patrimoine.cua.map((doc: any) => (
                <a
                  key={doc.id}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm"
                >
                  <FileText size={14} />
                  {doc.filename}
                  <ExternalLink size={12} />
                </a>
              ))
            ) : (
              <span className="text-xs text-gray-500">
                Aucun document disponible
              </span>
            )}
          </Section>

          {/* ====================================================== */}
          {/* 📘 RÈGLEMENTATION PLU (optionnel, long texte) */}
          {/* ====================================================== */}
          {patrimoine.reglementation_plu && (
            <Section title="📘 Règlementation PLU (extrait)">
              <details>
                <summary className="cursor-pointer text-sm font-medium">
                  Afficher le texte
                </summary>
                <pre className="mt-2 text-xs bg-gray-50 p-2 rounded whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {patrimoine.reglementation_plu}
                </pre>
              </details>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
