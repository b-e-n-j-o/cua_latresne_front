import { useState, useEffect } from "react";

type Props = {
  ufBuilderMode?: boolean;
  selectedUfParcelles?: Array<{
    section: string;
    numero: string;
    commune: string;
    insee: string;
    geometry: GeoJSON.Geometry;
  }>;
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

type UFParcelle = {
  section: string;
  numero: string;
  source?: "manual" | "click";
};

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

  // Parcelles saisies manuellement
  const [ufParcelles, setUfParcelles] = useState<UFParcelle[]>([
    { section: "", numero: "", source: "manual" },
  ]);

  // Garder la liste combinée (saisie + clic) pour l'UI
  const allUfParcelles = [
    ...ufParcelles.filter((p) => p.section && p.numero),
    ...selectedUfParcelles.map((p) => ({
      section: p.section,
      numero: p.numero,
      source: "click" as const,
    })),
  ];

  function addUfParcelle() {
    setUfParcelles((prev) => [
      ...prev,
      { section: "", numero: "", source: "manual" },
    ]);
  }

  function updateUfParcelle(index: number, field: keyof UFParcelle, value: string) {
    setUfParcelles((prev) =>
      prev.map((p, i) =>
        i === index
          ? {
              ...p,
              [field]: field === "section" ? value.toUpperCase() : value,
            }
          : p
      )
    );
  }

  function removeUfParcelle(index: number) {
    const parcelle = ufParcelles[index];
    if (parcelle && parcelle.section && parcelle.numero && onUfParcelleRemove) {
      onUfParcelleRemove(parcelle.section, parcelle.numero);
    }
    setUfParcelles((prev) => prev.filter((_, i) => i !== index));
  }

  function padNumero(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return trimmed;
    return trimmed.padStart(4, "0");
  }

  async function confirmUF() {
    if (allUfParcelles.length < 2) {
      alert("Une unité foncière doit contenir au moins 2 parcelles");
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
            "Impossible de créer l'unité foncière : les parcelles sélectionnées n'ont pas de code INSEE. Veuillez d'abord sélectionner une commune."
          );
          setLoading(false);
          return;
        }

        const uniqueInsee = [...new Set(inseeCodes)];
        if (uniqueInsee.length > 1) {
          alert(
            "Impossible de créer l'unité foncière : les parcelles sélectionnées appartiennent à des communes différentes. Une unité foncière doit être dans la même commune."
          );
          setLoading(false);
          return;
        }
      }

      const inseeFromClic = inseeCodes[0] || "";

      if (!inseeFromClic && selectedUfParcelles.length > 0) {
        console.error(
          "Code INSEE manquant pour les parcelles sélectionnées:",
          selectedUfParcelles
        );
        alert(
          "Impossible de créer l'unité foncière : code INSEE manquant. Veuillez d'abord sélectionner une commune."
        );
        setLoading(false);
        return;
      }

      if (selectedUfParcelles.length > 0 && !inseeFromClic) {
        console.error(
          "Erreur : parcelles sélectionnées sans code INSEE",
          selectedUfParcelles
        );
        alert(
          "Erreur : les parcelles sélectionnées n'ont pas de code INSEE. Veuillez réessayer en sélectionnant d'abord une commune."
        );
        setLoading(false);
        return;
      }

      // Commune : toujours Latresne pour cette application (fallback sur celle du clic si fournie)
      const communeValue =
        selectedUfParcelles.length > 0
          ? selectedUfParcelles[0].commune || "Latresne"
          : "Latresne";

      const parcellesManuelles = ufParcelles
        .map((p) => ({
          section: p.section.trim().toUpperCase(),
          numero: padNumero(p.numero),
        }))
        .filter((p) => p.section && p.numero);

      const parcellesClic = selectedUfParcelles.map((p) => ({
        section: p.section.trim().toUpperCase(),
        numero: padNumero(p.numero),
      }));

      const parcellesPayload = [...parcellesManuelles, ...parcellesClic];
      const uniqueParcelles = Array.from(
        new Map(
          parcellesPayload.map((p) => [`${p.section}-${p.numero}`, p])
        ).values()
      );

      const requestBody: {
        commune?: string;
        code_insee?: string;
        parcelles: Array<{ section: string; numero: string }>;
      } = {
        parcelles: uniqueParcelles,
      };

      if (inseeFromClic) {
        requestBody.code_insee = inseeFromClic;
      }

      if (communeValue) {
        requestBody.commune = communeValue;
      } else if (!inseeFromClic) {
        alert(
          "Impossible de créer l'unité foncière : veuillez sélectionner une commune ou des parcelles sur la carte."
        );
        setLoading(false);
        return;
      }

      console.log("📤 Création UF - Requête envoyée:", {
        commune: communeValue,
        code_insee: inseeFromClic || "NON DISPONIBLE",
        parcelles: uniqueParcelles.map((p) => `${p.section} ${p.numero}`),
        selectedUfParcelles: selectedUfParcelles.map((p) => ({
          section: p.section,
          numero: p.numero,
          commune: p.commune,
          insee: p.insee || "MANQUANT",
        })),
        requestBody: requestBody,
      });

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/parcelle/uf-geometrie`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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

      const finalInsee = feature.properties.insee || inseeFromClic || "";
      const finalCommune = feature.properties.commune || communeValue;

      if (!finalInsee) {
        alert(
          "Impossible de créer l'unité foncière : code INSEE manquant dans la réponse du serveur."
        );
        setLoading(false);
        return;
      }

      console.log("UF créée avec:", {
        insee: finalInsee,
        commune: finalCommune,
        parcelles: uniqueParcelles.length,
      });

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
    } catch (err: any) {
      console.error("Erreur lors de la confirmation de l'UF:", err);
      alert(
        `Erreur : ${err.message || "Impossible de créer l'unité foncière"}`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`${
        embedded ? "" : "absolute top-4 left-4 z-40"
      } bg-white shadow-md rounded-md p-3 text-sm ${
        embedded ? "w-full" : "w-80"
      } space-y-3`}
    >
      <div className="font-semibold">1. Construire une unité foncière</div>

      {/* Toggle pour activer la sélection par clic */}
      <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200">
        <input
          type="checkbox"
          id="uf-click-mode"
          checked={ufBuilderMode}
          onChange={(e) => onUfBuilderToggle?.(e.target.checked)}
          className="w-4 h-4"
        />
        <label
          htmlFor="uf-click-mode"
          className="text-xs cursor-pointer flex-1"
        >
          Sélectionner par clic sur la carte
        </label>
      </div>

      {/* Liste des parcelles (manuelles + sélectionnées par clic) */}
      {allUfParcelles.length > 0 && (
        <div className="space-y-1 bg-gray-50 p-2 rounded">
          <div className="text-xs font-medium mb-1 text-gray-700">
            Parcelles ({allUfParcelles.length}/20)
          </div>
          {allUfParcelles.map((p, idx) => (
            <div
              key={`${p.section}-${p.numero}-${idx}`}
              className="flex items-center gap-2 text-xs bg-white px-2 py-1 rounded border"
            >
              <span className="font-mono flex-1">
                {p.section} {p.numero}
              </span>
              {p.source === "click" && (
                <span className="text-amber-600 text-xs">(clic)</span>
              )}
              {p.source === "click" && onUfParcelleRemove && (
                <button
                  type="button"
                  className="px-1 py-0.5 text-xs border rounded hover:bg-red-50 hover:text-red-600"
                  onClick={() => onUfParcelleRemove(p.section, p.numero)}
                  title="Retirer"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Champs de saisie manuelle */}
      <div className="space-y-2">
        {ufParcelles.map((p, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              className="w-20 border px-2 py-1 rounded text-xs"
              placeholder="Section"
              value={p.section}
              onChange={(e) => updateUfParcelle(idx, "section", e.target.value)}
            />
            <input
              className="flex-1 border px-2 py-1 rounded text-xs"
              placeholder="Numéro"
              value={p.numero}
              onChange={(e) => updateUfParcelle(idx, "numero", e.target.value)}
            />
            <button
              type="button"
              className="px-2 py-1 text-xs border rounded hover:bg-gray-100"
              onClick={() => {
                const s = p.section.trim().toUpperCase();
                const n = padNumero(p.numero);
                if (!s || !n) return;
                onAddManualUfParcelleToMap?.(s, n);
              }}
              title="Ajouter à l'unité foncière (carte)"
            >
              +
            </button>
            {ufParcelles.length > 1 && (
              <button
                type="button"
                className="px-2 py-1 text-xs border rounded hover:bg-gray-100"
                onClick={() => removeUfParcelle(idx)}
              >
                -
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="w-full border border-dashed px-2 py-1 rounded text-xs hover:bg-gray-50"
        onClick={addUfParcelle}
      >
        + Ajouter une parcelle (saisie manuelle)
      </button>

      {/* Bouton pour confirmer l'UF */}
      {allUfParcelles.length >= 2 && (
        <button
          type="button"
          className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded text-sm font-medium transition-colors"
          disabled={loading}
          onClick={confirmUF}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
              <span>Validation…</span>
            </span>
          ) : (
            "2. Confirmer l'unité foncière"
          )}
        </button>
      )}
    </div>
  );
}

