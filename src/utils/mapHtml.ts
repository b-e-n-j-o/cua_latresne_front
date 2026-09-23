/** Folium `_repr_html_()` wraps the map in a Jupyter iframe — unwrap for a real page. */
export function unwrapFoliumHtml(html: string): string {
  const raw = (html || "").trim();
  if (!raw) return raw;

  if (raw.includes("Make this Notebook Trusted")) {
    const match = raw.match(/srcdoc="([^"]*)"/i);
    if (match?.[1]) {
      return match[1]
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
    }
  }

  if (/^<!DOCTYPE/i.test(raw) || /^<html/i.test(raw)) return raw;
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body style="margin:0">${raw}</body></html>`;
}

export function decodeMapsToken(token: string): Record<string, unknown> {
  const normalized = token.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + pad);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as Record<string, unknown>;
}

export function htmlToBlobUrl(html: string): string {
  const blob = new Blob([unwrapFoliumHtml(html)], { type: "text/html" });
  return URL.createObjectURL(blob);
}

/** En local, les liens stockés pointent vers kerelia.fr (prod). On les ramène sur l’origine courante. */
export function localizeMapsViewerUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "https://www.kerelia.fr");
    const host = parsed.hostname.replace(/^www\./, "");
    const isKerelia = host === "kerelia.fr";
    const isMapsPath = parsed.pathname === "/maps" || parsed.pathname.startsWith("/m/");
    if (isKerelia && isMapsPath && typeof window !== "undefined") {
      return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return url;
  }
  return url;
}
