import { motion, AnimatePresence } from "framer-motion";

type Status = "idle" | "uploading" | "running" | "done" | "error";

type Props = {
  labels: readonly string[];
  activeStep: number;
  progressPct: number;
  status: Status;
  reportUrl: string | null;
  mapUrl: string | null;
};

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

export default function ProgressPanel({
  labels,
  activeStep,
  progressPct,
  status,
  reportUrl,
  mapUrl,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className="bg-white/10 backdrop-blur-2xl border border-white/15 rounded-2xl p-8"
    >
      <h2 className="text-2xl font-semibold mb-6">Progression</h2>

      {/* Barre */}
      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden mb-6">
        <div
          className="h-2 bg-[#ff4f3b] rounded-full transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Étapes */}
      <div className="space-y-4">
        <AnimatePresence>
          {labels.slice(0, activeStep + 1).map((label, i) => {
            const isActive = i === activeStep;
            const isDone = i < activeStep;

            return (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3"
              >
                {/* Pastille animée pour étape active */}
                <motion.div
                  className={cx(
                    "h-3 w-3 rounded-full",
                    isDone
                      ? "bg-[#d5e1e3]/50"
                      : isActive
                      ? "bg-[#ff4f3b]"
                      : "bg-transparent"
                  )}
                  animate={
                    isActive
                      ? {
                          boxShadow: [
                            "0 0 0px rgba(255, 79, 59, 0)",
                            "0 0 12px rgba(255, 79, 59, 0.6)",
                            "0 0 24px rgba(255, 79, 59, 0.9)",
                            "0 0 12px rgba(255, 79, 59, 0.6)",
                            "0 0 0px rgba(255, 79, 59, 0)",
                          ],
                          scale: [1, 1.4, 1.2, 1.4, 1],
                        }
                      : undefined
                  }
                  transition={
                    isActive
                      ? {
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }
                      : undefined
                  }
                />

                {/* Texte */}
                <motion.span
                  className={cx(
                    "transition-colors",
                    isDone
                      ? "text-[#d5e1e3]/40 text-sm"
                      : isActive
                      ? "text-white text-lg font-semibold"
                      : "text-[#d5e1e3]/70 text-sm"
                  )}
                >
                  {label}
                </motion.span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Résultats */}
      <h3 className="text-xl font-semibold mt-8 mb-4">Résultats</h3>

      <div className="flex flex-col gap-4">
        <a
          href={reportUrl || undefined}
          className={cx(
            "px-4 py-2 rounded-lg text-center transition",
            status === "done" && reportUrl
              ? "bg-[#1a2b42] text-white"
              : "bg-white/10 text-white/40 cursor-not-allowed"
          )}
        >
          Télécharger le rapport
        </a>

        <a
          href={mapUrl || undefined}
          target="_blank"
          className={cx(
            "px-4 py-2 rounded-lg text-center transition",
            status === "done" && mapUrl
              ? "bg-[#ff4f3b] text-white"
              : "bg-white/10 text-white/40 cursor-not-allowed"
          )}
        >
          Ouvrir la carte (HTML)
        </a>
      </div>
    </motion.div>
  );
}
