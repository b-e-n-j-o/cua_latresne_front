import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import supabase from "../supabaseClient";
import LogoutButton from "../LogoutButton";
import HistoryPanel from "../HistoryPanel";
import { useMeta } from "../hooks/useMeta";

/**
 * CUA Demo Front — Pro v2 (React + Tailwind) — Thème Latresne
 */

// Palette (arbitraire proche du site)
const PAL = {
  primary: "#78B7A6",       // vert sauge (boutons, barres)
  primaryDark: "#2E6E62",   // hover / bords
  coral: "#E98C7E",         // accent (CTA secondaire)
  mustard: "#E8B45C",       // petits points
  mint: "#BEE3D2",          // fonds clairs
  ink: "#1F2937",           // texte
};

const ENV_API_BASE = (import.meta as any)?.env?.VITE_API_BASE || "";
const ENV_API_KEY  = (import.meta as any)?.env?.VITE_API_KEY  || "";

type Status = "idle" | "uploading" | "running" | "done" | "error";
const STEP_LABELS = [
  "Analyse visuelle du CERFA",
  "Localisation de la parcelle",
  "Analyse des servitudes (SUP)",
  "Analyse du zonage (PLU/PLUi)",
  "Génération du rapport",
  "Génération de la cartographie",
] as const;

