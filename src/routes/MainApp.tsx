import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import supabase from "../supabaseClient";
import LogoutButton from "../LogoutButton";
import HistoryPanel from "../HistoryPanel";
import { useMeta } from "../hooks/useMeta";
import UrbanHeroAnimation from "../components/UrbanHeroAnimation";

/**
 * CUA Demo Front — Pro v2 (React + Tailwind) — Thème Kerelia
 * Adapté pour backend /analyze-cerfa + /status/{job_id}
 */

const ENV_API_BASE = import.meta.env.VITE_API_BASE || "";
const ENV_API_KEY  = (import.meta as any)?.env?.VITE_API_KEY  || "";

type Status = "idle" | "uploading" | "running" | "done" | "error";
const STEP_LABELS = [
  "Analyse du CERFA",
  "Vérification de l’unité foncière",
  "Analyse des intersections réglementaires",
  "Génération du certificat CUA",
  "Finalisation",
] as const;

const STEP_MAP: Record<string, number> = {
  analyse_cerfa: 0,
  verification_unite_fonciere: 1,
  intersections: 2,
  generation_cua: 3,
};

function cx(...xs: Array<string | false | undefined | null>) { return xs.filter(Boolean).join(" "); }
function prettySize(bytes?: number | null) {
  if (bytes == null) return ""; const k = 1024; const sizes = ["B","KB","MB","GB"] as const;
  const i = Math.min(Math.floor(Math.log(bytes)/Math.log(k)), sizes.length-1);
  return `${(bytes/Math.pow(k,i)).toFixed(1)} ${sizes[i]}`;
}
export default function MainApp() {
  useMeta({
    title: "Kerelia – Automatisation des certificats d'urbanisme",
    description:
      "Générez vos certificats d'urbanisme (CU) à partir d'un PDF CERFA ou d'une référence parcellaire, avec rapports DOCX et cartes interactives.",
  });

  const [file, setFile] = useState<File | null>(null);
  const [isOver, setIsOver] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  // Informations utilisateur
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Récupération des infos utilisateur au montage
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

  const resetAll = () => {
    setFile(null); setIsOver(false); setStatus("idle"); setError(null);
    setReportUrl(null); setMapUrl(null); setActiveStep(0);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsOver(false);
    const f = e.dataTransfer.files?.[0]; if (!f) return;
    if (f.type!=="application/pdf") { setError("Veuillez déposer un fichier PDF."); return; }
    setFile(f); setError(null);
  }, []);

  const onChooseFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]||null; if (!f) return;
    if (f.type!=="application/pdf") { setError("Veuillez sélectionner un fichier PDF."); return; }
    setFile(f); setError(null);
  }, []);

  const disabled = !file || status === "uploading" || status === "running";

  const launch = useCallback(async () => {
    try {
      if (!file) { setError("Ajoutez d'abord un PDF."); return; }
      setError(null); setReportUrl(null); setMapUrl(null);
      setActiveStep(0);

      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id || "";
      const userEmail = sess.session?.user?.email || "";

      const base = ENV_API_BASE.replace(/\/$/,"");
      if (!base) { setError("URL du backend non configurée"); return; }

      setStatus("uploading");
      const form = new FormData();
      form.append("pdf", file);
      
      // ✅ Les métadonnées utiles (commune extraite côté backend)
      form.append("code_insee", "");
      form.append("user_id", userId);
      form.append("user_email", userEmail);

      const res = await fetch(`${base}/analyze-cerfa`, {
        method: "POST",
        body: form,
        headers: ENV_API_KEY ? { "X-API-Key": ENV_API_KEY } : undefined,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.job_id) {
        throw new Error(data?.error || `Échec (HTTP ${res.status})`);
      }

      setStatus("running");
      const jobId = data.job_id;
      if (!jobId) return;

      // Polling toutes les 5s
      const interval = setInterval(async () => {
        try {
          const r = await fetch(`${base}/status/${jobId}`, {
            headers: ENV_API_KEY ? {"X-API-Key": ENV_API_KEY} : undefined
          });
          const j = await r.json();

          if (j.current_step) {
            const idx = STEP_MAP[j.current_step];
            if (idx !== undefined) {
              setActiveStep(prev => (prev !== idx ? idx : prev));
            }
          }
          
          if (j.status === "success") {
            clearInterval(interval);
            
            // ✅ Utilisation de result_enhanced (cartes + CUA + QR) en priorité
            const enhanced = j.result_enhanced || {};
            const result = j.result || {};
            
            // Récupération des URLs depuis result_enhanced (ou fallback sur result)
            setReportUrl(enhanced.output_cua || result?.report_docx_path || result?.report_url || null);
            setMapUrl(enhanced.carte_2d_url || enhanced.carte_3d_url || result?.map_html_path || result?.map_url || null);
            setActiveStep(STEP_LABELS.length - 1);
            setStatus("done");
          } else if (j.status === "error" || j.status === "timeout") {
            clearInterval(interval);
            setError(j.error || "Erreur lors du traitement.");
            setStatus("error");
          }
        } catch (e) {
          clearInterval(interval);
          setError("Impossible de suivre le job.");
          setStatus("error");
        }
      }, 5000);

    } catch (e:any) {
      setError(e?.message || "Une erreur est survenue.");
      setStatus("error");
    }
  }, [file]);

  const progressPct = useMemo(() => {
    if (status === "done") return 100;
    if (status === "idle" || status === "error") return 0;
    const base = status === "uploading" ? 12 : 20;
    const stepSpan = 80/STEP_LABELS.length;
    return Math.min(95, Math.round(base + activeStep*stepSpan));
  }, [status, activeStep]);

  const showProgress = status !== "idle";

  return (
    <div className="min-h-screen bg-[#0b131f] text-[#d5e1e3] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-90">
        <UrbanHeroAnimation />
      </div>
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* ====== HEADER ====== */}
        <header className="px-6 lg:px-10 pt-6">
          <div className="w-full max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 backdrop-blur-2xl">
            <div className="flex items-center gap-3">
              <img
                src="/logo_kerelia_noir.png"
                alt="Kerelia"
                className="h-8 w-auto"
              />
            </div>

            <div className="flex items-center gap-4 text-right">
              {userEmail && (
                <div className="text-xs leading-tight">
                  <div className="font-semibold">{userEmail}</div>
                  <div className="text-[11px] text-[#d5e1e3]/60">ID: {userId?.slice(0, 8)}…</div>
                </div>
              )}
              <LogoutButton />
            </div>
          </div>
        </header>

        {/* ====== CONTENU ====== */}
        <main
          className={cx(
            "flex-1 w-full max-w-[1400px] mx-auto px-6 lg:px-10 py-10 grid gap-10",
            showProgress ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
          )}
        >
          {/* ==== COLONNE GAUCHE — UPLOAD ==== */}
          <div className="bg-transparent backdrop-blur-2xl rounded-2xl p-8">
            <h2 className="text-2xl font-semibold mb-6">Déposer un CERFA (PDF)</h2>

            {/* ZONE DROP */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
              onDragLeave={() => setIsOver(false)}
              onDrop={onDrop}
              className={cx(
                "flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed p-8 transition bg-white/5",
                isOver ? "border-[#ff4f3b] bg-white/10" : "border-white/20"
              )}
            >
              <p className="text-lg mb-3">Déposez un fichier PDF</p>

              {/* Bouton choisir */}
              <label className="cursor-pointer inline-flex items-center gap-2 bg-[#1a2b42] px-4 py-2 rounded-lg hover:bg-[#1a2b42]/80 transition">
                <input type="file" accept="application/pdf" className="hidden" onChange={onChooseFile} />
                Choisir un fichier
              </label>

              {file && (
                <p className="mt-4 text-sm">
                  <span className="font-medium">{file.name}</span>
                  <span className="text-[#d5e1e3]/60"> — {prettySize(file.size)}</span>
                </p>
              )}

              {error && (
                <p className="mt-4 text-sm text-[#ff4f3b]">{error}</p>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap justify-between items-center gap-4">
              <button
                onClick={resetAll}
                className="px-4 py-2 border border-white/20 rounded-lg hover:bg-white/10 transition"
              >
                Réinitialiser
              </button>

              <button
                onClick={launch}
                disabled={disabled}
                className={cx(
                  "px-5 py-2 rounded-lg font-medium transition",
                  disabled ? "opacity-50 bg-[#1a2b42]" : "bg-[#ff4f3b] hover:opacity-90"
                )}
              >
                {status === "uploading"
                  ? "Envoi…"
                  : status === "running"
                  ? "Analyse…"
                  : "Lancer l'analyse"}
              </button>
            </div>
          </div>

          {/* ==== COLONNE DROITE — PROGRESSION ==== */}
          <AnimatePresence>
            {showProgress && (
              <motion.div
                key="progress-panel"
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="bg-white/10 backdrop-blur-2xl border border-white/15 rounded-2xl p-8"
              >
                <h2 className="text-2xl font-semibold mb-6">Progression</h2>

                {/* Barre de progression */}
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden mb-6">
                  <div
                    className="h-2 bg-[#ff4f3b] rounded-full transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* Étapes */}
                <div className="space-y-4">
                  {STEP_LABELS.map((label, i) => {
                    const isActive = i === activeStep;
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <motion.div
                          className={cx(
                            "h-6 w-6 flex items-center justify-center rounded-full border text-sm",
                            i < activeStep
                              ? "bg-[#ff4f3b] text-white border-[#ff4f3b]"
                              : isActive
                              ? "bg-white/10 border-white/20"
                              : "bg-transparent border-white/20"
                          )}
                          animate={
                            isActive
                              ? {
                                  boxShadow: [
                                    "0 0 0px rgba(255,79,59,0)",
                                    "0 0 18px rgba(255,79,59,0.65)",
                                    "0 0 0px rgba(255,79,59,0)",
                                  ],
                                  scale: [1, 1.08, 1],
                                }
                              : undefined
                          }
                          transition={
                            isActive
                              ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                              : undefined
                          }
                        >
                          {i + 1}
                        </motion.div>
                        <span
                          className={cx(
                            "transition-colors",
                            isActive ? "text-white" : "text-[#d5e1e3]/70"
                          )}
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Résultats */}
                <h3 className="text-xl font-semibold mt-8 mb-4">Résultats</h3>

                <div className="flex flex-col gap-4">
                  <a
                    href={reportUrl || undefined}
                    className={cx(
                      "px-4 py-2 rounded-lg text-center transition",
                      status === "done" && reportUrl
                        ? "bg-[#1a2b42] text-white"
                        : "bg-white/10 text-white/40 cursor-not-allowed"
                    )}
                  >
                    Télécharger le rapport
                  </a>

                  <a
                    href={mapUrl || undefined}
                    target="_blank"
                    className={cx(
                      "px-4 py-2 rounded-lg text-center transition",
                      status === "done" && mapUrl
                        ? "bg-[#ff4f3b] text-white"
                        : "bg-white/10 text-white/40 cursor-not-allowed"
                    )}
                  >
                    Ouvrir la carte (HTML)
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* ====== HISTORIQUE ====== */}
        <div className="w-full max-w-[1400px] mx-auto px-6 lg:px-10 pb-20">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/15 rounded-2xl p-6 mt-10">
            <HistoryPanel apiBase={ENV_API_BASE} />
          </div>
        </div>
      </div>
    </div>
  );
}