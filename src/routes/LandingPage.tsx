import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import UrbanHeroAnimation from "../components/UrbanHeroAnimation";

const solutionCards: { title: string; description: string }[] = [
  {
    title: "Certificats d'Urbanisme",
    description:
      "Kerelia analyse vos dossiers de demandes d'urbanisme, croise les données territoriales à jour et génère des certificats d’urbanisme complets, fiables et lisibles en quelques minutes."
  },
  {
    title: "Cartes d'Identité Parcellaires",
    description:
      "Synthèse foncière et réglementaire instantanée pour chaque parcelle : PLU, risques, servitudes, altimétrie."
  },
  {
    title: "Veille Juridique par IA Agentique",
    description:
      "Surveillance continue des évolutions réglementaires et intégration automatique dans vos modèles de documents."
  }
];

const painPoints: { title: string; description: string }[] = [
  {
    title: "Délais de traitement trop longs",
    description:
      "Analyse manuelle des dossiers, recherches répétitives, va-et-vient entre services… Les CUA et demandes d’urbanisme s’accumulent."
  },
  {
    title: "Données éparpillées",
    description:
      "PLU, SUP, risques, cadastre, RAA, open data : les informations sont dispersées sur différentes plateformes et formats."
  },
  {
    title: "Risque d’erreurs réglementaires",
    description:
      "La complexité croissante des textes multiplie les risques d’oubli ou de mauvaise interprétation."
  },
  {
    title: "Charge mentale pour les équipes",
    description:
      "Les experts passent trop de temps à produire des documents types au lieu de se concentrer sur les projets structurants."
  },
  {
    title: "Expérience usager hétérogène",
    description:
      "Les particuliers et professionnels peinent à comprendre les réponses, les cartes et les implications des règlements."
  },
  {
    title: "Aucune vision consolidée du territoire",
    description:
      "Difficile d’avoir une vue d’ensemble des dynamiques, contraintes et opportunités à l’échelle de la commune."
  }
];

const howItWorksSteps: { step: string; title: string; description: string }[] = [
  {
    step: "01",
    title: "Analyse des dossiers",
    description:
    "Kerelia traite automatiquement le dossier et fait ressortir les informations essentielles, réduisant le temps d’analyse dès la première étape."  },
  {
    step: "02",
    title: "Croisement avec les données du territoire",
    description:
    "Kerelia centralise les données territoriales pertinentes et les transforme en un diagnostic clair et exploitable."  },
  {
    step: "03",
    title: "Génération du certificat & des cartes",
    description:
      "Un certificat d’urbanisme complet est généré : texte structuré selon les normes officielles, références juridiques, cartes intéractives 2D/3D des parcelles, disponibles en quelques minutes."
  }
];

const stats: { label: string; value: string; detail: string }[] = [
  {
    label: "Temps de traitement",
    value: "5min",
    detail: "Des certificats d’urbanisme et des cartes d'identité parcellaire générés en moins de 5 minutes grâce à l’automatisation."
  },
  {
    label: "Erreurs & oublis",
    value: "-90%",
    detail: "Réduction significative des incohérences et oublis réglementaires."
  },
  {
    label: "Satisfaction",
    value: "85%",
    detail: "Des réponses plus claires et pédagogiques pour les usagers."
  }
];

