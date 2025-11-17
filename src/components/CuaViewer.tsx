import { useEffect, useState } from "react";

export default function CuaViewer() {
  const [html, setHtml] = useState<string>("");
  const [docxUrl, setDocxUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");

    if (!t) {
      setError("Aucun token fourni.");
      return;
    }

    setToken(t);

    try {
      const decoded = JSON.parse(atob(t));
      if (decoded.docx) {
        setDocxUrl(decoded.docx);
      }
    } catch {
      setError("Token corrompu.");
      return;
    }

    async function loadCUA() {
      try {
        const url = `${import.meta.env.VITE_API_BASE}/cua/html?t=${t}`;
        const res = await fetch(url);
        const data = await res.json();
        setHtml(data.html);
      } catch (e: any) {
        setError("Impossible de charger le document.");
      } finally {
        setLoading(false);
      }
    }

    loadCUA();
  }, []);

  if (error) {
    return <div style={{ textAlign: "center", marginTop: "10%" }}>{error}</div>;
  }

  if (loading) {
    return <div style={{ textAlign: "center", marginTop: "10%" }}>
      Chargement du CUA…
    </div>;
  }

  return (
    <div style={{ padding: "20px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontWeight: 600, textAlign: "center" }}>
        Certificat d’Urbanisme
      </h1>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, justifyContent: "center", margin: "20px 0" }}>
        {docxUrl && (
          <a
            href={docxUrl}
            target="_blank"
            style={{
              padding: "8px 16px",
              background: "#0A7AFE",
              color: "white",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            Télécharger DOCX
          </a>
        )}

        {token && (
          <a
            href={`${import.meta.env.VITE_API_BASE}/export/pdf?t=${token}`}
            target="_blank"
            style={{
              padding: "8px 16px",
              background: "#111",
              color: "white",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            Exporter PDF
          </a>
        )}
      </div>

      {/* Contenu HTML */}
      <div
        style={{
          background: "white",
          padding: "20px",
          borderRadius: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
