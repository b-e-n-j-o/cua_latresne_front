import { useEffect, useMemo, useState } from "react";
import supabase from "./supabaseClient";

type HistoryRow = {
  id: string;
  created_at: string;
  status: "success" | "error" | "running" | "idle" | string;
  parcel_label?: string | null;
  insee?: string | null;
  layers_with_hits?: number | null;
  report_docx_path?: string | null;
  report_markdown_path?: string | null;
  map_html_path?: string | null;
  // champs à venir
  title?: string | null;
  cerfa_number?: string | null;
  applicant_lastname?: string | null;
};

type Props = {
  /** Ex: https://cua-latresne-1.onrender.com  pour préfixer /files/...  */
  apiBase?: string;
  /** Par défaut 20 */
  pageSize?: number;
  className?: string;
};

const PAGE_DEFAULT = 20;

export default function HistoryPanel({ apiBase, pageSize = PAGE_DEFAULT, className }: Props) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // recherche serveur (illimitée)
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const isSearching = q.trim().length > 0;

  // pagination récente
  const [recentOffset, setRecentOffset] = useState(0);
  const [recentHasMore, setRecentHasMore] = useState(true);

  // pagination search
  const [searchRows, setSearchRows] = useState<HistoryRow[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searching, setSearching] = useState(false);

  // debounce 300ms
  useEffect(() => {
    const id = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  // helpers
  const base =
    (apiBase && apiBase.replace(/\/$/, "")) ||
    (localStorage.getItem("apiBase") || "").replace(/\/$/, "");

  async function toUrl(path?: string | null): Promise<string | null> {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path; // déjà absolue (backend)
    if (path.startsWith("/")) {
      if (!base) return null;
      return `${base}${path}`; // /files/... → prefix apiBase
    }
    // suppose un path Storage
    const { data, error } = await supabase.storage.from("cua-artifacts").createSignedUrl(path, 3600);
    if (error) return null;
    return data.signedUrl;
  }
  async function openLink(path?: string | null) {
    const url = await toUrl(path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  // fetchers
  async function fetchRecent(offset = 0) {
    const { data, error } = await supabase
      .from("cua_jobs")
      .select(
        "id, created_at, status, parcel_label, insee, layers_with_hits, report_docx_path, report_markdown_path, map_html_path, title, cerfa_number, applicant_lastname"
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    return (data as HistoryRow[]) || [];
  }

  async function fetchSearchRPC(query: string, page = 1) {
    const off = (page - 1) * pageSize;
    const { data, error } = await supabase.rpc("search_cua_jobs", {
      q: query,
      lim: pageSize,
      off,
    });
    if (error) throw error;
    return (data as HistoryRow[]) || [];
  }

  async function fetchSearchFallback(query: string, page = 1) {
    const off = (page - 1) * pageSize;
    const like = `%${query}%`;
    const { data, error } = await supabase
      .from("cua_jobs")
      .select(
        "id, created_at, status, parcel_label, insee, layers_with_hits, report_docx_path, report_markdown_path, map_html_path, title, cerfa_number, applicant_lastname"
      )
      .or(
        [
          `title.ilike.${like}`,
          `parcel_label.ilike.${like}`,
          `insee.ilike.${like}`,
          `cerfa_number.ilike.${like}`,
          `applicant_lastname.ilike.${like}`,
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .range(off, off + pageSize - 1);

    if (error) throw error;
    return (data as HistoryRow[]) || [];
  }

  // initial : charge la première page sans recherche
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const first = await fetchRecent(0);
        if (!mounted) return;
        setRows(first);
        setRecentOffset(first.length);
        setRecentHasMore(first.length === pageSize);
      } catch (e: any) {
        setError(e.message || "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // à chaque recherche (debounced) : remet la page à 1 et charge
  useEffect(() => {
    if (!qDebounced) {
      setSearching(false);
      setSearchRows([]);
      setSearchPage(1);
      setSearchHasMore(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        setSearching(true);
        let first: HistoryRow[] = [];
        try {
          first = await fetchSearchRPC(qDebounced, 1);
        } catch {
          first = await fetchSearchFallback(qDebounced, 1);
        }
        if (!mounted) return;
        setSearchRows(first);
        setSearchPage(1);
        setSearchHasMore(first.length === pageSize);
      } finally {
        setSearching(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced, pageSize]);

  async function loadMore() {
    if (qDebounced) {
      // recherche
      const next = searchPage + 1;
      let more: HistoryRow[] = [];
      try {
        more = await fetchSearchRPC(qDebounced, next);
      } catch {
        more = await fetchSearchFallback(qDebounced, next);
      }
      setSearchRows((p) => [...p, ...more]);
      setSearchPage(next);
      setSearchHasMore(more.length === pageSize);
    } else {
      // récent
      const more = await fetchRecent(recentOffset);
      setRows((p) => [...p, ...more]);
      setRecentOffset((o) => o + more.length);
      setRecentHasMore(more.length === pageSize);
    }
  }

  const list = isSearching ? searchRows : rows;
  const hasMore = isSearching ? searchHasMore : recentHasMore;

  if (loading) return <div className={className}>Chargement…</div>;
  if (error) return <div className={className + " text-red-600"}>{error}</div>;

  return (
    <section className={className}>
      <div className="rounded-2xl border bg-white p-4">
        {/* Titre + recherche */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Historique</h3>
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher (parcelle, n° CERFA, nom...)"
              className="rounded-xl border px-3 py-2 w-64"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="rounded-full px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200"
              >
                Effacer
              </button>
            )}
          </div>
        </div>

        {/* Compteur */}
        <div className="mt-1 text-xs text-gray-500">
          {isSearching
            ? searching
              ? "Recherche…"
              : `${list.length} résultat(s)`
            : `Derniers dossiers (${list.length})`}
        </div>

        {/* Liste */}
        {(!list || list.length === 0) && !searching ? (
          <p className="mt-4 text-sm text-gray-500">Aucun dossier pour le moment.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {list.map((r) => (
              <div key={r.id} className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-gray-500">
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                    <div className="font-medium">
                      {r.title || r.parcel_label || "Parcelle —"}{" "}
                      {r.insee ? `(INSEE ${r.insee})` : ""}
                    </div>
                    <div className="text-xs text-gray-500">
                      {r.cerfa_number ? (
                        <>
                          CERFA : <span className="font-medium">{r.cerfa_number}</span>
                          {" · "}
                        </>
                      ) : null}
                      {r.applicant_lastname ? (
                        <>
                          Dossier :{" "}
                          <span className="font-medium">{r.applicant_lastname}</span>
                        </>
                      ) : null}
                      {typeof r.layers_with_hits === "number" ? (
                        <>
                          {" "}
                          {r.cerfa_number || r.applicant_lastname ? " · " : ""}
                          {r.layers_with_hits} couches intersectées
                        </>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className={`text-xs rounded-full px-2 py-1 ${
                      r.status === "success"
                        ? "bg-emerald-100 text-emerald-700"
                        : r.status === "error"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      openLink(r.report_docx_path || r.report_markdown_path)
                    }
                    className="rounded-full px-3 py-1.5 text-sm text-white"
                    style={{ backgroundColor: "#2E6E62" }}
                  >
                    Rapport
                  </button>
                  <button
                    onClick={() => openLink(r.map_html_path)}
                    className="rounded-full px-3 py-1.5 text-sm text-white"
                    style={{ backgroundColor: "#E98C7E" }}
                  >
                    Carte
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && !searching && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={loadMore}
              className="rounded-full px-4 py-2 text-sm text-white"
              style={{ backgroundColor: "#2E6E62" }}
            >
              Afficher plus
            </button>
          </div>
        )}
        {isSearching && searchHasMore && !searching && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={loadMore}
              className="rounded-full px-4 py-2 text-sm text-white"
              style={{ backgroundColor: "#2E6E62" }}
            >
              Plus de résultats
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