const audienceGroups: { title: string; bullets: string[] }[] = [
  {
    title: "Collectivités",
    bullets: [
      "Réduction des délais de délivrance",
      "Conformité réglementaire documentée",
      "Pilotage fin du territoire"
    ]
  },
  {
    title: "Architectes & Urbanistes",
    bullets: [
      "Pré-diagnostic automatique des parcelles",
      "Accès simplifié aux données réglementaires",
      "Meilleure anticipation des contraintes"
    ]
  },
  {
    title: "Particuliers",
    bullets: [
      "Informations compréhensibles et pédagogiques",
      "Réponses plus rapides aux demandes",
      "Vision claire des droits à construire"
    ]
  }
];

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement | null>(null);
  const { scrollY } = useScroll();

  // Fade-out de l’animation topographique au scroll
  const fadeOpacity = useTransform(
    scrollY,
    [0, (typeof window !== "undefined" ? window.innerHeight : 800) * 0.7],
    [1, 0]
  );

  return (
    <div className="font-sans text-[#0b131f]">
      {/* ================= HEADER ================= */}
      <header className="fixed top-0 left-0 w-full bg-transparent backdrop-blur-sm shadow-sm z-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-12 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <img
              src="/kerelia_logo_gris_fond_bleu_fonce.png"
              alt="Kerelia"
              className="h-10 w-auto"
              loading="lazy"
            />
          </a>

          <nav className="hidden md:flex gap-8 text-[#d5e1e3] text-sm font-medium">
            <a href="#problem" className="hover:text-[#FF4F3B] transition">
              Constat
            </a>
            <a href="#solutions" className="hover:text-[#FF4F3B] transition">
              Solutions
            </a>
            <a href="#how-it-works" className="hover:text-[#FF4F3B] transition">
              Comment ça marche
            </a>
            <a href="#audiences" className="hover:text-[#FF4F3B] transition">
              Pour qui
            </a>
          </nav>

          <a
            href="#contact"
            className="hidden md:inline-block bg-[#FF4F3B] text-white px-6 py-2 rounded-xl font-semibold hover:opacity-90"
          >
            Demander une démo
          </a>
        </div>
      </header>

      {/* ================= HERO ================= */}
      <section
        ref={heroRef}
        className="min-h-screen flex items-start lg:items-center pt-24 lg:pt-32 pb-16 relative overflow-hidden"
      >
        {/* Animation topographique en arrière-plan */}
        <motion.div
          style={{ opacity: fadeOpacity }}
          className="pointer-events-none z-0"
        >
          <UrbanHeroAnimation />
        </motion.div>


        {/* Contenu HERO */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="relative max-w-[1400px] px-4 sm:px-8 lg:px-12 grid md:grid-cols-2 gap-12 mt-10 lg:mt-0"
        >
          <div className="relative">
            {/* Background blurry derrière le texte */}
            <div className="absolute inset-0 -z-10 bg-[#0b131f]/20 backdrop-blur-sm rounded-2xl" />

            <div className="p-6 md:p-8 backdrop-blur-sm rounded-2xl">
              <h1 className="text-5xl md:text-6xl font-bold text-[#d5e1e3] mb-6 leading-tight">
                L’urbanisme intelligent<br />et automatique.
              </h1>
              <p className="text-xl text-[#d5e1e3] mb-8">
                Des solutions IA pour automatiser l'administratif des demandes d'urbanisme.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="#contact"
                  className="inline-block bg-[#FF4F3B] text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-md hover:opacity-90 transition"
                >
                  Demander son Certificat d'urbanisme
                </a>
                <a
                  href="#how-it-works"
                  className="inline-block bg-[#D5E1E3] text-[#FF4F3B] px-8 py-4 rounded-xl text-lg font-semibold shadow-md hover:opacity-90 transition"
                >
                  Comment ça marche
                </a>
              </div>
            </div>
          </div>

        </motion.div>
      </section>

      {/* ================= PROBLÈME / CONSTAT ================= */}
      <section
        id="problem"
        className="bg-[#F7FAFB] py-24 border-t border-[#D5E1E3]/70"
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.7 }}
            className="max-w-4xl mb-12"
          >
            <h2 className="text-4xl font-bold text-[#0B131F] mb-4">
              Un territoire, des règles, trop de complexité.
            </h2>
            <p className="text-lg text-[#1A2B42] leading-relaxed">
              Les services d’urbanisme jonglent entre PLU, SUP, risques,
              cadastre, jurisprudence et exigences citoyennes. Kerelia part de
              cette complexité pour la transformer en un processus fluide et
              maîtrisé.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {painPoints.map(({ title, description }) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.6 }}
                className="bg-white rounded-xl p-5 shadow-sm border border-[#D5E1E3]/80"
              >
                <h3 className="text-lg font-semibold text-[#0B131F] mb-2">
                  {title}
                </h3>
                <p className="text-sm text-[#030303]/80 leading-relaxed">
                  {description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SOLUTIONS ================= */}
      <section
        id="solutions"
        className="py-24 bg-[#FFFFFF]"
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-12">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7 }}
            className="text-4xl font-bold text-[#0B131F] mb-12 text-center"
          >
            Ce qu'automatise Kerelia
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8">
            {solutionCards.map(({ title, description }) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.6 }}
                className="bg-[#F7FAFB] p-6 rounded-xl shadow-sm hover:shadow-md border border-[#D5E1E3]"
              >
                <h3 className="text-xl font-semibold text-[#0B131F] mb-3">
                  {title}
                </h3>
                <p className="text-sm text-[#030303]/80 leading-relaxed">
                  {description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section id="how-it-works" className="bg-[#D5E1E3]/60 py-24">
  <div className="max-w-6xl mx-auto px-6">
    
    {/* Titre + intro */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.7 }}
      className="max-w-3xl mb-12"
    >
      <h2 className="text-4xl font-bold text-[#0B131F] mb-4">
        Comment fonctionne le Certificat d’Urbanisme avec Kerelia ?
      </h2>

      <p className="text-lg text-[#1A2B42] leading-relaxed">
        L'outil de Kerelia transforme une procédure complexe en un parcours clair et continu,
        du dépôt de la demande jusqu’à la production d’un certificat complet et fiable.
      </p>
    </motion.div>

    {/* Étapes */}
    <div className="grid md:grid-cols-3 gap-8">

      {/* Étape 1 */}
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6 }}
        className="bg-white p-6 rounded-xl shadow-sm border border-[#D5E1E3]"
      >
        <div className="text-sm font-mono text-[#FF4F3B] mb-2">Étape 01</div>
        <h3 className="text-xl font-semibold text-[#0B131F] mb-3">Lecture du dossier</h3>
        <p className="text-sm text-[#030303]/80 leading-relaxed">
          Kerelia lit le dossier comme le ferait un instructeur : elle identifie la demande,
          en extrait l’essentiel et prépare une base de travail cohérente dès les premières secondes.
        </p>
      </motion.div>

      {/* Étape 2 */}
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="bg-white p-6 rounded-xl shadow-sm border border-[#D5E1E3]"
      >
        <div className="text-sm font-mono text-[#FF4F3B] mb-2">Étape 02</div>
        <h3 className="text-xl font-semibold text-[#0B131F] mb-3">Compréhension du terrain</h3>
        <p className="text-sm text-[#030303]/80 leading-relaxed">
          L’unité foncière est analysée dans son contexte réglementaire et territorial.
          Kerelia rassemble l’ensemble des informations utiles et à jour pour restituer une
          vision précise et immédiatement exploitable du site.
        </p>
      </motion.div>

      {/* Étape 3 */}
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="bg-white p-6 rounded-xl shadow-sm border border-[#D5E1E3]"
      >
        <div className="text-sm font-mono text-[#FF4F3B] mb-2">Étape 03</div>
        <h3 className="text-xl font-semibold text-[#0B131F] mb-3">Production du certificat</h3>
        <p className="text-sm text-[#030303]/80 leading-relaxed mb-3">
          Le certificat d’urbanisme est rédigé dans un format clair, structuré et conforme
          aux exigences officielles, un gain de temps appréciable pour les services
          d’urbanisme comme pour les usagers.
        </p>
        <p className="text-sm text-[#030303]/80 leading-relaxed">
          Des cartes interactives 2D et 3D sont intégrées automatiquement pour une
          délivrance complète en quelques minutes.
        </p>
      </motion.div>

    </div>
  </div>
