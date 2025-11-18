import type { ReactNode } from "react";

interface Props {
  className?: string;
  children: ReactNode;
}

/**
 * LiquidCard — copie exacte du bloc flouté du HERO
 * ------------------------------------------------------------------
 * Style :
 * - fond très translucide : bg-[#0b131f]/20
 * - blur doux : backdrop-blur-sm
 * - arrondi : rounded-2xl
 * - légère bordure interne transparente
 * - padding interne configurable via className
 */
export default function LiquidCard({ className = "", children }: Props) {
  return (
    <div
      className={`
        relative rounded-2xl overflow-hidden
        /* COUCHES / Effet Hero */
        bg-[#0b131f]/20
        backdrop-blur-sm
        border border-white/10
        shadow-[0_0_40px_rgba(0,0,0,0.15)]
        ${className}
      `}
    >
      {/* couche interne très subtile pour la profondeur */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/0 pointer-events-none" />
      
      {/* contenu rendu au-dessus */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
