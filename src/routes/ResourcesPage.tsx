import { motion } from "framer-motion";

export default function ResourcesPage() {
  return (
    <div className="font-sans text-[#0B131F] bg-white">
      {/* ================= HEADER ================= */}
      <header className="w-full bg-[#0B131F] text-white py-6 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-12">
          <h1 className="text-3xl md:text-4xl font-bold">
            Ressources : Urbanisme, Certificats d’Urbanisme & Analyse Parcellaire
          </h1>
          <p className="text-white/80 text-lg mt-2 max-w-3xl">
            Guides, explications et contenus pédagogiques pour comprendre les règles
            d’urbanisme, les certificats d’urbanisme, les servitudes, le PLU/PLUi et
            les données territoriales. Une base de connaissances pensée pour les
            collectivités, urbanistes, architectes et particuliers.
          </p>
        </div>
      </header>

      {/* ================= SECTION GUIDES ================= */}
      <section className="py-20 bg-[#F7FAFB] border-b border-[#D5E1E3]/80">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-12">
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl font-bold mb-8"
          >
            Guides essentiels sur l'Urbanisme
          </motion.h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              "Comprendre le Certificat d’Urbanisme (CU)",
              "Différences entre CUa et CUb",
              "Comment lire un PLU ou PLUi ?",
              "Qu’est-ce qu’une unité foncière ?",
              "À quoi servent les Servitudes d’Utilité Publique (SUP) ?",
              "Comment fonctionne une analyse parcellaire automatisée ?",
            ].map((title) => (
              <div
                key={title}
                className="bg-white border border-[#D5E1E3] rounded-xl p-6 shadow-sm hover:shadow transition"
              >
                <h3 className="text-xl font-semibold mb-2">{title}</h3>
                <p className="text-sm text-[#1A2B42]/80 mb-4">
                  Contenu en cours de rédaction — sera bientôt disponible.
                </p>
                <a
                  href="#"
                  className="text-[#FF4F3B] font-semibold text-sm hover:underline"
                >
                  Bientôt disponible →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SECTION FAQ ================= */}
      <section className="py-20 bg-white border-b border-[#D5E1E3]/80">
        <div className="max-w-[900px] mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl font-bold mb-12 text-center"
          >
            FAQ – Certificats d’Urbanisme & Analyse Territoriale
          </motion.h2>

          <p className="text-[#1A2B42]/80 text-center max-w-3xl mx-auto mb-12 text-lg">
            Ces ressources sont conçues pour aider les collectivités, instructeurs,
            architectes, urbanistes et particuliers à mieux comprendre les règles
            d’urbanisme, les certificats d’urbanisme et les données territoriales.
          </p>

          <div className="space-y-10">
            {[
              {
                q: "Qu’est-ce qu’un Certificat d’Urbanisme ?",
                a: "C’est un document officiel précisant les règles d’urbanisme applicables sur une parcelle : PLU, servitudes, risques, droits à construire…",
              },
              {
                q: "Quelle est la différence entre un CUa et un CUb ?",
                a: "Le CUa informe sur les règles. Le CUb précise en plus la faisabilité d’un projet (construction, division…).",
              },
              {
                q: "Pourquoi demander un certificat d’urbanisme ?",
                a: "Pour sécuriser un projet, connaître les droits à construire et vérifier les contraintes réglementaires.",
              },
              {
                q: "Kerelia génère-t-il un certificat officiel ?",
                a: "Kerelia automatise l’analyse et la rédaction. La validation et la délivrance restent du ressort des mairies.",
              },
              {
                q: "Quelles données sont analysées par Kerelia ?",
                a: "Zonage PLU/PLUi, SUP, risques, cadastre, altimétrie, patrimoine… selon disponibilité des données.",
              },
              {
                q: "À qui s’adresse Kerelia ?",
                a: "Aux collectivités, architectes, urbanistes et particuliers souhaitant comprendre la réglementation d’une parcelle.",
              },
              {
                q: "Kerelia couvre-t-il toute la France ?",
                a: "La couverture s’étend progressivement en fonction des données disponibles pour chaque commune.",
              },
            ].map((item) => (
              <motion.div
                key={item.q}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <h3 className="text-xl font-semibold mb-2">{item.q}</h3>
                <p className="text-[#1A2B42]/80 text-sm leading-relaxed">
                  {item.a}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SECTION POURQUOI AUTOMATISER ================= */}
      <section className="py-20 bg-[#F7FAFB]">
        <div className="max-w-[1000px] mx-auto px-6 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl font-bold mb-6"
          >
            Pourquoi automatiser les certificats d’urbanisme ?
          </motion.h2>

          <p className="text-lg text-[#1A2B42] leading-relaxed opacity-90">
            L’automatisation permet d’accélérer les délais de traitement, réduire les erreurs, 
            harmoniser les réponses aux usagers et libérer du temps pour les missions à forte
            valeur ajoutée. Kerelia centralise les données territoriales, croise les règlements
            et génère des documents clairs et structurés en quelques minutes.
          </p>
        </div>
      </section>

      {/* ================= SECTION LEXIQUE ================= */}
      <section className="py-16 bg-white border-b border-[#D5E1E3]/80">
        <div className="max-w-[900px] mx-auto px-6">
          <h2 className="text-3xl font-bold mb-8 text-center">
            Lexique de l’Urbanisme
          </h2>

          <ul className="space-y-6 text-[#1A2B42]/80 text-sm leading-relaxed">
            <li>
              <strong className="text-[#0B131F]">PLU / PLUi :</strong>
              &nbsp;Document qui définit les règles d’aménagement et de construction d’un territoire.
            </li>
            <li>
              <strong className="text-[#0B131F]">SUP :</strong>
              &nbsp;Servitudes d’Utilité Publique, contraintes légales affectant un terrain.
            </li>
            <li>
              <strong className="text-[#0B131F]">PPRI :</strong>
              &nbsp;Plan de prévention des risques d’inondation, applicable selon les zones de risque.
            </li>
            <li>
              <strong className="text-[#0B131F]">Unité foncière :</strong>
              &nbsp;Ensemble des parcelles appartenant au même propriétaire et contiguës.
            </li>
          </ul>
        </div>
      </section>

      {/* ================= SECTION QUESTIONS COLLECTIVITÉS ================= */}
      <section className="py-20 bg-[#F7FAFB] border-b border-[#D5E1E3]/80">
        <div className="max-w-[1000px] mx-auto px-6">
          <h2 className="text-3xl font-bold mb-10 text-center">
            Questions fréquentes des collectivités
          </h2>

          <div className="space-y-8 text-[#1A2B42]/80">
            {[
              {
                q: "Comment accélérer les délais d’instruction ?",
                a: "Kerelia automatise la collecte des données, standardise les analyses et fournit un dossier prêt à relire en quelques minutes."
              },
              {
                q: "Peut-on automatiser les CUb ?",
                a: "Oui, la plateforme prépare les éléments du CUb à partir des pièces fournies et des données territoriales, tout en laissant l’instructeur valider le contenu."
              },
              {
                q: "Est-ce compatible avec le PLUi ?",
                a: "Kerelia s’appuie sur les données PLU/PLUi disponibles et s’adapte à la structure propre à chaque territoire."
              },
              {
                q: "Comment garantir l’exactitude des données ?",
                a: "Les sources officielles (cadastre, SUP, risques, Géoportail…) sont vérifiées à chaque extraction et les mises à jour sont suivies automatiquement."
              }
            ].map(({ q, a }) => (
              <div key={q}>
                <h3 className="text-xl font-semibold mb-2 text-[#0B131F]">{q}</h3>
                <p className="text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FOOTER SIMPLE ================= */}
      <footer className="py-12 text-center text-sm text-[#1A2B42]/70">
        © {new Date().getFullYear()} Kerelia — Ressources & Documentation Urbanisme.
        <p className="text-center text-sm text-[#1A2B42]/60 mt-8">
          Vous souhaitez tester Kerelia ou en savoir plus sur l’automatisation des certificats d’urbanisme ?{" "}
          <a href="/#contact" className="text-[#FF4F3B] font-semibold">
            Contactez-nous.
          </a>
        </p>
      </footer>
    </div>
  );
}
