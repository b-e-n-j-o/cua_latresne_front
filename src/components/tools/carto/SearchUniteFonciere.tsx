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
  onAddManualUfParcelleToMap?: (section: string, numero: string, insee?: string) => void;
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
  /** Brouillon saisie manuelle (une seule ligne à la fois). */
  const [draftInsee, setDraftInsee] = useState("");
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
    const insee = draftInsee.trim();
    const s = padSection(draftSection);
    const n = padNumero(draftNumero);
    if (!insee || !s || !n) return;
    onAddManualUfParcelleToMap?.(s, n, insee);
    setDraftInsee("");
    setDraftSection("");
    setDraftNumero("");
  }

  async function confirmUF() {
    if (totalCount < 1) {
      alert("Une unité foncière doit contenir au moins 1 parcelle.");
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

  return (
    <div
      className={`${
        embedded ? "" : "absolute top-4 left-4 z-40"
      } bg-white shadow-md rounded-lg p-3 text-sm ${
        embedded ? "w-full" : "w-80"
      } space-y-3`}
    >
      <div className="font-semibold text-gray-900">Unité foncière</div>

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
            <span className="font-medium text-amber-900">Sélection parcelles au clic</span>
          </label>
        </div>
        {parcellesCarte.length === 0 && (
          <p className="text-[11px] text-amber-800/80 italic">Aucune parcelle sélectionnée sur la carte pour l’instant.</p>
        )}
      </div>

      <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50/60 p-2.5">
        <p className="text-[11px] text-gray-600 leading-snug">
          Ou bien renseignez les références cadastrales
        </p>
        <div className="grid grid-cols-12 gap-2 text-[11px] font-medium text-gray-600 px-1">
          <div className="col-span-4">INSEE</div>
          <div className="col-span-3">Section</div>
          <div className="col-span-4">Numéro</div>
          <div className="col-span-1" />
        </div>
        <div className="max-h-40 overflow-y-auto space-y-1">
          {selectedUfParcelles.map((p, idx) => (
            <div key={`${p.section}-${p.numero}-${idx}`} className="grid grid-cols-12 gap-2 items-center">
              <input
                className="col-span-4 border border-gray-200 px-2 py-1.5 rounded text-xs bg-white"
                value={p.insee || ""}
                readOnly
              />
              <input
                className="col-span-3 border border-gray-200 px-2 py-1.5 rounded text-xs uppercase bg-white"
                value={p.section}
                readOnly
              />
              <input
                className="col-span-4 border border-gray-200 px-2 py-1.5 rounded text-xs bg-white"
                value={p.numero}
                readOnly
              />
              {onUfParcelleRemove && (
                <button
                  type="button"
                  className="col-span-1 text-red-600 hover:bg-red-50 px-1.5 rounded text-sm leading-none"
                  onClick={() => onUfParcelleRemove(p.section, p.numero)}
                  title="Retirer"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <div className="grid grid-cols-12 gap-2 items-center">
            <input
              className="col-span-4 border border-gray-200 px-2 py-1.5 rounded text-xs bg-white"
              placeholder="33234"
              value={draftInsee}
              onChange={(e) => setDraftInsee(e.target.value)}
            />
            <input
              className="col-span-3 border border-gray-200 px-2 py-1.5 rounded text-xs uppercase bg-white"
              placeholder="XX"
              value={draftSection}
              onChange={(e) => setDraftSection(e.target.value.toUpperCase())}
              onBlur={() => setDraftSection((v) => padSection(v))}
              maxLength={2}
            />
            <input
              className="col-span-4 border border-gray-200 px-2 py-1.5 rounded text-xs bg-white"
              placeholder="XXXX"
              value={draftNumero}
              onChange={(e) => setDraftNumero(e.target.value)}
              onBlur={() => setDraftNumero((v) => padNumero(v))}
            />
            <button
              type="button"
              className="col-span-1 h-full text-xs font-medium rounded-md bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-40"
              disabled={!draftInsee.trim() || !draftSection.trim() || !draftNumero.trim()}
              onClick={addDraftToUf}
              title="Ajouter la ligne"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Récap global + validation */}
      <div className="rounded-md border border-dashed border-gray-200 bg-gray-50/80 px-2.5 py-2">
        <div className="text-[11px] text-gray-600">
          <span className="font-medium text-gray-800">Total sélection : {totalCount}/20</span>
        </div>
      </div>

      {totalCount >= 1 && (
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
