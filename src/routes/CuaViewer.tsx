import { useEffect, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";

// === TinyMCE (self-host, gratuit, pas de cloud) ===
import "tinymce/tinymce";
import "tinymce/icons/default";
import "tinymce/themes/silver";
import "tinymce/models/dom/model";

// Plugins open-source uniquement
import "tinymce/plugins/lists";
import "tinymce/plugins/table";
import "tinymce/plugins/link";
import "tinymce/plugins/image";
import "tinymce/plugins/code";
import "tinymce/plugins/accordion";

export default function CuaViewer() {
  const [html, setHtml] = useState<string>("");
  const [token, setToken] = useState<string | null>(null);
  const [toc, setToc] = useState<Array<{ id: string; text: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ================================
  // 1) Chargement du CUA depuis backend
  // ================================
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

        // Génère sommaire à partir du HTML
        generateTOC(data.html);

      } catch (e) {
        setError("Impossible de charger le document.");
      } finally {
        setLoading(false);
      }
    }

    loadCUA();
  }, []);

  // ================================
  // 2) Génération du Sommaire
  // ================================
  function generateTOC(rawHtml: string) {
    const div = document.createElement("div");
    div.innerHTML = rawHtml;

    const headers = div.querySelectorAll("h1, h2, h3");
    const tocItems: any[] = [];

    headers.forEach((h, index) => {
      const text = h.textContent || "";
      const id = `section-${index}`;
      h.setAttribute("id", id);
      tocItems.push({ id, text });
    });

    setToc(tocItems);
  }

  // ================================
  // 3) Sauvegarde backend (HTML -> DOCX)
  // ================================
  async function saveChanges() {
    if (!token) return;
    setSaving(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/cua/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, html }),
      });

      const data = await res.json();
      if (!data.status || data.status !== "success") {
        throw new Error("Erreur de sauvegarde");
      }

      alert("✔️ CUA mis à jour avec succès !");
    } catch (e) {
      alert("❌ Impossible d’enregistrer les modifications.");
    } finally {
      setSaving(false);
    }
  }

  // ================================
  // 4) État loading / erreur
  // ================================
  if (loading) {
    return <div className="text-center mt-20 text-gray-600">Chargement…</div>;
  }

  if (error) {
    return <div className="text-center mt-20 text-red-500">{error}</div>;
  }

  // ================================
  // 5) Rendu principal
  // ================================
  return (
    <div className="min-h-screen bg-[#F4F7F6] flex flex-col md:flex-row">

      {/* ========= SOMMAIRE ========== */}
      <aside className="w-full md:w-64 bg-white shadow-lg p-6 border-r border-gray-200">
        <h2 className="text-xl font-semibold text-[#0A7AFE] mb-4">
          Sommaire
        </h2>

        <ul className="space-y-2">
          {toc.map((item) => (
            <li key={item.id}>
              <a
                className="text-gray-700 hover:text-[#0A7AFE] cursor-pointer"
                onClick={() => {
                  const el = document.getElementById(item.id);
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </aside>

      {/* ========= CONTENU ========== */}
      <main className="flex-1 p-8">

        {/* Titre */}
        <h1 className="text-3xl font-bold text-center mb-6 text-[#0A5768]">
          Patron de Certificat d’Urbanisme – Kerelia
        </h1>

        {/* Bouton Sauvegarder */}
        <div className="flex justify-center mb-6">
          <button
            onClick={saveChanges}
            disabled={saving}
            className="px-6 py-3 bg-[#0A7AFE] text-white font-semibold rounded-lg shadow hover:bg-[#065FD1] disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "💾 Sauvegarder les modifications"}
          </button>
        </div>

        {/* === Editeur === */}
        <Editor
          value={html}
          onEditorChange={(content) => setHtml(content)}
          init={{
            menubar: "file edit view insert format tools table",
            branding: false,
            height: 1200,
            plugins: "lists table link image code accordion",
            toolbar:
              "undo redo | styles | bold italic underline | alignleft aligncenter alignright | bullist numlist | table | link image | code",
            skin: "oxide",
            content_css: "default",
          }}
        />
      </main>
    </div>
  );
}
