import { motion } from "framer-motion";
import { Mail, Linkedin } from "lucide-react";
import SiteHeader from "../components/layout/SIteHeader";
import SiteFooter from "../components/layout/SiteFooter";

interface TeamMember {
  name: string;
  title: string;
  image: string;
  email: string;
  linkedin: string;
  description: string;
}

const TEAM: TeamMember[] = [
  {
    name: "Christophe Collantier",
    title: "Fondateur & Président",
    image: "/christophe.png",
    email: "christophe.collantier@kerelia.fr",
    linkedin: "https://www.linkedin.com/in/christophe-collantier-b4290695/",
    description:
      "Président de Kerelia — expertise réglementaire & pilotage des collectivités, au cœur des besoins terrain.",
  },
  {
    name: "Benjamin Benoit",
    title: "CTO - IA / Cartographie",
    image: "/benjamin.png",
    email: "benjamin.b@kerelia.fr",
    linkedin: "https://www.linkedin.com/in/benjamin-benoit-ai-ml/",
    description:
      "Ingénieur IA & urbaniste numérique — automatise la réglementation territoriale et les certificats.",
  }
];

export default function TeamPage() {
  return (
    <div className="font-sans bg-[#F7FAFB]">
      <SiteHeader />
      
      <div className="pt-32 pb-24 max-w-[1200px] mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl font-bold text-[#0B131F] mb-4">
            Notre équipe
          </h1>
          <p className="text-lg text-[#1A2B42]/70 max-w-2xl mx-auto">
            Nous construisons Kerelia avec passion pour les territoires.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-10">
          {TEAM.map((member, i) => (
            <motion.div
              key={member.email}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="backdrop-blur-md bg-white/30 p-8 rounded-2xl border border-black/5 shadow-sm
              hover:shadow-md hover:border-[#FF4F3B]/30 transition-all"
            >
              <div className="flex flex-col items-center text-center">
                <img
                  src={member.image}
                  alt={member.name}
                  className={`w-28 h-28 rounded-full object-cover mb-6 shadow-sm ${
                    member.email === "benjamin@kerelia.fr" ? "grayscale" : ""
                  }`}
                />

                <h3 className="text-2xl font-bold text-[#0B131F] mb-1">
                  {member.name}
                </h3>
                <p className="text-[#FF4F3B] font-semibold mb-3">{member.title}</p>
                
                <p className="text-sm text-[#1A2B42]/70 leading-relaxed mb-6">
                  {member.description}
                </p>

                {/* Social links */}
                <div className="flex gap-4">
                  <a href={`mailto:${member.email}`} className="text-[#FF4F3B] hover:opacity-80">
                    <Mail className="w-5 h-5" />
                  </a>
                  <a href={member.linkedin} target="_blank" rel="noopener noreferrer" className="text-[#FF4F3B] hover:opacity-80">
                    <Linkedin className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      
      <SiteFooter />
    </div>
  );
}
