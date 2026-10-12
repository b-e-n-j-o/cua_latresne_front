/**
 * Encart admin — coûts LLM de la veille RAA (analyses persistées).
 */
import { useMemo } from "react";

export type DayPoint = { day: string; count: number };

export type RaaCommuneCost = {
  slug: string;
  label: string;
  analyses: number;
  ok: number;
  erreur: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  last_7d: number;
  last_30d: number;
  cost_7d: number;
  cost_30d: number;
  table_missing?: boolean;
};

export type RaaAnalyseRow = {
  analyse_id: number;
  raa_id: number | null;
  commune_slug: string;
  commune_label: string;
  modele: string | null;
  titre: string;
  date_publication?: string | null;
  taille_mo?: number | null;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  niveau_alerte: string | null;
  erreur: string | null;
  created_at: string | null;
  raa_url: string | null;
};

export type RaaMonitoringPayload = {
  analyses: number;
  ok: number;
  erreur: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  last_7d: number;
  last_30d: number;
  cost_7d: number;
  cost_30d: number;
  by_commune: RaaCommuneCost[];
  by_day: DayPoint[];
  recent: RaaAnalyseRow[];
};

export type LlmTotals = {
  raa_cost_usd: number;
  raa_tokens: number;
  chat_tokens: number;
  total_tokens: number;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function fmtInt(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString("fr-FR");
}

function fmtUsd(n: number | null | undefined): string {
  return `${Number(n || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} $`;
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

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="bg-white border border-[#d5e1e3] rounded-lg px-[18px] py-4">
      <span className="block text-xs font-semibold uppercase tracking-wide text-[#0b131f]/50">{label}</span>
      <strong className="block text-[32px] font-semibold my-1.5 tracking-[-0.02em]">{value}</strong>
      <em className="not-italic text-[13px] text-[#0b131f]/60">{hint}</em>
    </article>
  );
}

type Props = {
  raa: RaaMonitoringPayload;
  llm?: LlmTotals | null;
  commune: string;
};

