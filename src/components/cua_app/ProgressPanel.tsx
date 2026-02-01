import { motion } from "framer-motion";

type Status = "idle" | "uploading" | "running" | "waiting_user" | "awaiting_pipeline" | "done" | "error";

type Props = {
  status: Status;
};

export default function ProgressPanel({ status }: Props) {
  const isActive =
    status === "uploading" ||
    status === "running" ||
    status === "waiting_user" ||
    status === "awaiting_pipeline";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className="bg-white/10 backdrop-blur-2xl border border-white/15 rounded-2xl p-8"
    >
      <h2 className="text-2xl font-semibold mb-6">Progression</h2>

      {isActive && (
        <div className="flex items-center justify-center py-8">
          <motion.p
            className="text-center text-[#0b131f]/70 text-base"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            Analyse du dossier, génération du certificat d'urbanisme en cours...
          </motion.p>
        </div>
      )}

      {status === "error" && (
        <div className="text-red-500 text-center py-4">
          Une erreur est survenue.
        </div>
      )}
    </motion.div>
  );
}
