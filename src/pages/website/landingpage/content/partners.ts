export type Partnership = {
  name: string;
  body: string;
};

export type SourcesPartnershipsCopy = {
  title: string;
  intro: string;
  institutionalHeading: string;
  operationalHeading: string;
  partnerships: readonly Partnership[];
};

export const sourcesPartnershipsCopy = {
  title: "Sources & partenariats",
  intro:
    "Kerelia produit ses analyses à partir des données publiques et propriétaires faisant autorité. Nous travaillons sans intermédiaire avec les sources de l'État, des établissements publics et des organismes scientifiques.",
  institutionalHeading: "Références institutionnelles",
  operationalHeading: "Partenariats opérationnels",
  partnerships: [
    {
      name: "SIMETHIS et Eco-Compensation",
      body:
        "Co-conception du logiciel de bancarisation et de suivi des mesures ERC. SIMETHIS apporte vingt ans de pratique de terrain en écologie réglementaire ; Kerelia, l'ingénierie de données et le développement logiciel.",
    },
    {
      name: "Technowest",
      body:
        "Incubateur technologique de Bordeaux Métropole. Kerelia est incubée à Technowest depuis 2025.",
    },
  ],
} satisfies SourcesPartnershipsCopy;
