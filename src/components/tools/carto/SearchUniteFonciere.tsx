import { useState } from "react";

/** `map` = clic cadastre / recherche ; `manual` = bouton « Ajouter » après saisie. */
export type UfParcelleSource = "map" | "manual";

type UfParcelleItem = {
  section: string;
  numero: string;
  commune: string;
  insee: string;
  geometry: GeoJSON.Geometry;
  addedVia?: UfParcelleSource;
};

type Props = {
  ufBuilderMode?: boolean;
  selectedUfParcelles?: UfParcelleItem[];
  onUfBuilderToggle?: (active: boolean) => void;
  onUfParcelleRemove?: (section: string, numero: string) => void;
  onConfirmUF?: (
    parcelles: Array<{ section: string; numero: string; commune: string; insee: string }>,
    unionGeometry: GeoJSON.Geometry,
    commune: string,
    insee: string
  ) => void;
  onAddManualUfParcelleToMap?: (section: string, numero: string) => void;
  embedded?: boolean;
};

function isFromMap(p: UfParcelleItem): boolean {
  return p.addedVia !== "manual";
}

function padSection(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return trimmed;
  return trimmed.padStart(2, "0");
}

export default function SearchUniteFonciere({
  ufBuilderMode = false,
  selectedUfParcelles = [],
  onUfBuilderToggle,
  onUfParcelleRemove,
  onConfirmUF,
  onAddManualUfParcelleToMap,
  embedded = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  /** Onglet actif : deux façons de construire l'UF, bien séparées. */
  const [mode, setMode] = useState<"carte" | "manuel">("carte");
  /** Brouillon saisie manuelle (une seule ligne à la fois). */
  const [draftSection, setDraftSection] = useState("");
  const [draftNumero, setDraftNumero] = useState("");

  const parcellesCarte = selectedUfParcelles.filter(isFromMap);
  const totalCount = selectedUfParcelles.length;

  function padNumero(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return trimmed;
    return trimmed.padStart(4, "0");
  }

  function addDraftToUf() {
    const s = padSection(draftSection);
    const n = padNumero(draftNumero);
    if (!s || !n) return;
    onAddManualUfParcelleToMap?.(s, n);
    setDraftSection("");
    setDraftNumero("");
  }

  async function confirmUF() {
    if (totalCount < 2) {
      alert("Une unité foncière doit contenir au moins 2 parcelles.");
      return;
    }

    setLoading(true);
    try {
      const inseeCodes = selectedUfParcelles
        .map((p) => p.insee)
        .filter((insee) => insee && insee.trim() !== "");

      if (selectedUfParcelles.length > 0) {
        if (inseeCodes.length === 0) {
          alert(
            "Impossible de créer l'unité foncière : les parcelles n'ont pas de code INSEE. Utilisez la carte ou des références présentes au cadastre local."
          );
          setLoading(false);
          return;
        }

        const uniqueInsee = [...new Set(inseeCodes)];
        if (uniqueInsee.length > 1) {
          alert(
            "Les parcelles doivent appartenir à la même commune (même code INSEE)."
          );
          setLoading(false);
          return;
        }
      }

      const inseeFromSelection = inseeCodes[0] || "";

      if (selectedUfParcelles.length > 0 && !inseeFromSelection) {
        alert("Code INSEE manquant pour les parcelles sélectionnées.");
        setLoading(false);
        return;
      }

      const communeValue =
        selectedUfParcelles.length > 0
          ? selectedUfParcelles[0].commune || "Latresne"
          : "Latresne";

      const uniqueParcelles = Array.from(
        new Map(
          selectedUfParcelles.map((p) => [
            `${padSection(p.section)}-${padNumero(p.numero)}`,
            {
              section: padSection(p.section),
              numero: padNumero(p.numero),
            },
          ])
        ).values()
      );

      const requestBody: {
        commune?: string;
        code_insee?: string;
        parcelles: Array<{ section: string; numero: string }>;
      } = {
        parcelles: uniqueParcelles,
      };

      if (inseeFromSelection) {
        requestBody.code_insee = inseeFromSelection;
      }
      if (communeValue) {
        requestBody.commune = communeValue;
      } else if (!inseeFromSelection) {
        alert("Commune ou parcelles manquantes.");
        setLoading(false);
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/parcelle/uf-geometrie`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ detail: "Erreur inconnue" }));
        throw new Error(errorData.detail || `Erreur ${res.status}`);
      }

      const feature = await res.json();

      const finalInsee = feature.properties.insee || inseeFromSelection || "";
      const finalCommune = feature.properties.commune || communeValue;

      if (!finalInsee) {
        alert("Code INSEE manquant dans la réponse du serveur.");
        setLoading(false);
        return;
      }

      if (onConfirmUF) {
        onConfirmUF(
          uniqueParcelles.map((p) => ({
            section: p.section,
            numero: p.numero,
            commune: finalCommune,
            insee: finalInsee,
          })),
          feature.geometry,
          finalCommune,
          finalInsee
        );
      }
    } catch (err: unknown) {
      console.error("Erreur lors de la confirmation de l'UF:", err);
      const msg = err instanceof Error ? err.message : "Impossible de créer l'unité foncière";
      alert(`Erreur : ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  const tabBtn = (active: boolean) =>
    `flex-1 py-2 px-2 text-xs font-medium rounded-md transition ${
      active
        ? "bg-white text-amber-900 shadow-sm border border-amber-200"
        : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
    }`;

  return (
    <div
      className={`${
        embedded ? "" : "absolute top-4 left-4 z-40"
      } bg-white shadow-md rounded-lg p-3 text-sm ${
        embedded ? "w-full" : "w-80"
      } space-y-3`}
    >
      <div className="font-semibold text-gray-900">Unité foncière</div>
      <p className="text-[11px] text-gray-500 leading-snug">
        Choisissez une méthode : sélection sur la carte ou saisie des références
        cadastrales une par une.
      </p>

      {/* Onglets Carte / Manuel */}
      <div className="p-1 rounded-lg bg-amber-50/80 border border-amber-100 flex gap-1">
        <button
          type="button"
          className={tabBtn(mode === "carte")}
          onClick={() => setMode("carte")}
        >
          Sur la carte
        </button>
        <button
          type="button"
          className={tabBtn(mode === "manuel")}
          onClick={() => setMode("manuel")}
        >
          Saisie manuelle
        </button>
      </div>

      {/* ——— Mode carte ——— */}
      {mode === "carte" && (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/40 p-2.5">
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="uf-click-mode"
              checked={ufBuilderMode}
              onChange={(e) => onUfBuilderToggle?.(e.target.checked)}
              className="w-4 h-4 mt-0.5 shrink-0"
            />
            <label htmlFor="uf-click-mode" className="text-xs cursor-pointer leading-snug text-gray-800">
              <span className="font-medium text-amber-900">Mode sélection au clic</span>
              <span className="block text-gray-600 mt-0.5">
                Cliquez sur les parcelles du cadastre pour les ajouter,
                recliquez pour les retirer.
              </span>
            </label>
          </div>
          {parcellesCarte.length === 0 && (
            <p className="text-[11px] text-amber-800/80 italic">Aucune parcelle sélectionnée sur la carte pour l’instant.</p>
          )}
        </div>
      )}

      {/* ——— Mode saisie manuelle ——— */}
      {mode === "manuel" && (
        <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50/60 p-2.5">
          <p className="text-[11px] text-gray-600 leading-snug">
            Saisissez la <strong>section</strong> et le <strong>numéro</strong> (ex. AN et 0404), puis « Ajouter ».
            Répétez pour chaque parcelle.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="w-[4.5rem] border border-gray-200 px-2 py-1.5 rounded text-xs uppercase"
              placeholder="Sect."
              value={draftSection}
              onChange={(e) => setDraftSection(e.target.value.toUpperCase())}
              onBlur={() => setDraftSection((v) => padSection(v))}
              maxLength={2}
            />
            <input
              className="flex-1 min-w-[5rem] border border-gray-200 px-2 py-1.5 rounded text-xs"
              placeholder="N° parcelle"
              value={draftNumero}
              onChange={(e) => setDraftNumero(e.target.value)}
              onBlur={() => setDraftNumero((v) => padNumero(v))}
            />
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-40"
              disabled={!draftSection.trim() || !draftNumero.trim()}
              onClick={addDraftToUf}
            >
              Ajouter
            </button>
          </div>
        </div>
      )}

      {totalCount > 0 && (
        <div className="space-y-1 bg-gray-50 p-2 rounded border border-gray-200">
          <div className="text-xs font-medium text-gray-700">
            Parcelles sélectionnées ({totalCount}/20)
          </div>
          <ul className="max-h-40 overflow-y-auto space-y-1">
            {selectedUfParcelles.map((p, idx) => (
              <li
                key={`${p.section}-${p.numero}-${idx}`}
                className="flex items-center justify-between gap-2 text-xs bg-white px-2 py-1 rounded border"
              >
                <span className="font-mono">
                  {p.section} {p.numero}
                </span>
                {onUfParcelleRemove && (
                  <button
                    type="button"
                    className="text-red-600 hover:bg-red-50 px-1.5 rounded text-sm leading-none"
                    onClick={() => onUfParcelleRemove(p.section, p.numero)}
                    title="Retirer"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Récap global + validation */}
      <div className="rounded-md border border-dashed border-gray-200 bg-gray-50/80 px-2.5 py-2">
        <div className="text-[11px] text-gray-600">
          <span className="font-medium text-gray-800">Total sélection : {totalCount}/20</span>
        </div>
      </div>

      {totalCount >= 2 && (
        <button
          type="button"
          className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-md text-sm font-medium transition-colors"
          disabled={loading}
          onClick={confirmUF}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
              <span>Validation…</span>
            </span>
          ) : (
            "Confirmer l'unité foncière"
          )}
        </button>
      )}
    </div>
  );
}
