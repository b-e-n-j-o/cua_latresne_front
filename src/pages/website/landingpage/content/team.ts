export type TeamMemberCopy = {
  name: string;
  title: string;
  image: string;
  email: string;
  linkedin: string;
  quote: string;
  description: string;
};

export type TeamCopy = {
  title: string;
  emailAriaPrefix: string;
  linkedinAriaPrefix: string;
  members: readonly TeamMemberCopy[];
};

export const teamCopy = {
  title: "Notre équipe",
  emailAriaPrefix: "Email",
  linkedinAriaPrefix: "LinkedIn",
  members: [
    {
      name: "Christophe Collantier",
      title: "Fondateur",
      image: "/christophe.png",
      email: "christophe.collantier@kerelia.fr",
      linkedin: "https://www.linkedin.com/in/christophe-collantier-b4290695/",
      quote: "Quinze ans à naviguer dans les procédures d\u2019urbanisme m\u2019ont appris exactement où le système coince. Kerelia est née de la volonté de résoudre ces blocages par la donnée.",
      description:
        "Fondateur de Kerelia. Pilote les sujets réglementaires et la relation avec les collectivités et les services de l\u2019État.",
    },
    {
      name: "Benjamin Benoit",
      title: "CTO - Data SIG / IA",
      image: "/benjamin.png",
      email: "benjamin.b@kerelia.fr",
      linkedin: "https://www.linkedin.com/in/benjamin-benoit-ai-ml/",
      quote: "Faire fusionner l\u2019analyse de données et la géomatique pour produire des résultats concrets au service de l\u2019environnement.",
      description:
        "Ingénieur Data SIG. Conception des pipelines géospatiaux, croisement multi-sources et génération automatisée de rapports.",
    },
  ] satisfies TeamCopy["members"],
} satisfies TeamCopy;
