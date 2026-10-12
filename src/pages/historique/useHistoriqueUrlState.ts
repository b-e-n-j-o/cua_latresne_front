import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { IsoDate, Vue } from "./types";

/**
 * Tout l'état partageable vit dans l'URL : ?v=<version_id>&date=YYYY-MM-DD&vue=frise
 *  - v    : version cible (idu, statut et date de référence en sont déduits)
 *  - date : millésime affiché sur la carte
 *  - vue  : onglet du panneau
 * Règles : changer la date ne change pas la cible, et inversement.
 * Le survol n'est jamais écrit dans l'URL (état local de la page).
 * Lot 3 : ajouter uf=<idus> et ufdate= pour l'unité foncière.
 */
const VUES: Vue[] = ["frise", "spatial", "graphe", "evenements"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export interface HistoriqueUrlState {
  version: number | null;
  date: IsoDate | null;
  vue: Vue;
}

export function useHistoriqueUrlState() {
  const [params, setParams] = useSearchParams();

  const state = useMemo<HistoriqueUrlState>(() => {
    const v = Number(params.get("v"));
    const date = params.get("date");
    const vue = params.get("vue") as Vue | null;
    return {
      version: Number.isInteger(v) && v > 0 ? v : null,
      date: date && ISO.test(date) ? date : null,
      vue: vue && VUES.includes(vue) ? vue : "frise",
    };
  }, [params]);

  const update = useCallback(
    (patch: Partial<HistoriqueUrlState>, opts: { push?: boolean } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if ("version" in patch) patch.version ? next.set("v", String(patch.version)) : next.delete("v");
          if ("date" in patch) patch.date ? next.set("date", patch.date) : next.delete("date");
          if ("vue" in patch) patch.vue && patch.vue !== "frise" ? next.set("vue", patch.vue) : next.delete("vue");
          return next;
        },
        // Changer de parcelle crée une entrée d'historique ; le curseur temporel non.
        { replace: !opts.push },
      );
    },
    [setParams],
  );

  return [state, update] as const;
}
