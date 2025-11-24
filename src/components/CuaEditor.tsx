import { useEffect, useState, useMemo } from "react";
import { Editor } from "@tinymce/tinymce-react";
import { FileDown, Map, Save, Loader2 } from "lucide-react";

function encodeToken(obj: any): string {
  const json = JSON.stringify(obj);
  const utf8 = new TextEncoder().encode(json);
  let b64 = btoa(String.fromCharCode(...utf8));
  return b64;
}

function buildToken(path: string) {
  const payload = { docx: path };
  return encodeToken(payload);
}

interface CuaEditorProps {
  slug: string;
  dossier: any;
  apiBase: string;
  onSaved?: () => void;
  mapsPageUrl?: string | null;
  onOpenAI?: () => void;
}

export default function CuaEditor({ slug, dossier, apiBase, onSaved, mapsPageUrl, onOpenAI }: CuaEditorProps) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const base = apiBase.replace(/\/$/, "");

  // URL du DOCX dans Supabase (celui mis à jour par /cua/update)
  const docxPath = useMemo(() => {
    if (!dossier?.output_cua) return null;
    const url = dossier.output_cua;
    const idx = url.indexOf("/object/public/");
    if (idx === -1) return null;
    // Garder tout après /object/public/ - le backend gère le nettoyage avec get_docx_path()
    return url.substring(idx + "/object/public/".length);
  }, [dossier]);

  const token = docxPath ? buildToken(docxPath) : null;

  // Endpoints backend
  const docxUrl = token ? `${base}/cua/download/docx?t=${encodeURIComponent(token)}` : null;

  function makeTokenFromUrl(url: string): string {
    const idx = url.indexOf("/object/public/");
    if (idx === -1) return "";
    const internal = url.substring(idx + "/object/public/".length);
    return encodeToken({ docx: internal });
  }

  useEffect(() => {
    async function loadCUA() {
      if (!dossier?.output_cua) {
        setError("Pas de document disponible");
        setLoading(false);
        return;
      }

      const token = makeTokenFromUrl(dossier.output_cua);

      try {
        setLoading(true);
        const res = await fetch(`${base}/cua/html?t=${encodeURIComponent(token)}`);
        if (!res.ok) throw new Error("Document introuvable");
        const data = await res.json();
        setHtml(data.html || "");
        setError(null);
      } catch (e: any) {
        setError(e.message || "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    }

    loadCUA();
  }, [slug, base, dossier]);

  async function handleSave() {
    if (!dossier?.output_cua) {
      alert("❌ Document non disponible");
      return;
    }

    const token = makeTokenFromUrl(dossier.output_cua);

    try {
      setSaving(true);
      const res = await fetch(`${base}/cua/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, html }),
      });

      if (!res.ok) throw new Error("Erreur de sauvegarde");
      onSaved?.();
    } catch (e: any) {
      alert("❌ " + (e.message || "Erreur"));
    } finally {
      setSaving(false);
    }
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
        {onOpenAI && (
          <button
            onClick={onOpenAI}
            className="bg-[#ff4f3b] text-white px-3 py-1 rounded hover:bg-[#ff4f3b]/90 transition"
          >
            Analyser avec l'IA
          </button>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#0b131f] text-white rounded-lg hover:bg-[#0b131f]/90 disabled:opacity-50 transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Sauvegarder les modifications
        </button>

        {docxUrl && (
          <button
            onClick={() => window.open(docxUrl, "_blank")}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#d5e1e3] text-[#0b131f] rounded-lg hover:bg-[#d5e1e3]/20 transition"
          >
            <FileDown className="w-4 h-4" />
            Télécharger le DOCX
          </button>
        )}

        {mapsPageUrl && (
          <a
            href={mapsPageUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#d5e1e3] text-[#0b131f] rounded-lg hover:bg-[#d5e1e3]/20 transition"
          >
            <Map className="w-4 h-4" />
            Afficher les cartes
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