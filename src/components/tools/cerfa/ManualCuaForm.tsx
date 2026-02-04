import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import supabase from "../../../supabaseClient";

type Parcelle = {
  section: string;
  numero: string;
  surface_m2?: number;
};

type UFParcelle = {
  section: string;
  numero: string;
};

type Props = {
  ufParcelles?: UFParcelle[];
  unionGeometry?: GeoJSON.Geometry;
  onParcellesDetected?: (
    parcelles: Array<{
      section: string;
      numero: string;
      surface_m2?: number;
    }>,
    commune: string,
    insee: string
  ) => void;
};

export function ManualCuaForm({ ufParcelles, unionGeometry, onParcellesDetected }: Props) {
  // État local pour les données modifiables (initialisées vides)
  const [infoGenerales, setInfoGenerales] = useState<any>({
    numero_cu: "",
    type_cu: "",
    date_depot: "",
    commune_nom: "Latresne",
    commune_insee: "33234",
  });

  const [demandeur, setDemandeur] = useState<any>({
    type: "",
    prenom: "",
    nom: "",
    denomination: "",
    representant_prenom: "",
    representant_nom: "",
    siret: "",
    adresse: {
      numero: "",
      voie: "",
      code_postal: "",
      ville: "",
      email: "",
      telephone: "",
    },
  });

  const [adresseTerrain, setAdresseTerrain] = useState<any>({
    numero: "",
    voie: "",
    lieu_dit: "",
    ville: "Latresne",
    code_postal: "33610",
  });

  const [parcelles, setParcelles] = useState<Parcelle[]>(
    ufParcelles?.map((p) => ({
      section: p.section,
      numero: p.numero,
    })) || [{ section: "", numero: "" }]
  );

  const isUFMode = !!ufParcelles;

  // Recalculer la superficie totale quand les parcelles changent
  const superficieTotale = parcelles.reduce(
    (sum, p) => sum + (p.surface_m2 || 0),
    0
  );

  // Ref pour éviter les appels multiples inutiles
  const isInitialMount = useRef(true);

  // État pour la génération de CUA
  const [jobId, setJobId] = useState<string | null>(null);
  const [cuaStatus, setCuaStatus] = useState<string | null>(null);
  const [cuaError, setCuaError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [cuaViewerUrl, setCuaViewerUrl] = useState<string | null>(null);

  // Utilisateur connecté (pour associer le pipeline à l'historique)
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const user = sess.session?.user;
        if (user) {
          setUserId(user.id || null);
          setUserEmail(user.email || null);
        }
      } catch (e) {
        console.error(
          "Erreur récupération session Supabase dans ManualCuaForm",
          e
        );
      }
    })();
  }, []);

  // Notifier la carte quand les parcelles / commune changent
  useEffect(() => {
    if (!onParcellesDetected) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const validParcelles = parcelles.filter(
      (p) => p.section && p.numero && p.section.trim() && p.numero.trim()
    );

    if (validParcelles.length === 0) return;

    const commune = infoGenerales.commune_nom || "";
    const insee = infoGenerales.commune_insee || "";
    if (!commune || !insee) return;

    onParcellesDetected(validParcelles, commune, insee);
  }, [parcelles, infoGenerales.commune_nom, infoGenerales.commune_insee, onParcellesDetected]);

  function updateInfoGenerales(field: string, value: string) {
    setInfoGenerales((prev: any) => ({ ...prev, [field]: value }));
  }

  function updateDemandeur(field: string, value: string) {
    setDemandeur((prev: any) => ({ ...prev, [field]: value }));
  }

  function updateDemandeurAdresse(field: string, value: string) {
    setDemandeur((prev: any) => ({
      ...prev,
      adresse: { ...(prev.adresse || {}), [field]: value },
    }));
  }

  function updateAdresseTerrain(field: string, value: string) {
    setAdresseTerrain((prev: any) => ({ ...prev, [field]: value }));
  }

  function updateParcelle(
    index: number,
    field: keyof Parcelle,
    value: string | number
  ) {
    setParcelles((prev) =>
      prev.map((p, i) =>
        i === index
          ? {
              ...p,
              [field]:
                field === "section"
                  ? String(value).toUpperCase()
                  : field === "surface_m2"
                  ? Number(value) || 0
                  : value,
            }
          : p
      )
    );
  }

  function addParcelle() {
    setParcelles((prev) => [
      ...prev,
      { section: "", numero: "", surface_m2: 0 },
    ]);
  }

  function removeParcelle(index: number) {
    setParcelles((prev) => prev.filter((_, i) => i !== index));
  }

  // Polling du statut du job CUA
  useEffect(() => {
    if (!jobId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/status/${jobId}`
        );
        const data = await res.json();

        setCuaStatus(data.status);

        if (data.status === "success") {
          setSlug(data.slug);
          if (data.result_enhanced?.cua_viewer_url) {
            setCuaViewerUrl(data.result_enhanced.cua_viewer_url);
          }
          clearInterval(pollInterval);
        } else if (data.status === "error") {
          setCuaError(data.error || "Erreur lors de la génération");
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error("Erreur polling:", err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [jobId]);

  const handleGenerateCUA = async () => {
    // Valider les données
    const validParcelles = parcelles.filter(
      (p) => p.section && p.numero && p.section.trim() && p.numero.trim()
    );

    if (validParcelles.length === 0) {
      alert(
        "Veuillez ajouter au moins une parcelle valide avant de générer le CUA"
      );
      return;
    }

    const insee = infoGenerales.commune_insee || "33234"; // Fallback sur Latresne
    const commune = infoGenerales.commune_nom || "";

    if (!insee) {
      alert("Code INSEE manquant. Veuillez renseigner la commune.");
      return;
    }

    // Construire l'objet demandeur à partir de l'état local
    const demandeurData: any = {
      ...(demandeur || {}),
      type: demandeur?.type || "particulier",
    };

    // Réinitialiser l'état de génération
    setJobId(null);
    setCuaStatus(null);
    setCuaError(null);
    setSlug(null);
    setCuaViewerUrl(null);

    try {
      // Construire un objet "data" au format attendu par le CUA
      const cerfaDataForBuilder = {
        ...infoGenerales,
        demandeur: demandeurData,
        adresse_terrain: adresseTerrain,
        references_cadastrales: validParcelles,
        superficie_totale_m2: validParcelles.reduce(
          (sum, p) => sum + (p.surface_m2 || 0),
          0
        ),
      };

      const requestBody = {
        parcelles: validParcelles.map((p) => ({
          section: p.section.trim().toUpperCase(),
          numero: p.numero.trim(),
        })),
        code_insee: insee,
        commune_nom: commune,
        cerfa_data: cerfaDataForBuilder,
        union_geometry: unionGeometry,
        user_id: userId || undefined,
        user_email: userEmail || undefined,
      };

      console.log("[CUA] Envoi manual analyze-parcelles-with-json-data", {
        parcelles: requestBody.parcelles,
        code_insee: requestBody.code_insee,
        commune_nom: requestBody.commune_nom,
        cerfa_data_keys: Object.keys(cerfaDataForBuilder || {}),
      });

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE}/analyze-parcelles-with-json-data`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        throw new Error("Erreur lors du lancement de la génération");
      }

      const data = await response.json();
      setJobId(data.job_id);
      setCuaStatus("queued");
    } catch (err) {
      setCuaError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  return (
    <div className="space-y-3 mt-3 border-t border-gray-100 pt-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-800">
          Saisie manuelle (sans CERFA)
        </h4>
      </div>

      {/* Informations générales */}
      <div className="space-y-2">
        <div className="bg-gray-50 border border-gray-200 rounded p-2">
          <div className="text-xs font-semibold text-gray-700 mb-2">
            Informations générales
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <label className="block text-gray-600 mb-0.5">N° CU</label>
              <input
                type="text"
                value={infoGenerales.numero_cu || ""}
                onChange={(e) => updateInfoGenerales("numero_cu", e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                placeholder="033-234-2024-X00078"
              />
            </div>
            <div>
              <label className="block text-gray-600 mb-0.5">Type</label>
              <select
                value={infoGenerales.type_cu || ""}
                onChange={(e) => updateInfoGenerales("type_cu", e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
              >
                <option value="">Sélectionner</option>
                <option value="CUa">CUa</option>
                <option value="CUb">CUb</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-600 mb-0.5">Date dépôt</label>
              <input
                type="date"
                value={infoGenerales.date_depot || ""}
                onChange={(e) => updateInfoGenerales("date_depot", e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="block text-gray-600 mb-0.5">Commune</label>
              <input
                type="text"
                value={infoGenerales.commune_nom || ""}
                onChange={(e) => updateInfoGenerales("commune_nom", e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                placeholder="Latresne"
              />
            </div>
            <div>
              <label className="block text-gray-600 mb-0.5">Code INSEE</label>
              <input
                type="text"
                value={infoGenerales.commune_insee || ""}
                onChange={(e) =>
                  updateInfoGenerales("commune_insee", e.target.value)
                }
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                placeholder="33234"
              />
            </div>
          </div>
        </div>

        {/* Demandeur */}
        <div className="bg-blue-50 border border-blue-200 rounded p-2">
          <div className="text-xs font-semibold text-blue-800 mb-2">
            Demandeur
          </div>
          <div className="space-y-2 text-xs">
            {/* Type de demandeur */}
            <div>
              <label className="block text-blue-700 mb-0.5">Type</label>
              <select
                value={demandeur.type || ""}
                onChange={(e) => updateDemandeur("type", e.target.value)}
                className="w-full border border-blue-300 rounded px-2 py-1 text-xs"
              >
                <option value="">Sélectionner</option>
                <option value="particulier">Particulier</option>
                <option value="personne_morale">Personne morale</option>
              </select>
            </div>

            {/* Personne physique */}
            <div>
              <label className="block text-blue-700 mb-0.5">Prénom</label>
              <input
                type="text"
                value={demandeur.prenom || ""}
                onChange={(e) => updateDemandeur("prenom", e.target.value)}
                className="w-full border border-blue-300 rounded px-2 py-1 text-xs"
                placeholder="Jean"
              />
            </div>
            <div>
              <label className="block text-blue-700 mb-0.5">Nom</label>
              <input
                type="text"
                value={demandeur.nom || ""}
                onChange={(e) => updateDemandeur("nom", e.target.value)}
                className="w-full border border-blue-300 rounded px-2 py-1 text-xs"
                placeholder="DUPONT"
              />
            </div>

            {/* Personne morale */}
            <div>
              <label className="block text-blue-700 mb-0.5">
                Dénomination (personne morale)
              </label>
              <input
                type="text"
                value={demandeur.denomination || ""}
                onChange={(e) => updateDemandeur("denomination", e.target.value)}
                className="w-full border border-blue-300 rounded px-2 py-1 text-xs"
                placeholder="Raison sociale"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-blue-700 mb-0.5">
                  Représentant - Prénom
                </label>
                <input
                  type="text"
                  value={demandeur.representant_prenom || ""}
                  onChange={(e) =>
                    updateDemandeur("representant_prenom", e.target.value)
                  }
                  className="w-full border border-blue-300 rounded px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="block text-blue-700 mb-0.5">
                  Représentant - Nom
                </label>
                <input
                  type="text"
                  value={demandeur.representant_nom || ""}
                  onChange={(e) =>
                    updateDemandeur("representant_nom", e.target.value)
                  }
                  className="w-full border border-blue-300 rounded px-2 py-1 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-blue-700 mb-0.5">SIRET</label>
              <input
                type="text"
                value={demandeur.siret || ""}
                onChange={(e) => updateDemandeur("siret", e.target.value)}
                className="w-full border border-blue-300 rounded px-2 py-1 text-xs font-mono"
                placeholder="30491458300022"
              />
            </div>

            {/* Adresse du demandeur */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-blue-700 mb-0.5">N°</label>
                <input
                  type="text"
                  value={demandeur.adresse?.numero || ""}
                  onChange={(e) =>
                    updateDemandeurAdresse("numero", e.target.value)
                  }
                  className="w-full border border-blue-300 rounded px-2 py-1 text-xs"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-blue-700 mb-0.5">Voie</label>
                <input
                  type="text"
                  value={demandeur.adresse?.voie || ""}
                  onChange={(e) =>
                    updateDemandeurAdresse("voie", e.target.value)
                  }
                  className="w-full border border-blue-300 rounded px-2 py-1 text-xs"
                  placeholder="allées de Chartres"
                />
              </div>
            </div>
            <div>
              <label className="block text-blue-700 mb-0.5">Code postal</label>
              <input
                type="text"
                value={demandeur.adresse?.code_postal || ""}
                onChange={(e) =>
                  updateDemandeurAdresse("code_postal", e.target.value)
                }
                className="w-full border border-blue-300 rounded px-2 py-1 text-xs"
                placeholder="33360"
              />
            </div>
            <div>
              <label className="block text-blue-700 mb-0.5">Ville</label>
              <input
                type="text"
                value={demandeur.adresse?.ville || ""}
                onChange={(e) =>
                  updateDemandeurAdresse("ville", e.target.value)
                }
                className="w-full border border-blue-300 rounded px-2 py-1 text-xs"
                placeholder="Latresne"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-blue-700 mb-0.5">Email</label>
                <input
                  type="email"
                  value={demandeur.adresse?.email || ""}
                  onChange={(e) =>
                    updateDemandeurAdresse("email", e.target.value)
                  }
                  className="w-full border border-blue-300 rounded px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="block text-blue-700 mb-0.5">Téléphone</label>
                <input
                  type="tel"
                  value={demandeur.adresse?.telephone || ""}
                  onChange={(e) =>
                    updateDemandeurAdresse("telephone", e.target.value)
                  }
                  className="w-full border border-blue-300 rounded px-2 py-1 text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Adresse terrain */}
        <div className="bg-green-50 border border-green-200 rounded p-2">
          <div className="text-xs font-semibold text-green-800 mb-2">
            Adresse du terrain
          </div>
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-green-700 mb-0.5">N°</label>
                <input
                  type="text"
                  value={adresseTerrain.numero || ""}
                  onChange={(e) =>
                    updateAdresseTerrain("numero", e.target.value)
                  }
                  className="w-full border border-green-300 rounded px-2 py-1 text-xs"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-green-700 mb-0.5">Voie</label>
                <input
                  type="text"
                  value={adresseTerrain.voie || ""}
                  onChange={(e) => updateAdresseTerrain("voie", e.target.value)}
                  className="w-full border border-green-300 rounded px-2 py-1 text-xs"
                  placeholder="Allee du Bastard"
                />
              </div>
            </div>
            <div>
              <label className="block text-green-700 mb-0.5">Lieu-dit</label>
              <input
                type="text"
                value={adresseTerrain.lieu_dit || ""}
                onChange={(e) =>
                  updateAdresseTerrain("lieu_dit", e.target.value)
                }
                className="w-full border border-green-300 rounded px-2 py-1 text-xs"
                placeholder="Les Hauts de Latresne"
              />
            </div>
            <div>
              <label className="block text-green-700 mb-0.5">Ville</label>
              <input
                type="text"
                value={adresseTerrain.ville || ""}
                onChange={(e) => updateAdresseTerrain("ville", e.target.value)}
                className="w-full border border-green-300 rounded px-2 py-1 text-xs"
                placeholder="Latresne"
              />
            </div>
            <div>
              <label className="block text-green-700 mb-0.5">Code postal</label>
              <input
                type="text"
                value={adresseTerrain.code_postal || ""}
                onChange={(e) =>
                  updateAdresseTerrain("code_postal", e.target.value)
                }
                className="w-full border border-green-300 rounded px-2 py-1 text-xs"
                placeholder="33610"
              />
            </div>
          </div>
        </div>

        {/* Parcelles */}
        <div className="bg-amber-50 border border-amber-200 rounded p-2">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-amber-800">
              Parcelles ({parcelles.length})
            </div>
            {!isUFMode && (
              <button
                type="button"
                onClick={addParcelle}
                className="text-xs px-2 py-0.5 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
              >
                + Ajouter
              </button>
            )}
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {parcelles.map((p, i) => (
              <div
                key={i}
                className="bg-white rounded p-2 border border-amber-100 text-xs space-y-1"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={p.section}
                    onChange={(e) => updateParcelle(i, "section", e.target.value)}
                    placeholder="Section"
                    className="w-16 border border-amber-300 rounded px-1.5 py-0.5 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={p.numero}
                    onChange={(e) => updateParcelle(i, "numero", e.target.value)}
                    placeholder="Numéro"
                    className="flex-1 border border-amber-300 rounded px-1.5 py-0.5 text-xs font-mono"
                  />
                  {!isUFMode && (
                    <button
                      type="button"
                      onClick={() => removeParcelle(i)}
                      className="px-2 py-0.5 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors"
                      title="Supprimer"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
            {parcelles.length === 0 && (
              <div className="text-xs text-amber-600 italic text-center py-2">
                Aucune parcelle. Cliquez sur "+ Ajouter" pour en ajouter une.
              </div>
            )}
          </div>
          {superficieTotale > 0 && (
            <div className="mt-2 pt-2 border-t border-amber-200 text-xs">
              <span className="font-medium text-amber-800">
                Superficie totale :
              </span>{" "}
              <span className="text-amber-900">
                {superficieTotale.toLocaleString("fr-FR")} m²
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Génération CUA */}
      <div className="pt-2 border-t border-gray-200">
        <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
          <FileText className="w-3 h-3" />
          Génération du Certificat d'Urbanisme
        </h4>

        {/* Info sur les parcelles qui seront utilisées */}
        {parcelles.filter((p) => p.section && p.numero).length > 0 && (
          <div className="mb-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
            <span className="font-medium">
              {parcelles.filter((p) => p.section && p.numero).length} parcelle(s)
              valide(s) :
            </span>{" "}
            {parcelles
              .filter((p) => p.section && p.numero)
              .map((p) => `${p.section} ${p.numero}`)
              .join(", ")}
            {infoGenerales.commune_insee && (
              <span className="block mt-1 text-gray-500">
                Code INSEE : {infoGenerales.commune_insee}
              </span>
            )}
          </div>
        )}

        {!jobId && !slug ? (
          <button
            onClick={handleGenerateCUA}
            disabled={
              parcelles.filter((p) => p.section && p.numero).length === 0
            }
            className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-2"
          >
            <FileText className="w-3 h-3" />
            Générer le CUA
          </button>
        ) : cuaStatus === "success" && cuaViewerUrl ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-green-600 text-xs">
              <CheckCircle2 className="w-3 h-3" />
              <span>CUA généré avec succès</span>
            </div>
            <a
              href={cuaViewerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-2"
            >
              <FileText className="w-3 h-3" />
              Visualiser le CUA
            </a>
            <a
              href="/app"
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-2"
            >
              Ouvrir dans l'interface Kerelia (historique)
            </a>
          </div>
        ) : cuaStatus === "error" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-red-600 text-xs">
              <AlertCircle className="w-3 h-3" />
              <span>Échec de la génération</span>
            </div>
            <button
              onClick={handleGenerateCUA}
              className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-2"
            >
              Réessayer
            </button>
            {cuaError && (
              <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                {cuaError}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-blue-600 text-xs">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Génération du CUA en cours...</span>
          </div>
        )}
      </div>
    </div>
  );
}

