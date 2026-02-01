import { motion } from "framer-motion";
import { useState } from "react";

export default function AudienceSmartForm({ selectedProfile }: { selectedProfile: string | null }) {
  const [need, setNeed] = useState("");
  const [email, setEmail] = useState("");
  const [commune, setCommune] = useState("");
  const [parcelle, setParcelle] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

  if (!selectedProfile) {
    return (
      <div className="text-center text-[#1A2B42]/70 text-sm mt-6">
        {selectedProfile === null 
          ? "Sélectionnez votre profil ci-dessus pour commencer →"
          : null}
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!commune.trim()) {
      alert("Merci d’indiquer votre commune.");
      return;
    }

    setStatus("loading");

    console.log(import.meta.env.VITE_API_BASE);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: selectedProfile,
          need,
          email,
          commune,
          parcelle,
          message
        })
      });

      

      if (!res.ok) throw new Error("Erreur API");

      setStatus("success");
      setNeed("");
      setEmail("");
      setCommune("");
      setParcelle("");
      setMessage("");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'envoi, merci de réessayer.");
      setStatus("idle");
    }
  };

  const needOptions = {
    collectivite: [
      { value: "demo", label: "Demander une démo" },
      { value: "automatiser", label: "Automatiser mes certificats d'urbanisme" },
      { value: "moderniser", label: "Moderniser mon service urbanisme" }
    ],
    pro: [
      { value: "analyser", label: "Analyser une parcelle" },
      { value: "prediag", label: "Obtenir un pré-diagnostic" },
      { value: "connaître_regles", label: "Accéder aux règles PLU/SUP" }
    ],
    particulier: [
      { value: "comprendre", label: "Comprendre les règles de ma parcelle" },
      { value: "cu", label: "Obtenir un Certificat d'Urbanisme" },
      { value: "accompagnement", label: "Être accompagné dans mes démarches" }
    ],
    all: [
      { value: "cu", label: "Obtenir un Certificat d'Urbanisme" },
      { value: "automatiser", label: "Automatiser mes certificats d'urbanisme pour ma collectivité" },
      { value: "analyser", label: "Analyser et comprendre les règles de ma parcelle" },
      { value: "prediag", label: "Obtenir un pré-diagnostic rapide de parcelles pour les professionnels" },
      { value: "moderniser", label: "Moderniser complètement mon service urbanisme" },
      { value: "plu", label: "Mettre à jour mon PLU automatiquement et au fil du temps" },
      { value: "carto", label: "Obtenir un outil intelligent de cartographie automatique" },
      { value: "accompagnement", label: "Être accompagné dans mes démarches d'urbanisme" },
      { value: "demo", label: "Demander une démo complète et nous contacter" }
    ]
  } as const;

  const optionsForProfile =
    needOptions[selectedProfile as keyof typeof needOptions] ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className={`max-w-2xl mx-auto border shadow-sm p-8 rounded-2xl ${
        selectedProfile === "all" 
          ? "bg-white/10 backdrop-blur-sm border-white/20 text-white" 
          : "bg-white border-[#D5E1E3]"
      }`}
    >
      <h3 className={`text-2xl font-bold mb-6 text-center ${
        selectedProfile === "all" ? "text-white" : "text-[#0B131F]"
      }`}>
        Dites-nous en plus pour vous aider
      </h3>

      {status === "success" ? (
        <p className="text-green-600 font-semibold text-center">
          Merci ! Nous vous recontactons très vite.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className={`block text-sm font-medium mb-1 ${
              selectedProfile === "all" ? "text-white/90" : "text-[#1A2B42]"
            }`}>
              Que souhaitez-vous faire ? *
            </label>
            <select
              value={need}
              required
              onChange={(e) => setNeed(e.target.value)}
              className={`w-full border rounded-lg p-3 text-sm ${
                selectedProfile === "all" 
                  ? "border-white/30 bg-white/10 text-white placeholder-white/50" 
                  : "border-[#D5E1E3] text-[#0B131F]"
              }`}
            >
              <option value="">Choisir…</option>
              {optionsForProfile.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${
              selectedProfile === "all" ? "text-white/90" : "text-[#1A2B42]"
            }`}>
              Email *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full border rounded-lg p-3 ${
                selectedProfile === "all" 
                  ? "border-white/30 bg-white/10 text-white placeholder-white/50" 
                  : "border-[#D5E1E3]"
              }`}
              placeholder="email@exemple.fr"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${
              selectedProfile === "all" ? "text-white/90" : "text-[#1A2B42]"
            }`}>
              Commune concernée *
            </label>
            <input
              type="text"
              required
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
              className={`w-full border rounded-lg p-3 ${
                selectedProfile === "all" 
                  ? "border-white/30 bg-white/10 text-white placeholder-white/50" 
                  : "border-[#D5E1E3]"
              }`}
              placeholder="ex : Latresne, Bordeaux, Pessac…"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${
              selectedProfile === "all" ? "text-white/90" : "text-[#1A2B42]"
            }`}>
              Section / numéro de parcelle (optionnel)
            </label>
            <input
              type="text"
              value={parcelle}
              onChange={(e) => setParcelle(e.target.value)}
              className={`w-full border rounded-lg p-3 ${
                selectedProfile === "all" 
                  ? "border-white/30 bg-white/10 text-white placeholder-white/50" 
                  : "border-[#D5E1E3]"
              }`}
              placeholder="ex : AC 0242"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${
              selectedProfile === "all" ? "text-white/90" : "text-[#1A2B42]"
            }`}>
              Message (optionnel)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={`w-full border rounded-lg p-3 ${
                selectedProfile === "all" 
                  ? "border-white/30 bg-white/10 text-white placeholder-white/50" 
                  : "border-[#D5E1E3]"
              }`}
              rows={4}
              placeholder="Décrivez votre projet ou vos questions"
            />
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full bg-[#FF4F3B] text-white font-semibold py-3 rounded-xl hover:opacity-90 transition disabled:opacity-70"
          >
            {status === "loading" ? "Envoi en cours…" : "Envoyer"}
          </button>
        </form>
      )}
    </motion.div>
  );
}
