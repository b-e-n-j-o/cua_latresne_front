import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function SiteFooter() {
  return (
    <footer className="bg-[#0B131F] text-white py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-[1400px] mx-auto px-4 grid md:grid-cols-4 gap-12"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h3 className="font-bold mb-4">KERELIA</h3>
          <p className="text-sm opacity-80">
            L'intelligence cartographique au service de l'urbanisme français.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h3 className="font-bold mb-4">Solution</h3>
          <ul className="space-y-2 opacity-90 text-sm">
            <li>Mise à jour PLU</li>
            <li>Cartographie réglementaire</li>
            <li>Certificats d'urbanisme</li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h3 className="font-bold mb-4">Entreprise</h3>
          <ul className="space-y-2 opacity-90 text-sm">
            <li>À propos</li>
            <li>
              <Link to="/notre-equipe" className="hover:text-[#FF4F3B] transition">
                Notre équipe
              </Link>
            </li>
            <li>Contact</li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h3 className="font-bold mb-4">Contact</h3>
          <p>contact@kerelia.fr</p>
          <p>Bordeaux, France</p>
        </motion.div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="text-center text-xs text-gray-400 mt-12"
      >
        © {new Date().getFullYear()} Kerelia. Tous droits réservés.
      </motion.p>
    </footer>
  );
}
