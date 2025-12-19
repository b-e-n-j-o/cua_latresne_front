import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowUp } from "lucide-react";
import SiteHeader from "../components/layout/SIteHeader";
import MarkdownContent from "../components/MarkdownContent";
import CodeSelector, { type LegalCode } from "../components/rag_components/CodeSelector";
import PLUSelector, { type Commune } from "../components/rag_components/PLUSelector";
import ArticleCards from "../components/rag_components/ArticleCards";
import type { RAGArticleSource } from "../components/rag_components/types";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: RAGArticleSource[];
};

export default function ChatUrba() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sourcesSidebarOpen, setSourcesSidebarOpen] = useState(false);
  const [activeSources, setActiveSources] = useState<RAGArticleSource[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const [selectedCodes, setSelectedCodes] = useState<LegalCode[]>([
    "urbanisme",
    "construction",
    "environnement",
  ]);

  const [usePLU, setUsePLU] = useState(false);
  const [pluCommune, setPluCommune] = useState<string | null>(null);

  // TODO: à remplacer par un endpoint (ex: GET /plu/communes) quand dispo
  const communesDisponibles: Commune[] = [
    { insee: "33234", nom: "Latresne (33234)" },
  ];

  const hasStarted = messages.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    if (usePLU && !pluCommune) {
      alert("Veuillez sélectionner une commune pour interroger le PLU.");
      return;
    }

    if (!usePLU && selectedCodes.length === 0) {
      alert("Veuillez sélectionner au moins une source juridique.");
      return;
    }

    const userMessage = input;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
    ]);

    setInput("");
    setIsTyping(true);

    try {
      // Un seul appel à l'endpoint orchestrateur parallèle
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE}/chat-urba-parallel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: userMessage,
            codes: selectedCodes.length > 0 ? selectedCodes : null,
            commune_insee: usePLU ? pluCommune : null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Erreur backend");
      }

      const result = await response.json();

      // Combiner les sources des codes et du PLU
      const codesSources = (result.sources?.codes || []) as RAGArticleSource[];
      const pluSources = (result.sources?.plu || []) as RAGArticleSource[];
      const allSources = [...codesSources, ...pluSources];

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.response || "Aucune synthèse n'a pu être générée.",
          sources: allSources,
        },
      ]);

      setActiveSources(allSources);
      setSourcesSidebarOpen(allSources.length > 0);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Une erreur est survenue lors de l'interrogation des sources.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-screen flex flex-col font-sans text-[#0B131F]">
      <SiteHeader />
      <div className="flex flex-1 overflow-hidden bg-white">
        {/* ================= SIDEBAR ================= */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ x: -260, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -260, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="w-[260px] bg-white border-r border-[#D5E1E3] pt-24 px-4 pb-4 flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-sm">
                  Historique
                </span>
                <button onClick={() => setSidebarOpen(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ================= CHAT ZONE ================= */}
        <div className="flex-1 flex flex-col relative">
          {/* Bouton hamburger */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="absolute top-24 left-4 z-10 bg-white border border-[#D5E1E3] rounded-lg p-2 shadow-sm hover:bg-[#F7FAFB]"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Bouton "Voir les sources" */}
          {!sourcesSidebarOpen && activeSources.length > 0 && (
            <button
              onClick={() => setSourcesSidebarOpen(true)}
              className="absolute top-24 right-4 z-10 bg-white border border-[#D5E1E3] rounded-lg px-3 py-2 shadow-sm hover:bg-[#F7FAFB] text-xs"
            >
              Voir les sources
            </button>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 pt-24 pb-10">
            <div className="max-w-3xl mx-auto space-y-8">
              {/* Message d’intro */}
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center text-[#1A2B42]/80 mt-24"
                >
                  <h1 className="text-3xl md:text-5xl font-bold text-black/80 mb-6 text-center">
                    Une question?
                  </h1>
                  <p className="text-xl text-black/80">
                    Interrogez les codes légaux d&apos;urbanisme, de
                    construction et de l&apos;habitation, l&apos;environnement
                  </p>
                </motion.div>
              )}

              {/* Messages */}
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "w-full"
                  }`}
                >
                  <div
                    className={`px-5 py-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      msg.role === "user"
                        ? "bg-[#FF4F3B] text-white max-w-[80%]"
                        : "bg-white border border-[#D5E1E3] w-full"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <MarkdownContent content={msg.content} />
                    ) : (
                      msg.content
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Skeleton de chargement */}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full"
                >
                  <div className="w-full bg-white border border-[#D5E1E3] rounded-2xl px-5 py-4 shadow-sm space-y-3">
                    <div className="h-4 w-3/4 bg-[#E5ECEF] rounded animate-pulse" />
                    <div className="h-4 w-full bg-[#E5ECEF] rounded animate-pulse" />
                    <div className="h-4 w-5/6 bg-[#E5ECEF] rounded animate-pulse" />
                  </div>
                </motion.div>
              )}

              {/* ================= INPUT (PRIORITAIRE) ================= */}
              {!hasStarted && (
                <div className="w-full pt-10">
                  <div className="w-full px-6 pb-4">
                    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
                      <div className="flex items-center gap-3">
                        <input
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          placeholder="Posez votre question juridique…"
                          disabled={isTyping}
                          className="
                            flex-1
                            px-5 py-3
                            rounded-xl
                            border border-[#D5E1E3]
                            focus:outline-none
                            focus:ring-2
                            focus:ring-[#FF4F3B]/40
                            disabled:bg-[#F7FAFB]
                          "
                        />
                        <button
                          type="submit"
                          disabled={isTyping}
                          className="
                            bg-black text-white
                            p-3 rounded-xl
                            hover:opacity-90
                            disabled:opacity-50
                          "
                        >
                          <ArrowUp className="w-5 h-5" />
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* ================= OUTILS (SECONDAIRES) ================= */}
                  <div className="w-full px-6 pb-10">
                    <div className="max-w-2xl mx-auto space-y-4 rounded-2xl p-6">
                      {/* Codes */}
                      <div>
                        <p className="text-xs font-medium text-[#1A2B42] mb-1">
                          Codes juridiques
                        </p>
                        <p className="text-[11px] text-[#1A2B42]/70 mb-2">
                          Sélectionnez les codes légaux dans lesquels vous souhaitez tirer des informations.
                        </p>

                        <CodeSelector
                          selectedCodes={selectedCodes}
                          onChange={setSelectedCodes}
                        />
                      </div>

                      {/* PLU */}
                      <PLUSelector
                        enabled={usePLU}
                        commune={pluCommune}
                        communes={communesDisponibles}
                        onToggle={(enabled) => {
                          setUsePLU(enabled);
                          if (!enabled) setPluCommune(null);
                        }}
                        onCommuneChange={(insee) => setPluCommune(insee || null)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ================= INPUT + OUTILS (BAS) ================= */}
          {hasStarted && (
            <div className="w-full bg-white/90 backdrop-blur border-t border-[#D5E1E3]">
              {/* INPUT (PRIORITAIRE) */}
              <div className="w-full px-6 pb-4 pt-4">
                <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
                  <div className="flex items-center gap-3">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Posez votre question juridique…"
                      disabled={isTyping}
                      className="
                        flex-1
                        px-5 py-3
                        rounded-xl
                        border border-[#D5E1E3]
                        focus:outline-none
                        focus:ring-2
                        focus:ring-[#FF4F3B]/40
                        disabled:bg-[#F7FAFB]
                      "
                    />
                    <button
                      type="submit"
                      disabled={isTyping}
                      className="
                        bg-black text-white
                        p-3 rounded-xl
                        hover:opacity-90
                        disabled:opacity-50
                      "
                    >
                      <ArrowUp className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              </div>

              {/* OUTILS (SECONDAIRES) */}
              <div className="w-full px-6 pb-10">
                <div className="max-w-2xl mx-auto space-y-4 border-2 border-[#D5E1E3] rounded-2xl p-6">
                  <div>
                    <p className="text-xs font-medium text-[#1A2B42] mb-1">
                      Codes juridiques
                    </p>
                    <p className="text-[11px] text-[#1A2B42]/70 mb-2">
                      Sélectionnez les codes légaux dans lesquels vous souhaitez tirer des informations.
                    </p>
                    <CodeSelector
                      selectedCodes={selectedCodes}
                      onChange={setSelectedCodes}
                    />
                  </div>

                  <PLUSelector
                    enabled={usePLU}
                    commune={pluCommune}
                    communes={communesDisponibles}
                    onToggle={(enabled) => {
                      setUsePLU(enabled);
                      if (!enabled) setPluCommune(null);
                    }}
                    onCommuneChange={(insee) => setPluCommune(insee || null)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= SIDEBAR DROITE (SOURCES) ================= */}
        <AnimatePresence>
          {sourcesSidebarOpen && (
            <motion.aside
              initial={{ x: 360, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 360, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="w-[360px] bg-white border-l border-[#D5E1E3] pt-24 px-4 pb-4 flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-sm">
                  Articles juridiques
                </span>
                <button onClick={() => setSourcesSidebarOpen(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3">
                <ArticleCards sources={activeSources} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
