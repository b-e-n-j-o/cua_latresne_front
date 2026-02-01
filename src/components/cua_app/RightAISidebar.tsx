import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function RightAISidebar({ slug, isOpen, onToggle, apiBase }: { slug: string, isOpen: boolean, onToggle: () => void, apiBase: string }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(384); // 96 * 4 = 384px (w-96)
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  useEffect(() => {
    // Ne charger que si on a un slug, que la sidebar est ouverte, et qu'on n'a pas encore de résultat
    if (!slug || !isOpen || summary || error) return;

    const fetchSummary = async () => {
      setLoading(true);
      setError(null);

      try {
        const base = apiBase.replace(/\/$/, "");
        const res = await fetch(`${base}/cua/ai_summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        const j = await res.json();

        if (j.success) {
          setSummary(j.summary || j.error || "Aucun résumé disponible");
        } else {
          setError(j.error || "Erreur IA");
        }
      } catch (err) {
        setError("Erreur connexion serveur");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [slug, isOpen, apiBase, summary, error]);

  // Réinitialiser summary/error si le slug change
  useEffect(() => {
    setSummary(null);
    setError(null);
    setLoading(false);
  }, [slug]);

  // Gestion du redimensionnement
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  }, [width]);

  useEffect(() => {
    if (!isResizingRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = startXRef.current - e.clientX; // Inverse car on resize depuis la gauche
      const newWidth = Math.max(320, Math.min(800, startWidthRef.current + deltaX)); // Min 320px, Max 800px
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <>
      {/* Bouton toggle toujours visible même quand la sidebar est fermée */}
      {!isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed right-0 z-40 p-2"
          style={{ top: "calc(56px + 5rem)" }}
        >
          <button
            onClick={onToggle}
            className="p-2 rounded-l-lg bg-[#ff4f3b] text-white hover:bg-[#ff4f3b]/90 transition shadow-lg flex items-center justify-center"
            aria-label="Afficher analyse IA"
          >
            {/* Icône sparkles/étoile pour l'IA */}
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" />
              <circle cx="19" cy="4" r="1.5" />
              <circle cx="20" cy="19" r="1" />
              <circle cx="4" cy="19" r="1" />
              <circle cx="2" cy="6" r="0.8" />
            </svg>
          </button>
        </motion.div>
      )}

      {/* Sidebar complète */}
      <motion.div
        initial={{ x: width }}
        animate={{ x: isOpen ? 0 : width }}
        transition={{ duration: 0.3 }}
        className="fixed top-14 right-0 h-[calc(100vh-56px)] bg-white border-l border-[#d5e1e3] shadow-xl z-40 flex flex-col"
        style={{ width: `${width}px` }}
      >
        {/* Handle de redimensionnement - visible seulement quand ouvert */}
        {isOpen && (
          <div
            onMouseDown={handleMouseDown}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-[#ff4f3b] transition-colors z-50"
            style={{ marginLeft: "-2px" }}
          />
        )}

        {/* HEADER */}
        <div className="px-4 py-3 border-b border-[#d5e1e3] flex items-center justify-between">
          <h3 className="font-semibold">Analyse IA</h3>
          <button 
            onClick={onToggle} 
            className="p-1 hover:bg-[#d5e1e3]/20 rounded transition"
            aria-label="Masquer"
          >
            {/* Icône croix - visible seulement quand ouvert */}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* CONTENU */}
        {isOpen && (
          <div className="flex-1 overflow-auto p-4 text-sm text-[#0b131f]/80 leading-relaxed">
            {loading && (
              <div className="text-center animate-pulse">
                Analyse du certificat en cours…
              </div>
            )}

            {error && (
              <div className="text-red-500">{error}</div>
            )}

            {summary && (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {summary}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </>
  );
}
