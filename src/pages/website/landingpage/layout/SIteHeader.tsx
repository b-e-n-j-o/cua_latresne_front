import { Link } from "react-router-dom";

export default function SiteHeader() {
  return (
    <header className="fixed top-0 left-0 w-full bg-transparent backdrop-blur-sm shadow-sm z-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-12 py-4 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3">
          <img
            src="/KERELIA-14.png"
            alt="Kerelia - Automatisation urbanisme"
            className="h-10 w-auto"
            loading="lazy"
          />
          <span className="text-xl font-bold">KERELIA</span>
        </a>

        <nav className="hidden md:flex gap-8 text-black/60 text-sm font-medium">
          <a href="/#audiences" className="hover:text-[#FF4F3B] transition">
            Pour qui ?
          </a>
          <a href="/#process" className="hover:text-[#FF4F3B] transition">
            Comment ça marche
          </a>
          <a href="/#results" className="hover:text-[#FF4F3B] transition">
            Résultats
          </a>
          <a href="/#contact" className="hover:text-[#FF4F3B] transition">
            Contact
          </a>
          <a href="/notre-equipe" className="hover:text-[#FF4F3B] transition">
            Notre équipe
          </a>
        </nav>

        <a
          href="/#contact"
          className="hidden md:inline-block bg-[#FF4F3B] text-white px-6 py-2 rounded-xl font-semibold hover:opacity-90"
        >
          Demander une démo
        </a>
      </div>
    </header>
  );
}
