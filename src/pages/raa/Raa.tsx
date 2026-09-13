import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  RefreshCw, AlertTriangle, ArrowRight, ChevronDown, Loader2, Search,
} from "lucide-react";
import { getRaaConfig, type RaaCommuneConfig } from "./raaConfig";
import VeilleCadastre from "./VeilleCadastre";
import RaaDetailDrawer from "./RaaDetailDrawer";
import {
  buildNiveau,
  fmtJourCourt,
  fmtMois,
  importanceStatus,
  isNouveau,
  monthKey,
  type RaaItem,
} from "./raaShared";

/* ------------------------------------------------------------------ *
 *  Veille des arrêtés RAA — multi-commune (slug portail)
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
  const [searchParams, setSearchParams] = useSearchParams();
  const onglet = searchParams.get("onglet") === "cadastre" ? "cadastre" : "raa";

  if (!cfg) {
    return (
      <div className="commune-portal-fallback">
        <p>La veille RAA n&apos;est pas disponible pour cette commune.</p>
      </div>
    );
  }

  const setOnglet = (next: "raa" | "cadastre") => {
    if (next === "cadastre") setSearchParams({ onglet: "cadastre" });
    else setSearchParams({});
  };

  return (
    <div className={`rv${onglet === "cadastre" ? " rv--scroll" : ""}`}>
      <style>{CSS}</style>
      <nav className="rv__subnav" aria-label="Sous-onglets de la veille">
        <button
          type="button"
          className={`rv__subnavbtn${onglet === "raa" ? " rv__subnavbtn--active" : ""}`}
          onClick={() => setOnglet("raa")}
        >
          Arrêtés RAA
        </button>
        <button
          type="button"
          className={`rv__subnavbtn${onglet === "cadastre" ? " rv__subnavbtn--active" : ""}`}
          onClick={() => setOnglet("cadastre")}
        >
          Veille cadastre
        </button>
      </nav>
      {onglet === "cadastre" ? <VeilleCadastre cfg={cfg} /> : <VeilleRaaContent cfg={cfg} />}
    </div>
  );
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
  const [demo, setDemo] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState<Set<number>>(() => new Set());
  const [masquerLoading, setMasquerLoading] = useState<Set<number>>(() => new Set());
  const [openMonths, setOpenMonths] = useState<Set<string>>(() => new Set());
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

  const selectItem = (id: number) => {
    setSelectedId(id);
    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (
      !demo
      && item.statut === "analyse"
      && !(item.arretes?.length)
      && (item.nb_arretes_total ?? 0) > 0
    ) {
      void fetchDetail(id);
    }
  };

  const closeDetail = () => setSelectedId(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (selectedId != null && !items.some((it) => it.id === selectedId)) {
      setSelectedId(null);
    }
  }, [items, selectedId]);

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
    }
  };

  const remove = (id: number) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
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
    if (demo) {
      window.alert("Mode démo — la synchronisation nécessite le backend.");
      return;
    }
    setSyncing(true);
    try {
      const r = await fetch(`${raaBase}/sync?annee=${annee}`, { method: "POST" });
      if (!r.ok) {
        const err = await r.json().catch(() => null);
        throw new Error(err?.detail || `Erreur ${r.status}`);
      }
      await load({ silent: true });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Échec de la synchronisation.");
    } finally {
      setSyncing(false);
    }
  };

  const monthGroups = useMemo(() => {
    const byMonth: Record<string, Record<string, RaaItem[]>> = {};
    for (const it of items) {
      const day = it.date_publication || "";
      const month = monthKey(day);
      ((byMonth[month] ||= {})[day] ||= []).push(it);
    }
    return Object.entries(byMonth)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([month, days]) => ({
        key: month,
        label: fmtMois(month),
        count: Object.values(days).reduce((n, list) => n + list.length, 0),
        days: Object.entries(days)
          .sort((a, b) => (a[0] < b[0] ? 1 : -1))
          .map(([d, list]) => [
            d,
            [...list].sort((a, b) => (isNouveau(a) ? 0 : 1) - (isNouveau(b) ? 0 : 1)),
          ] as [string, RaaItem[]]),
      }));
  }, [items]);

  useEffect(() => {
    if (monthGroups.length === 0) return;
    setOpenMonths((prev) => (prev.size > 0 ? prev : new Set([monthGroups[0].key])));
  }, [monthGroups]);

  useEffect(() => {
    if (selectedId == null) return;
    const key = monthKey(items.find((it) => it.id === selectedId)?.date_publication);
    if (!key) return;
    setOpenMonths((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, [selectedId, items]);

  const toggleMonth = (key: string) => {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const nbBloques = useMemo(
    () => items.filter((i) => i.statut === "en_cours" || i.statut === "erreur").length,
    [items],
  );

  const reinitialiserBloques = async () => {
    if (resetting) return;
    if (demo) {
      window.alert("Mode démo — action indisponible sans backend.");
      return;
    }
    if (nbBloques === 0) return;
    const ok = window.confirm(
      `${nbBloques} recueil(s) bloqué(s) en analyse ou en erreur vont être relancés.\n\n`
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
      await load({ silent: true });
      if ((data.analyses_lancees ?? []).length === 0 && (data.nb_reinitialises ?? 0) > 0) {
        const r2 = await fetch(`${raaBase}/analyser-en-attente`, { method: "POST" });
        if (r2.ok) await load({ silent: true });
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Échec de la réinitialisation.");
    } finally {
      setResetting(false);
    }
  };

  const selected = selectedId == null ? null : items.find((it) => it.id === selectedId) ?? null;

  return (
    <div className="rv__page">
      <header className="rv__head">
        <div>
          <div className="rv__eyebrow">{cfg.departementLabel} · {cfg.communeLabel}</div>
          <h1 className="rv__title">Veille des arrêtés RAA</h1>
          {demo && <p className="rv__demo">mode démo — backend non connecté</p>}
        </div>
        <div className="rv__head-actions">
          {nbBloques > 0 && (
            <button
              type="button"
              className="rv__refresh rv__refresh--warn"
              onClick={reinitialiserBloques}
              disabled={resetting || loading}
              title="Débloquer les analyses coincées ou en erreur et les relancer"
            >
              {resetting ? <Loader2 size={15} className="rv__spin" /> : <AlertTriangle size={15} />}
              {resetting ? "Relance…" : `Relancer ${nbBloques} bloqué(s)`}
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

      <div className={`rv__workspace${selected ? " rv__workspace--open" : ""}`}>
        <section className="rv__listpane" aria-label="Liste des recueils">
          <div className="rv__list">
            {loading ? (
              <div className="rv__skel">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="rv__skelcard" />)}</div>
            ) : monthGroups.length === 0 ? (
              <div className="rv__empty">
                <Search size={20} />
                <p>Aucun recueil pour {annee}. Le pipeline alimentera cette page dès la prochaine publication.</p>
              </div>
            ) : (
              monthGroups.map((month) => {
                const open = openMonths.has(month.key);
                return (
                  <section key={month.key || "nd"} className="rv__month">
                    <button
                      type="button"
                      className={`rv__monthbtn${open ? " rv__monthbtn--open" : ""}`}
                      onClick={() => toggleMonth(month.key)}
                      aria-expanded={open}
                    >
                      <ChevronDown size={18} className={`rv__monthchev${open ? " rv__monthchev--open" : ""}`} />
                      <span className="rv__monthlabel">{month.label}</span>
                      <span className="rv__monthcount">{month.count}</span>
                    </button>
                    {open && month.days.map(([d, list]) => (
                      <div key={d || "nd"} className="rv__day">
                        <h3 className="rv__daylabel">{fmtJourCourt(d)}</h3>
                        {list.map((it) => (
                          <RaaListRow
                            key={it.id}
                            it={it}
                            niveau={niveau}
                            selected={selectedId === it.id}
                            onSelect={() => selectItem(it.id)}
                          />
                        ))}
                      </div>
                    ))}
                  </section>
                );
              })
            )}
          </div>
        </section>

        {selected && (
          <button
            type="button"
            className="rv__backdrop"
            aria-label="Fermer le détail"
            onClick={closeDetail}
          />
        )}

        <div className={`rv__detailpane${selected ? "" : " rv__detailpane--empty"}`}>
          <RaaDetailDrawer
            item={selected}
            cfg={cfg}
            detailLoading={selectedId != null && detailLoading.has(selectedId)}
            masquerLoading={selectedId != null && masquerLoading.has(selectedId)}
            onClose={closeDetail}
            onAnalyser={() => selectedId != null && analyser(selectedId)}
            onMarquerVu={() => selectedId != null && void marquerVu(selectedId)}
            onMasquer={() => selectedId != null && void masquer(selectedId)}
          />
        </div>
      </div>
    </div>
  );
}

function RaaListRow({
  it, niveau, selected, onSelect,
}: {
  it: RaaItem;
  niveau: Record<string, { dot: string; label: string }>;
  selected: boolean;
  onSelect: () => void;
}) {
  const importance = importanceStatus(it, niveau);
  const nouveau = isNouveau(it);
  const cls = ["rv__row", `rv__row--${importance.tone}`];
  if (nouveau) cls.push("rv__row--new");
  if (selected) cls.push("rv__row--selected");

  return (
    <button
      type="button"
      className={cls.join(" ")}
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
    >
      <span className="rv__rowbar" style={{ background: importance.dot }} />
      <span className="rv__rowmain">
        <span className="rv__rowtext">
          <span className="rv__rowtitle">{it.titre}</span>
          <span className="rv__rowmeta">
            <span className="rv__rowniveau" style={{ color: importance.dot }}>
              <i style={{ background: importance.dot }} />
              {importance.label}
            </span>
            {nouveau && <span className="rv__rownew">Nouveau</span>}
          </span>
        </span>
        <span className="rv__rowhint">
          Voir les détails
          <ArrowRight size={14} strokeWidth={2.25} />
        </span>
      </span>
    </button>
  );
}

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap");
.rv{
  --accent:#85e372; --accent-hover:#289f01; --accent-soft:rgba(133,227,114,.14);
  --text:#111; --muted:#4b4b4b; --faint:#8a8d92; --border:#e8e8e8; --surface:#fafafa;
  --font:"Kerelia Sans","Inter",-apple-system,system-ui,sans-serif;
  font-family:var(--font); color:var(--text); background:#fff;
  flex:1; min-height:0; height:100%; width:100%; max-width:none;
  display:flex; flex-direction:column; overflow:hidden;
  padding:1.15rem 1.25rem 0;
}
.rv--scroll{overflow-y:auto; -webkit-overflow-scrolling:touch; padding-bottom:4rem;}
.rv *{box-sizing:border-box;}
.rv__page{flex:1; min-height:0; display:flex; flex-direction:column;}
.rv__subnav{display:flex; gap:.35rem; margin:0 0 1rem; padding:.28rem; background:var(--surface);
  border:1px solid var(--border); border-radius:.8rem; width:fit-content; max-width:100%; flex-shrink:0;}
.rv__subnavbtn{border:none; background:transparent; font:inherit; font-size:.84rem; font-weight:600;
  color:var(--muted); padding:.45rem .9rem; border-radius:.6rem; cursor:pointer;}
.rv__subnavbtn:hover{color:var(--text); background:#fff;}
.rv__subnavbtn--active{background:#fff; color:var(--text); box-shadow:0 1px 3px rgba(0,0,0,.06);}
.rv__head{display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:.7rem;
  flex-shrink:0;}
.rv__head-actions{display:flex; flex-direction:column; align-items:stretch; gap:.5rem; flex-shrink:0;}
.rv__eyebrow{font-size:.72rem; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--faint);}
.rv__title{font-size:1.45rem; font-weight:600; margin:.2rem 0 0; letter-spacing:-.01em;}
.rv__sub{font-size:.86rem; color:var(--muted); line-height:1.45; max-width:44rem; margin:0;}
.rv__refresh{flex-shrink:0; display:inline-flex; align-items:center; gap:.4rem; padding:.5rem .8rem;
  border:1px solid var(--border); border-radius:.6rem; background:#fff; font:inherit; font-size:.82rem;
  font-weight:500; color:var(--text); cursor:pointer; transition:border-color .15s, background .15s;}
.rv__refresh:hover:not(:disabled){border-color:var(--accent); background:var(--accent-soft);}
.rv__refresh--warn{border-color:#f0d9a8; background:#fffaf0; color:#9a6700;}
.rv__refresh--warn:hover:not(:disabled){border-color:#e0b050; background:#fff4db;}
.rv__refresh:disabled{opacity:.6; cursor:default;}

.rv__overview{display:flex; align-items:center; flex-wrap:wrap; gap:.55rem; font-size:.82rem;
  color:var(--muted); padding:0 0 .75rem; flex-shrink:0;}
.rv__overview b{color:var(--text); font-weight:600;}
.rv__dot{width:3px; height:3px; border-radius:50%; background:#c8cbd0;}
.rv__demo{display:inline-block; margin-top:.4rem; font-size:.72rem; color:#b07a00; background:#fff6e0;
  padding:.2rem .55rem; border-radius:.5rem; font-weight:500;}

.rv__workspace{flex:1; min-height:0; display:grid; grid-template-columns:minmax(20rem,26rem) minmax(0,1fr);
  border:1px solid var(--border); border-radius:.85rem .85rem 0 0; overflow:hidden; background:#fff;}
.rv__listpane{min-width:0; min-height:0; display:flex; flex-direction:column; border-right:1px solid var(--border);
  background:#f7f8f9;}

.rv__list{flex:1; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:.65rem .65rem 1.25rem;}
.rv__month{margin-bottom:.35rem;}
.rv__monthbtn{display:flex; align-items:center; gap:.45rem; width:100%; padding:.55rem .5rem;
  border:none; background:transparent; font:inherit; text-align:left; cursor:pointer;
  border-radius:.55rem; color:#111;}
.rv__monthbtn:hover{background:rgba(0,0,0,.04);}
.rv__monthlabel{flex:1; font-size:.95rem; font-weight:700; letter-spacing:-.01em;}
.rv__monthcount{flex-shrink:0; min-width:1.5rem; padding:.1rem .45rem; border-radius:999px;
  background:#fff; border:1px solid #e2e4e1; font-size:.72rem; font-weight:700; color:#111; text-align:center;}
.rv__monthchev{flex-shrink:0; color:#111; transition:transform .2s;}
.rv__monthchev--open{transform:rotate(180deg);}
.rv__day{margin:0 0 .85rem .15rem; padding-left:.35rem;}
.rv__daylabel{font-size:.84rem; font-weight:700; color:#111; margin:0 0 .45rem; padding:0 .15rem;}

.rv__row{position:relative; display:flex; width:100%; gap:0; padding:0; border:1px solid transparent;
  border-radius:.7rem; margin-bottom:.4rem; background:#fff; text-align:left; font:inherit; cursor:pointer;
  overflow:hidden; opacity:.7; transition:opacity .18s ease, border-color .15s, box-shadow .15s;}
.rv__row:hover{opacity:1; border-color:#d5d8de; box-shadow:0 2px 10px rgba(0,0,0,.07);}
.rv__row--selected{opacity:1; border-color:#9bb8d4; box-shadow:0 0 0 2px rgba(26,111,168,.12);}
.rv__row--r{background:#fff5f4;}
.rv__row--o{background:#fffaf0;}
.rv__row--v{background:#f6f7f6;}
.rv__row--wait{background:#f4f9fd;}
.rv__row--err{background:#fff6f5;}
.rv__row--muted{background:#f3f4f6;}
.rv__row--new.rv__row--v,.rv__row--new.rv__row--muted{background:#eef6fc;}
.rv__row--new.rv__row--r{background:#fff1ef;}
.rv__row--new.rv__row--o{background:#fff6e6;}
.rv__rowbar{flex-shrink:0; width:4px;}
.rv__rowmain{flex:1; min-width:0; display:flex; align-items:center; justify-content:space-between;
  gap:.65rem; padding:.65rem .75rem .6rem;}
.rv__rowtext{flex:1; min-width:0;}
.rv__rowtitle{display:block; font-size:.88rem; font-weight:600; line-height:1.3; margin:0 0 .3rem;}
.rv__rowmeta{display:flex; align-items:center; flex-wrap:wrap; gap:.4rem;}
.rv__rowhint{flex-shrink:0; display:inline-flex; align-items:center; gap:.25rem;
  font-size:.74rem; font-weight:700; color:#1a6fa8; white-space:nowrap;
  opacity:0; transform:translateX(.15rem); pointer-events:none;
  transition:opacity .18s ease, transform .18s ease;}
.rv__row:hover .rv__rowhint,.rv__row:focus-visible .rv__rowhint{opacity:1; transform:none;}
.rv__rowniveau{display:inline-flex; align-items:center; gap:.3rem; font-size:.74rem; font-weight:700;}
.rv__rowniveau i{width:7px; height:7px; border-radius:50%;}
.rv__rownew{font-size:.68rem; font-weight:700; letter-spacing:.02em; color:#1a6fa8;
  background:#e8f4fd; padding:.08rem .4rem; border-radius:.35rem;}

.rv__detailpane{min-width:0; min-height:0; background:#fff;}
.rv__backdrop{display:none;}

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
.rv__spacer{flex:1;}
.rv__vu{flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;
  padding:.35rem .7rem; border:1px solid #b8d4f0; border-radius:.45rem;
  background:#e8f4fd; color:#1a6fa8; font:inherit; font-size:.76rem; font-weight:700;
  cursor:pointer; white-space:nowrap;}
.rv__vu:hover{background:#d4ebfa; border-color:#1a6fa8;}
.rv__btn{display:inline-flex; align-items:center; gap:.35rem; padding:.45rem .75rem; border-radius:.6rem;
  border:1px solid var(--border); background:#fff; font:inherit; font-size:.8rem; font-weight:600;
  color:var(--text); cursor:pointer; transition:border-color .15s, background .15s; white-space:nowrap;}
.rv__btn:hover:not(:disabled){border-color:var(--accent); background:var(--accent-soft);}
.rv__btn--ghost{color:var(--muted); font-weight:500;}
.rv__btn--ghost:hover:not(:disabled){border-color:#d8c4c4; background:#fdf6f6; color:#a94442;}
.rv__btn:disabled{opacity:.6; cursor:default;}

.rv__skel{display:flex; flex-direction:column; gap:.45rem;}
.rv__skelcard{height:62px; border-radius:.7rem; background:linear-gradient(90deg,#f4f4f5,#fafafa,#f4f4f5);
  background-size:200% 100%; animation:rvsh 1.3s infinite;}
@keyframes rvsh{0%{background-position:200% 0}100%{background-position:-200% 0}}
.rv__empty{display:flex; flex-direction:column; align-items:center; gap:.6rem; text-align:center;
  color:var(--faint); padding:2.5rem 1rem; border:1px dashed var(--border); border-radius:.85rem; background:#fff;}
.rv__empty p{margin:0; font-size:.86rem; max-width:22rem;}
.rv__spin{animation:rvspin .9s linear infinite;}
@keyframes rvspin{to{transform:rotate(360deg)}}
.rv__chevopen{transform:rotate(180deg);}

@media (max-width:860px){
  .rv{padding:1rem .85rem 0;}
  .rv__head{flex-direction:column;}
  .rv__head-actions{width:100%;}
  .rv__title{font-size:1.25rem;}
  .rv__workspace{grid-template-columns:1fr; border-radius:.75rem .75rem 0 0;}
  .rv__listpane{border-right:none;}
  .rv__backdrop{display:block; position:fixed; inset:0; z-index:70; border:0; padding:0;
    background:rgba(17,17,17,.35); cursor:pointer;}
  .rv__detailpane{position:fixed; top:0; right:0; bottom:0; width:min(100%,34rem); z-index:80;
    box-shadow:-8px 0 28px rgba(0,0,0,.12);}
  .rv__detailpane--empty{display:none;}
}
@media (prefers-reduced-motion:reduce){
  .rv__spin,.rv__skelcard{animation:none;}
}
.rv a:focus-visible,.rv button:focus-visible{outline:2px solid var(--accent-hover); outline-offset:2px; border-radius:.4rem;}
`;
