import {
  formatM,
  formatM2,
  formatPct,
  type FamilleCroisee,
  type ParcelleSel,
  type RapportCroisement,
} from "./cartoTypes";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 46;

const WIN1252: Record<string, number> = {
  "€": 0x80,
  "Œ": 0x8c,
  "œ": 0x9c,
  "Š": 0xa0,
  "Ž": 0x8e,
  "ž": 0x9e,
  "Ÿ": 0x9f,
  "¡": 0xa1,
  "¢": 0xa2,
  "£": 0xa3,
  "¥": 0xa5,
  "§": 0xa7,
  "¨": 0xa8,
  "©": 0xa9,
  "«": 0xab,
  "¬": 0xac,
  "®": 0xae,
  "°": 0xb0,
  "±": 0xb1,
  "²": 0xb2,
  "³": 0xb3,
  "µ": 0xb5,
  "·": 0xb7,
  "»": 0xbb,
  "À": 0xc0,
  "Á": 0xc1,
  "Â": 0xc2,
  "Ã": 0xc3,
  "Ä": 0xc4,
  "Å": 0xc5,
  "Æ": 0xc6,
  "Ç": 0xc7,
  "È": 0xc8,
  "É": 0xc9,
  "Ê": 0xca,
  "Ë": 0xcb,
  "Ì": 0xcc,
  "Í": 0xcd,
  "Î": 0xce,
  "Ï": 0xcf,
  "Ñ": 0xd1,
  "Ò": 0xd2,
  "Ó": 0xd3,
  "Ô": 0xd4,
  "Õ": 0xd5,
  "Ö": 0xd6,
  "Ø": 0xd8,
  "Ù": 0xd9,
  "Ú": 0xda,
  "Û": 0xdb,
  "Ü": 0xdc,
  "Ý": 0xdd,
  "à": 0xe0,
  "á": 0xe1,
  "â": 0xe2,
  "ã": 0xe3,
  "ä": 0xe4,
  "å": 0xe5,
  "æ": 0xe6,
  "ç": 0xe7,
  "è": 0xe8,
  "é": 0xe9,
  "ê": 0xea,
  "ë": 0xeb,
  "ì": 0xec,
  "í": 0xed,
  "î": 0xee,
  "ï": 0xef,
  "ñ": 0xf1,
  "ò": 0xf2,
  "ó": 0xf3,
  "ô": 0xf4,
  "õ": 0xf5,
  "ö": 0xf6,
  "ø": 0xf8,
  "ù": 0xf9,
  "ú": 0xfa,
  "û": 0xfb,
  "ü": 0xfc,
  "ý": 0xfd,
  "ÿ": 0xff,
  "’": 0x92,
  "‘": 0x91,
  "“": 0x93,
  "”": 0x94,
  "–": 0x96,
  "—": 0x97,
  "…": 0x85,
  "\u00a0": 0xa0,
};

type Page = { cmds: string[]; y: number };

function pdfText(text: string): string {
  let out = "";
  for (const ch of text) {
    if (ch === "\u202f" || ch === "\u2009" || ch === "\u00a0") {
      out += " ";
      continue;
    }
    if (ch === "\\") {
      out += "\\\\";
      continue;
    }
    if (ch === "(") {
      out += "\\(";
      continue;
    }
    if (ch === ")") {
      out += "\\)";
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code >= 32 && code <= 126) {
      out += ch;
      continue;
    }
    const win = WIN1252[ch];
    out += win == null ? "?" : `\\${win.toString(8).padStart(3, "0")}`;
  }
  return `(${out})`;
}

