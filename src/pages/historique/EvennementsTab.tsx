import { useMemo } from "react";
import { COURT, aVerifier, dateEvt, libellesFlags } from "./libelles";
import type { EvenementParcelle, IsoDate } from "./types";

interface Props {
  evenements: EvenementParcelle[];
  onDate: (d: IsoDate) => void;
}

const ROLE = { parent: "Parcelle d'origine", enfant: "Parcelle issue" } as const;

/** Seul endroit où apparaissent les événements masqués de la frise : domaine public, recalages, artefacts. */
export default function EvenementsTab({ evenements, onDate }: Props) {
  const lignes = useMemo(() => {
    const vus = new Set<string>();
    return [...evenements]
      .sort((a, b) => b.millesime_enfant.localeCompare(a.millesime_enfant))
      .filter((e) => {
        const k = `${e.evt_id}:${e.role}`;
        if (vus.has(k)) return false;
        vus.add(k);
        return true;
      });
  }, [evenements]);

  if (!lignes.length) {
    return <p className="p-4 text-sm text-slate-600">Aucun événement enregistré pour cette parcelle depuis juillet 2017.</p>;
  }

  return (
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 bg-slate-50 text-slate-500">
        <tr>
          <th className="px-4 py-2 font-medium">Date</th>
          <th className="py-2 font-medium">Opération</th>
          <th className="py-2 font-medium">Rôle</th>
          <th className="px-4 py-2" />
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {lignes.map((e) => (
          <tr key={`${e.evt_id}:${e.role}`} className="cursor-pointer hover:bg-orange-50" onClick={() => onDate(e.millesime_enfant)}>
            <td className="whitespace-nowrap px-4 py-2 tabular-nums text-slate-700">{dateEvt(e.date_evenement, e.millesime_enfant)}</td>
            <td className="py-2 text-slate-900">{COURT[e.type] ?? e.type}</td>
            <td className="py-2 text-slate-600">{ROLE[e.role] ?? e.role}</td>
            <td className="px-4 py-2 text-right">
              {aVerifier(e.flags) ? (
                <span title={libellesFlags(e.flags).join("\n")} className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                  à vérifier
                </span>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}