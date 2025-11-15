import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import supabase from "../supabaseClient";
import LogoutButton from "../LogoutButton";
import HistoryPanel from "../HistoryPanel";
import { useMeta } from "../hooks/useMeta";
import UrbanHeroAnimation from "../components/UrbanHeroAnimation";
import ProgressPanel from "../components/ProgressPanel";

const ENV_API_BASE = import.meta.env.VITE_API_BASE || "";
const ENV_API_KEY  = (import.meta as any)?.env?.VITE_API_KEY  || "";

type Status = "idle" | "uploading" | "running" | "done" | "error";
const STEP_LABELS = [
  "Analyse du CERFA",
  "Vérification de l’unité foncière",
  "Analyse réglementaire",
  "Génération du CUA",
  "Finalisation",
] as const;

const STEP_MAP: Record<string, number> = {
  analyse_cerfa: 0,
  verification_unite_fonciere: 1,
  intersections: 2,
  generation_cua: 3,
};

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

export default function MainApp() {
  useMeta({
    title: "Kerelia – Automatisation des certificats d'urbanisme",
    description:
      "Générez vos certificats d'urbanisme (CU) à partir d'un PDF CERFA avec cartes interactives et analyses réglementaires automatisées.",
  });

  const [file, setFile] = useState<File | null>(null);
  const [isOver, setIsOver] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

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
    setFile(null);
    setIsOver(false);
    setStatus("idle");
    setError(null);
    setReportUrl(null);
    setMapUrl(null);
    setActiveStep(0);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsOver(false);
    const f = e.dataTransfer.files?.[0]; if (!f) return;
    if (f.type !== "application/pdf") return setError("Veuillez déposer un PDF.");
    setFile(f); setError(null);
  }, []);

  const onChooseFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (!f) return;
    if (f.type !== "application/pdf") return setError("Veuillez sélectionner un PDF.");
    setFile(f); setError(null);
  }, []);

  const disabled = !file || status === "uploading" || status === "running";

  const launch = useCallback(async () => {
    try {
      if (!file) return setError("Ajoutez d'abord un PDF.");

      setError(null);
      setReportUrl(null);
      setMapUrl(null);
      setActiveStep(0);

      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id || "";
      const userEmail = sess.session?.user?.email || "";

      const base = ENV_API_BASE.replace(/\/$/, "");
      if (!base) return setError("Backend non configuré.");

      setStatus("uploading");

      const form = new FormData();
      form.append("pdf", file);
      form.append("code_insee", "");
      form.append("user_id", userId);
      form.append("user_email", userEmail);

      const res = await fetch(`${base}/analyze-cerfa`, {
        method: "POST",
        body: form,
        headers: ENV_API_KEY ? { "X-API-Key": ENV_API_KEY } : undefined,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.job_id) throw new Error(data?.error || "Erreur backend");

      setStatus("running");
      const jobId = data.job_id;

      const interval = setInterval(async () => {
        try {
          const r = await fetch(`${base}/status/${jobId}`, {
            headers: ENV_API_KEY ? { "X-API-Key": ENV_API_KEY } : undefined,
          });
          const j = await r.json();

          if (j.current_step) {
            const idx = STEP_MAP[j.current_step];
            if (idx !== undefined) setActiveStep(idx);
          }

          if (j.status === "success") {
            clearInterval(interval);

            const enhanced = j.result_enhanced || {};
            const result = j.result || {};

            setReportUrl(enhanced.output_cua || result.report_url || null);
            setMapUrl(enhanced.carte_2d_url || result.map_url || null);

            setActiveStep(STEP_LABELS.length - 1);
            setStatus("done");
          }

          if (j.status === "error" || j.status === "timeout") {
            clearInterval(interval);
            setError(j.error || "Erreur.");
            setStatus("error");
          }
        } catch (e) {
          clearInterval(interval);
          setError("Impossible de suivre le job.");
          setStatus("error");
        }
      }, 5000);

    } catch (err: any) {
      setError(err.message || "Erreur inconnue.");
      setStatus("error");
    }
  }, [file]);

  const progressPct = useMemo(() => {
    if (status === "done") return 100;
    if (status === "idle" || status === "error") return 0;
    const base = status === "uploading" ? 12 : 20;
    return Math.min(95, Math.round(base + activeStep * (80 / STEP_LABELS.length)));
  }, [status, activeStep]);

  const showProgress = status !== "idle";

  return (
    <div className="min-h-screen bg-[#0b131f] text-[#d5e1e3] relative overflow-hidden">

      <div className="absolute inset-0 pointer-events-none opacity-90">
        <UrbanHeroAnimation />
      </div>

      <header className="fixed top-0 left-0 w-full bg-transparent backdrop-blur-sm shadow-sm z-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-12 py-4 flex items-center justify-between">
          <img src="/logo_kerelia_noir.png" className="h-8" alt="Kerelia" />

          <div className="flex items-center gap-4">
            {userEmail && (
              <div className="text-xs leading-tight text-white">
                <div className="font-semibold">{userEmail}</div>
                <div className="text-[11px] text-white/60">ID: {userId?.slice(0, 8)}…</div>
              </div>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="relative z-10 flex flex-col min-h-screen pt-28">

        {/* MAIN CONTENT */}
        <main
          className={cx(
            "flex-1 w-full max-w-[1400px] mx-auto px-6 lg:px-10 py-10 grid gap-10",
            showProgress ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
          )}
        >
          {/* UPLOAD PANEL */}
          <div className="p-8 bg-white/10 backdrop-blur-2xl border border-white/15 rounded-2xl">
            <h2 className="text-2xl font-semibold mb-6">Déposer un CERFA (PDF)</h2>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
              onDragLeave={() => setIsOver(false)}
              onDrop={onDrop}
              className={cx(
                "flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed p-8 transition bg-white/5",
                isOver ? "border-[#ff4f3b] bg-white/50" : "border-white/20"
              )}
            >
              <p className="text-lg mb-3">Déposez un fichier PDF</p>

              <label className="cursor-pointer inline-flex items-center gap-2 bg-[#1a2b42] px-4 py-2 rounded-lg hover:bg-[#1a2b42]/80 transition">
                <input type="file" accept="application/pdf" className="hidden" onChange={onChooseFile} />
                Choisir un fichier
              </label>

              {file && (
                <p className="mt-4 text-sm opacity-80">
                  <span className="font-medium">{file.name}</span>
                </p>
              )}

              {error && (
                <p className="mt-4 text-sm text-[#ff4f3b]">{error}</p>
              )}
            </div>

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

          {/* RIGHT PANEL */}
          <AnimatePresence>
            {showProgress && (
              <ProgressPanel
                key="progress-panel"
                labels={STEP_LABELS}
                progressPct={progressPct}
                activeStep={activeStep}
                status={status}
                reportUrl={reportUrl}
                mapUrl={mapUrl}
              />
            )}
          </AnimatePresence>
        </main>

        {/* HISTORY */}
        <div className="w-full max-w-[1400px] mx-auto px-6 lg:px-10 pb-20">
          <div className="p-6 mt-10 bg-white/10 backdrop-blur-2xl border border-white/15 rounded-2xl">
            <HistoryPanel apiBase={ENV_API_BASE} />
          </div>
        </div>
      </div>
    </div>
  );
}