function wrap(text: string, size: number, indent: number): string[] {
  const maxChars = Math.max(20, Math.floor((PAGE_W - MARGIN * 2 - indent) / (size * 0.52)));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = Number.parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  if (!Number.isFinite(n)) return [0.4, 0.4, 0.4];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function rgb(tuple: [number, number, number]): string {
  return tuple.map((v) => v.toFixed(3)).join(" ");
}

function nouvellePage(pages: Page[]) {
  const page: Page = { cmds: [], y: PAGE_H - 58 };
  page.cmds.push(
    "0.35 0.35 0.35 rg",
    "BT",
    "/F1 8 Tf",
    `1 0 0 1 ${MARGIN} ${PAGE_H - 32} Tm`,
    `${pdfText("Carte d'identité foncière — CdA de La Rochelle")} Tj`,
    "ET",
    "0.82 0.84 0.86 RG",
    "0.6 w",
    `${MARGIN} ${PAGE_H - 40} m ${PAGE_W - MARGIN} ${PAGE_H - 40} l S`,
  );
  pages.push(page);
}

function pageCourante(pages: Page[], besoin: number): Page {
  let page = pages[pages.length - 1];
  if (!page || page.y - besoin < MARGIN + 16) {
    nouvellePage(pages);
    page = pages[pages.length - 1];
  }
  return page;
}

function texte(pages: Page[], value: string, size: number, bold: boolean, color = "0.12 0.13 0.15", indent = 0) {
  const leading = size + 4;
  const lines = wrap(value, size, indent);
  const page = pageCourante(pages, lines.length * leading + 2);
  page.cmds.push("BT", `${color} rg`, `/${bold ? "F2" : "F1"} ${size} Tf`);
  lines.forEach((line, i) => {
    const y = page.y - size - i * leading;
    page.cmds.push(`1 0 0 1 ${MARGIN + indent} ${y.toFixed(2)} Tm`, `${pdfText(line)} Tj`);
  });
  page.cmds.push("ET");
  page.y -= lines.length * leading;
}

function espace(pages: Page[], n: number) {
  const page = pages[pages.length - 1];
  if (page) page.y -= n;
}

function pastille(pages: Page[], hex: string) {
  const page = pageCourante(pages, 14);
  const y = page.y - 10;
  page.cmds.push(`${rgb(hexRgb(hex))} rg`, `${MARGIN} ${y.toFixed(2)} 8 8 re f`);
}

function metrique(famille: FamilleCroisee): string {
  const parts: string[] = [];
  if (famille.surfaceM2 >= 1) parts.push(`${formatM2(famille.surfaceM2)}${famille.pct != null ? ` (${formatPct(famille.pct)})` : ""}`);
  if (famille.longueurM >= 0.5) parts.push(formatM(famille.longueurM));
  if (famille.nbPoints > 0) parts.push(famille.nbPoints > 1 ? `${famille.nbPoints} points` : "1 point");
  return parts.join(" · ");
}

function metriqueObjet(objet: FamilleCroisee["objets"][number]): string {
  const parts: string[] = [];
  if (objet.surfaceM2 >= 1) parts.push(`${formatM2(objet.surfaceM2)}${objet.pct != null ? ` (${formatPct(objet.pct)})` : ""}`);
  if (objet.longueurM >= 0.5) parts.push(formatM(objet.longueurM));
  if (objet.nbPoints > 0) parts.push(objet.nbPoints > 1 ? `${objet.nbPoints} points` : "présent");
  return parts.join(" · ");
}

function construirePages(parcelles: ParcelleSel[], rapport: RapportCroisement): Page[] {
  const pages: Page[] = [];
  nouvellePage(pages);
  const titre = parcelles.length > 1 ? "Unité foncière" : "Parcelle";
  texte(pages, "Carte d'identité foncière", 18, true, "0.08 0.16 0.28");
  espace(pages, 2);
  texte(pages, "Communauté d'agglomération de La Rochelle", 11, false, "0.25 0.32 0.4");
  espace(pages, 8);
  texte(
    pages,
    "Ébauche générée depuis la carte. Elle récapitule les couches de la légende croisées avec la ou les parcelles sélectionnées. Document non opposable.",
    9,
    false,
    "0.35 0.38 0.42",
  );
  espace(pages, 12);
  texte(pages, titre, 13, true);
  espace(pages, 4);
  for (const p of parcelles) {
    const surface = p.contenanceM2 != null ? formatM2(p.contenanceM2) : "contenance non renseignée";
    texte(pages, `${p.section} ${p.numero} — ${p.commune} (${p.codeInsee || "INSEE inconnu"}) — ${surface}`, 10, false, "0.12 0.13 0.15", 8);
  }
  espace(pages, 8);
  texte(
    pages,
    `Surface cadastrale : ${formatM2(rapport.contenanceM2)}${rapport.contenanceIncomplete ? " (incomplète)" : ""}`,
    10,
    true,
  );
  texte(pages, `Surface graphique : ${formatM2(rapport.surfaceGraphiqueM2)}`, 10, false);
  texte(pages, `Calculé le ${rapport.calculeLe} · ${rapport.nTouchees} / ${rapport.nFamilles} familles de la légende concernées.`, 9, false, "0.35 0.38 0.42");
  if (rapport.avertissement) {
    espace(pages, 4);
    texte(pages, rapport.avertissement, 9, false, "0.55 0.32 0.08");
  }
  espace(pages, 12);
  texte(pages, "Croisements", 13, true);
  espace(pages, 4);
  texte(pages, "Les pourcentages portent sur la surface graphique de l'unité foncière.", 8, false, "0.4 0.42 0.46");

  let any = false;
  for (const groupe of rapport.groupes) {
    if (!groupe.familles.length) continue;
    any = true;
    espace(pages, 8);
    texte(pages, groupe.label, 12, true, "0.1 0.22 0.38");
    for (const famille of groupe.familles) {
      espace(pages, 4);
      pastille(pages, famille.couleur);
      texte(pages, `${famille.label} — ${metrique(famille)}`, 10, true, "0.12 0.13 0.15", 14);
      for (const objet of famille.objets.slice(0, 25)) {
        texte(pages, `${objet.libelle} — ${metriqueObjet(objet)}`, 9, false, "0.22 0.24 0.28", 22);
      }
      if (famille.objets.length > 25) {
        texte(pages, `… ${famille.objets.length - 25} autre(s) objet(s)`, 8, false, "0.45 0.45 0.45", 22);
      }
    }
  }
  if (!any) {
    espace(pages, 6);
    texte(pages, "Aucune intersection significative avec les couches de la légende.", 10, false);
  }

  espace(pages, 12);
  texte(pages, "Familles sans intersection", 12, true, "0.25 0.28 0.32");
  espace(pages, 3);
  for (const groupe of rapport.groupes) {
    if (!groupe.sans.length) continue;
    texte(pages, `${groupe.label} : ${groupe.sans.join(", ")}`, 8, false, "0.4 0.42 0.46");
  }

  espace(pages, 14);
  texte(
    pages,
    "Méthode : intersections calculées dans le navigateur à partir des tuiles vectorielles de la carte (PLUi, servitudes, réseaux, cadastre). Les grands polygones sont lus découpés par tuile ; les longueurs de réseaux sont estimées. Ce PDF est une ébauche de carte d'identité foncière, pas un certificat d'urbanisme.",
    8,
    false,
    "0.4 0.42 0.46",
  );
  return pages;
}

function serialiser(pages: Page[]): Uint8Array {
  const n = pages.length;
  const fontRegular = 3;
  const fontBold = 4;
  const premierObjetPage = 5;
  const kids = pages.map((_, i) => `${premierObjetPage + i * 2} 0 R`).join(" ");
  const objets: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];

  pages.forEach((page, i) => {
    const pageId = premierObjetPage + i * 2;
    const contentId = pageId + 1;
    const contenu = [
      ...page.cmds,
      "BT",
      "/F1 8 Tf",
      "0.55 0.55 0.55 rg",
      `1 0 0 1 ${PAGE_W - MARGIN - 36} 28 Tm`,
      `${pdfText(`${i + 1} / ${n}`)} Tj`,
      "ET",
    ].join("\n");
    objets.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> >>`,
    );
    objets.push(`<< /Length ${contenu.length} >>\nstream\n${contenu}\nendstream`);
    void pageId;
  });

  let corps = "%PDF-1.4\n";
  const encoder = new TextEncoder();
  const offsets: number[] = [];
  objets.forEach((body, i) => {
    offsets.push(encoder.encode(corps).length);
    corps += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = encoder.encode(corps).length;
  corps += `xref\n0 ${objets.length + 1}\n`;
  corps += "0000000000 65535 f \n";
  for (const offset of offsets) corps += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  corps += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return encoder.encode(corps);
}

export function telechargerCifPdf(parcelles: ParcelleSel[], rapport: RapportCroisement) {
  const bytes = serialiser(construirePages(parcelles, rapport));
  const blob = new Blob([bytes], { type: "application/pdf" });
  const lien = document.createElement("a");
  const ref =
    parcelles.length === 1
      ? `${parcelles[0].codeInsee}_${parcelles[0].section}_${parcelles[0].numero}`
      : `UF_${parcelles.length}parcelles`;
  lien.href = URL.createObjectURL(blob);
  lien.download = `CIF_LaRochelle_${ref}.pdf`;
  lien.click();
  URL.revokeObjectURL(lien.href);
}
