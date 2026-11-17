export type DemoSubjectOption = {
  /** Valeur technique du champ, inchangée : ce n'est pas un libellé. */
  value: string;
  label: string;
};

export type DemoRequestCopy = {
  backLabel: string;
  backHref: string;
  badge: string;
  title: string;
  intro: string;
  emailLabel: string;
  emailPlaceholder: string;
  subjectLabel: string;
  subjectPlaceholder: string;
  subjectOptions: readonly DemoSubjectOption[];
  messageLabel: string;
  messageOptional: string;
  messagePlaceholder: string;
  submitLabel: string;
  notice: string;
  alreadyClient: string;
  loginLabel: string;
  loginHref: string;
};

export const demoRequestCopy = {
  backLabel: "← KERELIA",
  backHref: "/",
  badge: "FORMULAIRE DE CONTACT",
  title: "Demander une démonstration",
  intro:
    "Décrivez votre besoin : dites-nous qui vous êtes et ce que vous recherchez, nous reviendrons vers vous rapidement.",
  emailLabel: "Adresse e-mail professionnelle",
  emailPlaceholder: "vous@organisation.fr",
  subjectLabel: "Type de sujet",
  subjectPlaceholder: "Choisir un type de sujet",
  subjectOptions: [
    { value: "urbanisme", label: "Urbanisme & documents d'urbanisme" },
    { value: "environnement", label: "Environnement & données" },
    { value: "sig", label: "Outils SIG / intégration" },
    { value: "autre", label: "Autre" },
  ],
  messageLabel: "Présentation / contexte",
  messageOptional: "(facultatif)",
  messagePlaceholder: "Projet, collectivité, volumétrie…",
  submitLabel: "Envoyer la demande",
  notice:
    "Merci pour votre intérêt. L'envoi en ligne sera activé prochainement — en attendant, écrivez-nous à contact@kerelia.fr.",
  alreadyClient: "Déjà client ou partenaire ?",
  loginLabel: "Identification",
  loginHref: "/login",
} satisfies DemoRequestCopy;
