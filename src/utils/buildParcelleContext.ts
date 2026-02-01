import type { ParcelleInfo } from "../types/parcelle";

export function buildParcelleContextText(
  parcelle: ParcelleInfo,
  identityResult: any   // résultat de l'endpoint identité parcellaire
): string {
  const intersections = identityResult.intersections || [];
  
  const allIntersections = intersections
    .map((i: any) => {
      const elementsText = i.elements && i.elements.length > 0
        ? ` : ${i.elements.join(", ")}`
        : "";
      return `• ${i.display_name}${elementsText}`;
    })
    .join("\n") || "Aucune intersection détectée";

  return `
PARCELLE ANALYSÉE :

- Commune : ${parcelle.commune} (${parcelle.insee})
- Parcelle : section ${parcelle.section}, numéro ${parcelle.numero}

INFORMATIONS D'INTERSECTION SIG :

${allIntersections}

Ces informations sont issues d'analyses SIG et sont considérées comme factuelles.
`.trim();
}
