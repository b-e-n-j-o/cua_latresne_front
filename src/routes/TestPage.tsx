import { useState, useCallback, useRef, useEffect } from "react";
import { Plus, X, Loader2, FileText, CheckCircle, AlertCircle, FileDown } from "lucide-react";
import { Editor } from "@tinymce/tinymce-react";
import supabase from "../supabaseClient";
import { useMeta } from "../hooks/useMeta";
import Map2DViewer from "../components/Map2dViewer";

const ENV_API_BASE = import.meta.env.VITE_API_BASE || "";

function encodeToken(obj: any): string {
  const json = JSON.stringify(obj);
  const utf8 = new TextEncoder().encode(json);
  let b64 = btoa(String.fromCharCode(...utf8));
  return b64;
}

interface Parcelle {
  section: string;
  numero: string;
}

type Status = "idle" | "running" | "done" | "error";

export default function TestPage() {
  useMeta({
    title: "Test — Analyse par parcelles | Kerelia",
    description: "Testez l'analyse de certificat d'urbanisme depuis une liste de parcelles",
  });

  const [parcelles, setParcelles] = useState<Parcelle[]>([{ section: "", numero: "" }]);
  const [codeInsee, setCodeInsee] = useState("33234");
  const [communeNom, setCommuneNom] = useState("Latresne");
  const [status, setStatus] = useState<Status>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cuaHtml, setCuaHtml] = useState<string | null>(null);
  const [cuaUrl, setCuaUrl] = useState<string | null>(null);
  const [carte2DUrl, setCarte2DUrl] = useState<string | null>(null);
  const [gpkgUrl, setGpkgUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string>("");

  const pollIntervalRef = useRef<number | null>(null);

  // Auth Supabase
  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;
      if (user) {
        setUserEmail(user.email || null);
        setUserId(user.id || null);
      }
    })();
  }, []);

  // Nettoyage polling
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const addParcelle = () => {
    setParcelles([...parcelles, { section: "", numero: "" }]);
  };

  const removeParcelle = (index: number) => {
    if (parcelles.length > 1) {
      setParcelles(parcelles.filter((_, i) => i !== index));
    }
  };

  const updateParcelle = (index: number, field: "section" | "numero", value: string) => {
    const updated = [...parcelles];
    updated[index][field] = value.toUpperCase();
    setParcelles(updated);
  };

  const pollStatus = useCallback((jobId: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    const base = ENV_API_BASE.replace(/\/$/, "");

    const intervalId = window.setInterval(async () => {
      try {
        const res = await fetch(`${base}/status/${jobId}`);
        const j = await res.json();

        if (typeof j.current_step === "string") {
          setCurrentStep(j.current_step);
        }

        if (j.status === "success") {
          clearInterval(intervalId);
          pollIntervalRef.current = null;
          setStatus("done");

          // Récupérer le slug et charger le CUA
          const slug = j?.result_enhanced?.slug;
          if (slug) {
            // Récupérer les infos du pipeline depuis Supabase
            try {
              const pipelineRes = await fetch(`${base}/pipelines/by_slug?slug=${slug}`);
              const pipelineData = await pipelineRes.json();
              
              if (pipelineData.success && pipelineData.pipeline?.output_cua) {
                const docxUrl = pipelineData.pipeline.output_cua;
                setCuaUrl(docxUrl);
                setCarte2DUrl(pipelineData.pipeline.carte_2d_url || null);
                setGpkgUrl(pipelineData.pipeline.intersections_gpkg_url || null);
                
                // Charger le HTML du CUA
                const idx = docxUrl.indexOf("/object/public/");
                if (idx !== -1) {
                  const internal = docxUrl.substring(idx + "/object/public/".length);
                  const token = encodeToken({ docx: internal });
                  
                  const htmlRes = await fetch(`${base}/cua/html?t=${encodeURIComponent(token)}`);
                  if (htmlRes.ok) {
                    const htmlData = await htmlRes.json();
                    setCuaHtml(htmlData.html || "");
                  }
                }
              }
            } catch (e) {
              console.error("Erreur chargement CUA:", e);
            }
          }
        }

        if (j.status === "error") {
          // Faux positif = on ignore
          if (j.error && j.error.includes("Aucune intersection")) {
            console.warn("⚠️ Faux positif ignoré:", j.error);
            return;
          }
          // Vraie erreur backend
          clearInterval(intervalId);
          pollIntervalRef.current = null;
          setStatus("error");
          setError(j.error || "Erreur pipeline");
          return;
        }
      } catch (err) {
        console.error("Erreur polling status:", err);
      }
    }, 1500);

    pollIntervalRef.current = intervalId;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const validParcelles = parcelles.filter(
      (p) => p.section.trim() && p.numero.trim()
    );

    if (validParcelles.length === 0) {
      setError("Veuillez saisir au moins une parcelle valide");
      return;
    }

    if (!codeInsee.trim()) {
      setError("Veuillez saisir le code INSEE");
      return;
    }

    setError(null);
    setStatus("running");
    setCuaHtml(null);
    setCuaUrl(null);
    setCarte2DUrl(null);
    setGpkgUrl(null);

    const base = ENV_API_BASE.replace(/\/$/, "");
    if (!base) {
      setError("Backend non configuré");
      setStatus("error");
      return;
    }

    try {
      const res = await fetch(`${base}/analyze-parcelles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcelles: validParcelles,
          code_insee: codeInsee.trim(),
          commune_nom: communeNom.trim() || null,
          user_id: userId,
          user_email: userEmail,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setStatus("error");
        setError(data.error || "Erreur lancement pipeline");
        return;
      }

      setJobId(data.job_id);
      pollStatus(data.job_id);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setError("Erreur de connexion serveur");
    }
  };

  const reset = () => {
    setParcelles([{ section: "", numero: "" }]);
    setCodeInsee("33234");
    setCommuneNom("Latresne");
    setStatus("idle");
    setJobId(null);
    setError(null);
    setCuaHtml(null);
    setCuaUrl(null);
    setCarte2DUrl(null);
    setGpkgUrl(null);
    setCurrentStep("");
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#0b131f]">
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-[#d5e1e3] z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <img src="/logo_kerelia_noir.png" className="h-7" alt="Kerelia" />
          <div className="text-sm text-[#0b131f]/60">
            Page de test — Analyse par parcelles
          </div>
        </div>
      </header>

      <div className="pt-20 max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Test — Analyse par parcelles</h1>

        {status === "idle" && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informations commune */}
            <div className="bg-[#f8f9fa] p-4 rounded-lg space-y-4">
              <h2 className="font-semibold text-lg">Informations de la commune</h2>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Code INSEE <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={codeInsee}
                  onChange={(e) => setCodeInsee(e.target.value)}
                  className="w-full px-3 py-2 border border-[#d5e1e3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff4f3b]"
                  placeholder="33234"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Nom de la commune
                </label>
                <input
                  type="text"
                  value={communeNom}
                  onChange={(e) => setCommuneNom(e.target.value)}
                  className="w-full px-3 py-2 border border-[#d5e1e3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff4f3b]"
                  placeholder="Latresne"
                />
              </div>
            </div>

            {/* Liste des parcelles */}
            <div className="bg-[#f8f9fa] p-4 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">Parcelles cadastrales</h2>
                <button
                  type="button"
                  onClick={addParcelle}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#0b131f] text-white rounded-lg hover:bg-[#0b131f]/90 transition"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter
                </button>
              </div>

              {parcelles.map((parcelle, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">
                      Section
                    </label>
                    <input
                      type="text"
                      value={parcelle.section}
                      onChange={(e) => updateParcelle(index, "section", e.target.value)}
                      className="w-full px-3 py-2 border border-[#d5e1e3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff4f3b]"
                      placeholder="AC"
                      maxLength={2}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">
                      Numéro
                    </label>
                    <input
                      type="text"
                      value={parcelle.numero}
                      onChange={(e) => updateParcelle(index, "numero", e.target.value)}
                      className="w-full px-3 py-2 border border-[#d5e1e3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff4f3b]"
                      placeholder="0242"
                      maxLength={4}
                    />
                  </div>
                  {parcelles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeParcelle(index)}
                      className="mt-6 p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                      aria-label="Supprimer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full px-6 py-3 bg-[#ff4f3b] text-white rounded-lg hover:bg-[#ff4f3b]/90 transition font-medium"
            >
              Lancer l'analyse
            </button>
          </form>
        )}

        {status === "running" && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-[#ff4f3b] mx-auto mb-4" />
            <p className="text-lg font-medium">Analyse en cours...</p>
            <p className="text-sm text-[#0b131f]/60 mt-2">
              {currentStep === "unite_fonciere" && "Construction de l'unité foncière..."}
              {currentStep === "intersections" && "Calcul des intersections avec les couches réglementaires..."}
              {currentStep === "generation_cua" && "Génération des cartes et du CUA..."}
              {currentStep === "cua_pret" && "Finalisation du certificat..."}
              {!currentStep && "Construction de l'unité foncière, calcul des intersections, génération du CUA..."}
            </p>
            {jobId && (
              <p className="text-xs text-[#0b131f]/40 mt-4">Job ID: {jobId}</p>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 mb-2">Erreur</h3>
                <p className="text-red-700">{error || "Une erreur est survenue"}</p>
                <button
                  onClick={reset}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Réessayer
                </button>
              </div>
            </div>
          </div>
        )}

        {status === "done" && cuaHtml && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-900">CUA généré avec succès !</h3>
                <p className="text-sm text-green-700 mt-1">
                  Le certificat d'urbanisme a été généré et est prêt à être consulté.
                </p>
              </div>
            </div>

            {cuaUrl && (
              <div className="flex gap-3 flex-wrap">
                <a
                  href={cuaUrl}
                  download
                  className="flex items-center gap-2 px-4 py-2 bg-[#0b131f] text-white rounded-lg hover:bg-[#0b131f]/90 transition"
                >
                  <FileText className="w-4 h-4" />
                  Télécharger le DOCX
                </a>
                {gpkgUrl && (
                  <button
                    onClick={() => window.open(gpkgUrl, "_blank")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-[#d5e1e3] text-[#0b131f] rounded-lg hover:bg-[#d5e1e3]/20 transition"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Zonage GeoPackage
                  </button>
                )}
                <button
                  onClick={reset}
                  className="px-4 py-2 border border-[#d5e1e3] rounded-lg hover:bg-[#f8f9fa] transition"
                >
                  Nouvelle analyse
                </button>
              </div>
            )}

            <div className="border border-[#d5e1e3] rounded-lg overflow-hidden">
              <Editor
                tinymceScriptSrc="/tinymce/tinymce.min.js"
                licenseKey="gpl"
                value={cuaHtml}
                onEditorChange={(content) => setCuaHtml(content)}
                init={{
                  height: 800,
                  menubar: false,
                  branding: false,
                  plugins: "link lists table code preview",
                  toolbar:
                    "undo redo | bold italic | alignleft aligncenter alignright | bullist numlist | link | preview",
                  skin_url: "/tinymce/skins/ui/oxide",
                  content_css: "/tinymce/skins/content/default/content.css",
                  content_style: `
                    body {
                      font-family: Inter, system-ui, sans-serif;
                      font-size: 15px;
                      line-height: 1.6;
                      color: #0b131f;
                      padding: 40px;
                      max-width: 900px;
                      margin: 0 auto;
                    }
                    h1, h2, h3 { 
                      font-weight: 600;
                      color: #0b131f;
                      margin-top: 1.5em;
                      margin-bottom: 0.5em;
                    }
                    h1 { font-size: 2em; }
                    h2 { font-size: 1.5em; }
                    h3 { font-size: 1.2em; }
                    table { 
                      border-collapse: collapse;
                      width: 100%;
                      margin: 1em 0;
                    }
                    table, th, td { 
                      border: 1px solid #d5e1e3;
                      padding: 8px;
                    }
                    th {
                      background: #f8f9fa;
                      font-weight: 600;
                    }
                  `,
                }}
              />
            </div>

            {carte2DUrl && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-3">Carte 2D générée</h3>
                <Map2DViewer url={carte2DUrl} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

