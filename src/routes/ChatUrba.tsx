import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowUp } from "lucide-react";
import SiteHeader from "../components/layout/SIteHeader";
import MarkdownContent from "../components/MarkdownContent";
import CodeSelector, { type LegalCode } from "../components/rag_components/CodeSelector";
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
  const [selectedCodes, setSelectedCodes] = useState<LegalCode[]>([]);

  const hasStarted = messages.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = input;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
    ]);

    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/chat-urba`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: userMessage,
            codes: selectedCodes.length ? selectedCodes : ["all"],
          }),
        }
      );

      if (!res.ok) {
        throw new Error("Erreur backend");
      }

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          sources: data.sources || [],
        },
      ]);

      setActiveSources(data.sources || []);
      setSourcesSidebarOpen(true);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Une erreur est survenue lors de l'interrogation du moteur juridique.",
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
          <div className="flex-1 overflow-y-auto px-6 pt-24 pb-40">
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
            </div>
          </div>

          {/* ================= INPUT ================= */}
          <motion.form
            onSubmit={handleSubmit}
            initial={false}
            animate={
              hasStarted
                ? {
                    bottom: 24,
                    top: "auto",
                    transform: "translateY(0)",
                  }
                : {
                    top: "50%",
                    bottom: "auto",
                    transform: "translateY(-50%)",
                  }
            }
            transition={{ duration: 0.45, ease: "easeInOut" }}
            className="
              absolute
              left-0
              right-0
              mx-auto
              w-full
              max-w-2xl
              px-4
              py-4
              bg-white
              border
              border-[#D5E1E3]
              rounded-2xl
              shadow-md
              flex
              flex-col
              gap-3
              z-20
            "
          >
            <div className="w-full">
              <CodeSelector
                selectedCodes={selectedCodes}
                onChange={setSelectedCodes}
              />
              <div className="flex items-center gap-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Posez votre question juridique…"
                  disabled={isTyping}
                  className="
                    flex-1
                    px-5
                    py-3
                    rounded-xl
                    border
                    border-[#D5E1E3]
                    focus:outline-none
                    focus:ring-2
                    focus:ring-[#FF4F3B]/40
                    disabled:bg-[#F7FAFB]
                    disabled:cursor-not-allowed
                  "
                />
                <button
                  type="submit"
                  disabled={isTyping}
                  className="
                    bg-black
                    text-white
                    p-3
                    rounded-xl
                    hover:opacity-90
                    transition
                    disabled:opacity-50
                    disabled:cursor-not-allowed
                    flex
                    items-center
                    justify-center
                  "
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.form>
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
