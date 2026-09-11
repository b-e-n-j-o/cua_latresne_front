/**
 * AdminMonitoringPage — suivi interne CUA + chat LLM (superadmin, multi-commune).
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import supabase from "../../supabaseClient";
import { fetchCommuneAccess } from "../../auth/communeAccess";
import { apiFetch } from "../../api/apiFetch";
import AdminLayout from "./AdminLayout";

type DayPoint = { day: string; count: number };

type CuaRecent = {
  slug: string;
  commune_slug: string;
  created_at: string | null;
  user_email: string | null;
  n_parcelles: number;
  parcelles_label: string;
  status: string;
  project_url: string | null;
};

type ChatRecent = {
  session_id: string;
  commune_slug: string;
  user_email: string | null;
  created_at: string | null;
  updated_at: string | null;
  total_tokens: number;
  total_turns: number;
  preview: string;
  chat_url: string | null;
};

type CuaCommune = {
  slug: string;
  label: string;
  total: number;
  success: number;
  error: number;
  last_7d: number;
  last_30d: number;
};

type ChatCommune = {
  slug: string;
  label: string;
  sessions: number;
  tokens: number;
  turns: number;
  users: number;
  last_7d: number;
  last_30d: number;
  table_missing?: boolean;
};

type AccessUser = {
  user_id: string;
  email: string | null;
  commune_slug: string | null;
  commune_label: string;
  code_insee: string | null;
  role: string | null;
  role_label: string | null;
  access_since: string | null;
  account_created: string | null;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
};

type UsersCommune = {
  slug: string;
  label: string;
  count: number;
  users: AccessUser[];
};

type MonitoringPayload = {
  generated_at: string;
  cua: {
    total: number;
    success: number;
    error: number;
    last_7d: number;
    last_30d: number;
    by_commune: CuaCommune[];
    by_day: DayPoint[];
    recent: CuaRecent[];
  };
  chat: {
    total_sessions: number;
    total_tokens: number;
    total_turns: number;
    unique_users: number;
    by_commune: ChatCommune[];
    by_day: DayPoint[];
    recent: ChatRecent[];
  };
  users?: {
    total_accounts: number;
    total_accesses: number;
    by_commune: UsersCommune[];
    sans_acces: AccessUser[];
  };
};

type AdminTab = "activite" | "acces";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "activite", label: "Activité" },
  { id: "acces", label: "Accès utilisateurs" },
];

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left py-[7px] px-2 border-b border-[#d5e1e3] text-[11px] uppercase tracking-wide text-[#0b131f]/50 font-semibold">
      {children}
    </th>
  );
}

function Td({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top" title={title}>
      {children}
    </td>
  );
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function fmtInt(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString("fr-FR");
}

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DayBars({ series, accent }: { series: DayPoint[]; accent: string }) {
  const points = asArray<DayPoint>(series);
  const max = Math.max(1, ...points.map((p) => p.count));
  return (
    <div className="flex items-end gap-[3px] h-14 mb-3.5 py-1.5" title="30 derniers jours">
      {points.map((p) => (
        <div
          key={p.day}
          className="flex-1 min-w-1 rounded-t-sm opacity-90"
          style={{ height: `${Math.round((p.count / max) * 100)}%`, background: accent }}
          title={`${p.day} · ${p.count}`}
        />
      ))}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AdminLayout>
      <div className="max-w-[1280px] mx-auto px-6 py-8 pb-16">{children}</div>
    </AdminLayout>
  );
}

export default function AdminMonitoringPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [data, setData] = useState<MonitoringPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [commune, setCommune] = useState<string>("all");
  const [tab, setTab] = useState<AdminTab>("activite");

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (import.meta.env.VITE_ADMIN_API_TOKEN) {
        setIsSuperadmin(true);
        setAuthLoading(false);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!mounted) return;
      const user = sessionData.session?.user;
      if (!user) {
        setIsSuperadmin(false);
        setAuthLoading(false);
        return;
      }
      const access = await fetchCommuneAccess(user);
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
    setLoading(true);
    setError(null);
    const adminToken = import.meta.env.VITE_ADMIN_API_TOKEN as string | undefined;
    const req = adminToken
      ? fetch(`${(import.meta.env.VITE_API_BASE || "").replace(/\/$/, "")}/admin/monitoring`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      : apiFetch("/admin/monitoring");
    req
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          const detail = (j as { detail?: unknown }).detail;
          throw new Error(typeof detail === "string" ? detail : `HTTP ${res.status}`);
        }
        return res.json() as Promise<MonitoringPayload>;
      })
      .then((payload) => {
        if (mounted) setData(payload);
      })
      .catch((e: Error) => {
        if (mounted) setError(e.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [authLoading, isSuperadmin]);

  const cuaByCommune = asArray<CuaCommune>(data?.cua.by_commune);
  const chatByCommune = asArray<ChatCommune>(data?.chat.by_commune);
  const usersByCommune = asArray<UsersCommune>(data?.users?.by_commune);
  const sansAcces = asArray<AccessUser>(data?.users?.sans_acces);

  const communes = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cuaByCommune) map.set(c.slug, c.label);
    for (const c of chatByCommune) map.set(c.slug, c.label);
    for (const c of usersByCommune) map.set(c.slug, c.label);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "fr"));
  }, [cuaByCommune, chatByCommune, usersByCommune]);

  const filteredUserGroups = useMemo(() => {
    if (commune === "all") return usersByCommune;
    return usersByCommune.filter((g) => g.slug === commune);
  }, [usersByCommune, commune]);

  const showSansAcces = commune === "all";

  const cuaRecent = useMemo(() => {
    const rows = asArray<CuaRecent>(data?.cua.recent);
    return commune === "all" ? rows : rows.filter((r) => r.commune_slug === commune);
  }, [data, commune]);

  const chatRecent = useMemo(() => {
    const rows = asArray<ChatRecent>(data?.chat.recent);
    return commune === "all" ? rows : rows.filter((r) => r.commune_slug === commune);
  }, [data, commune]);

  if (authLoading) {
    return (
      <Shell>
        <p className="text-sm text-[#0b131f]/55">Vérification des droits…</p>
      </Shell>
    );
  }

  if (!isSuperadmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <Shell>
      <header className="mb-6">
        <p className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#289f01]">
          Kerelia — Administration
        </p>
        <h1 className="m-0 mb-2 text-[1.75rem] font-semibold tracking-[-0.01em]">Suivi interne</h1>
        <p className="m-0 max-w-[720px] text-sm leading-relaxed text-[#0b131f]/60">
          {tab === "activite"
            ? "Générations de certificats d’urbanisme et conversations LLM, toutes communes."
            : "Comptes authentifiés et accès commune (table user_commune_access), avec l’email du compte Auth."}
          {data?.generated_at ? ` Actualisé ${fmtWhen(data.generated_at)}.` : ""}
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Vues administration"
        className="mb-4 inline-flex p-1 bg-white border border-[#d5e1e3] rounded-lg gap-1"
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={
                active
                  ? "px-3.5 py-1.5 text-sm font-semibold rounded-md bg-[#85e372] text-black"
                  : "px-3.5 py-1.5 text-sm font-semibold rounded-md text-[#0b131f]/70 hover:bg-[#f4f6f8]"
              }
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mb-4 px-4 py-3 bg-white border border-[#d5e1e3] rounded-lg">
        <label className="inline-flex items-center gap-2.5 text-xs font-semibold text-[#0b131f]/70">
          Commune
          <select
            value={commune}
            onChange={(e) => setCommune(e.target.value)}
            className="font-sans text-sm px-3 py-2 border border-[#d5e1e3] rounded-md bg-white min-w-[220px] text-[#0b131f]"
          >
            <option value="all">Toutes</option>
            {communes.map(([slug, label]) => (
              <option key={slug} value={slug}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p className="text-sm text-[#0b131f]/55">Chargement des agrégats…</p>}
      {error && <p className="text-sm text-[#c0362c]">{error}</p>}

      {data && tab === "acces" && (
        <>
          <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 mb-4">
            <Kpi
              label="Comptes Auth"
              value={fmtInt(data.users?.total_accounts)}
              hint={`${fmtInt(sansAcces.length)} sans accès commune`}
            />
            <Kpi
              label="Accès commune"
              value={fmtInt(data.users?.total_accesses)}
              hint={`${fmtInt(usersByCommune.length)} commune${usersByCommune.length > 1 ? "s" : ""}`}
            />
          </section>

          {filteredUserGroups.map((group) => (
            <section key={group.slug} className="bg-white border border-[#d5e1e3] rounded-lg p-[18px] mb-4">
              <h2 className="m-0 mb-3 text-lg font-semibold">
                {group.label}
                <span className="ml-2 text-sm font-normal text-[#0b131f]/50">
                  {fmtInt(group.count)} accès
                </span>
              </h2>
              <AccessTable rows={asArray<AccessUser>(group.users)} />
            </section>
          ))}

          {showSansAcces && sansAcces.length > 0 && (
            <section className="bg-white border border-[#d5e1e3] rounded-lg p-[18px] mb-4">
              <h2 className="m-0 mb-3 text-lg font-semibold">
                Sans accès commune
                <span className="ml-2 text-sm font-normal text-[#0b131f]/50">
                  {fmtInt(sansAcces.length)} compte{sansAcces.length > 1 ? "s" : ""}
                </span>
              </h2>
              <AccessTable rows={sansAcces} hideCommune />
            </section>
          )}

          {filteredUserGroups.length === 0 && !(showSansAcces && sansAcces.length > 0) && (
            <p className="text-sm text-[#0b131f]/55">Aucun accès pour ce filtre.</p>
          )}
        </>
      )}

      {data && tab === "activite" && (
        <>
          <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 mb-4">
            <Kpi
              label="CUA générés"
              value={fmtInt(data.cua.total)}
              hint={`${fmtInt(data.cua.last_7d)} / 7 j · ${fmtInt(data.cua.error)} échec${data.cua.error > 1 ? "s" : ""}`}
            />
            <Kpi
              label="Conversations chat"
              value={fmtInt(data.chat.total_sessions)}
              hint={`${fmtInt(data.chat.unique_users)} utilisateur${data.chat.unique_users > 1 ? "s" : ""}`}
            />
            <Kpi
              label="Tokens LLM"
              value={fmtInt(data.chat.total_tokens)}
              hint={`${fmtInt(data.chat.total_turns)} tour${data.chat.total_turns > 1 ? "s" : ""}`}
            />
          </section>

          <div className="grid grid-cols-1 gap-4 min-[1100px]:grid-cols-2">
            <section className="bg-white border border-[#d5e1e3] rounded-lg p-[18px]">
              <h2 className="m-0 mb-3 text-lg font-semibold">Certificats d&apos;urbanisme</h2>
              <DayBars series={asArray<DayPoint>(data.cua.by_day)} accent="#85e372" />
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr>
                    {["Commune", "Total", "OK", "Échecs", "7 j", "30 j"].map((h) => (
                      <th
                        key={h}
                        className="text-left py-[7px] px-2 border-b border-[#d5e1e3] text-[11px] uppercase tracking-wide text-[#0b131f]/50 font-semibold"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cuaByCommune.map((c) => (
                    <tr key={c.slug}>
                      <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{c.label}</td>
                      <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(c.total)}</td>
                      <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(c.success)}</td>
                      <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(c.error)}</td>
                      <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(c.last_7d)}</td>
                      <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(c.last_30d)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3 className="mt-[18px] mb-2 text-sm font-semibold text-[#0b131f]/70">Dernières générations</h3>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr>
                      {["Quand", "Commune", "User", "Parcelles", "Statut", "Dossier"].map((h) => (
                        <th
                          key={h}
                          className="text-left py-[7px] px-2 border-b border-[#d5e1e3] text-[11px] uppercase tracking-wide text-[#0b131f]/50 font-semibold"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cuaRecent.map((row) => (
                      <tr key={row.slug}>
                        <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtWhen(row.created_at)}</td>
                        <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{row.commune_slug}</td>
                        <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{row.user_email || "—"}</td>
                        <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top" title={row.parcelles_label}>
                          {row.n_parcelles} · {row.parcelles_label}
                        </td>
                        <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">
                          {row.status === "success" ? "OK" : row.status}
                        </td>
                        <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">
                          {row.project_url ? (
                            <a
                              href={row.project_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#289f01] font-semibold no-underline hover:underline"
                            >
                              Ouvrir
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                    {cuaRecent.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-[7px] px-2 text-sm text-[#0b131f]/55">
                          Aucune génération
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white border border-[#d5e1e3] rounded-lg p-[18px]">
              <h2 className="m-0 mb-3 text-lg font-semibold">Chat LLM</h2>
              <DayBars series={asArray<DayPoint>(data.chat.by_day)} accent="#0b131f" />
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr>
                    {["Commune", "Conv.", "Users", "Tours", "Tokens", "30 j"].map((h) => (
                      <th
                        key={h}
                        className="text-left py-[7px] px-2 border-b border-[#d5e1e3] text-[11px] uppercase tracking-wide text-[#0b131f]/50 font-semibold"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chatByCommune.map((c) => (
                    <tr key={c.slug}>
                      <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">
                        {c.label}
                        {c.table_missing ? " (table absente)" : ""}
                      </td>
                      <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(c.sessions)}</td>
                      <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(c.users)}</td>
                      <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(c.turns)}</td>
                      <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(c.tokens)}</td>
                      <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(c.last_30d)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3 className="mt-[18px] mb-2 text-sm font-semibold text-[#0b131f]/70">Dernières conversations</h3>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr>
                      {["Maj", "Commune", "User", "Objet", "Tours", "Tokens", "Chat"].map((h) => (
                        <th
                          key={h}
                          className="text-left py-[7px] px-2 border-b border-[#d5e1e3] text-[11px] uppercase tracking-wide text-[#0b131f]/50 font-semibold"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chatRecent.map((row) => (
                      <tr key={`${row.commune_slug}-${row.session_id}`}>
                        <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtWhen(row.updated_at)}</td>
                        <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{row.commune_slug}</td>
                        <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{row.user_email || "—"}</td>
                        <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{row.preview}</td>
                        <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(row.total_turns)}</td>
                        <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(row.total_tokens)}</td>
                        <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">
                          {row.chat_url ? (
                            <a
                              href={row.chat_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#289f01] font-semibold no-underline hover:underline"
                            >
                              Ouvrir
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                    {chatRecent.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-[7px] px-2 text-sm text-[#0b131f]/55">
                          Aucune conversation
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </Shell>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="bg-white border border-[#d5e1e3] rounded-lg px-[18px] py-4">
      <span className="block text-xs font-semibold uppercase tracking-wide text-[#0b131f]/50">{label}</span>
      <strong className="block text-[32px] font-semibold my-1.5 tracking-[-0.02em]">{value}</strong>
      <em className="not-italic text-[13px] text-[#0b131f]/60">{hint}</em>
    </article>
  );
}

function AccessTable({ rows, hideCommune }: { rows: AccessUser[]; hideCommune?: boolean }) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr>
            <Th>Email</Th>
            {!hideCommune && <Th>Commune</Th>}
            <Th>Rôle</Th>
            <Th>Compte créé</Th>
            <Th>Dernière connexion</Th>
            <Th>Accès depuis</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.user_id}-${row.commune_slug || "none"}`}>
              <Td title={row.user_id}>
                {row.email || "—"}
                {!row.email_confirmed && row.email ? (
                  <span className="ml-1.5 text-[11px] text-[#0b131f]/45">non confirmé</span>
                ) : null}
              </Td>
              {!hideCommune && <Td>{row.commune_label}</Td>}
              <Td>{row.role_label || "—"}</Td>
              <Td>{fmtWhen(row.account_created)}</Td>
              <Td>{fmtWhen(row.last_sign_in_at)}</Td>
              <Td>{fmtWhen(row.access_since)}</Td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={hideCommune ? 5 : 6} className="py-[7px] px-2 text-sm text-[#0b131f]/55">
                Aucun utilisateur
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
