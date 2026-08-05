import { useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw, ExternalLink, FileText, ChevronDown,
  AlertTriangle, Loader2, MapPin, Search, EyeOff, Trash2, Filter, X,
} from "lucide-react";
import { getRaaConfig, normaliseArreteNature, type ArreteNature, type RaaCommuneConfig } from "./raaConfig";

/* ------------------------------------------------------------------ *
 *  Veille réglementaire RAA — multi-commune (slug portail)
 *  GET  {API_BASE}/{slug}/raa?annee=YYYY
 *  GET  {API_BASE}/{slug}/raa/{id}
 *  POST {API_BASE}/{slug}/raa/sync
 *  POST {API_BASE}/{slug}/raa/{id}/marquer-vu
 *  POST {API_BASE}/{slug}/raa/{id}/masquer
 *  Si l'API est injoignable -> bascule en MODE DÉMO (données d'exemple).
 * ------------------------------------------------------------------ */

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");
/** Un seul GET liste toutes les 5 s tant qu'au moins un recueil est en_cours (batch inclus). */
const POLL_MS = 5000;
const POLL_MAX = 90;

type RaaFilter = "all" | "rouge" | "orange" | "nouveau";

type RaaItem = {
  id: number;
  titre: string;
  date_publication?: string;
  pdf_url: string;
  page_url: string;
  taille_mo?: number;
  statut: string;
  vu?: boolean;
  niveau_alerte?: string | null;
  nb_arretes_total?: number;
  nb_arretes_pertinents?: number;
  commune_mentionnee?: boolean;
  resume_global?: string;
  erreur?: string | null;
  arretes?: RaaArrete[];
};

type RaaArrete = {
  titre: string;
  reference?: string;
  pertinence?: string;
  nature?: ArreteNature | string;
  raison?: string;
  resume?: string;
  pages?: string;
};

function natureMeta(n?: string | null) {
  const key = normaliseArreteNature(n);
  switch (key) {
    case "URBANISME":
      return { key, label: "Urbanisme", className: "rv__nature--urba" };
    case "ENVIRONNEMENT":
      return { key, label: "Environnement", className: "rv__nature--env" };
    case "EVENEMENT":
      return { key, label: "Événement", className: "rv__nature--evt" };
    default:
      return { key: "AUTRE" as const, label: "Autre", className: "rv__nature--autre" };
  }
}

const PERTINENCE_ORDER: Record<string, number> = {
  DIRECTE: 0,
  INDIRECTE: 1,
  POSSIBLE: 2,
  NON_PERTINENT: 3,
};

function pertinenceMeta(p: string | undefined) {
  switch (p) {
    case "DIRECTE":
      return { dot: "#E74C3C", label: "Directe", hint: "Concerne explicitement la commune" };
    case "INDIRECTE":
      return { dot: "#F39C12", label: "Indirecte", hint: "Périmètre incluant la commune" };
    case "POSSIBLE":
      return { dot: "#9b59b6", label: "Possible", hint: "Périmètre large — à vérifier" };
    default:
      return { dot: "#b9bcc2", label: p || "Non pertinent", hint: "Hors périmètre ou administratif" };
  }
}

function sortArretes(arretes: RaaArrete[]) {
  return [...arretes].sort((a, b) => {
    const oa = PERTINENCE_ORDER[a.pertinence ?? ""] ?? 99;
    const ob = PERTINENCE_ORDER[b.pertinence ?? ""] ?? 99;
    return oa - ob;
  });
}

type NiveauMeta = { dot: string; label: string };

function buildNiveau(cfg: RaaCommuneConfig): Record<string, NiveauMeta> {
  return {
    ROUGE: { dot: "#E74C3C", label: cfg.niveauRougeLabel },
    ORANGE: { dot: "#F39C12", label: "À surveiller" },
    VERT: { dot: "#cfd4cd", label: "Rien de notable" },
  };
}

