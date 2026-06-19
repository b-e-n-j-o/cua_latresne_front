/**
 * ReglementsAdmin.tsx — Back-office Kerelia (superadmin).
 * Vue complète des catalogues règlements par schéma commune (PLU, laius, détails PPR…).
 */
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import supabase from "../../supabaseClient";
import { fetchCommuneAccess } from "../../auth/communeAccess";
import { ReglementsEditor } from "./ReglementsArgeles";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");

type AdminCatalogue = {
  commune_slug: string;
  label: string;
  schema: string;
  enabled: boolean;
  disabled_message?: string | null;
  source_count?: number;
};

export default function ReglementsAdminPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [token, setToken] = useState<string | undefined>(
    () => import.meta.env.VITE_ADMIN_API_TOKEN || undefined
  );
  const [catalogues, setCatalogues] = useState<AdminCatalogue[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (import.meta.env.VITE_ADMIN_API_TOKEN) {
        setIsSuperadmin(true);
        setAuthLoading(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!mounted) return;
      if (!session?.user) {
        setIsSuperadmin(false);
        setAuthLoading(false);
        return;
      }
      setToken(session.access_token);
      const access = await fetchCommuneAccess(session.user);
      if (!mounted) return;
      setIsSuperadmin(Boolean(access.isSuperadmin));
      setAuthLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading || !isSuperadmin) return;
    let mounted = true;
    setCatalogLoading(true);
    setCatalogError(null);
    fetch(`${API_BASE}/admin/reglements/catalogues`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.detail || res.statusText);
        }
        return res.json() as Promise<AdminCatalogue[]>;
      })
      .then((data) => {
        if (!mounted) return;
        setCatalogues(data);
        const first =
          data.find((c) => c.enabled)?.commune_slug || data[0]?.commune_slug || "";
        setSelectedSlug((prev) => prev || first);
      })
      .catch((e: Error) => {
        if (!mounted) return;
        setCatalogError(e.message);
        setCatalogues([]);
      })
      .finally(() => {
        if (mounted) setCatalogLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [authLoading, isSuperadmin, token]);

  const activeCatalogue = useMemo(
    () => catalogues.find((c) => c.commune_slug === selectedSlug) || null,
    [catalogues, selectedSlug]
  );

  if (authLoading) {
    return (
      <div className="reglements-admin-page">
        <p className="reglements-admin-muted">Vérification des droits…</p>
      </div>
    );
  }

  if (!isSuperadmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="reglements-admin-page">
      <style>{PAGE_CSS}</style>

      <header className="reglements-admin-header">
        <div>
          <p className="reglements-admin-kicker">Kerelia — Administration</p>
          <h1>Règlements (vue complète)</h1>
          <p className="reglements-admin-sub">
            Édition de tous les catalogues règlements par commune. Les portails communaux
            n&apos;exposent qu&apos;un sous-ensemble (laius).
          </p>
        </div>
        <nav className="reglements-admin-nav">
          <Link to="/admin">Admin général</Link>
          <Link to="/history">Historique</Link>
        </nav>
      </header>

      {catalogLoading && <p className="reglements-admin-muted">Chargement des catalogues…</p>}
      {catalogError && <p className="reglements-admin-error">{catalogError}</p>}

      {!catalogLoading && !catalogError && selectedSlug && (
        <>
          <div className="reglements-admin-toolbar">
            <label className="reglements-admin-picker">
              <span>Commune / schéma</span>
              <select
                value={selectedSlug}
                onChange={(e) => setSelectedSlug(e.target.value)}
                aria-label="Choisir le catalogue commune"
              >
                {catalogues.map((c) => (
                  <option key={c.commune_slug} value={c.commune_slug}>
                    {c.label} ({c.schema})
                    {!c.enabled ? " — à venir" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ReglementsEditor
            key={selectedSlug}
            apiBase={API_BASE}
            token={token}
            communeSlug={selectedSlug}
            apiMode="admin"
            disabledMessage={
              activeCatalogue && !activeCatalogue.enabled
                ? activeCatalogue.disabled_message || "Catalogue indisponible pour cette commune."
                : null
            }
          />
        </>
      )}
    </div>
  );
}

const PAGE_CSS = `
.reglements-admin-page{
  min-height:100vh; background:#f4f4f4; padding:24px 28px 40px;
  font-family:"Kerelia Sans","Inter",system-ui,sans-serif; color:#111;
}
.reglements-admin-header{
  display:flex; justify-content:space-between; align-items:flex-start; gap:20px;
  margin-bottom:20px; flex-wrap:wrap;
}
.reglements-admin-kicker{
  margin:0 0 4px; font-size:11px; letter-spacing:.12em; text-transform:uppercase;
  color:#289f01; font-weight:600;
}
.reglements-admin-header h1{margin:0 0 8px; font-size:28px; font-weight:600;}
.reglements-admin-sub{margin:0; color:#555; max-width:720px; line-height:1.5; font-size:14px;}
.reglements-admin-nav{display:flex; gap:12px; font-size:14px;}
.reglements-admin-nav a{color:#289f01; text-decoration:none; font-weight:600;}
.reglements-admin-nav a:hover{text-decoration:underline;}
.reglements-admin-muted,.reglements-admin-error{padding:12px 0; font-size:14px;}
.reglements-admin-error{color:#c0362c;}
.reglements-admin-toolbar{
  margin-bottom:12px; padding:12px 16px; background:#fff; border:1px solid #e8e8e8;
  border-radius:12px; display:flex; align-items:center; gap:12px;
}
.reglements-admin-picker{display:inline-flex; align-items:center; gap:10px;}
.reglements-admin-picker span{font-size:12px; font-weight:600; color:#4b4b4b;}
.reglements-admin-picker select{font-family:inherit; font-size:14px; padding:8px 12px; border:1px solid #e8e8e8; border-radius:8px; background:#fff; min-width:280px;}
.reglements-admin-page .rga-root{min-height:calc(100vh - 160px);}
`;
