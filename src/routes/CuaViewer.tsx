import { useEffect, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";

export default function CuaViewer() {
  const [html, setHtml] = useState<string>("");
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = import.meta.env.VITE_API_BASE;

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
        const res = await fetch(`${API_BASE}/cua/html?t=${t}`);
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

  // ----- Sauvegarde -----
  async function saveCUA() {
    if (!token) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/cua/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          html,
        }),
      });

      if (!res.ok) {
        throw new Error("Erreur serveur");
      }

      alert("CUA sauvegardé avec succès ! 🎉");
    } catch (e) {
      setError("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
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
    <div style={{ padding: 30, maxWidth: 900, margin: "0 auto" }}>
      <h1
        style={{
          fontWeight: 700,
          textAlign: "center",
          marginBottom: 20,
          fontSize: 26,
        }}
      >
        Patron de Certificat d’Urbanisme — Kerelia
      </h1>

      {/* Bouton sauvegarde */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <button
          onClick={saveCUA}
          disabled={saving}
          style={{
            padding: "10px 22px",
            background: "#0A7AFE",
            color: "white",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          {saving ? "Sauvegarde…" : "💾 Enregistrer les modifications"}
        </button>
      </div>

      {/* Editeur TinyMCE */}
      <Editor
        apiKey="no-api-key" // TinyMCE fonctionne sans abonnement
        value={html}
        init={{
          height: 1400,
          menubar: false,
          plugins: "lists table codesample link image autolink",
          toolbar:
            "undo redo | bold italic underline | alignleft aligncenter alignright | bullist numlist | table | link unlink | removeformat",
          content_style: `
            body { 
              font-family: Inter, sans-serif; 
              line-height: 1.6; 
              font-size: 15px; 
              padding: 20px;
            }
            h1,h2,h3 { margin-top: 24px; }
            table, th, td { border: 1px solid #ccc; border-collapse: collapse; padding: 6px; }
          `,
        }}
        onEditorChange={(content) => setHtml(content)}
      />

      {/* Optionnel : message d'erreur */}
      {error && (
        <p style={{ color: "red", textAlign: "center", marginTop: 10 }}>
          {error}
        </p>
      )}
    </div>
  );
}
