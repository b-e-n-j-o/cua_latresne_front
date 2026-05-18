/**
 * FranceMap.tsx
 * Affiche le SVG statique pré-généré — zéro calcul au runtime.
 * Générer d'abord : node scripts/generate-france-map.mjs
 */
export default function FranceMap() {
  return (
    <div className="about__map">
      <img
        className="about__map-img"
        src="/images/france-map.png"
        alt="Zone d'intervention Kerelia — Nouvelle-Aquitaine"
        width={480}
        height={520}
        decoding="async"
        loading="lazy"
      />
    </div>
  );
}