function cx(...xs: Array<string | false | undefined | null>) { return xs.filter(Boolean).join(" "); }
function prettySize(bytes?: number | null) {
  if (bytes == null) return ""; const k = 1024; const sizes = ["B","KB","MB","GB"] as const;
  const i = Math.min(Math.floor(Math.log(bytes)/Math.log(k)), sizes.length-1);
  return `${(bytes/Math.pow(k,i)).toFixed(1)} ${sizes[i]}`;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export default function MainApp() {
  // Métadonnées de la page
  useMeta({
    title: "Kerelia – Automatisation des certificats d’urbanisme",
    description:
      "Générez vos certificats d’urbanisme (CU) à partir d’un PDF CERFA ou d’une référence parcellaire, avec rapports DOCX et cartes interactives.",
  });
  const [file, setFile] = useState<File | null>(null);
  const [isOver, setIsOver] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const t0 = useRef<number | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  // --- Nouvel état pour le mode "direct" ---
  const [parcelRef, setParcelRef] = useState("");
  const [insee, setInsee] = useState("");
  const [commune, setCommune] = useState("");
  const [statusDirect, setStatusDirect] = useState<Status>("idle");
  const [errorDirect, setErrorDirect] = useState<string | null>(null);

  // --- Destinataires supplémentaires ---
  const [showExtra, setShowExtra] = useState(false);
  const [extraInput, setExtraInput] = useState("");
  const parsedEmails = useMemo(() => {
    const raw = extraInput
      .split(/[,\s;]+/)   // virgule / espace / point-virgule
      .map(s => s.trim())
      .filter(Boolean);
    const unique = Array.from(new Set(raw));
    const items = unique.map(v => ({ value: v, valid: EMAIL_RE.test(v) }));
    const valid = items.filter(i => i.valid).map(i => i.value);
    const invalid = items.filter(i => !i.valid).map(i => i.value);
    return { items, valid, invalid };
  }, [extraInput]);

  useEffect(() => {
    if (status !== "running" && statusDirect !== "running") return; 
    setActiveStep(0);
    const timer = window.setInterval(() => setActiveStep((s)=>Math.min(s+1, STEP_LABELS.length-1)), 1100);
    return () => window.clearInterval(timer);
  }, [status, statusDirect]);

  useEffect(() => {
    let id: number | null = null;
    if (status === "uploading" || status === "running" || statusDirect === "running") {
      t0.current = performance.now();
      id = window.setInterval(()=>{
        if (t0.current) setElapsed(Math.round((performance.now()-t0.current)/1000));
      }, 500);
    } else {
      if (id) window.clearInterval(id);
      t0.current = null;
    }
    return () => { if (id) window.clearInterval(id as any); };
  }, [status, statusDirect]);

  const resetAll = () => {
    setFile(null); setIsOver(false); setStatus("idle"); setError(null);
    setReportUrl(null); setMapUrl(null); setElapsed(0); setActiveStep(0);
    // Reset du mode direct
    setParcelRef(""); setInsee(""); setCommune(""); setStatusDirect("idle"); setErrorDirect(null);
    // on garde extraInput (destinataires) pour rester "visibles discrètement"
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

      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id || "";
      const userEmail = sess.session?.user?.email || "";

      const base = ENV_API_BASE.replace(/\/$/,"");
      if (!base) { setError("URL du backend non configurée"); return; }

      setStatus("uploading");
      const form = new FormData();
      form.append("file", file);
      form.append("user_id", userId);
      form.append("user_email", userEmail);
      if (parsedEmails.valid.length) {
        form.append("notify_emails", parsedEmails.valid.join(","));
      }

      const res = await fetch(`${base}/cua`, {
        method:"POST",
        body:form,
        headers: ENV_API_KEY ? {"X-API-Key": ENV_API_KEY} : undefined
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.status !== "processing") {
        throw new Error(data?.detail || data?.error || `Échec (HTTP ${res.status})`);
      }

      // ✅ on passe en "running" mais pas "done"
      setStatus("running");

      // On récupère le job_id
      const jobId = data.job_id;
      if (!jobId) return;

      // Polling toutes les 5s
      const interval = setInterval(async () => {
        try {
          const r = await fetch(`${base}/jobs/${jobId}`, {
            headers: ENV_API_KEY ? {"X-API-Key": ENV_API_KEY} : undefined
          });
          const j = await r.json();
          if (j.status === "success") {
            clearInterval(interval);
            setReportUrl(j.report_docx_path);
            setMapUrl(j.map_html_path);
            setStatus("done");
          } else if (j.status === "error") {
            clearInterval(interval);
            setError("Erreur lors du traitement.");
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
  }, [file, parsedEmails.valid, parsedEmails.invalid]);

  const launchDirect = useCallback(async () => {
    try {
      if (!parcelRef || !insee || !commune) {
        setErrorDirect("Veuillez remplir les trois champs.");
        return;
      }
      setErrorDirect(null);
      setReportUrl(null);
      setMapUrl(null);

      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id || "";
      const userEmail = sess.session?.user?.email || "";

      const base = ENV_API_BASE.replace(/\/$/,"");
      if (!base) { setErrorDirect("URL backend manquante"); return; }

      setStatusDirect("running");

      const res = await fetch(`${base}/cua/direct`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(ENV_API_KEY ? {"X-API-Key": ENV_API_KEY} : {})
        },
        body: JSON.stringify({
          parcel: parcelRef,
          insee,
          commune,
          user_id: userId,
          user_email: userEmail,
          notify_emails: parsedEmails.valid.join(",")
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.status !== "processing") {
        throw new Error(data?.detail || data?.error || `Échec (HTTP ${res.status})`);
      }

      // ⚡ récupération du job_id
      const jobId = data.job_id;
      if (!jobId) {
        setErrorDirect("Job ID manquant dans la réponse backend.");
        setStatusDirect("error");
        return;
      }

      // ⏳ Polling toutes les 5s
      const interval = setInterval(async () => {
        try {
          const r = await fetch(`${base}/jobs/${jobId}`, {
            headers: ENV_API_KEY ? {"X-API-Key": ENV_API_KEY} : undefined
          });
          const j = await r.json();
          if (j.status === "success") {
            clearInterval(interval);
            setReportUrl(j.report_docx_path);
            setMapUrl(j.map_html_path);
            setStatusDirect("done");
          } else if (j.status === "error") {
            clearInterval(interval);
            setErrorDirect("Erreur lors du traitement direct.");
            setStatusDirect("error");
          }
        } catch (e) {
          clearInterval(interval);
          setErrorDirect("Impossible de suivre le job direct.");
          setStatusDirect("error");
        }
      }, 5000);

    } catch (e:any) {
      setErrorDirect(e?.message || "Erreur lors du lancement direct");
      setStatusDirect("error");
    }
  }, [parcelRef, insee, commune, parsedEmails.valid]);

  const progressPct = useMemo(() => {
    // Progression pour PDF ou Direct
    const isDone = status === "done" || statusDirect === "done";
    const isIdle = (status === "idle" || status === "error") && (statusDirect === "idle" || statusDirect === "error");
    
    if (isDone) return 100;
    if (isIdle) return 0;
    const base = status === "uploading" ? 12 : 20;
    const stepSpan = 80/STEP_LABELS.length;
    return Math.min(95, Math.round(base + activeStep*stepSpan));
  }, [status, statusDirect, activeStep]);

  // Affichage compact des destinataires valides (toujours visible)
  const extraChipsCompact = (
    parsedEmails.valid.length > 0 && (
      <div className="flex flex-wrap items-center gap-1">
        {parsedEmails.valid.slice(0, 5).map(e => (
          <span key={e} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                style={{ backgroundColor: "#EEF6F3", color: PAL.primaryDark, border: "1px solid #D1EAE2" }}>
            {e}
          </span>
        ))}
        {parsedEmails.valid.length > 5 && (
          <span className="text-xs text-gray-500">+{parsedEmails.valid.length - 5}</span>
        )}
      </div>
    )
  );

  return (
    <div className="min-h-screen" style={{ color: PAL.ink, backgroundColor: "#F6FAF8" }}>
      {/* Brand strip */}
      <div className="w-full" style={{ backgroundColor: 'rgb(190, 227, 210)' }}>
        <div className="mx-auto max-w-6xl px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo_latresne.png" alt="Mairie de Latresne — logo" className="h-8 w-auto" />
            <span className="sr-only">Mairie de Latresne</span>
            <span className="hidden sm:inline-flex gap-1 ml-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PAL.mustard }} />
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PAL.coral }} />
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PAL.primary }} />
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#9ACF8A" }} />
            </span>
          </div>
          <LogoutButton />
        </div>
      </div>

      {/* Header */}
      <header className="bg-white">
        {/* Hero bandeau Latresne */}
        <section className="relative">
          <img
            src="/home_latresne.png"
            alt="Latresne — bandeau paysage"
            className="h-14 md:h-24 lg:h-36 w-full object-cover object-center select-none"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-transparent" />
          <img
            src="/bienvenue_latresne.png"
            alt="Bienvenue à Latresne"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[20%] md:w-[25%] lg:w-[20%] max-w-[900px] opacity-95 drop-shadow"
            draggable={false}
            style={{ imageRendering: "-webkit-optimize-contrast" }}
          />
        </section>

        {/* En-tête fonctionnel (titre + config) */}
        <div className="mx-auto max-w-6xl px-4 py-6 border-b" style={{ borderColor: '#BEE3D2' }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" style={{ color: PAL.primaryDark }}>
                Mairie de Latresne — Auto CUA
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-gray-600">
                Déposez un <span className="font-medium">CERFA (PDF)</span>, lancez l'analyse. À la fin : un
                <span className="font-medium"> rapport (.docx)</span> et une <span className="font-medium">carte (HTML)</span>.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Uploader */}
        <section>
          <div
            onDragOver={(e)=>{e.preventDefault(); setIsOver(true);}}
            onDragLeave={()=>setIsOver(false)}
            onDrop={onDrop}
            className={cx(
              "relative flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed bg-white p-8 transition",
              isOver?"bg-[#F0FAF7]":""
            )}
            style={{ borderColor: isOver ? PAL.primary : "#D1D5DB" }}
          >
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: PAL.mint }}>
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: PAL.primaryDark }}>
                  <path d="M12 16V4m0 12l-3-3m3 3l3-3" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="3" y="16" width="18" height="5" rx="1.5" />
                </svg>
              </div>
              <h2 className="text-lg font-medium">Déposez votre CERFA (PDF)</h2>
              <p className="mt-1 text-sm text-gray-600">ou</p>
              <div className="mt-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-white hover:opacity-95" style={{ backgroundColor: PAL.primaryDark }}>
                  <input type="file" accept="application/pdf" className="hidden" onChange={onChooseFile} />
                  Choisir un fichier
                </label>
              </div>
              {file && (
                <div className="mt-3 text-sm text-gray-700">
                  Sélectionné : <span className="font-medium">{file.name}</span>
                  <span className="text-gray-500"> — {prettySize(file.size)}</span>
                </div>
              )}

              {/* Toggle destinataires supplémentaires */}
              <div className="mt-4 text-sm">
                <button
                  type="button"
                  onClick={() => setShowExtra(v => !v)}
                  className="underline underline-offset-2"
                  style={{ color: PAL.primaryDark }}
                >
                  Destinataires supplémentaires
                </button>

                {/* Aperçu compact (toujours visible) */}
                {!showExtra && extraChipsCompact}

                {showExtra && (
                  <div className="mt-2 text-left">
                    <input
                      type="text"
                      value={extraInput}
                      onChange={e => setExtraInput(e.target.value)}
                      placeholder="ex. urbanisme@latresne.fr, jean.dupont@mairie.fr"
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                    />
                    <div className="mt-1 text-xs text-gray-500">Séparez les adresses par des virgules.</div>

                    {/* Chips + erreurs */}
                    {parsedEmails.items.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {parsedEmails.items.map(i => (
                          <span
                            key={i.value}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs border"
                            style={{
                              backgroundColor: i.valid ? "#EEF6F3" : "#FEF2F2",
                              color: i.valid ? PAL.primaryDark : "#991B1B",
                              borderColor: i.valid ? "#D1EAE2" : "#FECACA"
                            }}
                          >
                            {i.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && (<p className="mt-3 text-sm" style={{ color: "#C2410C" }}>{error}</p>)}
            </div>
          </div>

          {/* Controls */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    (status==="done" || statusDirect==="done") ? "#10B981" :
                    (status==="error" || statusDirect==="error") ? "#EF4444" :
                    (status==="uploading"||status==="running"||statusDirect==="running") ? PAL.mustard : "#D1D5DB"
                }}
              />
              {(status === "idle" && statusDirect === "idle") && <span>Prêt à lancer l'analyse</span>}
              {status === "uploading" && <span>Envoi du PDF…</span>}
              {(status === "running" || statusDirect === "running") && <span>Analyse en cours… {elapsed ? `(${elapsed}s)` : null}</span>}
              {(status === "done" || statusDirect === "done") && <span>Analyse terminée</span>}
              {(status === "error" || statusDirect === "error") && <span>Erreur d'analyse</span>}
            </div>
            <div className="flex items-center gap-3">
              {/* rappel discret destinataires */}
              {extraChipsCompact}
              <button onClick={resetAll} className="rounded-full border px-4 py-2 text-sm hover:bg-gray-50" title="Réinitialiser l'interface">
                Réinitialiser
              </button>
              <button
                onClick={launch}
                disabled={disabled}
                className={cx("rounded-full px-5 py-2 text-sm font-medium text-white transition",
                  disabled?"opacity-60 cursor-not-allowed":"hover:brightness-95")}
                style={{ backgroundColor: PAL.primaryDark }}
              >
                {status === "uploading"?"Envoi…": status === "running"?"Analyse en cours…":"Lancer l'analyse"}
              </button>
            </div>
          </div>
        </section>

        {/* Uploader direct par référence */}
        <section className="mt-8">
          <div className="rounded-2xl border bg-white p-4" style={{ borderColor: PAL.mint }}>
            <h3 className="text-sm font-semibold" style={{ color: PAL.primaryDark }}>
              Lancer sans CERFA (parcelle directe)
            </h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <input
                type="text"
                placeholder="Référence (ex. AC 0494)"
                value={parcelRef}
                onChange={e => setParcelRef(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Code INSEE (ex. 33234)"
                value={insee}
                onChange={e => setInsee(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Commune (ex. Latresne)"
                value={commune}
                onChange={e => setCommune(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>
            
            {/* Affichage d'état */}
            <div className="mt-3 text-sm">
              {statusDirect === "idle" && <span className="text-gray-600">Prêt à lancer</span>}
              {statusDirect === "running" && <span className="text-blue-600">Analyse en cours…</span>}
              {statusDirect === "done" && <span className="text-green-600">Analyse terminée ✅</span>}
              {statusDirect === "error" && <span className="text-red-600">{errorDirect}</span>}
            </div>
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={launchDirect}
                disabled={statusDirect==="running"}
                className="rounded-full px-5 py-2 text-sm font-medium text-white transition"
                style={{ backgroundColor: PAL.primaryDark }}
              >
                {statusDirect==="running" ? "Analyse en cours…" : "Lancer l'analyse directe"}
              </button>
            </div>
          </div>
        </section>

        {/* Progression & étapes */}
        <section className="mt-6">
          <div className="rounded-2xl border bg-white p-4" style={{ borderColor: PAL.mint }}>
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: "#EEF6F3" }}>
              <div className="h-2 rounded-full transition-all" style={{ width: `${progressPct}%`, backgroundColor: PAL.primary }} />
            </div>
            <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
              {STEP_LABELS.map((label, i) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border"
                    style={{
                      backgroundColor: i<activeStep?PAL.primary: i===activeStep? "#F0FAF7":"#F9FAFB",
                      color: i<activeStep?"white": PAL.primaryDark,
                      borderColor: PAL.mint
                    }}
                  >
                    {i+1}
                  </span>
                  <span className={cx("truncate", i<=activeStep?"text-gray-800":"text-gray-400")}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Résultats */}
        <section className="mt-6">
          <div className="rounded-2xl border bg-white p-4" style={{ borderColor: PAL.mint }}>
            <h3 className="text-sm font-semibold" style={{ color: PAL.primaryDark }}>Résultats</h3>
            <p className="mt-1 text-sm text-gray-600">
              Une fois l'analyse terminée, récupérez le rapport (.docx ou .md) et ouvrez la carte (HTML).
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <a
                href={reportUrl || undefined}
                download
                onClick={(e)=>{ if(!reportUrl) e.preventDefault(); }}
                className={cx("rounded-full px-4 py-2 text-sm font-medium",
                  (status==="done" || statusDirect==="done") && reportUrl?"text-white":"text-gray-500 cursor-not-allowed")}
                style={{ backgroundColor: (status==="done" || statusDirect==="done") && reportUrl ? PAL.primaryDark : "#E5E7EB" }}
              >
                Télécharger le rapport
              </a>
              <a
                href={mapUrl || undefined}
                target="_blank" rel="noreferrer"
                onClick={(e)=>{ if(!mapUrl) e.preventDefault(); }}
                className={cx("rounded-full px-4 py-2 text-sm font-medium",
                  (status==="done" || statusDirect==="done") && mapUrl?"text-white":"text-gray-500 cursor-not-allowed")}
                style={{ backgroundColor: (status==="done" || statusDirect==="done") && mapUrl ? PAL.coral : "#E5E7EB" }}
              >
                Ouvrir la carte (HTML)
              </a>
            </div>
          </div>
        </section>

        {/* Historique inline */}
        <HistoryPanel apiBase={ENV_API_BASE} className="mt-8" />

        <footer className="mt-10 pb-10 text-center text-xs" style={{ color: "#6B7280" }}>
          Démonstration — Kerelia · Intersection parcelle & couches urbanistiques (Supabase/PostGIS)
        </footer>
      </main>
    </div>
  );
}
