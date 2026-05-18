/**
 * generate-france-map.mjs
 * Lance une seule fois : node src/scripts/generate-france-map.mjs
 * Génère public/images/france-map.svg
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { geoPath, geoConicConformal } from "d3-geo";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");

const WIDTH  = 480;
const HEIGHT = 520;

const NA_CODES = new Set([
  "16", "17", "19", "23", "24",
  "33", "40", "47", "64", "79", "86", "87",
]);

const BORDEAUX = [-0.5792, 44.8378];

// ── Palette ──────────────────────────────────────────────────
const REGION_FILL    = "rgba(255,255,255,0.03)";
const REGION_STROKE  = "rgba(255,255,255,0.10)";
const REGION_SW      = "0.5";
const NA_DEPT_FILL   = "rgba(255,255,255,0.09)";
const NA_DEPT_STROKE = "rgba(255,255,255,0.28)";
const NA_DEPT_SW     = "0.7";
const DOT_COLOR      = "#85e372";

// ── Projection + arrondi des coordonnées (évite un SVG de 20+ Mo) ──
const projection = geoConicConformal()
  .center([2.454071, 46.279229])
  .parallels([44, 49])
  .scale(2800)
  .translate([WIDTH / 2, HEIGHT / 2])
  // Sans clipExtent, d3 génère des paths de ~900 ko par petit polygone
  .clipExtent([[0, 0], [WIDTH, HEIGHT]]);

const pathGen = geoPath(projection);

/** Arrondit chaque nombre du path SVG à 1 décimale. */
function roundPathD(d) {
  return d.replace(/-?\d*\.?\d+/g, (n) => String(Math.round(parseFloat(n) * 10) / 10));
}

function featureToPath(feature) {
  const raw = pathGen(feature.geometry ?? feature);
  if (!raw) return null;
  return roundPathD(raw);
}

// ── Régions (hors Nouvelle-Aquitaine) ────────────────────────
const regionsDir  = join(ROOT, "public/geojson/regions");
const regionFiles = readdirSync(regionsDir).filter(
  (f) => f.endsWith(".geojson") && !f.startsWith(".") && !f.includes("nouvelle-aquitaine")
);

console.log(`📂 ${regionFiles.length} régions trouvées`);

let regionPathsHtml = "";

for (const file of regionFiles) {
  const geojson  = JSON.parse(readFileSync(join(regionsDir, file), "utf-8"));
  const features = geojson.type === "FeatureCollection" ? geojson.features : [geojson];

  for (const feature of features) {
    const d = featureToPath(feature);
    if (!d) continue;
    regionPathsHtml += `  <path d="${d}" fill="${REGION_FILL}" stroke="${REGION_STROKE}" stroke-width="${REGION_SW}" stroke-linejoin="round"/>\n`;
  }
}

// ── Départements Nouvelle-Aquitaine ──────────────────────────
const deptsGeo = JSON.parse(
  readFileSync(join(ROOT, "public/geojson/departements-simplified.geojson"), "utf-8")
);

let deptPathsHtml = "";

for (const feature of deptsGeo.features) {
  if (!NA_CODES.has(feature.properties.code)) continue;
  const d = featureToPath(feature);
  if (!d) continue;
  deptPathsHtml += `  <path d="${d}" fill="${NA_DEPT_FILL}" stroke="${NA_DEPT_STROKE}" stroke-width="${NA_DEPT_SW}" stroke-linejoin="round"/>\n`;
}

// ── Point Bordeaux ────────────────────────────────────────────
const bx = projection(BORDEAUX);
const dotHtml = bx ? `
  <circle cx="${bx[0].toFixed(1)}" cy="${bx[1].toFixed(1)}" r="5" fill="${DOT_COLOR}"/>
  <circle cx="${bx[0].toFixed(1)}" cy="${bx[1].toFixed(1)}" r="10" fill="none" stroke="${DOT_COLOR}" stroke-width="1" opacity="0.35"/>
  <circle cx="${bx[0].toFixed(1)}" cy="${bx[1].toFixed(1)}" r="16" fill="none" stroke="${DOT_COLOR}" stroke-width="0.5" opacity="0.15"/>
` : "";

// ── SVG final ─────────────────────────────────────────────────
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 ${WIDTH} ${HEIGHT}"
  width="${WIDTH}"
  height="${HEIGHT}"
  aria-label="Zone d'intervention Kerelia — Nouvelle-Aquitaine"
>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#000000"/>
  <!-- Fond : régions France hors Nouvelle-Aquitaine -->
${regionPathsHtml}
  <!-- Nouvelle-Aquitaine découpée par département -->
${deptPathsHtml}
  <!-- Point Bordeaux -->
${dotHtml}
</svg>`;

// ── Écriture ──────────────────────────────────────────────────
const outDir  = join(ROOT, "public/images");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "france-map.svg");
writeFileSync(outPath, svg, "utf-8");

console.log(`✅ Carte générée → ${outPath}`);
console.log(`   Taille : ${(svg.length / 1024).toFixed(1)} kb`);