</section>



      {/* ================= IMPACT / STATS ================= */}
      <section className="bg-white py-24">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.7 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-[#0B131F] mb-4">
              Un impact concret sur votre quotidien
            </h2>
            <p className="text-lg text-[#1A2B42]">
              Kerelia libère du temps pour ce qui compte : l’aménagement du
              territoire, la qualité des projets et le service aux citoyens.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {stats.map(({ label, value, detail }) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.6 }}
                className="bg-[#F7FAFB] rounded-xl p-6 border border-[#D5E1E3]"
              >
                <div className="text-4xl font-bold text-[#0B131F] mb-2">
                  {value}
                </div>
                <div className="text-sm font-semibold text-[#1A2B42] mb-2">
                  {label}
                </div>
                <p className="text-sm text-[#030303]/80 leading-relaxed">
                  {detail}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= AUDIENCES ================= */}
      <section id="audiences" className="min-h-screen py-24 bg-[#F7FAFB]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7 }}
          className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-12 text-center"
        >
          <h2 className="text-4xl font-bold text-[#0B131F] mb-12">
            Pensé pour tous les acteurs du territoire
          </h2>

          <div className="grid md:grid-cols-3 gap-12 text-left">
            {audienceGroups.map(({ title, bullets }) => (
              <div key={title}>
                <h3 className="text-2xl font-bold text-[#1A2B42] mb-4">
                  {title}
                </h3>
                <ul className="space-y-2 text-sm text-[#030303]/85">
                  {bullets.map((bullet) => (
                    <li key={bullet}>• {bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ================= CONTACT ================= */}
      <section id="contact" className="bg-[#0B131F] text-white py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7 }}
          className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-12 text-center"
        >
          <h2 className="text-4xl font-bold mb-6">
            Prêts à moderniser vos démarches ?
          </h2>
          <p className="text-lg leading-relaxed opacity-90 mb-10">
            Kerelia accompagne les collectivités, urbanistes et acteurs
            privés dans la transformation de leurs procédures d’urbanisme.
            Discutons de vos enjeux et construisons ensemble une
            administration plus claire, plus rapide et plus fiable.
          </p>

          <a
            href="mailto:contact@kerelia.fr?subject=Demande%20de%20d%C3%A9mo%20Kerelia"
            className="inline-block px-8 py-4 border border-white text-white rounded-xl text-lg font-semibold hover:bg-white hover:text-[#0B131F] transition"
          >
            Échanger avec nous
          </a>
        </motion.div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="bg-[#0B131F] text-white py-16">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-12 grid md:grid-cols-4 gap-12">
          <div>
            <h3 className="font-bold mb-4">KERELIA</h3>
            <p className="text-sm opacity-80">
              L’intelligence artificielle au service de l’urbanisme français.
            </p>
          </div>

          <div>
            <h3 className="font-bold mb-4">Solutions</h3>
            <ul className="space-y-2 opacity-90 text-sm">
              {solutionCards.map(({ title }) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-bold mb-4">Entreprise</h3>
            <ul className="space-y-2 opacity-90 text-sm">
              <li>À propos</li>
              <li>Notre équipe</li>
              <li>Contact</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold mb-4">Contact</h3>
            <p>contact@kerelia.fr</p>
            <p>Bordeaux, France</p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-12">
          © {new Date().getFullYear()} Kerelia. Tous droits réservés.
        </p>
      </footer>
    </div>
  );
}
