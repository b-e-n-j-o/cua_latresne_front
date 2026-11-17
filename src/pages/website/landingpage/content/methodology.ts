export type MethodologyStep = {
  num: string;
  title: string;
  desc: string;
};

export type MethodologyCopy = {
  title: string;
  intro: string;
  steps: readonly MethodologyStep[];
};

export const methodologyCopy = {
  title: "Nos engagements.",
  intro: "Kerelia garantit un traitement 100\u00a0% souverain de vos données. Hébergement français, intelligence artificielle française, référentiels publics français. Chaque analyse est traçable de la source au livrable.",
  steps: [
    {
      num: "01",
      title: "Souveraineté",
      desc: "Hébergement OVH, intelligence artificielle Mistral. Vos données ne transitent pas hors du territoire national.",
    },
    {
      num: "02",
      title: "Traçabilité",
      desc: "Chaque analyse est horodatée et sourcée. Notre architecture permet de retracer l\u2019origine, le traitement et la destination de chaque donnée. Référentiels français : IGN, BRGM, INPN, Pléiades, Cadastre\u2026",
    },
    {
      num: "03",
      title: "Conformité",
      desc: "Traitement conforme au RGPD. Registre des traitements tenu \u00e0 jour. Droit d\u2019acc\u00e8s, de rectification et de suppression garanti.",
    },
    {
      num: "04",
      title: "Identité",
      desc: "Authentification des professionnels (notaires, demandeurs de CU) via FranceConnect et ProConnect. Interopérabilité native avec l\u2019écosystème d\u2019identité numérique de l\u2019État.",
    },
  ] satisfies MethodologyCopy["steps"],
} satisfies MethodologyCopy;
