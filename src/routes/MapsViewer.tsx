import { useEffect, useState } from "react";
import { decodeMapsToken, htmlToBlobUrl } from "../utils/mapHtml";

export default function MapsViewer() {
  const [carte2d, setCarte2d] = useState<string>("");
  const [carte2dHtml, setCarte2dHtml] = useState<string>("");
  const [carte3d, setCarte3d] = useState<string>("");
  const [selected, setSelected] = useState<"2d" | "3d">("2d");
  const [iframeSrc, setIframeSrc] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lsKey = params.get("ls");
    const token = params.get("t");

    if (lsKey) {
      try {
        const raw = localStorage.getItem(lsKey);
        if (!raw) {
          setError("Données de carte introuvables (session expirée).");
          setLoading(false);
          return;
        }
        const wrapped = JSON.parse(raw);
        const decoded = wrapped?.payload ?? wrapped;
        applyPayload(decoded);
      } catch (err) {
        console.error("Erreur de lecture localStorage :", err);
        setError("Impossible de lire les données de carte.");
        setLoading(false);
      }
      return;
    }

    if (!token) {
      setError("Aucun token de carte fourni.");
      setLoading(false);
      return;
    }

    try {
      applyPayload(decodeMapsToken(token));
    } catch (err) {
      console.error("Erreur de décodage du token :", err);
      setError("Le lien fourni est invalide ou corrompu.");
      setLoading(false);
    }
  }, []);

  function applyPayload(decoded: Record<string, unknown>) {
    const has2dUrl = typeof decoded.carte2d === "string" && decoded.carte2d.length > 0;
    const has2dHtml =
      typeof decoded.carte2d_html === "string" && decoded.carte2d_html.length > 0;
    const has3d = typeof decoded.carte3d === "string" && decoded.carte3d.length > 0;
    if (!has2dUrl && !has2dHtml && !has3d) {
      setError("Token invalide : données manquantes.");
      setLoading(false);
      return;
    }
    setCarte2d(has2dUrl ? (decoded.carte2d as string) : "");
    setCarte2dHtml(has2dHtml ? (decoded.carte2d_html as string) : "");
    setCarte3d(has3d ? (decoded.carte3d as string) : "");
    setSelected(has2dUrl || has2dHtml ? "2d" : "3d");
    setReady(true);
  }

  useEffect(() => {
    if (!ready) return;
    let blobUrl: string | null = null;
    let cancelled = false;

    async function loadMap() {
      if (selected === "2d" && carte2dHtml) {
        setLoading(true);
        setError(null);
        try {
          blobUrl = htmlToBlobUrl(carte2dHtml);
          if (!cancelled) setIframeSrc(blobUrl);
        } catch (err) {
          console.error("Erreur de rendu HTML inline :", err);
          if (!cancelled) setError("Impossible d'afficher la carte 2D.");
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      const url = selected === "2d" ? carte2d : carte3d;
      if (!url) {
        setError(selected === "3d" ? "Carte 3D indisponible." : "Carte 2D indisponible.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        const html = await res.text();
        if (cancelled) return;
        blobUrl = htmlToBlobUrl(html);
        setIframeSrc(blobUrl);
      } catch (err: unknown) {
        console.error("Erreur de chargement :", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erreur de chargement");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMap();
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [ready, selected, carte2d, carte2dHtml, carte3d]);

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        margin: 0,
        background: "#f4f4f4",
        overflow: "hidden",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 10,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 999,
          background: "rgba(255,255,255,0.95)",
          borderRadius: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          padding: "6px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          backdropFilter: "blur(8px)",
        }}
      >
        <label htmlFor="mapSelector">Carte :</label>
        <select
          id="mapSelector"
          value={selected}
          onChange={(e) => setSelected(e.target.value as "2d" | "3d")}
          style={{
            fontSize: 14,
            padding: "4px 8px",
            border: "1px solid #ccc",
            borderRadius: 6,
            background: "#fff",
          }}
        >
          <option value="2d" disabled={!carte2d && !carte2dHtml}>
            Vue 2D
          </option>
          {carte3d && <option value="3d">Vue 3D</option>}
        </select>
      </div>

      {loading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: 16,
            color: "#333",
          }}
        >
          Chargement de la carte...
        </div>
      )}
      {error && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: 16,
            color: "red",
            textAlign: "center",
            padding: "0 1rem",
          }}
        >
          {error}
        </div>
      )}

      {!error && iframeSrc && (
        <iframe
          key={iframeSrc}
          src={iframeSrc}
          sandbox="allow-scripts allow-same-origin"
          title="Carte CUA"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            background: "white",
            display: loading ? "none" : "block",
          }}
        />
      )}
    </div>
  );
}
