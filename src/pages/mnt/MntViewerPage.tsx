import { useMemo, useState } from "react";

interface MntRef {
  code_insee: string;
  section: string;
  numero: string;
  exaggeration: number;
  include_voisins: boolean;
}

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export default function MntViewerPage() {
  const [form, setForm] = useState<MntRef>({
    code_insee: "",
    section: "",
    numero: "",
    exaggeration: 1.5,
    include_voisins: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [htmlDoc, setHtmlDoc] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    surfaceM2?: string;
    resolutionM?: string;
    nVoisins?: string;
  }>({});

  const canSubmit = useMemo(() => {
    return (
      form.code_insee.trim().length > 0 &&
      form.section.trim().length > 0 &&
      form.numero.trim().length > 0 &&
      !loading
    );
  }, [form, loading]);

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setHtmlDoc(null);
    setMeta({});

    try {
      const res = await fetch(`${API}/mnt/visualisation/html`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code_insee: form.code_insee.trim(),
          section: form.section.trim().toUpperCase(),
          numero: form.numero.trim(),
          exaggeration: form.exaggeration,
          include_voisins: form.include_voisins,
        }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? "Erreur backend MNT");
      }

      const surfaceM2 = res.headers.get("X-Surface-M2") ?? undefined;
      const resolutionM = res.headers.get("X-Resolution-M") ?? undefined;
      const nVoisins = res.headers.get("X-N-Voisins") ?? undefined;
      setMeta({ surfaceM2, resolutionM, nVoisins });

      const html = await res.text();
      setHtmlDoc(html);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0d0d10", color: "#e5e7eb" }}>
      <div
        style={{
          width: 320,
          minWidth: 280,
          borderRight: "1px solid #1f2230",
          background: "#111318",
          padding: 16,
          boxSizing: "border-box",
          overflowY: "auto",
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Visualiseur MNT 3D</h2>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9ca3af" }}>
          Parcelle depuis Supabase (<code>latresne.parcelles_latresne</code>), MNT élargi aux parcelles
          contiguës si activé. Contour jaune = parcelle cible.
        </p>

        <label style={labelStyle}>Code INSEE</label>
        <input
          style={inputStyle}
          value={form.code_insee}
          onChange={(e) => setForm((p) => ({ ...p, code_insee: e.target.value }))}
          placeholder="ex: 33234"
        />

        <label style={labelStyle}>Section</label>
        <input
          style={inputStyle}
          value={form.section}
          onChange={(e) => setForm((p) => ({ ...p, section: e.target.value }))}
          placeholder="ex: AE"
        />

        <label style={labelStyle}>Numero</label>
        <input
          style={inputStyle}
          value={form.numero}
          onChange={(e) => setForm((p) => ({ ...p, numero: e.target.value }))}
          placeholder="ex: 0364"
        />

        <label style={{ ...labelStyle, marginTop: 14 }}>Parcelles voisines (terrain environnant)</label>
        <label style={checkboxRowStyle}>
          <input
            type="checkbox"
            checked={form.include_voisins}
            onChange={(e) => setForm((p) => ({ ...p, include_voisins: e.target.checked }))}
          />
          <span>Inclure les parcelles contiguës dans le MNT</span>
        </label>

        <label style={labelStyle}>Exageration verticale</label>
        <input
          style={inputStyle}
          type="number"
          min={0.1}
          step={0.1}
          value={form.exaggeration}
          onChange={(e) => setForm((p) => ({ ...p, exaggeration: Number(e.target.value) || 1.5 }))}
        />

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            marginTop: 12,
            width: "100%",
            border: "none",
            borderRadius: 8,
            background: canSubmit ? "#3b82f6" : "#334155",
            color: "white",
            padding: "10px 12px",
            cursor: canSubmit ? "pointer" : "default",
          }}
        >
          {loading ? "Generation..." : "Generer visualisation MNT"}
        </button>

        {error && (
          <div style={{ marginTop: 12, color: "#fca5a5", fontSize: 12, whiteSpace: "pre-wrap" }}>
            {error}
          </div>
        )}

        {(meta.surfaceM2 || meta.resolutionM || meta.nVoisins !== undefined) && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#9ca3af" }}>
            {meta.surfaceM2 && <div>Surface parcelle cible: {Number(meta.surfaceM2).toLocaleString()} m²</div>}
            {meta.resolutionM && <div>Résolution MNT: {meta.resolutionM} m</div>}
            {meta.nVoisins !== undefined && form.include_voisins && (
              <div>Parcelles voisines incluses: {meta.nVoisins}</div>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1, position: "relative", background: "#0b0b0f" }}>
        {!htmlDoc && !loading && (
          <div style={placeholderStyle}>Saisis une reference parcellaire puis lance la generation MNT.</div>
        )}
        {loading && <div style={placeholderStyle}>Generation en cours...</div>}
        {htmlDoc && (
          <iframe
            title="MNT 3D"
            srcDoc={htmlDoc}
            style={{ width: "100%", height: "100%", border: "none", background: "#0b0b0f" }}
          />
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 4,
  marginTop: 10,
  fontSize: 11,
  color: "#9ca3af",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #2a2d3e",
  borderRadius: 6,
  background: "#1a1d27",
  color: "#e5e7eb",
  fontSize: 13,
  padding: "8px 10px",
  outline: "none",
};

const checkboxRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  color: "#e5e7eb",
  cursor: "pointer",
  marginTop: 6,
};

const placeholderStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#6b7280",
  fontSize: 14,
  textAlign: "center",
  padding: 24,
};
