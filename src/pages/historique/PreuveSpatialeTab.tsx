import { useMemo } from "react";
import { formatRef, moisAnnee, pourcent } from "./libelles";
import type { IsoDate, PeriodeSpatiale } from "./types";

interface Props {
  periodes: PeriodeSpatiale[]; // triées par observe_depuis décroissant côté SQL
  dates: IsoDate[];
  date: IsoDate;
  onSurvol: (geoms: GeoJSON.Geometry[] | null) => void;
  onDate: (d: IsoDate) => void;
}

const LABEL_W = 64;
const BAND_W = 300;
const TRACK_H = 18;
const AXIS_H = 18;

export default function PreuveSpatialeTab({ periodes, dates, date, onSurvol, onDate }: Props) {
  // Une piste par idu, dans l'ordre d'apparition (le plus récent en haut).
  const pistes = useMemo(() => [...new Set(periodes.map((p) => p.idu))], [periodes]);

  if (!periodes.length) {
    return <p className="p-4 text-sm text-slate-600">Aucune parcelle trouvée sur cette emprise.</p>;
  }

  const n = dates.length;
  const col = BAND_W / n;
  // Index du premier millésime ≥ d (les dates d'observation sont normalement des millésimes).
  const idx = (d: IsoDate) => {
    const i = dates.findIndex((m) => m >= d);
    return i === -1 ? n - 1 : i;
  };
  const x = (i: number) => LABEL_W + i * col;
  const annees = dates
    .map((d, i) => ({ d, i }))
    .filter(({ d, i }) => i === 0 || d.slice(0, 4) !== dates[i - 1].slice(0, 4));
  const h = AXIS_H + pistes.length * TRACK_H;
  const curseur = idx(date);

  return (
    <div className="p-4">
      <p className="mb-3 text-xs text-slate-600">
        Parcelles ayant occupé ce terrain, millésime par millésime (seuil 2 % de la surface).
      </p>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${LABEL_W + BAND_W} ${h}`} className="w-full min-w-[320px]" role="img" aria-label="Occupation du terrain dans le temps">
          {annees.map(({ d, i }) => (
            <g key={d}>
              <line x1={x(i)} x2={x(i)} y1={AXIS_H - 4} y2={h} stroke="#e2e8f0" />
              <text x={x(i) + 2} y={11} fontSize={9} fill="#64748b">{d.slice(0, 4)}</text>
            </g>
          ))}

          {pistes.map((idu, t) => (
            <text key={idu} x={0} y={AXIS_H + t * TRACK_H + 12} fontSize={10} fill="#0f172a">
              {formatRef(idu)}
            </text>
          ))}

          {periodes.map((p) => {
            const t = pistes.indexOf(p.idu);
            const i0 = idx(p.observe_depuis);
            const i1 = idx(p.observe_jusqu_au) + 1;
            return (
              <rect
                key={`${p.version_id}-${p.observe_depuis}`}
                x={x(i0) + 0.5}
                y={AXIS_H + t * TRACK_H + 3}
                width={Math.max(col * (i1 - i0) - 1, 2)}
                height={TRACK_H - 6}
                rx={2}
                fill="#2563eb"
                fillOpacity={0.25 + 0.75 * Math.min(1, pourcent(p.part_emprise) / 100)}
                className="cursor-pointer"
                onMouseEnter={() => onSurvol([p.geojson])}
                onMouseLeave={() => onSurvol(null)}
                onClick={() => onDate(dates[i0])}
              >
                <title>{`${formatRef(p.idu)} : ${pourcent(p.part_emprise)} %`}</title>
              </rect>
            );
          })}

          <line x1={x(curseur) + col / 2} x2={x(curseur) + col / 2} y1={AXIS_H - 4} y2={h} stroke="#E53E3E" strokeWidth={1.5} />
        </svg>
      </div>

      <ul className="mt-4 divide-y divide-slate-100">
        {periodes.map((p) => {
          const pct = pourcent(p.part_emprise);
          return (
            <li
              key={`${p.version_id}-${p.observe_depuis}`}
              className="flex cursor-pointer items-center gap-3 py-2 hover:bg-orange-50"
              onMouseEnter={() => onSurvol([p.geojson])}
              onMouseLeave={() => onSurvol(null)}
              onClick={() => onDate(dates[idx(p.observe_depuis)])}
            >
              <span className="w-16 shrink-0 text-sm font-medium text-slate-900">{formatRef(p.idu)}</span>
              <span className="flex-1 text-xs text-slate-600">
                {p.censure_gauche ? `depuis au moins ${moisAnnee(p.observe_depuis)}` : `de ${moisAnnee(p.observe_depuis)}`}
                {` à ${moisAnnee(p.observe_jusqu_au)}`}
              </span>
              <span className="flex w-24 shrink-0 items-center gap-1.5">
                <span className="h-1.5 flex-1 rounded bg-slate-100">
                  <span className="block h-full rounded bg-blue-600" style={{ width: `${Math.min(100, pct)}%` }} />
                </span>
                {/* Jamais normalisé : la somme peut dépasser 100 % en cas de chevauchement du plan source. */}
                <span className="w-9 text-right text-xs tabular-nums text-slate-700">{pct} %</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
