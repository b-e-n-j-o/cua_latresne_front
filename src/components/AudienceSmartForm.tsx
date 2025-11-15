import { useState } from "react";
import { motion } from "framer-motion";

export default function AudienceSmartForm({ selectedProfile }: { selectedProfile: string | null }) {
  const [need, setNeed] = useState("");
  const [email, setEmail] = useState("");
  const [parcel, setParcel] = useState("");
  const [message, setMessage] = useState("");

  const profileLabel = {
    collectivite: "Collectivité",
    pro: "Professionnel",
    particulier: "Particulier"
  }[selectedProfile || ""];


  if (!selectedProfile) {
    return (
      <div className="text-center text-[#1A2B42]/70 text-sm mt-6">
        Sélectionnez votre profil ci-dessus pour commencer →
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="bg-[#F7FAFB] border border-[#D5E1E3] rounded-xl p-10 shadow-sm max-w-3xl mx-auto"
    >
      <h3 className="text-2xl font-bold text-[#0B131F] mb-6">
        Vous êtes : {profileLabel}
      </h3>

      {/* Question 1 : besoin */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#1A2B42] mb-2">
          Que souhaitez-vous faire ?
        </label>

        <select
          value={need}
          onChange={(e) => setNeed(e.target.value)}
          className="w-full p-3 border border-[#D5E1E3] rounded-xl text-sm text-[#0B131F]"
        >
          <option value="">Choisir…</option>

          {selectedProfile === "collectivite" && (
            <>
              <option value="demo">Demander une démo</option>
              <option value="automatiser">Automatiser mes certificats d’urbanisme</option>
              <option value="moderniser">Moderniser mon service urbanisme</option>
            </>
          )}

          {selectedProfile === "pro" && (
            <>
              <option value="analyser">Analyser une parcelle</option>
              <option value="prediag">Obtenir un pré-diagnostic</option>
              <option value="connaître_regles">Accéder aux règles PLU/SUP</option>
            </>
          )}

          {selectedProfile === "particulier" && (
            <>
              <option value="comprendre">Comprendre les règles de ma parcelle</option>
              <option value="cu">Obtenir un Certificat d’Urbanisme</option>
              <option value="accompagnement">Être accompagné dans mes démarches</option>
            </>
          )}
        </select>
      </div>

      {/* Question 2 : email */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#1A2B42] mb-2">
          Votre email
        </label>
        <input
          type="email"
          className="w-full p-3 border border-[#D5E1E3] rounded-xl text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="votre.email@mail.com"
        />
      </div>

      {/* Question 3 : parcelle (optionnel) */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#1A2B42] mb-2">
          Parcelle / Adresse ou Commune (optionnel)
        </label>
        <input
          type="text"
          className="w-full p-3 border border-[#D5E1E3] rounded-xl text-sm"
          value={parcel}
          onChange={(e) => setParcel(e.target.value)}
          placeholder="Ex : Section AC 0242, Latresne"
        />
      </div>

      {/* Message libre */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#1A2B42] mb-2">
          Votre message (optionnel)
        </label>
        <textarea
          className="w-full p-3 border border-[#D5E1E3] rounded-xl text-sm h-28"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Expliquez votre besoin en quelques mots…"
        />
      </div>

      {/* CTA */}
      <button
        className="w-full bg-[#FF4F3B] text-white font-semibold p-4 rounded-xl hover:opacity-90 transition"
        onClick={() => {
          console.log("À envoyer à Supabase plus tard :", {
            profile: selectedProfile,
            need,
            email,
            parcel,
            message
          });
          alert("Merci ! Nous revenons vers vous très vite.");
        }}
      >
        Envoyer
      </button>
    </motion.div>
  );
}
