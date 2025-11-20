import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import supabase from "../supabaseClient";
import LogoutButton from "../LogoutButton";
import HistorySidebar from "../components/HistorySidebar";
import CuaEditor from "../components/CuaEditor";
import NewDossierPanel from "../components/NewDossierPannel";
import { useMeta } from "../hooks/useMeta";

const ENV_API_BASE = import.meta.env.VITE_API_BASE || "";

type Status = "idle" | "uploading" | "running" | "waiting_user" | "awaiting_pipeline" | "done" | "error";
const STEP_LABELS = [
  "Analyse du CERFA",
  "Analyse de l'unité foncière",
  "Préparation des cartes de zonages",
  "Génération du CUA",
  "CUA prêt",
] as const;

const STEP_MAP: Record<string, number> = {
  analyse_cerfa: 0,
  unite_fonciere: 1,
  verification_unite_fonciere: 1, // Alias pour compatibilité
  intersections: 2,
  cartes: 2, // Cartes et intersections pointent vers la même étape
  generation_cua: 3,
  cua_pret: 4,
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
  maps_page?: string;
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

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [historyRows, setHistoryRows] = useState<PipelineRow[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [showNewPanel, setShowNewPanel] = useState<boolean>(true);
  const pollIntervalRef = useRef<number | null>(null);

  const loadHistory = useCallback(async () => {
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
  }, [userId]);

  const pollStatus = useCallback((jobId: string) => {
    // Clear ancien interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    const base = ENV_API_BASE.replace(/\/$/, "");

    const intervalId = window.setInterval(async () => {
      try {
        const res = await fetch(`${base}/status/${jobId}`);
        const j = await res.json();

        // Mise à jour étape
        const step = j.current_step;
        if (step && STEP_MAP[step] !== undefined) {
          setActiveStep(STEP_MAP[step]);
          setStatus("running");
        }

        // Pipeline terminé
        if (j.status === "success") {
          clearInterval(intervalId);
          pollIntervalRef.current = null;

          setStatus("done");
          setActiveStep(STEP_LABELS.length - 1);

          await loadHistory();

          const slug = j?.result_enhanced?.slug;
          if (slug) {
            setSelectedSlug(null);
            setTimeout(() => setSelectedSlug(slug), 30);
            setShowNewPanel(false);
          }
        }

        // Erreur
        if (j.status === "error") {
          clearInterval(intervalId);
          pollIntervalRef.current = null;
          setStatus("error");
          setError(j.error || "Erreur pipeline");
        }

      } catch (err) {
        console.error("Erreur polling status:", err);
      }
    }, 1500);

    pollIntervalRef.current = intervalId;
  }, [loadHistory]);

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
  }, [userId, loadHistory]);

  // Rafraîchir automatiquement selectedDossier quand historyRows change
  useEffect(() => {
    if (!selectedSlug) return;

    const updated = historyRows.find((r) => r.slug === selectedSlug);
    if (updated) {
      // Forcer la mise à jour en changeant temporairement selectedSlug pour déclencher un re-render
      const currentSlug = selectedSlug;
      setSelectedSlug(null);
      setTimeout(() => setSelectedSlug(currentSlug), 0);
    }
  }, [historyRows]);

  // Nettoyer le polling lors du démontage
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

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

  const launch = useCallback(async () => {
    if (!file) return setError("Ajoutez un PDF");

    setError(null);
    setActiveStep(0);
    setStatus("uploading");

    const base = ENV_API_BASE.replace(/\/$/, "");
    if (!base) return setError("Backend non configuré");

    const formData = new FormData();
    formData.append("pdf", file);
    formData.append("user_id", userId || "");
    formData.append("user_email", userEmail || "");
    formData.append("code_insee", ""); // INSEE détecté dans le CERFA ou vide

    try {
      const res = await fetch(`${base}/analyze-cerfa`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!data.success) {
        setStatus("error");
        setError(data.error || "Erreur lancement pipeline");
        return;
      }

      // Pipeline lancé
      setStatus("running");
      pollStatus(data.job_id);

    } catch (err) {
      console.error(err);
      setStatus("error");
      setError("Erreur de connexion serveur");
    }
  }, [file, userId, userEmail, pollStatus]);

  const progressPct = useMemo(() => {
    if (status === "done") return 100;
    if (status === "idle" || status === "error") return 0;
    const base = status === "uploading" ? 12 : 20;
    return Math.min(95, Math.round(base + activeStep * (80 / STEP_LABELS.length)));
  }, [status, activeStep]);

  const showProgress = status !== "idle";
  const selectedDossier = selectedSlug ? historyRows.find((r) => r.slug === selectedSlug) : null;

  // Construire mapsPageUrl avec fallback si maps_page n'existe pas
  const mapsPageUrl = useMemo(() => {
    if (selectedDossier?.maps_page) {
      return selectedDossier.maps_page;
    }
    // Fallback : construire l'URL à partir de carte_2d_url et carte_3d_url
    if (selectedDossier?.carte_2d_url && selectedDossier?.carte_3d_url) {
      const payload = {
        carte2d: selectedDossier.carte_2d_url,
        carte3d: selectedDossier.carte_3d_url,
      };
      const token = btoa(JSON.stringify(payload));
      return `${window.location.origin}/maps?t=${encodeURIComponent(token)}`;
    }
    return null;
  }, [selectedDossier]);

  return (
    <div className="min-h-screen bg-white text-[#0b131f]">
      <HistorySidebar
        rows={historyRows}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        selectedSlug={selectedSlug}
        onSelect={(slug: string) => {
          setSelectedSlug(slug);
          setShowNewPanel(false);
          if (window.innerWidth < 1024) setSidebarOpen(false);
        }}
        onCreateNew={() => {
          setSelectedSlug(null);
          setShowNewPanel(true);
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
          {showNewPanel && (
            <NewDossierPanel
              file={file}
              isOver={isOver}
              status={status}
              error={error}
              activeStep={activeStep}
              disabled={disabled}
              onDrop={onDrop}
              onChooseFile={onChooseFile}
              onReset={resetAll}
              onLaunch={launch}
              progressPct={progressPct}
              showProgress={showProgress}
            />
          )}

          <div className="flex-1 bg-white">
            {selectedSlug ? (
              <CuaEditor
                key={selectedSlug}
                slug={selectedSlug}
                dossier={selectedDossier}
                apiBase={ENV_API_BASE}
                onSaved={() => loadHistory()}
                mapsPageUrl={mapsPageUrl}
              />
            ) : !showNewPanel ? (
              <div className="flex items-center justify-center h-full text-[#0b131f]/40">
                Sélectionnez un dossier dans l'historique
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}