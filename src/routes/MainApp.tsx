import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import supabase from "../supabaseClient";
import LogoutButton from "../auth/LogoutButton";
import HistorySidebar from "../components/HistorySidebar";
import CuaEditor from "../components/CuaEditor";
import NewDossierPanel from "../components/NewDossierPannel";
import RightAISidebar from "../components/RightAISidebar";
import { useMeta } from "../hooks/useMeta";

const ENV_API_BASE = import.meta.env.VITE_API_BASE || "";

function encodeToken(obj: any): string {
  const json = JSON.stringify(obj);
  const utf8 = new TextEncoder().encode(json);
  let b64 = btoa(String.fromCharCode(...utf8));
  return b64;
}

type Status =
  | "idle"
  | "uploading"
  | "running"
  | "waiting_user"
  | "awaiting_pipeline"
  | "done"
  | "error";

interface PipelineRow {
  slug: string;
  created_at?: string;
  status: string;

  // URLs
  qr_url?: string;
  output_cua?: string;
  carte_2d_url?: string;
  carte_3d_url?: string;
  maps_page?: string;
  intersections_gpkg_url?: string;

  // ➕ NOUVELLES DONNÉES CERFA
  cerfa_data?: {
    numero_cu?: string;
    date_depot?: string;
    demandeur?: string;
    adresse_terrain?: {
      numero?: string;
      voie?: string;
      code_postal?: string;
      ville?: string;
    };
  };
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
  const [isOver, setIsOver] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);

  const [historyRows, setHistoryRows] = useState<PipelineRow[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [showNewPanel, setShowNewPanel] = useState(true);

  const pollIntervalRef = useRef<number | null>(null);

  // Chargement historique
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

  // Polling du pipeline
  const pollStatus = useCallback(
    (jobId: string) => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      const base = ENV_API_BASE.replace(/\/$/, "");

      const intervalId = window.setInterval(async () => {
        try {
          const res = await fetch(`${base}/status/${jobId}`);
          const j = await res.json();

          console.log("🔍 POLL RAW:", j);

          if (j.current_step) {
            setStatus("running");
          }

          if (j.status === "success") {
            console.log("✅ SUCCESS DETECTED");
            console.log("📦 RESULT ENHANCED:", j?.result_enhanced);
            console.log("📦 FULL RESPONSE:", JSON.stringify(j, null, 2));

            clearInterval(intervalId);
            pollIntervalRef.current = null;

            setStatus("done");

            const slug =
              j?.result_enhanced?.slug ??
              j?.result_enhanced?.cua?.slug ??
              j?.result?.slug ??
              j?.result?.cua?.slug ??
              null;
            console.log("🎯 Slug détecté =", slug);
            console.log("📋 SLUG TYPE:", typeof slug);
            console.log("📋 SLUG VALUE:", slug ? `"${slug}"` : "null/undefined");

            if (slug) {
              console.log("🚀 Setting showNewPanel(false) and selectedSlug:", slug);
              
              // Charger l'historique avant de changer l'UI
              await loadHistory();
              
              setShowNewPanel(false);
              setSelectedSlug(slug);
              setAiOpen(false);
              
              console.log("✅ UI state updated: showNewPanel=false, selectedSlug=", slug);
            } else {
              console.warn("⚠️ SLUG IS MISSING! Cannot switch to CuaEditor");
              console.warn("⚠️ Check backend response structure:", j);
            }
          }

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
    },
    [loadHistory]
  );

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

  // Charger historique après auth
  useEffect(() => {
    if (!userId) return;
    loadHistory();
  }, [userId, loadHistory]);

  // Nettoyage polling
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const resetAll = () => {
    setFile(null);
    setIsOver(false);
    setStatus("idle");
    setError(null);
  };

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
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

  // Lancement pipeline
  const launch = useCallback(
    async () => {
      if (!file) return setError("Ajoutez un PDF");

      setError(null);
      setStatus("uploading");

      const base = ENV_API_BASE.replace(/\/$/, "");
      if (!base) return setError("Backend non configuré");

      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("user_id", userId || "");
      formData.append("user_email", userEmail || "");
      formData.append("code_insee", "");

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

        setStatus("running");
        pollStatus(data.job_id);
      } catch (err) {
        console.error(err);
        setStatus("error");
        setError("Erreur de connexion serveur");
      }
    },
    [file, userId, userEmail, pollStatus]
  );

  const showProgress = status !== "idle";
  const selectedDossier = selectedSlug
    ? historyRows.find((r) => r.slug === selectedSlug)
    : null;
  
  console.log("🔍 Selected dossier:", selectedDossier);

  const mapsPageUrl = useMemo(() => {
    if (selectedDossier?.maps_page) return selectedDossier.maps_page;
    if (selectedDossier?.carte_2d_url && selectedDossier?.carte_3d_url) {
      const payload = {
        carte2d: selectedDossier.carte_2d_url,
        carte3d: selectedDossier.carte_3d_url,
      };
      const token = encodeToken(payload);
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
        onSelect={(slug) => {
          setSelectedSlug(slug);
          setShowNewPanel(false);
          if (window.innerWidth < 1024) setSidebarOpen(false);
        }}
        onCreateNew={() => {
          setSelectedSlug(null);
          setShowNewPanel(true);
        }}
      />

      {selectedSlug && (
        <RightAISidebar
          slug={selectedSlug}
          isOpen={aiOpen}
          onToggle={() => setAiOpen(!aiOpen)}
          apiBase={ENV_API_BASE}
        />
      )}

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
          {showNewPanel ? (
            <NewDossierPanel
              file={file}
              isOver={isOver}
              status={status}
              error={error}
              disabled={disabled}
              onDrop={onDrop}
              onChooseFile={onChooseFile}
              onReset={resetAll}
              onLaunch={launch}
              showProgress={showProgress}
            />
          ) : selectedSlug ? (
            <CuaEditor
              key={selectedSlug}
              slug={selectedSlug}
              dossier={selectedDossier}
              apiBase={ENV_API_BASE}
              onSaved={() => loadHistory()}
              mapsPageUrl={mapsPageUrl}
              onOpenAI={() => setAiOpen(true)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-[#0b131f]/40">
              Sélectionnez un dossier dans l'historique
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
