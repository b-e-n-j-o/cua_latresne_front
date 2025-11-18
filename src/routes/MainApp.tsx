import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import supabase from "../supabaseClient";
import LogoutButton from "../LogoutButton";
import HistorySidebar from "../components/HistorySidebar";
import CuaEditor from "../components/CuaEditor";
import NewDossierPanel from "../components/NewDossierPannel";
import { useMeta } from "../hooks/useMeta";
import { useCerfaWebSocket } from "../hooks/useCerfaWebSocket";

const ENV_API_BASE = import.meta.env.VITE_API_BASE || "";

type Status = "idle" | "uploading" | "running" | "waiting_user" | "done" | "error";
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

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [historyRows, setHistoryRows] = useState<PipelineRow[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [showNewPanel, setShowNewPanel] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  
  // Utiliser le hook pour la logique WebSocket CERFA
  const {
    step: cerfaStep,
    status: cerfaStatus,
    preanalyse,
    cerfa,
    pdfPath,
    start: startCerfa,
    validatePreanalyse,
  } = useCerfaWebSocket();

  const pipelineLaunchedRef = useRef<boolean>(false);

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

  const connectWebSocket = useCallback((jobId: string) => {
    // Fermer l'ancienne connexion si elle existe
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const base = ENV_API_BASE.replace(/\/$/, "");
    const wsUrl =
      base.replace(/^https?/, (m: string) => (m === "https" ? "wss" : "ws")) +
      "/ws/job/" +
      jobId;

    const ws = new WebSocket(wsUrl);

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        // --- logs en temps réel (optionnel, pour debug) ---
        if (msg.event === "log") {
          // Les logs peuvent être affichés dans la console ou dans l'UI
          console.log(`[Pipeline] ${msg.message}`);
        }

        // --- progression du pipeline (changement d'étape) ---
        if (msg.event === "step" || msg.step) {
          const stepKey = msg.step || msg.current_step;
          if (stepKey && STEP_MAP[stepKey] !== undefined) {
            setActiveStep(STEP_MAP[stepKey]);
            setStatus("running");
          }
        }

        // --- pipeline terminé avec succès ---
        if (msg.event === "done" || (msg.status === "success" && msg.event === "done")) {
          setStatus("done");
          setActiveStep(STEP_LABELS.length - 1);

          await loadHistory();

          if (msg.slug) {
            setSelectedSlug(null);
            setTimeout(() => setSelectedSlug(msg.slug), 30);
            setShowNewPanel(false);
          }

          ws.close();
          wsRef.current = null;
        }

        // --- erreur ---
        if (msg.event === "error" || msg.status === "error") {
          setStatus("error");
          setError(msg.error || msg.message || "Erreur");
          ws.close();
          wsRef.current = null;
        }
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };

    ws.onerror = () => {
      console.warn("WebSocket error — fallback polling");
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    wsRef.current = ws;
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

  // Nettoyer le WebSocket lors du démontage
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Synchroniser les statuts du hook avec les états locaux
  useEffect(() => {
    setStatus(cerfaStatus);
    setActiveStep(cerfaStep);
  }, [cerfaStatus, cerfaStep]);

  // Lancer le pipeline complet après cerfa_done
  useEffect(() => {
    if (!cerfa || cerfaStatus !== "done" || pipelineLaunchedRef.current) return;
    if (!pdfPath) return;

    pipelineLaunchedRef.current = true;

    const launchPipeline = () => {
      const base = ENV_API_BASE.replace(/\/$/, "");
      const wsUrl =
        base.replace(/^https?/, (m: string) => (m === "https" ? "wss" : "ws")) +
        "/ws/pipeline";

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        const insee = preanalyse?.insee?.code || cerfa?.data?.commune_insee;
        ws.send(
          JSON.stringify({
            action: "launch_pipeline",
            pdf_path: pdfPath,
            insee: insee,
            user_id: userId,
            user_email: userEmail,
          })
        );
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.event === "pipeline_started") {
          setStatus("running");
          setActiveStep(1);
          connectWebSocket(msg.job_id);
          ws.close();
        }

        if (msg.event === "error") {
          setStatus("error");
          setError(msg.message || "Erreur inconnue");
          ws.close();
          pipelineLaunchedRef.current = false;
        }
      };

      ws.onerror = (e) => {
        console.warn("WS pipeline launch error", e);
        setStatus("error");
        setError("Erreur lors du lancement du pipeline");
        ws.close();
        pipelineLaunchedRef.current = false;
      };
    };

    launchPipeline();
  }, [cerfa, cerfaStatus, pdfPath, userId, userEmail, preanalyse, connectWebSocket]);

  // Fonction de validation de la pré-analyse utilisant le hook
  const handleValidatePreanalyse = useCallback((override: {
    insee: string;
    parcelles: any[];
  }) => {
    validatePreanalyse(override);
  }, [validatePreanalyse]);

  const resetAll = () => {
    setFile(null);
    setIsOver(false);
    setStatus("idle");
    setError(null);
    setActiveStep(0);
    pipelineLaunchedRef.current = false;
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
    pipelineLaunchedRef.current = false;

    const base = ENV_API_BASE.replace(/\/$/, "");
    if (!base) return setError("Backend non configuré");

    setStatus("uploading");

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const pdfBase64 = (reader.result as string).split(",")[1];
        startCerfa(pdfBase64); // Utiliser le hook
      } catch (err: any) {
        setError(err.message || "Erreur lors de la lecture du fichier");
        setStatus("error");
      }
    };

    reader.onerror = () => {
      setError("Erreur lors de la lecture du fichier");
      setStatus("error");
    };

    reader.readAsDataURL(file);
  }, [file, startCerfa]);

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
              preanalyse={preanalyse}
              onValidatePreanalyse={handleValidatePreanalyse}
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