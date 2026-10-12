import { useMemo } from "react";
import { COURT, aVerifier, dateEvt, formatRef, libellesFlags } from "./libelles";
import type { Graphe, IsoDate } from "./types";

interface Props {
  graphe: Graphe;
  onSelectVersion: (versionId: number) => void;
  onSurvol: (versions: number[] | null) => void;
  onDate: (d: IsoDate) => void;
}

const MAX_AFFICHES = 12;

/** Opérations dont la cible est le parent direct, regroupées par événement (1 division → N lots). */
export default function DescendanceBlock({ graphe, onSelectVersion, onSurvol, onDate }: Props) {
  const operations = useMemo(() => {
    const nodes = new Map(graphe.nodes.map((n) => [n.id, n]));
    const parEvt = new Map<string, { edge: (typeof graphe.edges)[number]; enfants: { id: number; idu: string }[] }>();
    for (const e of graphe.edges) {
      if (e.source !== graphe.racine || e.meme_id) continue; // même parcelle recalée : pas une descendance
      const n = nodes.get(e.target);
      if (!n) continue;
      const g = parEvt.get(e.evt_id) ?? { edge: e, enfants: [] };
      g.enfants.push({ id: n.id, idu: n.idu });
      parEvt.set(e.evt_id, g);
    }
    return [...parEvt.values()].sort((a, b) => a.edge.millesime.localeCompare(b.edge.millesime));
  }, [graphe]);

  if (!operations.length) return null;

  return (
    <section className="border-b border-slate-200 p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">Ce qu'elle est devenue</h3>
      <ul className="space-y-3">
        {operations.map(({ edge, enfants }) => (
          <li
            key={edge.evt_id}
            className="rounded-md border border-slate-200 p-3 hover:border-orange-300"
            onMouseEnter={() => onSurvol(enfants.map((c) => c.id))}
            onMouseLeave={() => onSurvol(null)}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-slate-900">
                {COURT[edge.type] ?? edge.type} en {enfants.length} parcelle{enfants.length > 1 ? "s" : ""}
              </p>
              {aVerifier(edge.flags) ? (
                <span title={libellesFlags(edge.flags).join("\n")} className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                  à vérifier
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-slate-600">{dateEvt(edge.date_evenement, edge.millesime)}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {enfants.slice(0, MAX_AFFICHES).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectVersion(c.id)}
                  className="rounded border border-slate-300 px-1.5 py-0.5 text-xs hover:bg-slate-50"
                >
                  {formatRef(c.idu)}
                </button>
              ))}
              {enfants.length > MAX_AFFICHES ? (
                <span className="px-1 py-0.5 text-xs text-slate-500">et {enfants.length - MAX_AFFICHES} autres (voir Graphe)</span>
              ) : null}
              <button type="button" onClick={() => onDate(edge.millesime)} className="ml-auto text-xs text-blue-700 underline underline-offset-2">
                Voir après
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}