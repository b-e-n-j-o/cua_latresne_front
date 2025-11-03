"use client";

import { useEffect, useState } from "react";

/**
 * Page publique /maps
 * - Lit le paramètre `t` dans l’URL (token encodé en base64)
 * - Décode le JSON { id, carte2d, carte3d }
 * - Affiche les cartes 2D / 3D dans des iframes
 */

export default function MapsViewer() {
  const [carte2d, setCarte2d] = useState<string>("");
  const [carte3d, setCarte3d] = useState<string>("");
  const [selected, setSelected] = useState<"2d" | "3d">("2d");
  const [iframeSrc, setIframeSrc] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [id, setId] = useState<string>("");

  // 🧩 Étape 1 : Lecture et décodage du token base64
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("t");

    if (!token) {
      setError("Aucun token de carte fourni dans l’URL.");
      return;
    }

    try {
      // Décodage UTF-8 safe
      const jsonStr = decodeURIComponent(escape(window.atob(token)));
      const decoded = JSON.parse(jsonStr);

      if (decoded.carte2d && decoded.carte3d) {
        setCarte2d(decoded.carte2d);
        setCarte3d(decoded.carte3d);
        setId(decoded.id || "Inconnue");
      } else {
        setError("Token invalide ou incomplet.");
      }
    } catch (err: any) {
      console.error("Erreur de décodage du token :", err);
      setError("Le lien fourni est invalide ou corrompu.");
    }
  }, []);

  // 🗺️ Étape 2 : Chargement de la carte selon l’onglet sélectionné
  useEffect(() => {
    async function loadMap() {
      const url = selected === "2d" ? carte2d : carte3d;
      if (!url) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        const html = await res.text();

        const blob = new Blob([html], { type: "text/html" });
        const blobUrl = URL.createObjectURL(blob);
        setIframeSrc(blobUrl);
      } catch (err: any) {
        console.error("Erreur de chargement :", err);
        setError("Impossible de charger la carte.");
      } finally {
        setLoading(false);
      }
    }

    loadMap();
  }, [selected, carte2d, carte3d]);

  // 🧭 Interface utilisateur
  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        margin: 0,
        background: "#0f172a",
        color: "white",
        fontFamily: "system-ui, sans-serif",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* 🔹 Header */}
      <header
        style={{
          padding: "1rem",
          textAlign: "center",
          borderBottom: "1px solid #334155",
          background: "#1e293b",
        }}
      >
        <h2 style={{ margin: 0, fontWeight: 600 }}>
          Unité foncière {id || "inconnue"}
        </h2>
      </header>

      {/* 🔹 Toolbar */}
      <div
        style={{
          position: "absolute",
          top: 15,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          display: "flex",
          background: "rgba(255,255,255,0.1)",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.2)",
        }}
      >
        <button
          onClick={() => setSelected("2d")}
          style={{
            padding: "0.5rem 1rem",
            background: selected === "2d" ? "#334155" : "transparent",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          🗺️ Plan réglementaire 2D
        </button>
        <button
          onClick={() => setSelected("3d")}
          style={{
            padding: "0.5rem 1rem",
            background: selected === "3d" ? "#334155" : "transparent",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          ⛰️ Topographie 3D
        </button>
      </div>

      {/* 🔹 Loader / Erreur */}
      {loading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#e2e8f0",
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
            color: "#f87171",
            textAlign: "center",
            maxWidth: 400,
          }}
        >
          {error}
        </div>
      )}

      {/* 🔹 Carte */}
      {!error && (
        <iframe
          key={selected}
          src={iframeSrc}
          sandbox="allow-scripts allow-same-origin"
          style={{
            width: "100%",
            height: "calc(100vh - 60px)",
            border: "none",
            display: loading ? "none" : "block",
            background: "white",
          }}
          title={`Carte ${selected}`}
        />
      )}
    </div>
  );
}
