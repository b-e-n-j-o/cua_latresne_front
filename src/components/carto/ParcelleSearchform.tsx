import { useState, useEffect } from "react";

type Props = {
  onSearch: (data: any, addressPoint?: [number, number], keepSelection?: boolean) => void;
  ufBuilderMode?: boolean;
  selectedUfParcelles?: Array<{
    section: string;
    numero: string;
    commune: string;
    insee: string;
  }>;
  onUfBuilderToggle?: (active: boolean) => void;
  onUfParcelleRemove?: (section: string, numero: string) => void;
  onConfirmUF?: (parcelles: Array<{section: string; numero: string; commune: string; insee: string}>, unionGeometry: GeoJSON.Geometry, commune: string, insee: string) => void;
};

type Mode = "parcelle" | "adresse" | "uf";

type UFParcelle = {
  section: string;
  numero: string;
  source?: "manual" | "click"; // Pour distinguer les sources
};

export default function ParcelleSearchForm({ 
  onSearch, 
  ufBuilderMode = false,
  selectedUfParcelles = [],
  onUfBuilderToggle,
  onUfParcelleRemove,
  onConfirmUF
}: Props) {
  const [mode, setMode] = useState<Mode>("parcelle");
  const [loading, setLoading] = useState(false);

  // Parcelle & UF : commune (pas de valeur par défaut)
  const [commune, setCommune] = useState("");
  const [section, setSection] = useState("");
  const [numero, setNumero] = useState("");

  // Unité foncière : liste de parcelles (manuelles)
  const [ufParcelles, setUfParcelles] = useState<UFParcelle[]>([
    { section: "", numero: "", source: "manual" }
  ]);

  // Adresse
  const [adresse, setAdresse] = useState("");
  const [communeAdresse, setCommuneAdresse] = useState("");

  // Synchroniser les parcelles sélectionnées par clic avec l'état local
  useEffect(() => {
    if (mode === "uf" && selectedUfParcelles.length > 0) {
      // Les parcelles sélectionnées par clic sont déjà gérées par le parent
      // On ne fait que les afficher
    }
  }, [selectedUfParcelles, mode]);

  function addUfParcelle() {
    setUfParcelles((prev) => [...prev, { section: "", numero: "", source: "manual" }]);
  }

  function updateUfParcelle(index: number, field: keyof UFParcelle, value: string) {
    setUfParcelles((prev) =>
      prev.map((p, i) =>
        i === index
          ? {
              ...p,
              [field]: field === "section" ? value.toUpperCase() : value
            }
          : p
      )
    );
  }

  function removeUfParcelle(index: number) {
    setUfParcelles((prev) => prev.filter((_, i) => i !== index));
  }

  // Combiner les parcelles manuelles et celles sélectionnées par clic
  const allUfParcelles = [
    ...ufParcelles.filter(p => p.section && p.numero),
    ...selectedUfParcelles.map(p => ({ 
      section: p.section, 
      numero: p.numero, 
      source: "click" as const 
    }))
  ];

  // Fonction pour confirmer l'UF
  async function confirmUF() {
    if (allUfParcelles.length < 2) {
      alert("Une unité foncière doit contenir au moins 2 parcelles");
      return;
    }

    setLoading(true);
    try {
      // Récupérer le code INSEE depuis les parcelles sélectionnées par clic
      // (elles ont le code INSEE dans leur propriété insee)
      const inseeCodes = selectedUfParcelles
        .map(p => p.insee)
        .filter(insee => insee && insee.trim() !== "");
      
      // Vérifier que toutes les parcelles sélectionnées par clic ont le même code INSEE
      if (selectedUfParcelles.length > 0) {
        if (inseeCodes.length === 0) {
          alert("Impossible de créer l'unité foncière : les parcelles sélectionnées n'ont pas de code INSEE. Veuillez d'abord sélectionner une commune.");
          setLoading(false);
          return;
        }
        
        const uniqueInsee = [...new Set(inseeCodes)];
        if (uniqueInsee.length > 1) {
          alert("Impossible de créer l'unité foncière : les parcelles sélectionnées appartiennent à des communes différentes. Une unité foncière doit être dans la même commune.");
          setLoading(false);
          return;
        }
      }
      
      // Utiliser le code INSEE des parcelles sélectionnées par clic (ou celui de la première)
      const inseeFromClic = inseeCodes[0] || "";
      
      if (!inseeFromClic && selectedUfParcelles.length > 0) {
        console.error("Code INSEE manquant pour les parcelles sélectionnées:", selectedUfParcelles);
        alert("Impossible de créer l'unité foncière : code INSEE manquant. Veuillez d'abord sélectionner une commune.");
        setLoading(false);
        return;
      }
      
      // Si on a des parcelles sélectionnées par clic mais pas de code INSEE, c'est un problème
      if (selectedUfParcelles.length > 0 && !inseeFromClic) {
        console.error("Erreur : parcelles sélectionnées sans code INSEE", selectedUfParcelles);
        alert("Erreur : les parcelles sélectionnées n'ont pas de code INSEE. Veuillez réessayer en sélectionnant d'abord une commune.");
        setLoading(false);
        return;
      }
      
      // Utiliser la commune des parcelles sélectionnées par clic si disponible, sinon celle saisie manuellement
      const communeValue = selectedUfParcelles.length > 0 
        ? selectedUfParcelles[0].commune 
        : commune.trim();

      // Dédupliquer les parcelles
      const parcellesManuelles = ufParcelles
        .map((p) => ({
          section: p.section.trim().toUpperCase(),
          numero: p.numero.trim()
        }))
        .filter((p) => p.section && p.numero);

      const parcellesClic = selectedUfParcelles.map(p => ({
        section: p.section.trim().toUpperCase(),
        numero: p.numero.trim()
      }));

      const parcellesPayload = [...parcellesManuelles, ...parcellesClic];
      const uniqueParcelles = Array.from(
        new Map(parcellesPayload.map(p => [`${p.section}-${p.numero}`, p])).values()
      );

      // Si on a le code INSEE, on n'a pas besoin de la commune (mais on l'envoie quand même pour compatibilité)
      // Si on n'a pas le code INSEE mais qu'on a la commune, on l'utilise
      const requestBody: {
        commune?: string;
        code_insee?: string;
        parcelles: Array<{ section: string; numero: string }>;
      } = {
        parcelles: uniqueParcelles
      };
      
      // Ajouter le code INSEE si disponible (prioritaire)
      if (inseeFromClic) {
        requestBody.code_insee = inseeFromClic;
      }
      
      // Ajouter la commune seulement si on n'a pas de code INSEE, ou comme fallback
      if (communeValue) {
        requestBody.commune = communeValue;
      } else if (!inseeFromClic) {
        // Si ni commune ni code INSEE, c'est une erreur
        alert("Impossible de créer l'unité foncière : veuillez sélectionner une commune ou des parcelles sur la carte.");
        setLoading(false);
        return;
      }
      
      console.log("📤 Création UF - Requête envoyée:", {
        commune: communeValue,
        code_insee: inseeFromClic || "NON DISPONIBLE",
        parcelles: uniqueParcelles.map(p => `${p.section} ${p.numero}`),
        selectedUfParcelles: selectedUfParcelles.map(p => ({
          section: p.section,
          numero: p.numero,
          commune: p.commune,
          insee: p.insee || "MANQUANT"
        })),
        requestBody: requestBody
      });

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/parcelle/uf-geometrie`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: "Erreur inconnue" }));
        throw new Error(errorData.detail || `Erreur ${res.status}`);
      }

      const feature = await res.json();

      // Transformer en FeatureCollection pour compatibilité carte
      const geojson = {
        type: "FeatureCollection",
        features: [feature]
      };

      // Utiliser le code INSEE de la réponse, ou celui des parcelles sélectionnées par clic
      const finalInsee = feature.properties.insee || inseeFromClic || "";
      const finalCommune = feature.properties.commune || communeValue;
      
      if (!finalInsee) {
        alert("Impossible de créer l'unité foncière : code INSEE manquant dans la réponse du serveur.");
        setLoading(false);
        return;
      }

      console.log("UF créée avec:", {
        insee: finalInsee,
        commune: finalCommune,
        parcelles: uniqueParcelles.length
      });

      // Notifier le parent (UF confirmée) - passer les parcelles avec leur INSEE
      if (onConfirmUF) {
        onConfirmUF(
          uniqueParcelles.map(p => ({
            section: p.section,
            numero: p.numero,
            commune: finalCommune,
            insee: finalInsee // Utiliser le même INSEE pour toutes les parcelles
          })),
          feature.geometry,
          finalCommune,
          finalInsee
        );
      }

      // Affichage carte (ne pas réinitialiser selectedParcelle car onConfirmUF l'a déjà géré)
      onSearch(geojson, undefined, true);
    } catch (err: any) {
      console.error("Erreur lors de la confirmation de l'UF:", err);
      alert(`Erreur : ${err.message || "Impossible de créer l'unité foncière"}`);
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setLoading(true);
    try {
      let url = "";
      let addressPoint: [number, number] | undefined;
      let geojson: any;

      if (mode === "parcelle") {
        // Utiliser la commune saisie (pas de valeur par défaut)
        const communeValue = commune.trim();
        if (!communeValue) {
          alert("Veuillez saisir une commune");
          setLoading(false);
          return;
        }
        url =
          `${import.meta.env.VITE_API_BASE}/parcelle/et-voisins` +
          `?commune=${encodeURIComponent(communeValue)}` +
          `&section=${section}` +
          `&numero=${numero}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error();

        const data = await res.json();
        geojson = {
          type: data.type,
          features: data.features
        };
        addressPoint = data.address_point as [number, number] | undefined;
      } else if (mode === "adresse") {
        const q = `${adresse}, ${communeAdresse}`;
        url =
          `${import.meta.env.VITE_API_BASE}/parcelle/et-voisins-adresse` +
          `?adresse=${encodeURIComponent(q)}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error();

        const data = await res.json();
        geojson = {
          type: data.type,
          features: data.features
        };
        addressPoint = data.address_point as [number, number] | undefined;
      } else {
        // mode === "uf" - ne devrait pas arriver ici car le bouton Rechercher est caché en mode UF
        // La validation se fait via le bouton "Confirmer l'unité foncière"
        alert("Veuillez utiliser le bouton 'Confirmer l'unité foncière' pour valider l'UF.");
        setLoading(false);
        return;
      }

      onSearch(geojson, addressPoint);
    } catch {
      alert("Recherche impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute top-4 left-4 z-40 bg-white shadow-md rounded-md p-3 text-sm w-80 space-y-3">
      <div className="font-semibold">Rechercher une parcelle</div>

      {/* Onglets */}
      <div className="flex border rounded overflow-hidden">
        <button
          className={`flex-1 py-1 ${mode === "parcelle" ? "bg-black text-white" : ""}`}
          onClick={() => setMode("parcelle")}
        >
          Parcelle
        </button>
        <button
          className={`flex-1 py-1 ${mode === "adresse" ? "bg-black text-white" : ""}`}
          onClick={() => setMode("adresse")}
        >
          Adresse
        </button>
        <button
          className={`flex-1 py-1 ${mode === "uf" ? "bg-black text-white" : ""}`}
          onClick={() => setMode("uf")}
        >
          Unité foncière
        </button>
      </div>

      {/* Form Parcelle */}
      {mode === "parcelle" && (
        <>
          <input
            className="w-full border px-2 py-1 rounded"
            placeholder="Commune"
            value={commune}
            onChange={(e) => setCommune(e.target.value)}
          />
          <input
            className="w-full border px-2 py-1 rounded"
            placeholder="Section (ex: AC)"
            value={section}
            onChange={(e) => setSection(e.target.value.toUpperCase())}
          />
          <input
            className="w-full border px-2 py-1 rounded"
            placeholder="Numéro (ex: 42)"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
          />
        </>
      )}

      {/* Form Adresse */}
      {mode === "adresse" && (
        <>
          <input
            className="w-full border px-2 py-1 rounded"
            placeholder="Numéro et rue (ex : 12 rue des Malbecs)"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
          />
          <input
            className="w-full border px-2 py-1 rounded"
            placeholder="Commune ou code postal (ex : Latresne ou 33360)"
            value={communeAdresse}
            onChange={(e) => setCommuneAdresse(e.target.value)}
          />
        </>
      )}

      {/* Form Unité foncière */}
      {mode === "uf" && (
        <div className="space-y-2">
          <input
            className="w-full border px-2 py-1 rounded"
            placeholder="Commune (optionnel si sélection par clic)"
            value={commune}
            onChange={(e) => setCommune(e.target.value)}
          />

          {/* Toggle pour activer la sélection par clic */}
          <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200">
            <input
              type="checkbox"
              id="uf-click-mode"
              checked={ufBuilderMode}
              onChange={(e) => onUfBuilderToggle?.(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="uf-click-mode" className="text-xs cursor-pointer flex-1">
              Sélectionner par clic sur la carte
            </label>
          </div>

          {/* Liste des parcelles (manuelles + sélectionnées par clic) */}
          {allUfParcelles.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto pr-1 bg-gray-50 p-2 rounded">
              <div className="text-xs font-medium mb-1 text-gray-700">
                Parcelles ({allUfParcelles.length}/5)
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
          <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
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
            + Ajouter une parcelle (saisie)
          </button>

          {/* Bouton pour confirmer l'UF */}
          {allUfParcelles.length >= 2 && (
            <button
              type="button"
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded text-sm font-medium transition-colors"
              disabled={loading}
              onClick={confirmUF}
            >
              {loading ? "Validation…" : "Confirmer l'unité foncière"}
            </button>
          )}
        </div>
      )}

      {/* Bouton de recherche (uniquement pour parcelle et adresse) */}
      {mode !== "uf" && (
        <button
          className="w-full bg-black text-white py-1 rounded disabled:opacity-50"
          disabled={loading}
          onClick={submit}
        >
          {loading ? "Recherche…" : "Rechercher"}
        </button>
      )}
    </div>
  );
}
