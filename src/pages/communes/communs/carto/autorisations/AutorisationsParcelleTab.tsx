import { useEffect, useMemo, useState } from "react";
import { parseRef } from "../../../../historique/libelles";
import { autorisationsApi, type AutParcelleLien } from "./autorisationsApi";

const METHODE_BADGE: Record<string, { label: string; className: string }> = {
  actuel: { label: "Sur cette parcelle", className: "aut-methode aut-methode--actuel" },
  millesime: {
    label: "Sur la parcelle mère, avant division",
    className: "aut-methode aut-methode--millesime",
  },
  millesime_operation: {
    label: "Opération d'ensemble",
    className: "aut-methode aut-methode--op",
  },
};

const INSEE: Record<string, string> = { argeles: "66008", latresne: "33234" };

export default function AutorisationsParcelleTab({
  communeSlug,
  section,
  numero,
  insee,
  onOpen,
}: {
  communeSlug: string;
  section: string;
  numero: string;
  insee?: string;
  onOpen: (id: string) => void;
}) {
  const [rows, setRows] = useState<AutParcelleLien[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const idu = useMemo(
    () => parseRef(`${section} ${numero}`, insee?.trim() || INSEE[communeSlug] || ""),
    [section, numero, insee, communeSlug],
  );

  useEffect(() => {
    if (!idu) {
      setRows([]);
      return;
    }
    let cancelled = false;
    autorisationsApi
      .parParcelle(communeSlug, idu)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setErr("Impossible de charger les autorisations.");
      });
    return () => {
      cancelled = true;
    };
  }, [communeSlug, idu]);

  return (
    <div className="aut-tab">
      <h4 className="aut-tab__title">Autorisations d&apos;urbanisme</h4>
      {err ? <p className="aut-tab__err">{err}</p> : null}
      {rows == null ? <p className="aut-tab__muted">Chargement…</p> : null}
      {rows && rows.length === 0 ? (
        <p className="aut-tab__muted">Aucune autorisation liée à cette parcelle.</p>
      ) : null}
      {rows && rows.length > 0 ? (
        <ul className="aut-tab__list">
          {rows.map((r) => {
            const badge = METHODE_BADGE[r.methode] ?? {
              label: r.methode,
              className: "aut-methode",
            };
            const date = (r.date_autorisation || r.date_depot || "").slice(0, 10);
            return (
              <li key={`${r.id}-${r.methode}-${r.idu_origine ?? ""}`}>
                <button type="button" className="aut-tab__row" onClick={() => onOpen(r.id)}>
                  <span className="aut-tab__id">
                    {r.type_dau ?? ""} {r.id}
                  </span>
                  <span className="aut-tab__meta">
                    {date || "date inconnue"} · {r.etat || "inconnu"}
                  </span>
                  <span className={badge.className}>{badge.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