const fmtJour = (iso?: string) => {
  if (!iso) return "Date inconnue";
  const d = new Date(iso + "T00:00:00");
  const s = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function buildDemo(cfg: RaaCommuneConfig): RaaItem[] {
  const c = cfg.communeLabel;
  const short = cfg.communeShort;
  return [
    {
      id: 5, titre: "Recueil du 22 juin 2026", date_publication: "2026-06-22",
      pdf_url: "#", page_url: "#", taille_mo: 5.2, statut: "analyse", vu: false,
      niveau_alerte: "ROUGE", nb_arretes_total: 9, nb_arretes_pertinents: 1,
      commune_mentionnee: true,
      resume_global: `Recueil de 9 arrêtés. Un arrêté concerne directement ${c}.`,
      arretes: [
        { titre: `Travaux de défense contre la mer — ${c}`, pertinence: "DIRECTE", nature: "URBANISME", raison: `Mentionne explicitement ${c}.`, resume: "Autorisation de travaux d'enrochement et servitude de passage sur le domaine public maritime.", pages: "3-7" },
        { titre: "Nomination d'un secrétaire général adjoint", pertinence: "NON_PERTINENT", nature: "AUTRE", raison: "Acte RH sans lien avec l'urbanisme.", resume: "Nomination administrative préfectorale.", pages: "1-2" },
        { titre: "Arrêté ICPE — établissement industriel Perpignan", pertinence: "NON_PERTINENT", nature: "ENVIRONNEMENT", raison: "Localisation hors secteur communal.", resume: "Modification autorisation environnementale.", pages: "8-12" },
      ],
    },
    {
      id: 4, titre: "Recueil du 22 juin 2026 n°2", date_publication: "2026-06-22",
      pdf_url: "#", page_url: "#", taille_mo: 2.7, statut: "analyse",
      niveau_alerte: "ORANGE", nb_arretes_total: 4, nb_arretes_pertinents: 2,
      commune_mentionnee: false,
      resume_global: `4 arrêtés dont 2 concernent un périmètre incluant ${c}.`,
      arretes: [{ titre: "Arrêté préfectoral — périmètre élargi", pertinence: "INDIRECTE", nature: "ENVIRONNEMENT", raison: `Zone géographique incluant ${c}.`, resume: "Réglementation de l'emploi du feu sur le massif des Albères.", pages: "1-3" }],
    },
    {
      id: 3, titre: "Recueil du 19 juin 2026", date_publication: "2026-06-19",
      pdf_url: "#", page_url: "#", taille_mo: 4.2, statut: "analyse",
      niveau_alerte: "VERT", nb_arretes_total: 6, nb_arretes_pertinents: 0,
      commune_mentionnee: false,
      resume_global: `6 arrêtés, aucun ne concerne le territoire de ${c}.`,
      arretes: [],
    },
    {
      id: 2, titre: "Recueil du 18 Juin 2026", date_publication: "2026-06-18",
      pdf_url: "#", page_url: "#", taille_mo: 18.9, statut: "detecte",
      niveau_alerte: null, arretes: [],
    },
    {
      id: 1, titre: "Recueil du 17 juin 2026", date_publication: "2026-06-17",
      pdf_url: "#", page_url: "#", taille_mo: 16.8, statut: "erreur",
      erreur: "TimeoutError: Fichier Gemini bloqué en PROCESSING", arretes: [],
    },
  ].map((item) => ({
    ...item,
    arretes: item.arretes?.map((a) => ({
      ...a,
      titre: a.titre.replace(/\$\{short\}/g, short),
    })),
  }));
}

type VeilleRaaPageProps = {
  communeSlug: string;
};

export default function VeilleRaaPage({ communeSlug }: VeilleRaaPageProps) {
  const cfg = getRaaConfig(communeSlug);
  if (!cfg) {
    return (
      <div className="commune-portal-fallback">
        <p>La veille RAA n&apos;est pas disponible pour cette commune.</p>
      </div>
    );
  }

  return <VeilleRaaContent cfg={cfg} />;
}

function VeilleRaaContent({ cfg }: { cfg: RaaCommuneConfig }) {
  const niveau = useMemo(() => buildNiveau(cfg), [cfg]);
  const demoData = useMemo(() => buildDemo(cfg), [cfg]);
  const raaBase = `${API_BASE}/${cfg.slug}/raa`;

  const [annee] = useState(new Date().getFullYear());
  const [items, setItems] = useState<RaaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const [detailLoading, setDetailLoading] = useState<Set<number>>(() => new Set());
  const [masquerLoading, setMasquerLoading] = useState<Set<number>>(() => new Set());
  const [filter, setFilter] = useState<RaaFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [masquerBulkLoading, setMasquerBulkLoading] = useState(false);
  const listPoller = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTicks = useRef(0);

  const load = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const r = await fetch(`${raaBase}?annee=${annee}`);
      if (!r.ok) throw new Error("api");
      const data = await r.json();
      setItems(data.raa || []);
      setDemo(false);
    } catch {
      setItems(demoData);
      setDemo(true);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  const stopListPolling = () => {
    if (listPoller.current) {
      clearInterval(listPoller.current);
      listPoller.current = null;
    }
    pollTicks.current = 0;
  };

  const pollListOnce = async () => {
    pollTicks.current += 1;
    if (pollTicks.current > POLL_MAX) {
      stopListPolling();
      setItems((prev) =>
        prev.map((it) =>
          it.statut === "en_cours"
            ? {
                ...it,
                statut: "erreur",
                erreur: "L'analyse prend plus de temps que prévu. Réessayez dans un instant.",
              }
            : it,
        ),
      );
      return;
    }
    try {
      const r = await fetch(`${raaBase}?annee=${annee}`);
      if (!r.ok) return;
      const data = await r.json();
      const next: RaaItem[] = data.raa || [];
      setItems(next);
      if (!next.some((it) => it.statut === "en_cours")) {
        stopListPolling();
      }
    } catch {
      /* retenter au prochain tick */
    }
  };

  const startListPolling = () => {
    if (listPoller.current) return;
    pollTicks.current = 0;
    listPoller.current = setInterval(() => {
      void pollListOnce();
    }, POLL_MS);
  };

  const marquerVu = async (id: number) => {
    if (demo) {
      patch(id, { vu: true });
      return;
    }
    patch(id, { vu: true });
    try {
      await fetch(`${raaBase}/${id}/marquer-vu`, { method: "POST" });
    } catch {
      patch(id, { vu: false });
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [annee, raaBase]);
  useEffect(() => () => stopListPolling(), []);
  useEffect(() => {
    if (demo) return;
    if (items.some((it) => it.statut === "en_cours")) {
      startListPolling();
    } else {
      stopListPolling();
    }
  }, [items, demo]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (id: number, fields: Partial<RaaItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...fields } : it)));

  const fetchDetail = async (id: number) => {
    setDetailLoading((s) => new Set(s).add(id));
    try {
      const r = await fetch(`${raaBase}/${id}`);
      if (!r.ok) throw new Error("detail");
      const d = await r.json();
      patch(id, d);
    } catch {
      /* garde le résumé global si le détail échoue */
    } finally {
      setDetailLoading((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  };

  const toggleDetail = async (id: number) => {
    const willOpen = !open.has(id);
    setOpen((s) => {
      const n = new Set(s);
      if (willOpen) n.add(id);
      else n.delete(id);
      return n;
    });
    if (!willOpen || demo) return;
    const item = items.find((i) => i.id === id);
    if (
      item?.statut === "analyse"
      && !(item.arretes?.length)
      && (item.nb_arretes_total ?? 0) > 0
    ) {
      await fetchDetail(id);
    }
  };

  const demoAnalyse = (id: number) => {
    patch(id, { statut: "en_cours", erreur: null });
    setTimeout(() => {
      patch(id, {
        statut: "analyse", vu: false, niveau_alerte: "VERT", nb_arretes_total: 5,
        nb_arretes_pertinents: 0, commune_mentionnee: false,
        resume_global: `Analyse simulée (mode démo) — 5 arrêtés, aucun pertinent pour ${cfg.communeLabel}.`,
        arretes: [],
      });
    }, 2200);
  };

  const analyser = async (id: number) => {
    if (demo) return demoAnalyse(id);
    patch(id, { statut: "en_cours", erreur: null });
    try {
      await fetch(`${raaBase}/${id}/analyser`, { method: "POST" });
    } catch {
      patch(id, { statut: "erreur", erreur: "Impossible de joindre le serveur." });
      return;
    }
  };

  const remove = (id: number) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setOpen((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  };

  const masquer = async (id: number) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const ok = window.confirm(
      `Retirer « ${item.titre} » de la veille ?\n\n`
      + "Ce recueil sera masqué pour votre commune. Il ne sera pas réanalysé lors des prochaines synchronisations.",
    );
    if (!ok) return;

    if (demo) {
      remove(id);
      return;
    }

    setMasquerLoading((s) => new Set(s).add(id));
    try {
      const r = await fetch(`${raaBase}/${id}/masquer`, { method: "POST" });
      if (!r.ok) {
        const err = await r.json().catch(() => null);
        throw new Error(err?.detail || `Erreur ${r.status}`);
      }
      remove(id);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Impossible de masquer ce recueil.");
    } finally {
      setMasquerLoading((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  };

  const lancerVeille = async () => {
    if (syncing) return;
    setSyncMsg(null);
    if (demo) {
      setSyncMsg("Mode démo — la synchronisation nécessite le backend.");
      return;
    }
    setSyncing(true);
    try {
      const r = await fetch(`${raaBase}/sync?annee=${annee}`, { method: "POST" });
      if (!r.ok) {
        const err = await r.json().catch(() => null);
        throw new Error(err?.detail || `Erreur ${r.status}`);
      }
      const data = await r.json();
      setSyncMsg(data.message || "Synchronisation lancée.");
      await load({ silent: true });
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Échec de la synchronisation.");
    } finally {
      setSyncing(false);
    }
  };

  const isNouveau = (it: RaaItem) => it.statut === "analyse" && it.vu === false;
  const isConcerne = (it: RaaItem) => it.statut === "analyse" && it.niveau_alerte === "ROUGE";
  const isASurveiller = (it: RaaItem) => it.statut === "analyse" && it.niveau_alerte === "ORANGE";
  const isHorsPerimetre = (it: RaaItem) =>
    it.statut === "analyse" && it.niveau_alerte !== "ROUGE" && it.niveau_alerte !== "ORANGE";

  const toggleFilter = (next: RaaFilter) => {
    setFilter((prev) => (prev === next ? "all" : next));
  };

  const filteredItems = useMemo(() => {
    switch (filter) {
      case "rouge":
        return items.filter(isConcerne);
      case "orange":
        return items.filter(isASurveiller);
      case "nouveau":
        return items.filter(isNouveau);
      default:
        return items;
    }
  }, [items, filter]);

  const groups = useMemo(() => {
    const by: Record<string, RaaItem[]> = {};
    for (const it of filteredItems) (by[it.date_publication || ""] ||= []).push(it);
    return Object.entries(by)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([d, list]) => [
        d,
        [...list].sort((a, b) => {
          const na = isNouveau(a) ? 0 : 1;
          const nb = isNouveau(b) ? 0 : 1;
          return na - nb;
        }),
      ] as [string, RaaItem[]]);
  }, [filteredItems]);

  const stats = useMemo(() => {
    const a = items.filter((i) => i.statut === "analyse");
    return {
      total: items.length,
      analyses: a.length,
      nonLus: a.filter((i) => i.vu === false).length,
      rouge: a.filter((i) => i.niveau_alerte === "ROUGE").length,
      orange: a.filter((i) => i.niveau_alerte === "ORANGE").length,
      horsPerimetre: items.filter(isHorsPerimetre).length,
      bloques: items.filter((i) => i.statut === "en_cours" || i.statut === "erreur").length,
    };
  }, [items]);

  const reinitialiserBloques = async () => {
    if (resetting) return;
    setSyncMsg(null);
    if (demo) {
      setSyncMsg("Mode démo — action indisponible sans backend.");
      return;
    }
    if (stats.bloques === 0) {
      setSyncMsg("Aucun recueil bloqué à réinitialiser.");
      return;
    }
    const ok = window.confirm(
      `${stats.bloques} recueil(s) bloqué(s) en analyse ou en erreur vont être relancés.\n\n`
      + "Les recueils déjà analysés avec succès ne seront pas modifiés.",
    );
    if (!ok) return;

    setResetting(true);
    try {
      const r = await fetch(`${raaBase}/reinitialiser-bloques?relancer=true`, { method: "POST" });
      if (!r.ok) {
        const err = await r.json().catch(() => null);
        throw new Error(err?.detail || `Erreur ${r.status}`);
      }
      const data = await r.json();
      setSyncMsg(data.message || "Réinitialisation effectuée.");
      await load({ silent: true });
      if ((data.analyses_lancees ?? []).length === 0 && (data.nb_reinitialises ?? 0) > 0) {
        const r2 = await fetch(`${raaBase}/analyser-en-attente`, { method: "POST" });
        if (r2.ok) {
          const d2 = await r2.json();
          setSyncMsg(d2.message || data.message);
          await load({ silent: true });
        }
      }
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Échec de la réinitialisation.");
    } finally {
      setResetting(false);
    }
  };

  const masquerHorsPerimetre = async () => {
    const toHide = items.filter(isHorsPerimetre);
    if (toHide.length === 0) {
      setSyncMsg(`Aucun recueil sans lien avec ${cfg.communeShort} à retirer.`);
      return;
    }
    const ok = window.confirm(
      `Retirer ${toHide.length} recueil(s) sans lien direct avec ${cfg.communeShort} ?\n\n`
      + "Seuls les recueils « Rien de notable » seront masqués. "
      + "Les recueils concernant la commune ou à surveiller seront conservés.\n\n"
      + "Les recueils masqués restent en base (pas de réanalyse ultérieure).",
    );
    if (!ok) return;

    if (demo) {
      toHide.forEach((it) => remove(it.id));
      setSyncMsg(`${toHide.length} recueil(s) retiré(s) (mode démo).`);
      return;
    }

    setMasquerBulkLoading(true);
    setSyncMsg(null);
    let okCount = 0;
    try {
      for (const it of toHide) {
        const r = await fetch(`${raaBase}/${it.id}/masquer`, { method: "POST" });
        if (r.ok) {
          remove(it.id);
          okCount += 1;
        }
      }
      setSyncMsg(
        okCount === toHide.length
          ? `${okCount} recueil(s) hors périmètre retiré(s) de la veille.`
          : `${okCount}/${toHide.length} recueil(s) retiré(s).`,
      );
    } catch {
      setSyncMsg("Échec partiel du nettoyage — réessayez.");
    } finally {
      setMasquerBulkLoading(false);
    }
  };

  const filterLabel = useMemo(() => {
    switch (filter) {
      case "rouge":
        return `Concerne ${cfg.communeShort}`;
      case "orange":
        return "À surveiller";
      case "nouveau":
        return "Non lus";
      default:
        return null;
    }
  }, [filter, cfg.communeShort]);

  return (
    <div className="rv">
      <style>{CSS}</style>

      <header className="rv__head">
        <div>
          <div className="rv__eyebrow">{cfg.departementLabel} · {cfg.communeLabel}</div>
          <h1 className="rv__title">Veille réglementaire sur les Recueils des Actes Administratifs {cfg.departementLabelTitle}</h1>
          <p className="rv__sub">
            Recueils des actes administratifs de la préfecture, synchronisés et analysés chaque matin.
            Les recueils non encore consultés sont signalés comme nouveaux.
          </p>
          {syncMsg && <p className="rv__syncmsg">{syncMsg}</p>}
        </div>
        <div className="rv__head-actions">
          {stats.bloques > 0 && (
            <button
              type="button"
              className="rv__refresh rv__refresh--warn"
              onClick={reinitialiserBloques}
              disabled={resetting || loading}
              title="Débloquer les analyses coincées ou en erreur et les relancer"
            >
              {resetting ? <Loader2 size={15} className="rv__spin" /> : <AlertTriangle size={15} />}
              {resetting ? "Relance…" : `Relancer ${stats.bloques} bloqué(s)`}
            </button>
          )}
          <button
            type="button"
            className="rv__refresh"
            onClick={lancerVeille}
            disabled={syncing || loading}
            title="Scraper la préfecture, détecter les nouveaux recueils et lancer leur analyse"
          >
            {syncing ? <Loader2 size={15} className="rv__spin" /> : <RefreshCw size={15} />}
            {syncing ? "Veille en cours…" : "Lancer la veille"}
          </button>
        </div>
      </header>

      <div className="rv__overview">
        <span><b>{stats.total}</b> recueils au total</span>
        <span className="rv__dot" />
        <span><b>{stats.analyses}</b> analysés</span>
        {demo && <span className="rv__demo">mode démo — backend non connecté</span>}
      </div>

      <section
        className={`rv__filters${filtersOpen ? "" : " rv__filters--collapsed"}`}
        aria-label="Filtres des recueils"
      >
        <div className="rv__filters-head">
          <button
            type="button"
            className="rv__filters-toggle"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
          >
            <Filter size={16} className="rv__filters-icon" aria-hidden />
            <div className="rv__filters-toggle-text">
              <span className="rv__filters-title">Filtrer les recueils</span>
              {filtersOpen ? (
                <span className="rv__filters-hint">
                  Cliquez sur une catégorie pour n&apos;afficher que les recueils qui vous intéressent.
                </span>
              ) : filter !== "all" ? (
                <span className="rv__filters-summary">
                  Filtre actif : <strong>{filterLabel}</strong>
                  {" "}({filteredItems.length} affiché{filteredItems.length > 1 ? "s" : ""})
                </span>
              ) : (
                <span className="rv__filters-summary">Afficher par catégorie — cliquer pour déplier</span>
              )}
            </div>
            <ChevronDown size={18} className={`rv__filters-chev${filtersOpen ? " rv__filters-chev--open" : ""}`} />
          </button>
          {filter !== "all" && (
            <button
              type="button"
              className="rv__filters-reset"
              onClick={() => setFilter("all")}
            >
              <X size={14} />
              Tout afficher
            </button>
          )}
        </div>

        {filtersOpen && (
          <div className="rv__filters-body">
            <div className="rv__filterchips" role="group" aria-label="Catégories de recueils">
          <button
            type="button"
            className={`rv__chipbtn rv__chipbtn--all${filter === "all" ? " rv__chipbtn--active" : ""}`}
            onClick={() => setFilter("all")}
            aria-pressed={filter === "all"}
          >
            <div className="rv__chiprow">
              <span className="rv__chiplabel">Tous les recueils</span>
              <span className="rv__chipcount">{stats.total}</span>
            </div>
          </button>

          {stats.nonLus > 0 && (
            <button
              type="button"
              className={`rv__chipbtn rv__chipbtn--new${filter === "nouveau" ? " rv__chipbtn--active" : ""}`}
              onClick={() => toggleFilter("nouveau")}
              aria-pressed={filter === "nouveau"}
            >
              <div className="rv__chiprow">
                <span className="rv__chiplabel">Non lus</span>
                <span className="rv__chipcount">{stats.nonLus}</span>
              </div>
              <span className="rv__chipdesc">Pas encore consultés</span>
            </button>
          )}

          {stats.rouge > 0 && (
            <button
              type="button"
              className={`rv__chipbtn rv__chipbtn--r${filter === "rouge" ? " rv__chipbtn--active" : ""}`}
              onClick={() => toggleFilter("rouge")}
              aria-pressed={filter === "rouge"}
            >
              <div className="rv__chiprow">
                <span className="rv__chiplabel">
                  <i className="rv__chipdot" style={{ background: niveau.ROUGE.dot }} />
                  Concerne {cfg.communeShort}
                </span>
                <span className="rv__chipcount">{stats.rouge}</span>
              </div>
              <span className="rv__chipdesc">Impact direct sur la commune</span>
            </button>
          )}

          {stats.orange > 0 && (
            <button
              type="button"
              className={`rv__chipbtn rv__chipbtn--o${filter === "orange" ? " rv__chipbtn--active" : ""}`}
              onClick={() => toggleFilter("orange")}
              aria-pressed={filter === "orange"}
            >
              <div className="rv__chiprow">
                <span className="rv__chiplabel">
                  <i className="rv__chipdot" style={{ background: niveau.ORANGE.dot }} />
                  À surveiller
                </span>
                <span className="rv__chipcount">{stats.orange}</span>
              </div>
              <span className="rv__chipdesc">Périmètre élargi ou indirect</span>
            </button>
          )}
            </div>

            {filter !== "all" && (
              <p className="rv__filteractive">
                Filtre actif : <strong>{filterLabel}</strong>
                {" "}— {filteredItems.length} recueil{filteredItems.length > 1 ? "s" : ""} affiché{filteredItems.length > 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}
      </section>

      <div className="rv__toolbar">
        {stats.horsPerimetre > 0 && (
          <button
            type="button"
            className="rv__bulkhide"
            onClick={masquerHorsPerimetre}
            disabled={masquerBulkLoading || loading}
            title={`Masquer les recueils sans lien avec ${cfg.communeShort} ni à surveiller`}
          >
            {masquerBulkLoading ? <Loader2 size={14} className="rv__spin" /> : <Trash2 size={14} />}
            Retirer les recueils sans lien avec {cfg.communeShort} ({stats.horsPerimetre})
          </button>
        )}
      </div>

      {loading ? (
        <div className="rv__skel">{[0, 1, 2].map((i) => <div key={i} className="rv__skelcard" />)}</div>
      ) : groups.length === 0 ? (
        <div className="rv__empty">
          <Search size={20} />
          <p>
            {filter !== "all"
              ? `Aucun recueil ne correspond au filtre « ${filterLabel} ».`
              : `Aucun recueil pour ${annee}. Le pipeline alimentera cette page dès la prochaine publication.`}
          </p>
          {filter !== "all" && (
            <button type="button" className="rv__btn" onClick={() => setFilter("all")}>
              Afficher tous les recueils
            </button>
          )}
        </div>
      ) : (
        groups.map(([d, list]) => (
          <section key={d || "nd"} className="rv__day">
            <h2 className="rv__daylabel">{fmtJour(d)}</h2>
            {list.map((it) => (
              <Card
                key={it.id}
                it={it}
                cfg={cfg}
                niveau={niveau}
                expanded={open.has(it.id)}
                detailLoading={detailLoading.has(it.id)}
                onToggle={() => toggleDetail(it.id)}
                onAnalyser={() => analyser(it.id)}
                onMarquerVu={() => marquerVu(it.id)}
                onMasquer={() => masquer(it.id)}
                masquerLoading={masquerLoading.has(it.id)}
              />
            ))}
          </section>
        ))
      )}
    </div>
  );
}

type CardProps = {
  it: RaaItem;
  cfg: RaaCommuneConfig;
  niveau: Record<string, NiveauMeta>;
  expanded: boolean;
  detailLoading: boolean;
  onToggle: () => void;
  onAnalyser: () => void;
  onMarquerVu: () => void;
  onMasquer: () => void;
  masquerLoading: boolean;
};

function Card({
  it, cfg, niveau, expanded, detailLoading, onToggle, onAnalyser, onMarquerVu, onMasquer, masquerLoading,
}: CardProps) {
  const niveauItem = it.niveau_alerte ? niveau[it.niveau_alerte] : null;
  const enCours = it.statut === "en_cours";
  const erreur = it.statut === "erreur";
  const analyse = it.statut === "analyse";
  const detecte = it.statut === "detecte";
  const nouveau = analyse && it.vu === false;
  const arretes = sortArretes(it.arretes ?? []);
  const nbTotal = it.nb_arretes_total ?? arretes.length;
  const showDetailToggle = analyse && nbTotal > 0;

  const cls = ["rv__card"];
  if (nouveau) cls.push("rv__card--new");
  if (it.niveau_alerte === "ROUGE") cls.push("rv__card--r");
  if (it.niveau_alerte === "ORANGE") cls.push("rv__card--o");
  if (detecte || enCours) cls.push("rv__card--muted");

  return (
    <article className={cls.join(" ")}>
      <span className="rv__bar" style={{ background: niveauItem?.dot || "transparent" }} />

      <div className="rv__cardmain">
        <div className="rv__cardtop">
          <div>
            <h3 className="rv__cardtitle">{it.titre}</h3>
            <div className="rv__meta">
              {nouveau && (
                <span className="rv__chip rv__chip--new">Nouveau</span>
              )}
              {analyse && niveauItem && (
                <span className="rv__niveau" style={{ color: niveauItem.dot }}>
                  <i style={{ background: niveauItem.dot }} /> {niveauItem.label}
                </span>
              )}
              {it.commune_mentionnee && (
                <span className="rv__chip rv__chip--commune"><MapPin size={11} /> {cfg.communeShort} citée</span>
              )}
              {analyse && (it.nb_arretes_pertinents ?? 0) > 0 && (
                <span className="rv__chip">{it.nb_arretes_pertinents} arrêté(s) à voir</span>
              )}
              {analyse && (
                <span className="rv__chip rv__chip--soft">{it.nb_arretes_total} arrêtés</span>
              )}
              {it.taille_mo != null && <span className="rv__size">{it.taille_mo.toFixed(1)} Mo</span>}
            </div>
          </div>
          {nouveau && (
            <button
              type="button"
              className="rv__vu"
              onClick={onMarquerVu}
              title="Marquer comme lu"
            >
              Marquer comme lu
            </button>
          )}
        </div>

        {analyse && it.resume_global && <p className="rv__resume">{it.resume_global}</p>}

        {showDetailToggle && (
          <div className="rv__detail">
            <button type="button" className="rv__detail-toggle" onClick={onToggle} aria-expanded={expanded}>
              <ChevronDown size={15} className={expanded ? "rv__chevopen" : ""} />
              <span>
                {expanded ? "Masquer le détail" : "En détail"}
                {" · "}
                {nbTotal} arrêté{nbTotal > 1 ? "s" : ""} analysé{nbTotal > 1 ? "s" : ""}
                {(it.nb_arretes_pertinents ?? 0) > 0 && (
                  <em className="rv__detail-hint">
                    {" "}({it.nb_arretes_pertinents} à examiner pour {cfg.communeShort})
                  </em>
                )}
              </span>
            </button>

            {expanded && (
              <div className="rv__detail-body">
                {detailLoading ? (
                  <p className="rv__statusline rv__statusline--wait">
                    <Loader2 size={14} className="rv__spin" /> Chargement du détail…
                  </p>
                ) : arretes.length === 0 ? (
                  <p className="rv__statusline">Aucun arrêté détaillé disponible pour ce recueil.</p>
                ) : (
                  <ul className="rv__arretes">
                    {arretes.map((a, i) => {
                      const pm = pertinenceMeta(a.pertinence);
                      const nm = natureMeta(a.nature);
                      const pertinent = a.pertinence && a.pertinence !== "NON_PERTINENT";
                      return (
                        <li
                          key={i}
                          className={`rv__arrete${pertinent ? " rv__arrete--pertinent" : ""}`}
                        >
                          <span className="rv__arretedot" style={{ background: pm.dot }} />
                          <div>
                            <div className="rv__arretehead">
                              <span className="rv__arretetitre">{a.titre}</span>
                              {a.pages && <span className="rv__arretepages">p. {a.pages}</span>}
                            </div>
                            <div className="rv__arretetags">
                              <span
                                className="rv__arretetag"
                                style={{ color: pm.dot }}
                                title={pm.hint}
                              >
                                <span className="rv__tagprefix">Concernant {cfg.communeShort} :</span>
                                {" "}{pm.label}
                              </span>
                              <span className={`rv__nature ${nm.className}`}>
                                <span className="rv__tagprefix">Catégorie :</span>
                                {" "}{nm.label}
                              </span>
                            </div>
                            {a.reference && (
                              <div className="rv__arreteref">Réf. {a.reference}</div>
                            )}
                            {a.raison && <div className="rv__arreteraison">{a.raison}</div>}
                            {a.resume && <div className="rv__arreteresume">{a.resume}</div>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {enCours && (
          <p className="rv__statusline rv__statusline--wait">
            <Loader2 size={14} className="rv__spin" /> Analyse en cours… (jusqu&apos;à ~1 min pour les gros recueils)
          </p>
        )}
        {detecte && <p className="rv__statusline">Pas encore analysé.</p>}
        {erreur && (
          <p className="rv__statusline rv__statusline--err">
            <AlertTriangle size={14} /> {it.erreur || "L'analyse a échoué."} Vous pouvez relancer.
          </p>
        )}

        <div className="rv__actions">
          <a className="rv__link rv__link--pdf" href={it.pdf_url} target="_blank" rel="noreferrer">
            <FileText size={13} /> PDF du recueil
          </a>
          <a className="rv__link" href={it.page_url} target="_blank" rel="noreferrer">
            <ExternalLink size={13} /> Page préfecture
          </a>

          <span className="rv__spacer" />

          <button
            type="button"
            className="rv__btn rv__btn--ghost"
            onClick={onMasquer}
            disabled={enCours || masquerLoading}
            title="Retirer ce recueil de la veille (hors périmètre communal)"
          >
            {masquerLoading ? <Loader2 size={14} className="rv__spin" /> : <EyeOff size={14} />}
            Retirer
          </button>

          <button className="rv__btn" onClick={onAnalyser} disabled={enCours}>
            {enCours ? <Loader2 size={14} className="rv__spin" /> : <RefreshCw size={14} />}
            {detecte ? "Analyser" : enCours ? "En cours" : "Relancer l'analyse"}
          </button>
        </div>
      </div>
    </article>
  );
}

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap");
.rv{
  --accent:#85e372; --accent-hover:#289f01; --accent-soft:rgba(133,227,114,.14);
  --text:#111; --muted:#4b4b4b; --faint:#8a8d92; --border:#e8e8e8; --surface:#fafafa;
  --font:"Kerelia Sans","Inter",-apple-system,system-ui,sans-serif;
  font-family:var(--font); color:var(--text); background:#fff;
  flex:1; min-height:0; height:100%; overflow-y:auto; -webkit-overflow-scrolling:touch;
  max-width:860px; width:100%; margin:0 auto; padding:2rem 1.25rem 4rem;
}
.rv *{box-sizing:border-box;}
.rv__head{display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1.25rem;}
.rv__head-actions{display:flex; flex-direction:column; align-items:stretch; gap:.5rem; flex-shrink:0;}
.rv__eyebrow{font-size:.72rem; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--faint);}
.rv__title{font-size:1.7rem; font-weight:600; margin:.25rem 0 .4rem; letter-spacing:-.01em;}
.rv__sub{font-size:.9rem; color:var(--muted); line-height:1.5; max-width:46rem; margin:0;}
.rv__syncmsg{font-size:.82rem; color:var(--muted); margin:.5rem 0 0; line-height:1.4;}
.rv__refresh{flex-shrink:0; display:inline-flex; align-items:center; gap:.4rem; padding:.5rem .8rem;
  border:1px solid var(--border); border-radius:.6rem; background:#fff; font:inherit; font-size:.82rem;
  font-weight:500; color:var(--text); cursor:pointer; transition:border-color .15s, background .15s;}
.rv__refresh:hover:not(:disabled){border-color:var(--accent); background:var(--accent-soft);}
.rv__refresh--warn{border-color:#f0d9a8; background:#fffaf0; color:#9a6700;}
.rv__refresh--warn:hover:not(:disabled){border-color:#e0b050; background:#fff4db;}
.rv__refresh:disabled{opacity:.6; cursor:default;}

.rv__stat--new{color:#1a6fa8; font-weight:600;}

.rv__overview{display:flex; align-items:center; flex-wrap:wrap; gap:.55rem; font-size:.82rem;
  color:var(--muted); padding:.55rem .15rem; margin-bottom:.65rem;}
.rv__overview b{color:var(--text); font-weight:600;}

.rv__filters{padding:.75rem 1.05rem; background:var(--surface); border:1px solid var(--border);
  border-radius:.85rem; margin-bottom:1rem;}
.rv__filters--collapsed{padding:.65rem 1.05rem;}
.rv__filters-head{display:flex; align-items:center; justify-content:space-between; gap:.75rem;}
.rv__filters-toggle{flex:1; display:flex; align-items:flex-start; gap:.65rem; min-width:0;
  padding:0; border:none; background:transparent; font:inherit; text-align:left; cursor:pointer;
  color:inherit;}
.rv__filters-toggle:hover .rv__filters-title{color:#1a6fa8;}
.rv__filters-toggle-text{flex:1; min-width:0;}
.rv__filters-icon{flex-shrink:0; margin-top:.15rem; color:var(--faint);}
.rv__filters-title{display:block; font-size:.92rem; font-weight:600; margin:0 0 .15rem; color:var(--text);
  transition:color .15s;}
.rv__filters-hint,.rv__filters-summary{display:block; font-size:.8rem; color:var(--muted); margin:0; line-height:1.45;}
.rv__filters-summary strong{font-weight:700; color:#1a5f8a;}
.rv__filters-chev{flex-shrink:0; margin-top:.1rem; color:var(--faint); transition:transform .2s;}
.rv__filters-chev--open{transform:rotate(180deg);}
.rv__filters-body{margin-top:.85rem; padding-top:.85rem; border-top:1px solid var(--border);}
.rv__filters-reset{flex-shrink:0; display:inline-flex; align-items:center; gap:.35rem;
  padding:.4rem .7rem; border:1px solid var(--border); border-radius:.55rem; background:#fff;
  font:inherit; font-size:.76rem; font-weight:600; color:var(--muted); cursor:pointer;
  transition:border-color .15s, color .15s, background .15s;}
.rv__filters-reset:hover{border-color:#b8d4f0; color:#1a6fa8; background:#f4f9fd;}

.rv__filterchips{display:flex; flex-wrap:wrap; gap:.55rem;}
.rv__chipbtn{display:flex; flex-direction:column; align-items:stretch; gap:.2rem;
  min-width:10.5rem; flex:1 1 10.5rem; max-width:15rem; padding:.7rem .85rem;
  border:1.5px solid var(--border); border-radius:.7rem; background:#fff; font:inherit;
  text-align:left; cursor:pointer; transition:border-color .15s, background .15s, box-shadow .15s;}
.rv__chipbtn:hover{border-color:#c8cdd4; box-shadow:0 2px 8px rgba(0,0,0,.06);}
.rv__chipbtn--active{box-shadow:0 0 0 2px rgba(26,111,168,.12);}
.rv__chipbtn--all{max-width:none; flex:1 1 100%;}
.rv__chipbtn--all.rv__chipbtn--active{border-color:#9bb8d4; background:#f4f9fd;}
.rv__chipbtn--new.rv__chipbtn--active{border-color:#8ec0e8; background:#eef6fc;}
.rv__chipbtn--r.rv__chipbtn--active{border-color:#e8a8a0; background:#fff5f4;}
.rv__chipbtn--o.rv__chipbtn--active{border-color:#e8c878; background:#fffaf0;}
.rv__chiprow{display:flex; align-items:center; justify-content:space-between; gap:.5rem;}
.rv__chiplabel{display:inline-flex; align-items:center; gap:.4rem; font-size:.84rem; font-weight:700; color:var(--text); line-height:1.25;}
.rv__chipdesc{font-size:.72rem; color:var(--faint); line-height:1.35;}
.rv__chipdot{display:inline-block; width:8px; height:8px; border-radius:50%; flex-shrink:0;}
.rv__chipcount{flex-shrink:0; min-width:1.55rem; padding:.12rem .45rem; border-radius:999px;
  background:#f0f1f3; font-size:.72rem; font-weight:700; color:var(--text); text-align:center;}
.rv__chipbtn--new .rv__chipcount{background:#dbeefa; color:#1a6fa8;}
.rv__chipbtn--r .rv__chipcount{background:#fde8e6; color:#c0392b;}
.rv__chipbtn--o .rv__chipcount{background:#fef3d6; color:#9a6700;}
.rv__filteractive{margin:.8rem 0 0; padding:.55rem .7rem; border-radius:.55rem;
  background:#eef6fc; border:1px solid #cfe3f4; font-size:.8rem; color:#1a5f8a;}
.rv__filteractive strong{font-weight:700;}

.rv__toolbar{display:flex; align-items:center; flex-wrap:wrap; gap:.6rem; margin-bottom:1.25rem;}
.rv__bulkhide{display:inline-flex; align-items:center; gap:.4rem; padding:.45rem .75rem;
  border:1px solid #e8d4d4; border-radius:.6rem; background:#fff8f8; font:inherit; font-size:.78rem;
  font-weight:600; color:#a94442; cursor:pointer; transition:border-color .15s, background .15s;}
.rv__bulkhide:hover:not(:disabled){border-color:#d4a5a5; background:#fff0f0;}
.rv__bulkhide:disabled{opacity:.6; cursor:default;}
.rv__dot{width:3px; height:3px; border-radius:50%; background:#c8cbd0;}
.rv__demo{margin-left:auto; font-size:.72rem; color:#b07a00; background:#fff6e0;
  padding:.2rem .55rem; border-radius:.5rem; font-weight:500;}

.rv__day{margin-bottom:1.6rem;}
.rv__daylabel{font-size:.8rem; font-weight:600; color:var(--faint); text-transform:uppercase;
  letter-spacing:.03em; margin:0 0 .6rem; padding-bottom:.35rem; border-bottom:1px solid var(--border);}

.rv__card{position:relative; display:flex; gap:0; background:#fff; border:1px solid var(--border);
  border-radius:.85rem; margin-bottom:1.15rem; overflow:hidden;
  transition:box-shadow .15s, border-color .15s; box-shadow:0 1px 3px rgba(0,0,0,.04);}
.rv__card:hover{box-shadow:0 2px 10px rgba(0,0,0,.07);}
.rv__card--muted{background:var(--surface);}
.rv__card--new{background:#eef6fc; border-color:#b8d4f0; box-shadow:0 0 0 1px rgba(26,111,168,.1);}
.rv__card--r{border-color:#f3c6c0;}
.rv__card--o{border-color:#f6e0b8;}
.rv__card--new.rv__card--r{background:#fff8f7;}
.rv__card--new.rv__card--o{background:#fffbf5;}
.rv__bar{flex-shrink:0; width:4px;}
.rv__cardmain{flex:1; min-width:0; padding:.95rem 1.05rem;}
.rv__cardtop{display:flex; justify-content:space-between; gap:1rem;}
.rv__cardtitle{font-size:1rem; font-weight:600; margin:0 0 .4rem; line-height:1.3;}

.rv__meta{display:flex; align-items:center; flex-wrap:wrap; gap:.45rem; font-size:.76rem;}
.rv__niveau{display:inline-flex; align-items:center; gap:.35rem; font-weight:600;}
.rv__niveau i{width:8px; height:8px; border-radius:50%;}
.rv__chip{display:inline-flex; align-items:center; gap:.25rem; padding:.12rem .5rem; border-radius:.45rem;
  background:#f0f1f3; color:var(--muted); font-weight:500;}
.rv__chip--soft{background:transparent; color:var(--faint); padding-left:0; padding-right:0;}
.rv__chip--commune{background:var(--accent-soft); color:#1f7a08; font-weight:600;}
.rv__chip--new{background:#e8f4fd; color:#1a6fa8; font-weight:700; letter-spacing:.02em;}
.rv__size{color:var(--faint); margin-left:.1rem;}

.rv__vu{flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;
  padding:.35rem .7rem; border:1px solid #b8d4f0; border-radius:.45rem;
  background:#e8f4fd; color:#1a6fa8; font:inherit; font-size:.76rem; font-weight:700;
  cursor:pointer; transition:background .15s, border-color .15s; white-space:nowrap;}
.rv__vu:hover{background:#d4ebfa; border-color:#1a6fa8;}

.rv__resume{font-size:.88rem; line-height:1.55; color:var(--muted); margin:.6rem 0 .2rem;}

.rv__detail{margin:.75rem 0 .15rem;}
.rv__detail-toggle{display:flex; align-items:center; gap:.4rem; width:100%; padding:.55rem .7rem;
  border:1px solid var(--border); border-radius:.6rem; background:var(--surface);
  font:inherit; font-size:.82rem; font-weight:600; color:var(--text); cursor:pointer; text-align:left;
  transition:border-color .15s, background .15s;}
.rv__detail-toggle:hover{border-color:var(--accent); background:var(--accent-soft);}
.rv__detail-hint{font-style:normal; font-weight:500; color:var(--muted);}
.rv__detail-body{margin-top:.75rem; padding-top:.75rem; border-top:1px dashed var(--border);}

.rv__statusline{display:flex; align-items:center; gap:.4rem; font-size:.82rem; color:var(--faint); margin:.6rem 0 .2rem;}
.rv__statusline--wait{color:var(--muted);}
.rv__statusline--err{color:#c0392b;}

.rv__actions{display:flex; align-items:center; flex-wrap:wrap; gap:.6rem; margin-top:.8rem;}
.rv__link{display:inline-flex; align-items:center; gap:.3rem; font-size:.8rem; color:var(--muted);
  text-decoration:none; font-weight:500; transition:color .15s, background .15s, border-color .15s;}
.rv__link:hover{color:var(--accent-hover);}
.rv__link--pdf{padding:.48rem .85rem; border-radius:.6rem; font-weight:600; font-size:.82rem;
  color:#1a4d0f; background:rgba(133,227,114,.38); border:1px solid rgba(40,159,1,.25);}
.rv__link--pdf:hover{color:#123608; background:rgba(133,227,114,.55); border-color:rgba(40,159,1,.4);}
.rv__chevopen{transform:rotate(180deg);}
.rv__spacer{flex:1;}

.rv__btn{display:inline-flex; align-items:center; gap:.35rem; padding:.45rem .75rem; border-radius:.6rem;
  border:1px solid var(--border); background:#fff; font:inherit; font-size:.8rem; font-weight:600;
  color:var(--text); cursor:pointer; transition:border-color .15s, background .15s; white-space:nowrap;}
.rv__btn:hover:not(:disabled){border-color:var(--accent); background:var(--accent-soft);}
.rv__btn--ghost{color:var(--muted); font-weight:500;}
.rv__btn--ghost:hover:not(:disabled){border-color:#d8c4c4; background:#fdf6f6; color:#a94442;}
.rv__btn:disabled{opacity:.6; cursor:default;}

.rv__arretes{list-style:none; margin:0; padding:.25rem 0 0; display:flex; flex-direction:column; gap:1rem;}
.rv__arrete{display:flex; gap:.75rem; padding:.9rem 1rem; border:1px solid #dfe3e8;
  border-radius:.7rem; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,.04);}
.rv__arrete--pertinent{background:#f8faf9; border-color:#cfd8d2; box-shadow:0 1px 5px rgba(0,0,0,.06);}
.rv__arretedot{flex-shrink:0; width:9px; height:9px; border-radius:50%; margin-top:.45rem;}
.rv__arretehead{display:flex; align-items:baseline; flex-wrap:wrap; gap:.5rem; margin-bottom:.35rem;}
.rv__arretetitre{font-size:.88rem; font-weight:600; line-height:1.35;}
.rv__arretetags{display:flex; align-items:center; flex-wrap:wrap; gap:.45rem .65rem; margin-bottom:.25rem;}
.rv__arretetag{font-size:.74rem; font-weight:600; letter-spacing:.01em;}
.rv__tagprefix{font-weight:500; color:var(--muted);}
.rv__nature{display:inline-flex; align-items:center; gap:.2rem; padding:.15rem .5rem; border-radius:.4rem;
  font-size:.72rem; font-weight:600; letter-spacing:.01em;}
.rv__nature .rv__tagprefix{font-weight:500; text-transform:none;}
.rv__nature--urba{background:#e8f4fd; color:#1a6fa8;}
.rv__nature--env{background:#e6f6ec; color:#1a7a3a;}
.rv__nature--evt{background:#f3ebfa; color:#7d3c98;}
.rv__nature--autre{background:#f0f1f3; color:#6b7280;}
.rv__arretepages{font-size:.72rem; color:var(--faint);}
.rv__arreteref{font-size:.72rem; color:var(--faint); margin-top:.15rem;}
.rv__arreteraison{font-size:.8rem; color:var(--muted); margin-top:.2rem; font-style:italic;}
.rv__arreteresume{font-size:.82rem; color:var(--muted); line-height:1.5; margin-top:.2rem;}

.rv__skel{display:flex; flex-direction:column; gap:.7rem;}
.rv__skelcard{height:96px; border-radius:.85rem; background:linear-gradient(90deg,#f4f4f5,#fafafa,#f4f4f5);
  background-size:200% 100%; animation:rvsh 1.3s infinite;}
@keyframes rvsh{0%{background-position:200% 0}100%{background-position:-200% 0}}
.rv__empty{display:flex; flex-direction:column; align-items:center; gap:.6rem; text-align:center;
  color:var(--faint); padding:3rem 1rem; border:1px dashed var(--border); border-radius:.85rem;}
.rv__empty p{margin:0; font-size:.9rem; max-width:30rem;}

.rv__spin{animation:rvspin .9s linear infinite;}
@keyframes rvspin{to{transform:rotate(360deg)}}

@media (max-width:560px){
  .rv{padding:1.25rem .9rem 3rem;}
  .rv__head{flex-direction:column;}
  .rv__head-actions{width:100%;}
  .rv__title{font-size:1.4rem;}
  .rv__filters-head{flex-wrap:wrap;}
  .rv__filters-reset{width:100%; justify-content:center;}
  .rv__chipbtn{min-width:calc(50% - .3rem); flex:1 1 calc(50% - .3rem); max-width:none;}
  .rv__chipbtn--all{flex-basis:100%;}
}
@media (prefers-reduced-motion:reduce){
  .rv__spin,.rv__skelcard{animation:none;}
}
.rv a:focus-visible,.rv button:focus-visible{outline:2px solid var(--accent-hover); outline-offset:2px; border-radius:.4rem;}
`;
