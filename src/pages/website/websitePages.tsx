import type { ComponentType } from "react";
import { EditorialPage } from "./editorial/EditorialPage";
import type { EditorialPageContent } from "./editorial/types";
import {
  bancarisationSuiviErcPage,
  baseDonneesSigPage,
  carteIdentiteFoncierePage,
  certificatsUrbanismePage,
  etudesEnvironnementalesPage,
  outilsPilotageSigPage,
  scoringCompensationPage,
  veilleReglementairePage,
  visualisationMntLidarPage,
} from "./editorial/content";

/** Page rendue par les blocs de `content`. */
export type EditorialContentEntry = {
  path: string;
  content: EditorialPageContent;
};

/** Page avec son propre composant, sans passer par les blocs. */
export type EditorialComponentEntry = {
  path: string;
  component: ComponentType;
};

export type EditorialRegistryEntry = EditorialContentEntry | EditorialComponentEntry;

export const editorialPages: readonly EditorialRegistryEntry[] = [
  { path: "/urbanisme/certificats-durbanisme", content: certificatsUrbanismePage },
  { path: "/urbanisme/carte-didentite-fonciere", content: carteIdentiteFoncierePage },
  { path: "/urbanisme/veille-reglementaire", content: veilleReglementairePage },
  { path: "/environnement/scoring-compensation-ecologique", content: scoringCompensationPage },
  { path: "/environnement/etudes-environnementales", content: etudesEnvironnementalesPage },
  { path: "/environnement/bancarisation-suivi-erc", content: bancarisationSuiviErcPage },
  { path: "/outils/outils-pilotage-sig", content: outilsPilotageSigPage },
  { path: "/outils/base-de-donnees-sig", content: baseDonneesSigPage },
  { path: "/outils/visualisation-mnt-lidar", content: visualisationMntLidarPage },
];

export function EditorialRegistryPage({ entry }: { entry: EditorialRegistryEntry }) {
  if ("component" in entry) {
    const Page = entry.component;
    return <Page />;
  }
  return <EditorialPage page={entry.content} />;
}
