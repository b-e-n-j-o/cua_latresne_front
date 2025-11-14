import { useEffect, useState } from "react";
import supabase from "./supabaseClient";

type PipelineRow = {
  slug: string;
  created_at?: string;
  commune?: string;
  code_insee?: string;
  status: string;
  qr_url?: string;
  output_cua?: string;
  carte_2d_url?: string;
  carte_3d_url?: string;
};

type Props = {
  apiBase: string;
  className?: string;
};

export default function HistoryPanel({ apiBase, className }: Props) {
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const base = apiBase.replace(/\/$/, "");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: sess } = await supabase.auth.getSession();
        const userId = sess.session?.user?.id;
        if (!userId) {
          setError("Utilisateur non connecté");
          setLoading(false);
          return;
        }

        const res = await fetch(`${base}/pipelines/by_user?user_id=${userId}`);
        const j = await res.json();
        if (!j.success) throw new Error(j.error || "Erreur de chargement");
        setRows(j.pipelines || []);
      } catch (e: any) {
        setError(e.message || "Erreur réseau");
      } finally {
        setLoading(false);
      }
    })();
  }, [base]);

  if (loading) return <div className={className}>Chargement de l'historique…</div>;
  if (error) return <div className={className + " text-red-600"}>{error}</div>;
  if (!rows.length) return <div className={className}>Aucune analyse enregistrée pour cet utilisateur.</div>;

  return (
    <section className={className}>
      <div className="rounded-2xl border border-white/15 bg-[#0b131f]/70 backdrop-blur-xl p-6 text-[#d5e1e3]">
        <h3 className="text-base font-semibold mb-4 text-[#d5e1e3]">
          Mes analyses précédentes
        </h3>
        <div className="grid gap-4">
          {rows.map((r) => (
            <div
              key={r.slug}
              className="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-[#d5e1e3]/60">
                    {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                  </div>
                  <div className="text-sm font-medium text-[#d5e1e3]">
                    {r.commune || "Commune"} — INSEE {r.code_insee || "?"}
                  </div>
                </div>
                <span
                  className={`text-xs rounded-full px-3 py-1 font-medium ${
                    r.status === "success"
                      ? "bg-[#1a2b42] text-[#d5e1e3]"
                      : r.status === "error"
                      ? "bg-[#ff4f3b]/10 text-[#ff4f3b]"
                      : "bg-white/10 text-[#d5e1e3]"
                  }`}
                >
                  {r.status}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {r.output_cua && (
                  <a
                    href={r.output_cua}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full px-3 py-1.5 text-sm font-medium text-white"
                    style={{ backgroundColor: "#1a2b42" }}
                  >
                    Rapport
                  </a>
                )}
                {r.qr_url && (
                  <a
                    href={r.qr_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full px-3 py-1.5 text-sm font-medium text-white"
                    style={{ backgroundColor: "#ff4f3b" }}
                  >
                    Carte
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
