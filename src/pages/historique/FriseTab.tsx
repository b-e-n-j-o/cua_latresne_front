import { useMemo } from "react";
import { TYPES, aVerifier, formatRef, jourMoisAnnee, libellesFlags, moisAnnee, pourcent } from "./libelles";
import type { EtapeFrise, Flags, IsoDate, TypeEvenement } from "./types";

export interface EtapeGroupee {
  etape: number;
  type: TypeEvenement;
  millesimeEnfant: IsoDate;
  dateEvenement: IsoDate | null;
  parents: { idu: string; version: number; part: number }[];
  flags: Flags;
}

/** Regroupe les lignes par étape, parents triés par part décroissante, étapes masquées filtrées. */
export function grouperFrise(lignes: EtapeFrise[]): EtapeGroupee[] {
  const parEtape = new Map<number, EtapeGroupee>();
  for (const l of lignes) {
    let g = parEtape.get(l.etape);
    if (!g) {
      g = { etape: l.etape, type: l.type, millesimeEnfant: l.millesime_enfant, dateEvenement: l.date_evenement, parents: [], flags: {} };
      parEtape.set(l.etape, g);
    }
    // Un même parent peut revenir via plusieurs chemins : on ne le garde qu'une fois.
    if (!g.parents.some((p) => p.version === l.version_parent)) {
      g.parents.push({ idu: l.idu_parent, version: l.version_parent, part: l.part_enfant });
    }
    Object.assign(g.flags, l.flags ?? {});
  }
  return [...parEtape.values()]
    .filter((g) => TYPES[g.type]?.frise !== false)
    .sort((a, b) => a.etape - b.etape)
    .map((g) => ({ ...g, parents: g.parents.sort((a, b) => b.part - a.part) }));
}

interface Props {
  lignes: EtapeFrise[];
  dates: IsoDate[];
  onSurvol: (versions: number[] | null) => void;
  onDate: (d: IsoDate) => void;
  onVoirPreuve: () => void;
  /** Parcelle disparue : l'absence d'origine n'est pas l'absence d'historique. */
  descendance?: boolean;
}

export default function FriseTab({ lignes, dates, onSurvol, onDate, onVoirPreuve, descendance }: Props) {
  const etapes = useMemo(() => grouperFrise(lignes), [lignes]);

  if (!etapes.length) {
    return (
      <div className="p-4 text-sm text-slate-600">
        <p>{descendance ? "Origine : déjà présente en juillet 2017, aucune opération antérieure enregistrée." : "Aucune opération enregistrée depuis juillet 2017."}</p>
        <button type="button" onClick={onVoirPreuve} className="mt-2 text-blue-700 underline underline-offset-2">
          Voir les parcelles qui occupaient ce terrain
        </button>
      </div>
    );
  }

  const precedent = (d: IsoDate) => {
    const i = dates.indexOf(d);
    return i > 0 ? dates[i - 1] : null;
  };

  return (
    <ol className="relative p-4">
      {etapes.map((e, i) => {
        const def = TYPES[e.type];
        const plusieurs = e.parents.length > 1;
        const labels = e.parents.map((p) => (plusieurs ? `${formatRef(p.idu)} (${pourcent(p.part)} %)` : formatRef(p.idu)));
        const parents = plusieurs ? `${labels.slice(0, -1).join(", ")} et ${labels[labels.length - 1]}` : labels[0];
        const avant = precedent(e.millesimeEnfant);
        const doute = aVerifier(e.flags);

        return (
          <li
            key={e.etape}
            className="relative pb-5 pl-6 last:pb-0"
            onMouseEnter={() => onSurvol(e.parents.map((p) => p.version))}
            onMouseLeave={() => onSurvol(null)}
          >
            {i < etapes.length - 1 ? <span className="absolute left-[7px] top-4 h-full w-px bg-slate-300" aria-hidden /> : null}
            <span
              className={`absolute left-0 top-1 h-[15px] w-[15px] rounded-full border-2 bg-white ${doute ? "border-amber-500" : "border-blue-600"}`}
              aria-hidden
            />
            <div className="rounded-md border border-slate-200 p-3 hover:border-orange-300">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900">{def.titre(parents)}</h4>
                {doute ? (
                  <button
                    type="button"
                    onClick={onVoirPreuve}
                    title={libellesFlags(e.flags).join("\n")}
                    className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800"
                  >
                    à vérifier
                  </button>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {e.dateEvenement
                  ? `Opération du ${jourMoisAnnee(e.dateEvenement)}, publiée au cadastre en ${moisAnnee(e.millesimeEnfant)}`
                  : avant
                    ? `Publiée au cadastre entre ${moisAnnee(avant)} et ${moisAnnee(e.millesimeEnfant)}`
                    : `Publiée au cadastre en ${moisAnnee(e.millesimeEnfant)}`}
              </p>
              <div className="mt-2 flex gap-2">
                {avant ? (
                  <button type="button" onClick={() => onDate(avant)} className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50">
                    Avant
                  </button>
                ) : null}
                <button type="button" onClick={() => onDate(e.millesimeEnfant)} className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50">
                  Après
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}