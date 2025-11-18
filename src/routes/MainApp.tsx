import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import supabase from "../supabaseClient";
import LogoutButton from "../LogoutButton";
import HistorySidebar from "../components/HistorySidebar";
import CuaEditor from "../components/CuaEditor";
import NewDossierPanel from "../components/NewDossierPannel";
import { useMeta } from "../hooks/useMeta";

const ENV_API_BASE = import.meta.env.VITE_API_BASE || "";
const ENV_API_KEY = (import.meta as any)?.env?.VITE_API_KEY || "";

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
  
  // États pour la pré-analyse
  const [preanalyse, setPreanalyse] = useState<any | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const pipelineWsRef = useRef<WebSocket | null>(null);

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
      if (pipelineWsRef.current) {
        pipelineWsRef.current.close();
        pipelineWsRef.current = null;
      }
    };
  }, []);

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

  function connectWebSocket(jobId: string) {
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

        // --- progression du pipeline ---
        const stepKey = msg.step || msg.current_step;
        if (stepKey && STEP_MAP[stepKey] !== undefined) {
          setActiveStep(STEP_MAP[stepKey]);
          setStatus("running");
        }

        // --- pipeline terminé ---
        if (msg.status === "success") {
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
        if (msg.status === "error") {
          setStatus("error");
          setError(msg.error || "Erreur");
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
  }

  function connectPipelineWebSocket() {
    if (pipelineWsRef.current) {
      pipelineWsRef.current.close();
      pipelineWsRef.current = null;
    }

    const base = ENV_API_BASE.replace(/\/$/, "");
    const wsUrl =
      base.replace(/^https?/, (m: string) => (m === "https" ? "wss" : "ws")) +
      "/ws/pipeline";

    const ws = new WebSocket(wsUrl);
    
    // Variable locale pour stocker le pdfPath dans le scope du callback
    let currentPdfPath: string | null = null;
    let currentPreanalyse: any | null = null;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // --- réception de la pré-analyse ---
        if (msg.event === "preanalyse_result") {
          currentPreanalyse = msg.preanalyse;
          currentPdfPath = msg.pdf_path;
          setPreanalyse(msg.preanalyse);
          setPdfPath(msg.pdf_path);
          setStatus("waiting_user");
          setActiveStep(0); // Étape pré-analyse
        }

        // --- lancement analyse CERFA après validation ---
        if (msg.event === "cerfa_done") {
          // L'analyse CERFA est terminée, maintenant on lance le pipeline complet
          // avec le code INSEE validé
          const insee = currentPreanalyse?.insee?.code || msg.cerfa?.data?.commune_insee;
          
          // Lancer le pipeline complet via l'endpoint /analyze-cerfa
          launchPipelineComplete(currentPdfPath, insee).catch((err) => {
            console.error("Erreur lancement pipeline:", err);
            setError("Erreur lors du lancement du pipeline complet");
            setStatus("error");
          });
        }

        // --- erreurs ---
        if (msg.event === "error") {
          setStatus("error");
          setError(msg.message || "Erreur inconnue");
        }
      } catch (err) {
        console.error("WS pipeline parse error:", err);
      }
    };

    ws.onerror = (e) => console.warn("WS pipeline error", e);
    ws.onclose = () => {
      pipelineWsRef.current = null;
    };

    pipelineWsRef.current = ws;
    return ws;
  }

  // Fonction de validation de la pré-analyse
  async function handleValidatePreanalyse(override: {
    insee: string;
    parcelles: any[];
  }) {
    if (!pipelineWsRef.current || !pdfPath) {
      setError("Connexion WebSocket perdue");
      return;
    }

    pipelineWsRef.current.send(
      JSON.stringify({
        action: "confirm_preanalyse",
        pdf_path: pdfPath,
        insee: override.insee,
        parcelles: override.parcelles,
      })
    );

    setStatus("running");
    setActiveStep(1);
  }

  // Fonction pour lancer le pipeline complet après l'analyse CERFA
  async function launchPipelineComplete(pdfPathLocal: string | null, codeInsee: string | null) {
    try {
      if (!pdfPathLocal) {
        setError("Chemin PDF introuvable");
        return;
      }

      const { data: sess } = await supabase.auth.getSession();
      const currentUserId = sess.session?.user?.id || "";
      const currentUserEmail = sess.session?.user?.email || "";

      const base = ENV_API_BASE.replace(/\/$/, "");
      
      // Lire le PDF depuis le chemin temporaire (le backend l'a déjà)
      // On envoie juste le code INSEE et les infos utilisateur
      const form = new FormData();
      // Le PDF est déjà sur le serveur, on peut soit le renvoyer, soit le backend le garde
      // Pour l'instant, on va utiliser l'endpoint normal avec le fichier
      if (file) {
        form.append("pdf", file);
      }
      form.append("code_insee", codeInsee || "");
      form.append("user_id", currentUserId);
      form.append("user_email", currentUserEmail);

      const res = await fetch(`${base}/analyze-cerfa`, {
        method: "POST",
        body: form,
        headers: ENV_API_KEY ? { "X-API-Key": ENV_API_KEY } : undefined,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.job_id) {
        throw new Error(data?.error || "Erreur backend");
      }

      setStatus("running");
      const jobId = data.job_id;

      // Connecter au WebSocket pour suivre la progression du pipeline
      connectWebSocket(jobId);
    } catch (err: any) {
      setError(err.message || "Erreur lors du lancement du pipeline");
      setStatus("error");
    }
  }

  const resetAll = () => {
    setFile(null);
    setIsOver(false);
    setStatus("idle");
    setError(null);
    setActiveStep(0);
    setPreanalyse(null);
    setPdfPath(null);
    if (pipelineWsRef.current) {
      pipelineWsRef.current.close();
      pipelineWsRef.current = null;
    }
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
    try {
      if (!file) return setError("Ajoutez un PDF");

      setError(null);
      setActiveStep(0);
      setPreanalyse(null);
      setPdfPath(null);

      const base = ENV_API_BASE.replace(/\/$/, "");
      if (!base) return setError("Backend non configuré");

      setStatus("uploading");

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const pdfBase64 = (reader.result as string).split(",")[1];

          // Ouvre la ws pipeline
          const ws = connectPipelineWebSocket();
          if (!ws) {
            setError("WebSocket non disponible");
            setStatus("error");
            return;
          }

          // Envoie la préanalyse
          const send = () => {
            if (ws.readyState === WebSocket.OPEN) {
              setStatus("running");
              ws.send(
                JSON.stringify({
                  action: "start_preanalyse",
                  pdf: pdfBase64,
                })
              );
            } else {
              setTimeout(send, 100);
            }
          };
          send();
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
    } catch (e: any) {
      setError(e.message || "Erreur inconnue");
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