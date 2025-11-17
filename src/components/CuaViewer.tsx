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

    // Décode le token Base64 provenant du lien
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
    return (
      <div style={{ textAlign: "center", marginTop: "10%" }}>
        Chargement du CUA…
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontWeight: 600, textAlign: "center" }}>
        Certificat d’Urbanisme
      </h1>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: "center",
          margin: "20px 0",
        }}
      >
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

      {/* STYLES DU DOCUMENT */}
      <style>
        {`
        .cua-html {
          font-family: "Inter", sans-serif;
          line-height: 1.6;
          font-size: 15px;
          color: #1a1a1a;
        }

        .cua-html h1 {
          font-size: 28px;
          font-weight: 700;
          margin: 40px 0 20px;
          text-align: center;
          color: #111;
        }

        .cua-html h2 {
          font-size: 22px;
          margin: 30px 0 10px;
          font-weight: 600;
          color: #0A7AFE;
        }

        .cua-html h3 {
          font-size: 18px;
          margin: 25px 0 8px;
          font-weight: 600;
        }

        .cua-html p {
          margin: 10px 0;
          text-align: justify;
        }

        .cua-html img {
          display: block;
          margin: 20px auto;
          max-width: 350px;
        }

        .cua-html table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          font-size: 14px;
        }

        .cua-html td, .cua-html th {
          border: 1px solid #ccc;
          padding: 8px 10px;
        }

        .cua-html th {
          background: #f5f7fa;
          font-weight: 600;
        }

        .cua-html ul {
          margin: 10px 0 10px 30px;
        }

        .cua-html hr {
          margin: 30px 0;
          border: none;
          border-top: 1px solid #ddd;
        }

        .cua-html .note-reference {
          font-size: 13px;
          color: #666;
        }

        @media print {
          body {
            background: white !important;
          }
          .cua-html {
            padding: 0 !important;
            box-shadow: none !important;
          }
        }
      `}
      </style>

      {/* Contenu HTML du CUA */}
      <div
        className="cua-html"
        style={{
          background: "white",
          padding: "40px",
          borderRadius: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
