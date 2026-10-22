/** Communes de la CdA de La Rochelle (code INSEE → nom). */
export const COMMUNES_LR: { insee: string; nom: string }[] = [
  { insee: "17010", nom: "Angoulins" },
  { insee: "17028", nom: "Aytré" },
  { insee: "17059", nom: "Bourgneuf" },
  { insee: "17094", nom: "Châtelaillon-Plage" },
  { insee: "17109", nom: "Clavette" },
  { insee: "17136", nom: "Croix-Chapeau" },
  { insee: "17142", nom: "Dompierre-sur-Mer" },
  { insee: "17153", nom: "Esnandes" },
  { insee: "17190", nom: "L'Houmeau" },
  { insee: "17193", nom: "La Jarne" },
  { insee: "17194", nom: "La Jarrie" },
  { insee: "17300", nom: "La Rochelle" },
  { insee: "17200", nom: "Lagord" },
  { insee: "17222", nom: "Marsilly" },
  { insee: "17245", nom: "Montroy" },
  { insee: "17264", nom: "Nieul-sur-Mer" },
  { insee: "17274", nom: "Périgny" },
  { insee: "17291", nom: "Puilboreau" },
  { insee: "17315", nom: "Saint-Christophe" },
  { insee: "17373", nom: "Saint-Médard-d'Aunis" },
  { insee: "17391", nom: "Saint-Rogatien" },
  { insee: "17413", nom: "Saint-Vivien" },
  { insee: "17414", nom: "Saint-Xandre" },
  { insee: "17407", nom: "Sainte-Soulle" },
  { insee: "17420", nom: "Salles-sur-Mer" },
  { insee: "17443", nom: "Thairé" },
  { insee: "17466", nom: "Vérines" },
  { insee: "17483", nom: "Yves" },
];

const PAR_INSEE = new Map(COMMUNES_LR.map((c) => [c.insee, c.nom]));

export function nomCommune(insee: string): string {
  return PAR_INSEE.get(insee) ?? (insee || "Commune inconnue");
}
