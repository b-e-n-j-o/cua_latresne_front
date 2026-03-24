import { useState, useEffect, useRef } from "react";
import { FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import supabase from "../../../supabaseClient";

type Props = {
  result: any;
  file?: File | null;
  onBack?: () => void;
  onDataChange?: (data: any) => void;
  onPipelineCreated?: (slug: string) => void;
};

type Parcelle = {
  section: string;
  numero: string;
  surface_m2?: number;
};

export function ValidationView({ result, file, onBack, onDataChange, onPipelineCreated }: Props) {
  const { data: initialData, alerts } = result;
  const LATRESNE_INSEE = "33234";

  const handleVisualiser = () => {
    if (!file) return;
    
    // Créer une URL d'objet à partir du fichier
    const objectUrl = URL.createObjectURL(file);
    
    // Ouvrir le PDF dans un nouvel onglet
    const newWindow = window.open(objectUrl, '_blank');
    
    // Nettoyer l'URL après un délai pour libérer la mémoire
    if (newWindow) {
      newWindow.addEventListener('beforeunload', () => {
        URL.revokeObjectURL(objectUrl);
      });
    } else {
      // Si la fenêtre n'a pas pu s'ouvrir (popup bloquée), nettoyer immédiatement
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
  };

  // État local pour les données modifiables
  const [infoGenerales, setInfoGenerales] = useState({
    ...initialData.info_generales,
    commune_insee: LATRESNE_INSEE,
  });
  const [demandeur, setDemandeur] = useState(initialData.info_generales.demandeur);
  const [adresseTerrain, setAdresseTerrain] = useState(initialData.info_generales.adresse_terrain || {});
  const [parcelles, setParcelles] = useState<Parcelle[]>(
    initialData.parcelles_detectees.references_cadastrales || []
  );

  // Recalculer la superficie totale quand les parcelles changent
  const superficieTotale = parcelles.reduce(
    (sum, p) => sum + (p.surface_m2 || 0),
    0
  );

  // Ref pour éviter les appels multiples
  const isInitialMount = useRef(true);

  // État pour la génération de CUA
  const [jobId, setJobId] = useState<string | null>(null);
  const [cuaStatus, setCuaStatus] = useState<string | null>(null);
  const [cuaError, setCuaError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [cuaViewerUrl, setCuaViewerUrl] = useState<string | null>(null);
  const uploadedCerfaForSlugRef = useRef<string | null>(null);
  const notifiedPipelineSlugRef = useRef<string | null>(null);

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
        console.error("Erreur récupération session Supabase dans ValidationView", e);
      }
    })();
  }, []);

  // Notifier le parent des changements
  useEffect(() => {
    // Ignorer le premier rendu pour éviter les appels inutiles
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (onDataChange) {
      const updatedData = {
        ...initialData,
        info_generales: {
          ...infoGenerales,
          commune_insee: LATRESNE_INSEE,
          demandeur,
          adresse_terrain: adresseTerrain,
        },
        parcelles_detectees: {
          references_cadastrales: parcelles,
          superficie_totale_m2: superficieTotale,
        },
      };
      onDataChange(updatedData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infoGenerales, demandeur, adresseTerrain, parcelles, superficieTotale]);

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

  function updateParcelle(index: number, field: keyof Parcelle, value: string | number) {
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
    setParcelles((prev) => [...prev, { section: "", numero: "", surface_m2: 0 }]);
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
          const resolvedSlug =
            data.slug ||
            data.pipeline_slug ||
            data.result?.slug ||
            data.result?.pipeline_slug ||
            data.result_enhanced?.slug ||
            data.result_enhanced?.pipeline_slug ||
            null;
          console.log("[CUA] status success (validation)", {
            jobId,
            resolvedSlug,
            rawData: data,
          });
          setSlug(resolvedSlug);
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

  useEffect(() => {
    if (!slug || !onPipelineCreated || notifiedPipelineSlugRef.current === slug) return;
    console.log("[CUA] onPipelineCreated (validation)", { slug });
    notifiedPipelineSlugRef.current = slug;
    onPipelineCreated(slug);
  }, [slug, onPipelineCreated]);

  useEffect(() => {
    if (!file || !slug || uploadedCerfaForSlugRef.current === slug) return;

    const uploadCerfaPdf = async () => {
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("file_kind", "cerfa_pdf");
        if (userId) form.append("user_id", userId);

        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/pipelines/${encodeURIComponent(slug)}/files/upload`,
          { method: "POST", body: form }
        );
        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || "Upload PDF CERFA impossible");
        }
        uploadedCerfaForSlugRef.current = slug;
      } catch (e) {
        // Non bloquant: le pipeline doit rester fonctionnel même sans PDF CERFA.
        console.warn("[CUA] Upload optionnel du PDF CERFA non réalisé:", e);
      }
    };

    uploadCerfaPdf();
  }, [file, slug, userId]);

  const handleGenerateCUA = async () => {
    // Valider les données
    const validParcelles = parcelles.filter(
      (p) => p.section && p.numero && p.section.trim() && p.numero.trim()
    );

    if (validParcelles.length === 0) {
      alert("Veuillez ajouter au moins une parcelle valide avant de générer le CUA");
      return;
    }

    const insee = "33234"; // Application dédiée à Latresne
    const commune = infoGenerales.commune_nom || "";

    if (!insee) {
      alert("Code INSEE manquant. Veuillez renseigner la commune.");
      return;
    }

    // Construire l'objet demandeur à partir de l'état local
    // On conserve l'ensemble des champs (type, prénom/nom, dénomination, représentant, SIRET, adresse complète, email, téléphone, etc.)
    const demandeurData: any = {
      ...(demandeur || {}),
      type: demandeur?.type || "particulier",
    };

    // Réinitialiser l'état
    setJobId(null);
    setCuaStatus(null);
    setCuaError(null);
    setSlug(null);
    setCuaViewerUrl(null);

    try {
      // Construire un objet "data" au format attendu par le CUA (ancien cerfa_result.data)
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
        user_id: userId || undefined,
        user_email: userEmail || undefined,
      };

      // Log côté front pour tracer le pont vers le backend
      console.log("[CUA] Envoi analyze-parcelles-with-json-data", {
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
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
        <div className="flex items-center gap-2">
          {file && (
            <button
              type="button"
              onClick={handleVisualiser}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              📄 Visualiser le PDF
            </button>
          )}
        </div>
      </div>

      {/* Alertes */}
      {alerts && alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-2 space-y-1">
          <div className="text-xs font-semibold text-amber-800 mb-1">
            ⚠️ Alertes ({alerts.length})
          </div>
          {alerts.map((a: string, i: number) => (
            <div key={i} className="text-xs text-amber-700">
              {a}
            </div>
          ))}
        </div>
      )}

      {/* Informations générales */}
      <div className="space-y-2">
        <div className="bg-gray-50 border border-gray-200 rounded p-2">
          <div className="text-xs font-semibold text-gray-700 mb-2">
            3. Informations générales
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
                value={LATRESNE_INSEE}
                readOnly
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono bg-gray-100 text-gray-700"
                placeholder="33234"
              />
            </div>
          </div>
        </div>

        {/* Demandeur */}
        <div className="bg-blue-50 border border-blue-200 rounded p-2">
          <div className="text-xs font-semibold text-blue-800 mb-2">Demandeur</div>
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
              <label className="block text-blue-700 mb-0.5">Dénomination (personne morale)</label>
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
                <label className="block text-blue-700 mb-0.5">Représentant - Prénom</label>
                <input
                  type="text"
                  value={demandeur.representant_prenom || ""}
                  onChange={(e) => updateDemandeur("representant_prenom", e.target.value)}
                  className="w-full border border-blue-300 rounded px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="block text-blue-700 mb-0.5">Représentant - Nom</label>
                <input
                  type="text"
                  value={demandeur.representant_nom || ""}
                  onChange={(e) => updateDemandeur("representant_nom", e.target.value)}
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
                  onChange={(e) => updateDemandeurAdresse("numero", e.target.value)}
                  className="w-full border border-blue-300 rounded px-2 py-1 text-xs"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-blue-700 mb-0.5">Voie</label>
                <input
                  type="text"
                  value={demandeur.adresse?.voie || ""}
                  onChange={(e) => updateDemandeurAdresse("voie", e.target.value)}
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
                onChange={(e) => updateDemandeurAdresse("code_postal", e.target.value)}
                className="w-full border border-blue-300 rounded px-2 py-1 text-xs"
                placeholder="33360"
              />
            </div>
            <div>
              <label className="block text-blue-700 mb-0.5">Ville</label>
              <input
                type="text"
                value={demandeur.adresse?.ville || ""}
                onChange={(e) => updateDemandeurAdresse("ville", e.target.value)}
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
                  onChange={(e) => updateDemandeurAdresse("email", e.target.value)}
                  className="w-full border border-blue-300 rounded px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="block text-blue-700 mb-0.5">Téléphone</label>
                <input
                  type="tel"
                  value={demandeur.adresse?.telephone || ""}
                  onChange={(e) => updateDemandeurAdresse("telephone", e.target.value)}
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
                  onChange={(e) => updateAdresseTerrain("numero", e.target.value)}
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
                onChange={(e) => updateAdresseTerrain("lieu_dit", e.target.value)}
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
                onChange={(e) => updateAdresseTerrain("code_postal", e.target.value)}
                className="w-full border border-green-300 rounded px-2 py-1 text-xs"
                placeholder="33610"
              />
            </div>
          </div>
        </div>

        {/* Parcelles détectées */}
        <div className="bg-amber-50 border border-amber-200 rounded p-2">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-amber-800">
              Parcelles détectées ({parcelles.length})
            </div>
            <button
              type="button"
              onClick={addParcelle}
              className="text-xs px-2 py-0.5 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
            >
              + Ajouter
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {parcelles.map((p, i) => (
              <div
                key={i}
                className="bg-white rounded p-2 border border-amber-100 text-xs"
              >
                <div className="flex items-center gap-2 mb-1">
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
                  <button
                    type="button"
                    onClick={() => removeParcelle(i)}
                    className="px-2 py-0.5 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors"
                    title="Supprimer"
                  >
                    ×
                  </button>
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
              <span className="font-medium text-amber-800">Superficie totale :</span>{" "}
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
              {'4. Vérification des parcelles : ' + parcelles.filter((p) => p.section && p.numero).length + ' parcelle(s) valide(s) :'}
            </span>{" "}
            {parcelles
              .filter((p) => p.section && p.numero)
              .map((p) => `${p.section} ${p.numero}`)
              .join(", ")}
            <span className="block mt-1 text-gray-500">
              5. Code INSEE : {LATRESNE_INSEE}
            </span>
          </div>
        )}

        {!jobId && !slug ? (
          <button
            onClick={handleGenerateCUA}
            disabled={parcelles.filter((p) => p.section && p.numero).length === 0}
            className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-2"
          >
            <FileText className="w-3 h-3" />
            6. Générer le CUA
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

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-gray-200">
        {onBack && (
          <button
            onClick={onBack}
            className="flex-1 text-xs px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Retour
          </button>
        )}
      </div>
    </div>
  );
}
