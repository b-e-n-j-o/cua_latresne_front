import { useEffect, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";

export default function CuaViewer() {
  const [html, setHtml] = useState<string>("");
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

    async function loadCUA() {
      try {
        const url = `${import.meta.env.VITE_API_BASE}/cua/html?t=${t}`;
        const res = await fetch(url);
        const data = await res.json();
        setHtml(data.html);
      } catch (e) {
        setError("Impossible de charger le document.");
      } finally {
        setLoading(false);
      }
    }

    loadCUA();
  }, []);

  async function saveEdits(updatedHtml: string) {
    if (!token) return;

    const res = await fetch(`${import.meta.env.VITE_API_BASE}/cua/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, html: updatedHtml }),
    });

    if (!res.ok) {
      alert("❌ Erreur lors de la sauvegarde");
      return;
    }

    alert("💾 Modifications sauvegardées !");
  }

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
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ textAlign: "center", fontWeight: 700, marginBottom: 20 }}>
        Patron de Certificat d’Urbanisme — Kerelia
      </h1>

      {/* Bouton sauvegarde */}
      <div style={{ textAlign: "right", marginBottom: 15 }}>
        <button
          onClick={() => saveEdits(html)}
          style={{
            background: "#0A7AFE",
            color: "white",
            padding: "10px 20px",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
          }}
        >
          💾 Sauvegarder
        </button>
      </div>

      <Editor
        tinymceScriptSrc="/tinymce/tinymce.min.js"
        licenseKey="gpl" // Obligatoire pour self-hosted
        initialValue={html}
        onEditorChange={(content) => setHtml(content)}
        init={{
          height: 1000,
          menubar: false,
          branding: false,
          plugins: "link lists table code preview",
          toolbar:
            "undo redo | bold italic | alignleft aligncenter alignright | bullist numlist | link",
          skin_url: "/tinymce/skins/ui/oxide",
          content_css: "/tinymce/skins/content/default/content.css",
          content_style: `
            body {
              font-family: Inter, sans-serif;
              font-size: 15px;
              line-height: 1.6;
              color: #1a1a1a;
              padding: 20px;
            }
            h1,h2,h3 { font-weight: 600; }
            table { border-collapse: collapse; width: 100%; }
            table, th, td { border: 1px solid #ccc; padding: 6px; }
          `,
        }}
      />
    </div>
  );
}