export default function AdminRaaMonitoring({ raa, llm, commune }: Props) {
  const byCommune = asArray<RaaCommuneCost>(raa.by_commune);

  const filteredCommunes = useMemo(() => {
    if (commune === "all") return byCommune;
    return byCommune.filter((c) => c.slug === commune);
  }, [byCommune, commune]);

  const recent = useMemo(() => {
    const rows = asArray<RaaAnalyseRow>(raa.recent);
    return commune === "all" ? rows : rows.filter((r) => r.commune_slug === commune);
  }, [raa.recent, commune]);

  const scoped = useMemo(() => {
    if (commune === "all") {
      return {
        analyses: raa.analyses,
        ok: raa.ok,
        erreur: raa.erreur,
        tokens_in: raa.tokens_in,
        tokens_out: raa.tokens_out,
        cost_usd: raa.cost_usd,
        last_7d: raa.last_7d,
        cost_7d: raa.cost_7d,
        cost_30d: raa.cost_30d,
      };
    }
    const c = filteredCommunes[0];
    if (!c) {
      return {
        analyses: 0,
        ok: 0,
        erreur: 0,
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        last_7d: 0,
        cost_7d: 0,
        cost_30d: 0,
      };
    }
    return {
      analyses: c.analyses,
      ok: c.ok,
      erreur: c.erreur,
      tokens_in: c.tokens_in,
      tokens_out: c.tokens_out,
      cost_usd: c.cost_usd,
      last_7d: c.last_7d,
      cost_7d: c.cost_7d,
      cost_30d: c.cost_30d,
    };
  }, [commune, filteredCommunes, raa]);

  const showGlobalLlm = commune === "all" && llm;

  return (
    <section className="mt-4">
      <h2 className="m-0 mb-3 text-lg font-semibold">Coûts API LLM</h2>
      <p className="m-0 mb-4 max-w-[760px] text-sm leading-relaxed text-[#0b131f]/60">
        Estimation USD des analyses RAA (tarif Vertex enregistré à l’analyse). Le chat PLU n’a pas
        de coût monétaire persisté : seuls les tokens sont additionnés au suivi global.
      </p>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 mb-4">
        <Kpi
          label="Coût RAA estimé"
          value={fmtUsd(scoped.cost_usd)}
          hint={`${fmtUsd(scoped.cost_7d)} / 7 j · ${fmtUsd(scoped.cost_30d)} / 30 j`}
        />
        <Kpi
          label="Analyses RAA"
          value={fmtInt(scoped.analyses)}
          hint={`${fmtInt(scoped.ok)} OK · ${fmtInt(scoped.erreur)} erreur${scoped.erreur > 1 ? "s" : ""} · ${fmtInt(scoped.last_7d)} / 7 j`}
        />
        <Kpi
          label="Tokens RAA"
          value={fmtInt(scoped.tokens_in + scoped.tokens_out)}
          hint={`${fmtInt(scoped.tokens_in)} in · ${fmtInt(scoped.tokens_out)} out`}
        />
        {showGlobalLlm && (
          <Kpi
            label="Tokens LLM totaux"
            value={fmtInt(llm.total_tokens)}
            hint={`RAA ${fmtInt(llm.raa_tokens)} · chat ${fmtInt(llm.chat_tokens)}`}
          />
        )}
      </div>

      <div className="bg-white border border-[#d5e1e3] rounded-lg p-[18px]">
        <h3 className="m-0 mb-1 text-base font-semibold">Veille RAA par commune</h3>
        <DayBars series={asArray<DayPoint>(raa.by_day)} accent="#289f01" />
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr>
              {["Commune", "Analyses", "OK", "Erreurs", "Tokens in", "Tokens out", "Coût", "7 j", "30 j"].map((h) => (
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
            {filteredCommunes.map((c) => (
              <tr key={c.slug}>
                <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">
                  {c.label}
                  {c.table_missing ? " (table absente)" : ""}
                </td>
                <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(c.analyses)}</td>
                <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(c.ok)}</td>
                <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(c.erreur)}</td>
                <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(c.tokens_in)}</td>
                <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(c.tokens_out)}</td>
                <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtUsd(c.cost_usd)}</td>
                <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(c.last_7d)}</td>
                <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(c.last_30d)}</td>
              </tr>
            ))}
            {filteredCommunes.length === 0 && (
              <tr>
                <td colSpan={9} className="py-[7px] px-2 text-sm text-[#0b131f]/55">
                  Aucune donnée RAA pour ce filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <h3 className="mt-[18px] mb-2 text-sm font-semibold text-[#0b131f]/70">Analyses RAA (ligne à ligne)</h3>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr>
                {["Quand", "Commune", "Recueil", "Modèle", "In", "Out", "Coût", "Alerte", "Veille"].map((h) => (
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
              {recent.map((row) => (
                <tr key={`${row.commune_slug}-${row.analyse_id}`}>
                  <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtWhen(row.created_at)}</td>
                  <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{row.commune_label}</td>
                  <td
                    className="py-[7px] px-2 border-b border-[#d5e1e3] align-top"
                    title={row.erreur || row.titre}
                  >
                    {row.titre}
                    {row.erreur ? (
                      <span className="block text-[11px] text-[#c0362c]">{row.erreur}</span>
                    ) : null}
                  </td>
                  <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{row.modele || "—"}</td>
                  <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(row.tokens_in)}</td>
                  <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtInt(row.tokens_out)}</td>
                  <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{fmtUsd(row.cost_usd)}</td>
                  <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">{row.niveau_alerte || "—"}</td>
                  <td className="py-[7px] px-2 border-b border-[#d5e1e3] align-top">
                    {row.raa_url ? (
                      <a
                        href={row.raa_url}
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
              {recent.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-[7px] px-2 text-sm text-[#0b131f]/55">
                    Aucune analyse RAA
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
