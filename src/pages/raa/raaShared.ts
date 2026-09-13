import { normaliseArreteNature, type ArreteNature, type RaaCommuneConfig } from "./raaConfig";

export type RaaFilter = "all" | "rouge" | "orange" | "nouveau";

export type RaaArrete = {
  titre: string;
  reference?: string;
  pertinence?: string;
  nature?: ArreteNature | string;
  raison?: string;
  resume?: string;
  pages?: string;
};

export type RaaItem = {
  id: number;
  titre: string;
  date_publication?: string;
  pdf_url: string;
  page_url: string;
  taille_mo?: number;
  statut: string;
  vu?: boolean;
  niveau_alerte?: string | null;
  nb_arretes_total?: number;
  nb_arretes_pertinents?: number;
  commune_mentionnee?: boolean;
  resume_global?: string;
  erreur?: string | null;
  arretes?: RaaArrete[];
};

export type NiveauMeta = { dot: string; label: string };

export const PERTINENCE_ORDER: Record<string, number> = {
  DIRECTE: 0,
  INDIRECTE: 1,
  POSSIBLE: 2,
  NON_PERTINENT: 3,
};

export function natureMeta(n?: string | null) {
  const key = normaliseArreteNature(n);
  switch (key) {
    case "URBANISME":
      return { key, label: "Urbanisme", className: "rv__nature--urba" };
    case "ENVIRONNEMENT":
      return { key, label: "Environnement", className: "rv__nature--env" };
    case "EVENEMENT":
      return { key, label: "Événement", className: "rv__nature--evt" };
    default:
      return { key: "AUTRE" as const, label: "Autre", className: "rv__nature--autre" };
  }
}

export function pertinenceMeta(p: string | undefined) {
  switch (p) {
    case "DIRECTE":
      return { dot: "#E74C3C", label: "Directe", hint: "Concerne explicitement la commune" };
    case "INDIRECTE":
      return { dot: "#F39C12", label: "Indirecte", hint: "Périmètre incluant la commune" };
    case "POSSIBLE":
      return { dot: "#9b59b6", label: "Possible", hint: "Périmètre large — à vérifier" };
    default:
      return { dot: "#b9bcc2", label: p || "Non pertinent", hint: "Hors périmètre ou administratif" };
  }
}

export function sortArretes(arretes: RaaArrete[]) {
  return [...arretes].sort((a, b) => {
    const oa = PERTINENCE_ORDER[a.pertinence ?? ""] ?? 99;
    const ob = PERTINENCE_ORDER[b.pertinence ?? ""] ?? 99;
    return oa - ob;
  });
}

export function buildNiveau(cfg: RaaCommuneConfig): Record<string, NiveauMeta> {
  return {
    ROUGE: { dot: "#E74C3C", label: cfg.niveauRougeLabel },
    ORANGE: { dot: "#F39C12", label: "À surveiller" },
    VERT: { dot: "#9aa19a", label: "Rien de notable" },
  };
}

export const fmtJour = (iso?: string) => {
  if (!iso) return "Date inconnue";
  const d = new Date(iso + "T00:00:00");
  const s = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const fmtJourCourt = (iso?: string) => {
  if (!iso) return "Date inconnue";
  const d = new Date(iso + "T00:00:00");
  const s = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "numeric",
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const monthKey = (iso?: string) => {
  if (!iso) return "";
  return iso.slice(0, 7);
};

export const fmtMois = (key?: string) => {
  if (!key) return "Date inconnue";
  const src = key.length >= 10 ? key : `${key}-01`;
  const d = new Date(src + "T00:00:00");
  const s = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function isNouveau(it: RaaItem) {
  return it.statut === "analyse" && it.vu === false;
}

export function isConcerne(it: RaaItem) {
  return it.statut === "analyse" && it.niveau_alerte === "ROUGE";
}

export function isASurveiller(it: RaaItem) {
  return it.statut === "analyse" && it.niveau_alerte === "ORANGE";
}

export function isHorsPerimetre(it: RaaItem) {
  return it.statut === "analyse" && it.niveau_alerte !== "ROUGE" && it.niveau_alerte !== "ORANGE";
}

/** Première page d'un intervalle du type « 10-14 », « p. 10-14 », « 10 ». */
export function firstPageFromRange(pages?: string | null): number | null {
  if (!pages) return null;
  const match = pages.match(/(\d+)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** URL du PDF officiel, ouverte à la page de début du sous-arrêté si elle est connue. */
export function pdfUrlAtPage(pdfUrl: string | undefined, pages?: string | null): string | null {
  if (!pdfUrl || pdfUrl === "#") return null;
  const base = pdfUrl.split("#")[0];
  const page = firstPageFromRange(pages);
  return page ? `${base}#page=${page}` : base;
}

export function importanceStatus(it: RaaItem, niveau: Record<string, NiveauMeta>) {
  if (it.statut === "en_cours") return { label: "Analyse en cours", dot: "#7aa2c4", tone: "wait" as const };
  if (it.statut === "erreur") return { label: "Erreur d'analyse", dot: "#c0392b", tone: "err" as const };
  if (it.statut === "detecte") return { label: "Pas encore analysé", dot: "#b9bcc2", tone: "muted" as const };
  const meta = it.niveau_alerte ? niveau[it.niveau_alerte] : null;
  if (meta) {
    const tone = it.niveau_alerte === "ROUGE" ? "r" : it.niveau_alerte === "ORANGE" ? "o" : "v";
    return { label: meta.label, dot: meta.dot, tone: tone as "r" | "o" | "v" };
  }
  return { label: "En attente", dot: "#b9bcc2", tone: "muted" as const };
}
