/**
 * generate-france-map-fond-noir.mjs
 * node src/scripts/generate-france-map-fond-noir.mjs
 * Génère public/images/france-map.png avec fond noir garanti
 *
 * Prérequis : public/images/france-map.svg (généré au préalable)
 */

import { readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");

const svgPath = join(ROOT, "public/images/france-map.svg");
const outDir = join(ROOT, "public/images");
const outPath = join(outDir, "france-map.png");

const BLACK_RECT = '<rect width="100%" height="100%" fill="#000000"/>';

mkdirSync(outDir, { recursive: true });

let svgContent = readFileSync(svgPath, "utf-8");

// Retire les hacks précédents (style inline sur <svg>)
svgContent = svgContent.replace(/\s*style="background:#000000"/g, "");

// Un seul rect noir en premier élément — sharp composite les rgba() dessus
svgContent = svgContent.replace(/\s*<rect[^>]*fill="#000000"[^>]*\/?>\s*/g, "");
svgContent = svgContent.replace(/(<svg[^>]*>)/, `$1\n  ${BLACK_RECT}\n`);

const svgBuffer = Buffer.from(svgContent);

await sharp(svgBuffer)
  .resize(960, 1040)
  .flatten({ background: { r: 0, g: 0, b: 0 } })
  .png({ compressionLevel: 8 })
  .toFile(outPath);

const size = readFileSync(outPath).length;
console.log(`✅ PNG généré → ${outPath}`);
console.log(`   Taille : ${(size / 1024).toFixed(1)} kb`);
