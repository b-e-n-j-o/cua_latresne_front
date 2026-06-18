import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Editor } from "@tinymce/tinymce-react";
import type { Editor as TinyMCEEditor } from "tinymce";
import { downloadCuaDocx } from "../utils/cuaViewer";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function CuaViewer() {
  const [initialHtml, setInitialHtml] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const editorRef = useRef<TinyMCEEditor | null>(null);
  const htmlRef = useRef("");
  const docxVersionRef = useRef<number>(Date.now());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");

    if (!t) {
      setError("Aucun token fourni.");
      setLoading(false);
      return;
    }

    setToken(t);

    async function loadCUA() {
      try {
        const url = `${import.meta.env.VITE_API_BASE}/cua/html?t=${encodeURIComponent(t!)}&v=${Date.now()}`;
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.detail || "Erreur backend");
        }
        if (typeof data?.html !== "string") {
          throw new Error("Réponse invalide: HTML manquant");
        }
        htmlRef.current = data.html;
        setInitialHtml(data.html);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Impossible de charger le document.";
        setError(`Impossible de charger le document: ${msg}`);
      } finally {
        setLoading(false);
      }
    }

    void loadCUA();
  }, []);

  async function downloadDocx() {
    if (!token) return;

    try {
      await downloadCuaDocx(token, { version: docxVersionRef.current });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Impossible de télécharger le DOCX.";
      alert(`❌ ${msg}`);
    }
  }

  async function saveEdits() {
    if (!token) return;

    const updatedHtml = editorRef.current?.getContent() ?? htmlRef.current;
    setSaveState("saving");
    setSaveMessage(null);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/cua/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, html: updatedHtml }),
      });

      if (!res.ok) {
        let detail = "Erreur lors de la sauvegarde";
        try {
          const data = await res.json();
          detail = data?.detail || detail;
        } catch {
          // ignore
        }
        throw new Error(detail);
      }

      const data = (await res.json()) as { saved_at?: string };
      docxVersionRef.current = data.saved_at
        ? Date.parse(data.saved_at) || Date.now()
        : Date.now();

      htmlRef.current = updatedHtml;
      setSaveState("saved");
      setSaveMessage("Modifications enregistrées avec succès.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur lors de la sauvegarde";
      setSaveState("error");
      setSaveMessage(msg);
    }
  }

  useEffect(() => {
    if (saveState !== "saved") return;
    const timer = window.setTimeout(() => {
      setSaveState("idle");
      setSaveMessage(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [saveState]);

  if (error) {
    return <div style={{ textAlign: "center", marginTop: "10%" }}>{error}</div>;
  }

  if (loading || initialHtml === null) {
    return (
      <div style={{ textAlign: "center", marginTop: "10%" }}>
        Chargement du CUA…
      </div>
    );
  }

  const saveButtonStyle: CSSProperties = {
    padding: "10px 20px",
    borderRadius: 6,
    border: "none",
    cursor: saveState === "saving" ? "wait" : "pointer",
    opacity: saveState === "saving" ? 0.75 : 1,
    background:
      saveState === "saved" ? "#16a34a" : saveState === "error" ? "#dc2626" : "#0A7AFE",
    color: "white",
  };

  return (
    <div style={{ padding: 20, width: "100%", maxWidth: "100vw", margin: "0 auto" }}>
      <h1 style={{ textAlign: "center", fontWeight: 700, marginBottom: 20 }}>
        Patron de Certificat d&apos;Urbanisme — Kerelia
      </h1>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 10,
          marginBottom: 15,
          flexWrap: "wrap",
        }}
      >
        {saveMessage && (
          <span
            style={{
              fontSize: 14,
              color: saveState === "error" ? "#dc2626" : "#16a34a",
              marginRight: "auto",
            }}
          >
            {saveMessage}
          </span>
        )}

        <button
          type="button"
          onClick={() => void downloadDocx()}
          style={{
            background: "#ffffff",
            color: "#0A7AFE",
            padding: "10px 20px",
            borderRadius: 6,
            border: "1px solid #0A7AFE",
            cursor: "pointer",
          }}
        >
          Télécharger DOCX
        </button>
        <button
          type="button"
          onClick={() => void saveEdits()}
          disabled={saveState === "saving"}
          style={saveButtonStyle}
        >
          {saveState === "saving"
            ? "Sauvegarde…"
            : saveState === "saved"
              ? "✓ Enregistré"
              : saveState === "error"
                ? "Réessayer"
                : "Sauvegarder"}
        </button>
      </div>

      <Editor
        tinymceScriptSrc="/tinymce/tinymce.min.js"
        licenseKey="gpl"
        initialValue={initialHtml}
        onInit={(_evt, editor) => {
          editorRef.current = editor;
        }}
        onEditorChange={(content) => {
          htmlRef.current = content;
        }}
        init={{
          height: 1000,
          width: "100%",
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
              margin: 0;
              max-width: 100%;
              overflow-x: hidden;
              box-sizing: border-box;
            }
            h1,h2,h3 { font-weight: 600; }
            table { border-collapse: collapse; width: 100%; table-layout: fixed; }
            table, th, td { border: 1px solid #ccc; padding: 6px; }
            img, table, pre, iframe {
              max-width: 100%;
            }
          `,
        }}
      />
    </div>
  );
}
