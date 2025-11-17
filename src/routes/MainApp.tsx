import React, { useCallback, useEffect, useMemo, useState } from "react";
import supabase from "../supabaseClient";
import LogoutButton from "../LogoutButton";
import HistorySidebar from "../components/HistorySidebar";
import CuaEditor from "../components/CuaEditor";
import ProgressPanel from "../components/ProgressPanel";
import { useMeta } from "../hooks/useMeta";

const ENV_API_BASE = import.meta.env.VITE_API_BASE || "";
const ENV_API_KEY = (import.meta as any)?.env?.VITE_API_KEY || "";

type Status = "idle" | "uploading" | "running" | "done" | "error";
const STEP_LABELS = [
  "Analyse du CERFA",
  "Vérification de l'unité foncière",
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

interface PipelineRow {
  slug: string;
  created_at?: string;
  commune?: string;
  code_insee?: string;
  status: string;
  qr_url?: string;
  output_cua?: string;
  carte_2d_url?: string;
  carte_3d_url?: string;
}

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

export default function MainApp() {
  useMeta({
    title: "Kerelia – Automatisation des certificats d'urbanisme",
    description: "Générez et éditez vos certificats d'urbanisme",
  });

  const [file, setFile] = useState<File | null>(null);
  const [isOver, setIsOver] = useState<boolean>(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number>(0);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [historyRows, setHistoryRows] = useState<PipelineRow[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

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

  useEffect(() => {
    if (!userId) return;
    loadHistory();
  }, [userId]);

  async function loadHistory() {
    try {
      const base = ENV_API_BASE.replace(/\/$/, "");
      const res = await fetch(`${base}/pipelines/by_user?user_id=${userId}`);
      const j = await res.json();
      if (j.success) {
        setHistoryRows(j.pipelines || []);
      }
    } catch (e) {
      console.error("Error loading history:", e);
    }
  }

  const resetAll = () => {
    setFile(null);
    setIsOver(false);
    setStatus("idle");
    setError(null);
    setActiveStep(0);
  };

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") return setError("PDF uniquement");
    setFile(f);
    setError(null);
  }, []);

  const onChooseFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (!f) return;
    if (f.type !== "application/pdf") return setError("PDF uniquement");
    setFile(f);
    setError(null);
  }, []);

  const disabled = !file || status === "uploading" || status === "running";

  const getButtonText = (): string => {
    if (status === "uploading") return "Envoi…";
    if (status === "running") return "Analyse…";
    return "Lancer";
  };

  const launch = useCallback(async () => {
    try {
      if (!file) return setError("Ajoutez un PDF");

      setError(null);
      setActiveStep(0);

      const { data: sess } = await supabase.auth.getSession();
      const currentUserId = sess.session?.user?.id || "";
      const currentUserEmail = sess.session?.user?.email || "";

      const base = ENV_API_BASE.replace(/\/$/, "");
      if (!base) return setError("Backend non configuré");

      setStatus("uploading");

      const form = new FormData();
      form.append("pdf", file);
      form.append("code_insee", "");
      form.append("user_id", currentUserId);
      form.append("user_email", currentUserEmail);

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
            setActiveStep(STEP_LABELS.length - 1);
            setStatus("done");

            await loadHistory();
            if (j.slug) {
              setSelectedSlug(j.slug);
            }
          }

          if (j.status === "error" || j.status === "timeout") {
            clearInterval(interval);
            setError(j.error || "Erreur");
            setStatus("error");
          }
        } catch (e) {
          clearInterval(interval);
          setError("Impossible de suivre le job");
          setStatus("error");
        }
      }, 5000);
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
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
  const selectedDossier = selectedSlug ? historyRows.find((r) => r.slug === selectedSlug) : null;
  const showEditor = !!selectedSlug;

  return (
    <div className="min-h-screen bg-white text-[#0b131f]">
      <HistorySidebar
        rows={historyRows}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        selectedSlug={selectedSlug}
        onSelect={(slug: string) => {
          setSelectedSlug(slug);
          if (window.innerWidth < 1024) setSidebarOpen(false);
        }}
      />

      <header className="fixed top-0 left-0 right-0 bg-white border-b border-[#d5e1e3] z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <img src="/logo_kerelia_noir.png" className="h-7" alt="Kerelia" />

          <div className="flex items-center gap-4">
            {userEmail && (
              <div className="text-xs text-[#0b131f]/60">
                <div className="font-medium">{userEmail}</div>
              </div>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="pt-14 flex">
        <div className={cx("transition-all", sidebarOpen ? "w-80" : "w-0")} />

        <div className="flex-1 min-h-screen flex flex-col">
          <div className="p-6 border-b border-[#d5e1e3] bg-[#d5e1e3]/10">
            <div className="max-w-[1200px] mx-auto">
              {showProgress ? (
                <ProgressPanel
                  labels={STEP_LABELS}
                  progressPct={progressPct}
                  activeStep={activeStep}
                  status={status}
                  reportUrl={null}
                  mapUrl={null}
                />
              ) : (
                <div>
                  <h2 className="text-lg font-semibold mb-3">Nouveau certificat</h2>
                  <div
                    onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
                      e.preventDefault();
                      setIsOver(true);
                    }}
                    onDragLeave={() => setIsOver(false)}
                    onDrop={onDrop}
                    className={cx(
                      "border-2 border-dashed rounded-lg p-6 transition text-center",
                      isOver ? "border-[#0b131f] bg-[#d5e1e3]/30" : "border-[#d5e1e3]"
                    )}
                  >
                    <p className="text-sm mb-2">Déposez un CERFA (PDF)</p>

                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-[#0b131f] text-white rounded-lg hover:bg-[#0b131f]/90 transition">
                      <input type="file" accept="application/pdf" className="hidden" onChange={onChooseFile} />
                      Choisir
                    </label>

                    {file && <p className="text-xs mt-2 text-[#0b131f]/60">{file.name}</p>}
                    {error && <p className="text-xs mt-2 text-red-600">{error}</p>}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={resetAll}
                      className="px-4 py-2 text-sm border border-[#d5e1e3] rounded-lg hover:bg-[#d5e1e3]/20 transition"
                    >
                      Réinitialiser
                    </button>

                    <button
                      onClick={launch}
                      disabled={disabled}
                      className={cx(
                        "px-4 py-2 text-sm rounded-lg font-medium transition",
                        disabled ? "opacity-50 bg-[#0b131f] text-white" : "bg-[#0b131f] text-white hover:bg-[#0b131f]/90"
                      )}
                    >
                      {getButtonText()}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 bg-white">
            {showEditor ? (
              <CuaEditor
                slug={selectedSlug}
                dossier={selectedDossier}
                apiBase={ENV_API_BASE}
                onSaved={() => loadHistory()}
                carte2dUrl={selectedDossier?.carte_2d_url}
                carte3dUrl={selectedDossier?.carte_3d_url}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-[#0b131f]/40">
                Sélectionnez un dossier dans l'historique
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}