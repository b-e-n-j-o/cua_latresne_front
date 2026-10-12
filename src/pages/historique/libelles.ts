import type { FlagKey, Flags, IsoDate, TypeEvenement } from "./types";

export type Categorie =
  | "operation" | "administratif" | "geometrie" | "domaine_public" | "a_verifier" | "artefact";

interface DefType {
  /** Titre de carte de frise, à partir de la liste des parents déjà formatée. */
  titre: (parents: string) => string;
  categorie: Categorie;
  /** Visible dans la frise ; sinon uniquement dans l'onglet Événements. */
  frise: boolean;
}

const division: DefType = { titre: (p) => `Division de ${p}`, categorie: "operation", frise: true };
const reunion: DefType = { titre: (p) => `Réunion de ${p}`, categorie: "operation", frise: true };
const remaniement: DefType = { titre: (p) => `Remaniement de ${p}`, categorie: "operation", frise: true };
const renum: DefType = { titre: (p) => `Renumérotation de ${p}`, categorie: "administratif", frise: true };
const integrationDp: DefType = { titre: () => "Intégrée au domaine public (voirie)", categorie: "domaine_public", frise: false };
const sortieDp: DefType = { titre: () => "Issue du domaine non cadastré", categorie: "domaine_public", frise: true };
const incoherence: DefType = { titre: () => "Incohérence du plan source", categorie: "a_verifier", frise: false };
const artefact: DefType = { titre: () => "Artefact de données", categorie: "artefact", frise: false };

/** Record exhaustif : TypeScript refuse la compilation si un type n'a pas de libellé. */
export const TYPES: Record<TypeEvenement, DefType> = {
  division,
  division_conservation_numero: division,
  reunion,
  reunion_conservation_numero: reunion,
  recomposition: remaniement,
  recomposition_conservation_numero: remaniement,
  renumerotation: renum,
  renumerotation_administrative: renum,
  reduction_emprise: {
    titre: (p) => `Réduction d'emprise de ${p} (cession probable au domaine public)`,
    categorie: "operation",
    frise: true,
  },
  extension_emprise: { titre: (p) => `Extension d'emprise de ${p}`, categorie: "operation", frise: true },
  modif_limite_ou_recalage: { titre: () => "Modification de limite", categorie: "geometrie", frise: false },
  recalage_plan: { titre: () => "Recalage du plan cadastral", categorie: "geometrie", frise: false },
  integration_domaine_public: integrationDp,
  integration_domaine_public_voirie: integrationDp,
  sortie_domaine_public: sortieDp,
  sortie_domaine_public_voirie: sortieDp,
  suppression_sans_enfant: { titre: () => "Disparition sans correspondance", categorie: "a_verifier", frise: true },
  creation_sans_parent: { titre: () => "Apparition sans correspondance", categorie: "a_verifier", frise: true },
  suppression_parcelle_chevauchante: incoherence,
  absorption_non_resolue: incoherence,
  creation_parent_non_resolu: incoherence,
  artefact_micro_parcelle: artefact,
  absence_temporaire_artefact: artefact,
  reapparition_artefact: artefact,
};

export const FLAGS: Record<FlagKey, string> = {
  flag_geom: "Les surfaces avant et après ne correspondent pas exactement",
  flag_chevauchement: "Des parcelles se superposent dans le plan source",
  flag_perte_emprise: "Une partie de la surface a quitté le cadastre",
  flag_gain_emprise: "Une surface non cadastrée a été intégrée",
  flag_micro_parcelle: "Parcelle de moins de 1 m²",
  flag_ephemere: "Parcelle visible dans un seul millésime",
  flag_created_ancien: "Date d'opération très antérieure à la publication",
  flag_created_heterogene: "Dates d'opération différentes entre parcelles issues",
  flag_composante_geante: "Opération impliquant de nombreuses parcelles",
  maj_contenance: "Contenance cadastrale remesurée (information)",
};

export function libellesFlags(flags: Flags | null | undefined): string[] {
  return Object.keys(flags ?? {}).map((k) => FLAGS[k as FlagKey] ?? k);
}

/** maj_contenance seul est une information, pas un doute. */
export function aVerifier(flags: Flags | null | undefined): boolean {
  return Object.keys(flags ?? {}).some((k) => k !== "maj_contenance");
}

// --- Références et dates -------------------------------------------------------

/** '33234000AM2150' → 'AM 2150' ; section '0A' → 'A'. */
export function formatRef(idu: string): string {
  const section = idu.slice(8, 10).replace(/^0/, "");
  return `${section} ${idu.slice(10)}`;
}

/**
 * 'AM 2150', 'am2150', 'AM 150' ou un idu complet → idu.
 * Suppose le préfixe '000' : les communes associées (préfixe ≠ 000) doivent passer l'idu complet.
 */
export function parseRef(saisie: string, insee: string): string | null {
  const s = saisie.trim().toUpperCase().replace(/\s+/g, "");
  if (/^[0-9]{2}[0-9AB][0-9]{2}[0-9]{3}[0-9A-Z]{2}[0-9]{4}$/.test(s)) return s;
  const m = s.match(/^([0-9A-Z]{1,2}?)([0-9]{1,4})$/);
  if (!m) return null;
  return `${insee}000${m[1].padStart(2, "0")}${m[2].padStart(4, "0")}`;
}

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export const moisAnnee = (d: IsoDate) => `${MOIS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
export const jourMoisAnnee = (d: IsoDate) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** Parts : fraction 0–1 attendue ; tolère un pourcentage si la base en renvoie un. */
export const pourcent = (p: number) => Math.round(p <= 1.0001 ? p * 100 : p);

export const formatAire = (m2: number) => `${Math.round(m2).toLocaleString("fr-FR")} m²`;

/** Libellés courts : tableau d'événements et arêtes du graphe. */
export const COURT: Record<TypeEvenement, string> = {
  division: "Division", division_conservation_numero: "Division",
  reunion: "Réunion", reunion_conservation_numero: "Réunion",
  recomposition: "Remaniement", recomposition_conservation_numero: "Remaniement",
  renumerotation: "Renumérotation", renumerotation_administrative: "Renumérotation",
  reduction_emprise: "Réduction d'emprise", extension_emprise: "Extension d'emprise",
  modif_limite_ou_recalage: "Modification de limite", recalage_plan: "Recalage du plan",
  integration_domaine_public: "Domaine public", integration_domaine_public_voirie: "Domaine public (voirie)",
  sortie_domaine_public: "Issue du domaine public", sortie_domaine_public_voirie: "Issue de la voirie",
  suppression_sans_enfant: "Disparition", creation_sans_parent: "Apparition",
  suppression_parcelle_chevauchante: "Incohérence du plan", absorption_non_resolue: "Incohérence du plan",
  creation_parent_non_resolu: "Incohérence du plan",
  artefact_micro_parcelle: "Artefact", absence_temporaire_artefact: "Artefact", reapparition_artefact: "Artefact",
};

/** Date lisible d'un événement : opération si connue, sinon millésime de publication. */
export const dateEvt = (dateEvenement: IsoDate | null, millesime: IsoDate) =>
  dateEvenement ? jourMoisAnnee(dateEvenement) : moisAnnee(millesime);