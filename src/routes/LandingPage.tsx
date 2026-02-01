import { motion, useScroll, useTransform } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import UrbanHeroAnimation from "../components/UrbanHeroAnimation";
import AudienceSmartForm from "../components/cua_app/AudienceSmartForm";
import UniversalPreview from "../components/UniversalPreview";
import SiteHeader from "../components/layout/SIteHeader";
import SiteFooter from "../components/layout/SiteFooter";
import TopographicAnimation from "../components/TopographicAnimation";

import { Card } from "../components/ui/card";
import { MapPlus, Sparkles, FileCheck, MonitorCog, Map, FileCog } from "lucide-react";

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const location = useLocation();
  const { scrollY } = useScroll();

  // Fade-out de l'animation topographique au scroll
  const fadeOpacity = useTransform(
    scrollY,
    [0, (typeof window !== "undefined" ? window.innerHeight : 800) * 0.7],
    [1, 0]
  );

  // Auto-scroll vers #contact si présent dans l'URL
  useEffect(() => {
    if (location.hash === "#contact") {
      // Petit délai pour laisser le temps au DOM de se charger
      setTimeout(() => {
        const el = document.getElementById("contact");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, [location]);

  return (
    <div className="font-sans text-[#0b131f]">
      <SiteHeader />


{/* ================= HERO ================= */}
<section
  ref={heroRef}
  className="min-h-screen flex items-start lg:items-center pt-24 lg:pt-32 pb-16 relative overflow-hidden"
>
  {/* Animation topographique en arrière-plan */}
  <motion.div
    style={{ opacity: fadeOpacity }}
    className="pointer-events-none z-0 absolute inset-0"
  >
    <TopographicAnimation />
  </motion.div>

  <motion.div
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.8 }}
    className="relative z-10 max-w-[1400px] px-4 sm:px-8 lg:px-12 grid lg:grid-cols-2 gap-12 mt-10 lg:mt-0"
  >
    {/* LEFT HERO CARD */}
    <div className="p-6 md:p-8 backdrop-blur-md bg-white/10 rounded-2xl shadow-sm border border-black/5">
      <h1 className="text-5xl md:text-6xl font-bold text-black/80 mb-6 leading-tight">
        Cartographie et IA<br />au service des territoires.
      </h1>
      <p className="text-xl text-black/80 mb-10">
        Mise à jour automatique des PLU, cartographie réglementaire & génération de certificats
        d’urbanisme avec annexes cartographiques.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <a
          href="#contact"
          className="inline-block bg-[#FF4F3B] text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-md hover:opacity-90 transition"
        >
          Demander une démo
        </a>
        <a
          href="#process"
          className="inline-block bg-black/10 text-[#FF4F3B] px-8 py-4 rounded-xl text-lg font-semibold shadow-md hover:opacity-90 transition"
        >
          Comment ça marche
        </a>
      </div>
    </div>

    {/* RIGHT — THREE FEATURE CARDS */}
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8 }}
      className="grid gap-6"
    >
      {[
        {
          icon: MonitorCog,
          title: "Automatisation PLU",
          desc: "Veille, cartographie et mise à jour automatisée du PLU ( Emplacements reservés, SUP, nouvelles règlementations...)"
        },
        {
          icon: Map,
          title: "Cartographie 2D / 3D",
          desc: "Analyses foncières, contexte terrain et visualisation multi-échelle.",
          link: "#visualisation-cartographique"
        },
        {
          icon: FileCog,
          title: "Certificats d'urbanisme générés automatiquement",
          desc: "CU structurés avec annexes réglementaires complètes.",
          link: "#process"
        }
      ].map((block, i) => {
        const Icon = block.icon;
        const isClickable = block.link !== undefined;
        
        const CardContent = (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: i * 0.1 }}
            className={`p-6 md:p-8 backdrop-blur-md bg-white/10 rounded-2xl shadow-sm border border-black/5 ${
              isClickable 
                ? "cursor-pointer hover:bg-white/20 hover:shadow-md hover:border-[#FF4F3B]/30 transition-all duration-300" 
                : ""
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <Icon className="w-8 h-8 text-[#FF4F3B] flex-shrink-0" />
              <div className="text-xl font-semibold text-[#FF4F3B]">
                {block.title}
              </div>
            </div>
            <p className="text-md text-black/80 leading-relaxed">
              {block.desc}
            </p>
          </motion.div>
        );
        
        if (isClickable) {
          return (
            <a 
              href={block.link} 
              key={i}
              className="block no-underline"
            >
              {CardContent}
            </a>
          );
        }
        
        return <div key={i}>{CardContent}</div>;
      })}
    </motion.div>
  </motion.div>
</section>



      {/* ================= SECTION ACTEURS & FORMULAIRE ================= */}
      <section
        id="audiences"
        className="py-24 bg-[#F7FAFB] border-t border-[#D5E1E3]/70"
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-12"
        >
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-4xl font-bold text-[#0B131F] text-center mb-12"
          >
            Dites-nous qui vous êtes — Kerelia s'adapte à vos besoins
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-12 mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-white p-8 rounded-xl shadow-sm border border-[#FFFDEF] hover:shadow-md transition cursor-pointer"
              onClick={() => setSelectedProfile("collectivite")}
            >
              <h3 className="text-2xl font-bold text-[#1A2B42] mb-4">
                Collectivités
              </h3>
              <p className="text-sm text-[#1A2B42]/70 leading-relaxed mb-6">
              Modernisez votre service d’urbanisme, accélérez l’instruction et réduisez les erreurs, tout en garantissant une conformité réglementaire complète et une meilleure expérience usager.
              Kerelia vous aide à transformer la complexité territoriale en un processus clair, fluide et maîtrisé.
              </p>
              <ul className="space-y-2 text-sm text-[#030303]/85 mb-4">
                <li>• Réduction des délais de délivrance</li>
                <li>• Conformité réglementaire documentée</li>
                <li>• Pilotage fin du territoire</li>
              </ul>
              <span className="text-[#FF4F3B] font-semibold text-xl hover:underline">
                Je suis une collectivité →
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-white p-8 rounded-xl shadow-sm border border-[#D5E1E3] hover:shadow-md transition cursor-pointer"
              onClick={() => setSelectedProfile("pro")}
            >
              <h3 className="text-2xl font-bold text-[#1A2B42] mb-4">
                Architectes & Urbanistes
              </h3>
              <p className="text-sm text-[#1A2B42]/70 leading-relaxed mb-6">
              Obtenez en quelques minutes une vision exhaustive du potentiel réglementaire d’un terrain : zonages, servitudes, risques et données clés consolidées automatiquement.
              Gagnez du temps, sécurisez vos projets et anticipez les contraintes dès les premières phases de conception.
              </p>
              <ul className="space-y-2 text-sm text-[#030303]/85 mb-4">
                <li>• Pré-diagnostic automatique des parcelles</li>
                <li>• Accès simplifié aux données réglementaires</li>
                <li>• Meilleure anticipation des contraintes</li>
              </ul>
              <span className="text-[#FF4F3B] font-semibold text-xl hover:underline">
                Je suis un professionnel →
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="bg-white p-8 rounded-xl shadow-sm border border-[#D5E1E3] hover:shadow-md transition cursor-pointer"
              onClick={() => setSelectedProfile("particulier")}
            >
              <h3 className="text-2xl font-bold text-[#1A2B42] mb-4">
                Particuliers
              </h3>
              <p className="text-sm text-[#1A2B42]/70 leading-relaxed mb-6">
              Comprenez en un coup d’œil les règles d’urbanisme qui s’appliquent à votre parcelle : droits à construire, contraintes, risques et possibilités de projet.
              Kerelia vous accompagne pour sécuriser vos démarches et éclairer vos décisions avant d’acheter, de diviser ou de construire.
              </p>
              <ul className="space-y-2 text-sm text-[#030303]/85 mb-4">
                <li>• Informations compréhensibles et pédagogiques</li>
                <li>• Réponses plus rapides aux demandes</li>
                <li>• Vision claire des droits à construire</li>
              </ul>
              <span className="text-[#FF4F3B] font-semibold text-xl hover:underline">
                Je suis un particulier →
              </span>
            </motion.div>
          </div>

          <AudienceSmartForm selectedProfile={selectedProfile} />
        </motion.div>
      </section>

      {/* ================= PROCESS DÉTAILLÉ ================= */}
      <section id="process" className="py-28 bg-[#D5E1E3]/40">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl lg:text-5xl font-bold text-center text-[#0B131F] mb-6"
          >
            CUA AUTO - Comment ça marche
          </motion.h2>

          <p className="text-xl text-center text-[#1A2B42] mb-16 max-w-3xl mx-auto">
            Du CERFA au certificat d'urbanisme, un traitement automatisé en 5 étapes.
          </p>

          <div className="max-w-5xl mx-auto space-y-16">
            {/* Étape 1 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="grid lg:grid-cols-2 gap-12 items-center"
            >
              <div className="order-2 lg:order-1">
                <Card className="p-8 bg-secondary/50 border-border rounded-3xl">
                  <div className="aspect-video bg-gradient-to-br from-chart-1/20 to-chart-2/20 rounded-2xl flex items-center justify-center">
                    <FileCheck className="w-20 h-20 text-chart-1" />
                  </div>
                </Card>
              </div>
              <div className="order-1 lg:order-2">
                <StepHeader step="1" title="Import du formulaire CERFA" />
                <p className="text-lg text-center text-[#1A2B42]/80 leading-relaxed">
                  Téléchargement du formulaire CERFA de demande de certificat d'urbanisme.
                </p>
              </div>
            </motion.div>

            {/* Étape 2 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="grid lg:grid-cols-2 gap-12 items-center"
            >
              <div>
                <StepHeader step="2" title="Analyse par IA" />
                <p className="text-lg text-center [#1A2B42]/80 leading-relaxed">
                  Extraction automatique des informations pertinentes, croisement des données
                  réglementaires et identification des contraintes applicables à l'unité foncière.
                </p>
              </div>
              <div>
                <Card className="p-8 bg-secondary/50 border-border rounded-3xl">
                  <div className="aspect-video bg-gradient-to-br from-chart-2/20 to-chart-3/20 rounded-2xl flex items-center justify-center">
                    <Sparkles className="w-20 h-20 text-chart-2" />
                  </div>
                </Card>
              </div>
            </motion.div>

            {/* Étape 3 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="grid lg:grid-cols-2 gap-12 items-center"
            >
              <div className="order-2 lg:order-1">
                <Card className="p-8 bg-secondary/50 border-border rounded-3xl">
                  <div className="aspect-video bg-gradient-to-br from-chart-3/20 to-chart-4/20 rounded-2xl flex items-center justify-center">
                    <MapPlus className="w-20 h-20 text-chart-3" />
                  </div>
                </Card>
              </div>
              <div className="order-1 lg:order-2">
                <StepHeader step="3" title="Analyse géographique réglementaire" />
                <p className="text-lg text-center text-[#1A2B42]/80 leading-relaxed">
                  Contrôle automatique de conformité avec l&apos;ensemble des règles géographiquement applicables :
                  PLU, SUP, PPRI, servitudes d&apos;utilité publique, règles nationales.
                </p>
              </div>
            </motion.div>

            {/* Étape 4 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="grid lg:grid-cols-2 gap-12 items-center"
            >
              <div className="order-1 lg:order-2">
                <Card className="p-8 bg-secondary/50 border-border rounded-3xl">
                  <div className="aspect-video rounded-2xl overflow-hidden">
                    <UniversalPreview url="https://odlkagfeqkbrruajlcxm.supabase.co/storage/v1/object/public/visualisation/whYF4hcTBT69VrQtngo9UPtYPR/CUA_unite_fonciere.docx" />
                  </div>
                </Card>
              </div>
              <div className="order-2 lg:order-1">
                <StepHeader step="4" title="Génération du certificat" />
                <p className="text-lg text-center text-[#1A2B42]/80 leading-relaxed">
                  Production du document final de certificat d'urbanisme avec les réglementations, les servitudes,les prescriptions, et autres informations applicables à l'unité foncière.
                </p>
              </div>
            </motion.div>

            {/* Étape 5 – Visualisation cartographique */}
            <motion.div
              id="visualisation-cartographique"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-12 mt-16"
            >
              <div className="text-center">
                <StepHeader step="5" title="Visualisation cartographique" center />
                <p className="text-lg text-center text-[#1A2B42]/80 leading-relaxed max-w-3xl mx-auto mt-2">
                  Génération des cartes réglementaires et topographiques de l'unité foncière.
                </p>
              </div>

              <div className="grid lg:grid-cols-2 gap-8">
                {/* Carte réglementaire 2D */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  <Card className="p-8 bg-white border border-[#D5E1E3] rounded-3xl">
                    <h4 className="text-xl font-bold mb-4">Carte réglementaire 2D</h4>
                    <div className="aspect-video rounded-2xl">
                      <UniversalPreview url="https://odlkagfeqkbrruajlcxm.supabase.co/storage/v1/object/public/visualisation/whYF4hcTBT69VrQtngo9UPtYPR/carte_2d.html" />
                    </div>
                    <p className="text-md text-center text-[#030303]/80 mt-4 leading-relaxed">
                    Zonage règlementaire avec légende détaillée
                    </p>
                  </Card>
                </motion.div>

                {/* Carte topographique 3D */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <Card className="p-8 bg-white border border-[#D5E1E3] rounded-3xl">
                    <h4 className="text-xl font-bold mb-4">Carte topographique 3D</h4>
                    <div className="aspect-video rounded-2xl">
                      <UniversalPreview url="https://odlkagfeqkbrruajlcxm.supabase.co/storage/v1/object/public/visualisation/whYF4hcTBT69VrQtngo9UPtYPR/carte_3d.html" />
                    </div>
                    <p className="text-md text-center text-[#030303]/80 mt-4 leading-relaxed">
                    Topographie LiDAR

                    </p>
                  </Card>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ================= RESULTS ================= */}
      <section
        id="results"
        className="py-28 bg-gradient-to-br from-primary/10 to-secondary/20"
      >
        <div className="max-w-[1400px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.7 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-[#0B131F] mb-4">
              Résultats mesurables et impact concret
            </h2>
            <p className="text-lg text-[#1A2B42] leading-relaxed max-w-3xl mx-auto">
              Kerelia transforme la complexité réglementaire en processus automatisé et fiable.
              Les collectivités, professionnels et particuliers bénéficient d&apos;une analyse rapide,
              exhaustive et cohérente, tout en conservant le contrôle sur les décisions finales.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              {
                val: "1 minute",
                title: "Rapidité d'exécution",
                desc: "Génération automatique d'un pré-diagnostic CU complet en quelques minutes, réduisant drastiquement les délais liés aux recherches manuelles et à la consolidation des données réglementaires."
              },
              {
                val: "100%",
                title: "Conformité garantie",
                desc: "Conformité réglementaire consolidée et documentée. Toutes les sources pertinentes (PLU, SUP, PPRI, servitudes) sont automatiquement croisées pour éviter les oublis et garantir une cohérence constante."
              },
              {
                val: "x10",
                title: "Gain de productivité",
                desc: "Gain significatif sur les temps de recherche foncière et d'analyse réglementaire. L'automatisation libère du temps pour se concentrer sur l'instruction et la validation finale des dossiers."
              },
              {
                val: "∞",
                title: "Potentiel d'analyse",
                desc: "Potentiel d'analyse territoriale illimité. Kerelia permet de traiter des volumes importants de demandes tout en maintenant la qualité et la précision de chaque analyse."
              }
            ].map(({ val, title, desc }, index) => (
              <motion.div
                key={val}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="bg-white p-8 rounded-xl shadow-sm border border-[#D5E1E3]"
              >
                <div className="text-4xl font-bold text-[#FF4F3B] mb-3">
                  {val}
                </div>
                <h3 className="text-lg font-semibold text-[#0B131F] mb-3">
                  {title}
                </h3>
                <p className="text-sm text-[#030303]/80 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CONTACT / DEMO FORM ================= */}
      <section id="contact" className="bg-[#0B131F] text-white py-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-5xl mx-auto px-4 text-center"
        >
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-6">
              Un besoin? Contactez-nous !
            </h2>
            <p className="text-lg opacity-90">
              Découvrez Kerelia en action et demandez une démonstration personnalisée de la solution.
            </p>
          </div>
          
          <AudienceSmartForm selectedProfile="all" />
        </motion.div>
      </section>

      <SiteFooter />
    </div>
  );
}

/** Petit composant interne pour alléger le JSX des étapes */
function StepHeader({
  step,
  title,
  center
}: {
  step: string;
  title: string;
  center?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-4 mb-4 ${
        center ? "justify-center" : ""
      }`}
    >
      <div className="w-12 h-12 rounded-full bg-[#FF4F3B] text-white flex items-center justify-center text-xl font-bold">
        {step}
      </div>
      <h3 className="text-3xl font-bold text-[#0B131F]">{title}</h3>
    </div>
  );
}
