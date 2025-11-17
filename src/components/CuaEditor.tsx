import { useEffect, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";
import { FileDown, Map, Save, Loader2 } from "lucide-react";

interface CuaEditorProps {
  slug: string;
  apiBase: string;
  onSaved?: () => void;
  carte2dUrl?: string | null;
  carte3dUrl?: string | null;
}

export default function CuaEditor({ slug, apiBase, onSaved, carte2dUrl, carte3dUrl }: CuaEditorProps) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const base = apiBase.replace(/\/$/, "");

  useEffect(() => {
    if (!slug) return;

    async function loadCUA() {
      try {
        setLoading(true);
        const res = await fetch(`${base}/cua/html/${slug}`);
        if (!res.ok) throw new Error("Document introuvable");
        const data = await res.json();
        setHtml(data.html || "");
      } catch (e: any) {
        setError(e.message || "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    }

    loadCUA();
  }, [slug, base]);

  async function handleSave() {
    try {
      setSaving(true);
      const res = await fetch(`${base}/cua/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, html }),
      });

      if (!res.ok) throw new Error("Erreur de sauvegarde");
      onSaved?.();
    } catch (e: any) {
      alert("❌ " + (e.message || "Erreur"));
    } finally {
      setSaving(false);
    }
  }

  function downloadDocx() {
    window.open(`${base}/cua/download/docx/${slug}`, "_blank");
  }

  function downloadPdf() {
    window.open(`${base}/cua/download/pdf/${slug}`, "_blank");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#0b131f]/40" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-[#0b131f]/60">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end gap-2 p-3 bg-white border-b border-[#d5e1e3]">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#0b131f] text-white rounded-lg hover:bg-[#0b131f]/90 disabled:opacity-50 transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Sauvegarder
        </button>

        <button
          onClick={downloadDocx}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-[#d5e1e3] text-[#0b131f] rounded-lg hover:bg-[#d5e1e3]/20 transition"
        >
          <FileDown className="w-4 h-4" />
          DOCX
        </button>

        <button
          onClick={downloadPdf}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-[#d5e1e3] text-[#0b131f] rounded-lg hover:bg-[#d5e1e3]/20 transition"
        >
          <FileDown className="w-4 h-4" />
          PDF
        </button>

        {carte2dUrl && (
          <a
            href={carte2dUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#d5e1e3] text-[#0b131f] rounded-lg hover:bg-[#d5e1e3]/20 transition"
          >
            <Map className="w-4 h-4" />
            Carte 2D
          </a>
        )}

        {carte3dUrl && (
          <a
            href={carte3dUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#d5e1e3] text-[#0b131f] rounded-lg hover:bg-[#d5e1e3]/20 transition"
          >
            <Map className="w-4 h-4" />
            Carte 3D
          </a>
        )}
      </div>

      <div className="flex-1 bg-white overflow-auto">
        <Editor
          tinymceScriptSrc="/tinymce/tinymce.min.js"
          licenseKey="gpl"
          value={html}
          onEditorChange={(content: string) => setHtml(content)}
          init={{
            height: "100%",
            menubar: false,
            branding: false,
            plugins: "link lists table code preview",
            toolbar:
              "undo redo | bold italic | alignleft aligncenter alignright | bullist numlist | link | preview",
            skin_url: "/tinymce/skins/ui/oxide",
            content_css: "/tinymce/skins/content/default/content.css",
            content_style: `
              body {
                font-family: Inter, system-ui, sans-serif;
                font-size: 15px;
                line-height: 1.6;
                color: #0b131f;
                padding: 40px;
                max-width: 900px;
                margin: 0 auto;
              }
              h1, h2, h3 { 
                font-weight: 600;
                color: #0b131f;
                margin-top: 1.5em;
                margin-bottom: 0.5em;
              }
              h1 { font-size: 2em; }
              h2 { font-size: 1.5em; }
              h3 { font-size: 1.2em; }
              table { 
                border-collapse: collapse;
                width: 100%;
                margin: 1em 0;
              }
              table, th, td { 
                border: 1px solid #d5e1e3;
                padding: 8px;
              }
              th {
                background: #f8f9fa;
                font-weight: 600;
              }
            `,
          }}
        />
      </div>
    </div>
  );
}