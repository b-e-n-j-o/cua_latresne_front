import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays, ChevronDown, GitBranch, Loader2, MapPin, Search, Split,
} from "lucide-react";
import type { RaaCommuneConfig } from "./raaConfig";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");

type EventType = "division" | "fusion" | "recodage" | "remaniement" | "suppression" | "creation";

type ParcelSnap = {
  idu: string;
  ref?: string;
  section?: string | null;
  numero?: string | null;
  contenance?: number | null;
  area_m2?: number | null;
  created?: string | null;
  updated?: string | null;
  created_etalab?: string | null;
  updated_etalab?: string | null;
  millesime_pci?: string | null;
  imported_at?: string | null;
  geojson?: { type: string; coordinates: unknown } | null;
  origin?: string;
  has_sig?: boolean;
};

type VeilleEvent = {
  id: string | number;
  type: EventType | string;
  parents: ParcelSnap[];
  enfants: ParcelSnap[];
  nb_parents?: number;
  nb_enfants?: number;
  run_at?: string | null;
  millesime_pci?: string | null;
  source?: string;
  en_attente_apply?: boolean;
};

type Photo = {
  id: string;
  archived_at?: string;
  millesime_pci?: string | null;
  millesime_suivant?: string | null;
  motif?: string;
  nb_parcelles?: number;
  debut?: string | null;
  fin?: string | null;
  note?: string | null;
};

type FiliationLink = {
  type?: string;
  evenement_id?: string | number;
  idu_parent?: string;
  ref_parent?: string;
  idu_enfant?: string;
  ref_enfant?: string;
  millesime_pci?: string | null;
  run_at?: string | null;
};

type Accueil = {
  commune: string;
  insee: string;
  schema_ready: boolean;
  latest: { nb_parcelles?: number; millesime_pci?: string | null; imported_at?: string | null };
  photos: Photo[];
  last_run?: { run_at?: string | null; millesime_pci?: string | null } | null;
  counts: Record<string, number>;
  nb_evenements: number;
  pending?: { en_attente_apply?: boolean; fichier?: string; millesime_pci?: string | null } | null;
  source?: string;
};

type Fiche = {
  idu: string;
  ref: string;
  actuel: ParcelSnap | null;
  presente_aujourdhui: boolean;
  versions: Array<ParcelSnap & { photo_id?: string; motif?: string; archived_at?: string }>;
  photos: Photo[];
  evenements: VeilleEvent[];
  filiation: { parents: FiliationLink[]; enfants: FiliationLink[]; ancetres: FiliationLink[] };
};

const TYPE_META: Record<string, { label: string; hint: string; color: string; bg: string }> = {
  division: { label: "Division", hint: "1 parent → plusieurs enfants", color: "#1a6fa8", bg: "#eef6fc" },
  fusion: { label: "Fusion", hint: "Plusieurs parents → 1 enfant", color: "#6c3483", bg: "#f6eef9" },
  recodage: { label: "Recodage", hint: "1 → 1, nouvel identifiant", color: "#5d6d7e", bg: "#f0f1f3" },
  remaniement: { label: "Remaniement", hint: "Plusieurs → plusieurs", color: "#9a6700", bg: "#fffaf0" },
  suppression: { label: "Suppression", hint: "Disparue, sans successeur", color: "#c0392b", bg: "#fff5f4" },
  creation: { label: "Création", hint: "Apparue, sans prédécesseur", color: "#1a7a3a", bg: "#eef8f1" },
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date((iso.length <= 10 ? iso + "T00:00:00" : iso));
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(d);
};

function isoDay(iso?: string | null) {
  if (!iso) return null;
  const s = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function eventDay(ev: VeilleEvent) {
  return isoDay(ev.millesime_pci) || isoDay(ev.run_at);
}

function toLocalIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const fmtM2 = (n?: number | null) => {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} m²`;
};

function refs(list: ParcelSnap[]) {
  return list.map((p) => p.ref || p.idu).join(", ") || "—";
}

export default function VeilleCadastre({ cfg }: { cfg: RaaCommuneConfig }) {
  const base = `${API_BASE}/${cfg.slug}/cadastre-veille`;
  const [accueil, setAccueil] = useState<Accueil | null>(null);
  const [events, setEvents] = useState<VeilleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<Array<{ idu: string; ref?: string; section?: string; numero?: string; source?: string }>>([]);
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [ficheLoading, setFicheLoading] = useState(false);
  const [dateAt, setDateAt] = useState("");
  const [dated, setDated] = useState<{
    presente: boolean;
    note?: string;
    source?: string | null;
    photo?: Photo | null;
    parcelle?: ParcelSnap | null;
  } | null>(null);
  const [openEv, setOpenEv] = useState<string | number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [a, e] = await Promise.all([
        fetch(base).then((r) => { if (!r.ok) throw new Error("api"); return r.json(); }),
        fetch(`${base}/evenements`).then((r) => { if (!r.ok) throw new Error("api"); return r.json(); }),
      ]);
      setAccueil(a);
      setEvents(e.evenements || []);
      setDemo(false);
    } catch {
      setAccueil(demoAccueil(cfg));
      setEvents(demoEvents());
      setDemo(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [base]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFiche = async (idu: string) => {
    setFicheLoading(true);
    setDated(null);
    setHits([]);
    try {
      if (demo) {
        setFiche(demoFiche(idu));
        return;
      }
      const r = await fetch(`${base}/parcelle/${encodeURIComponent(idu)}`);
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        throw new Error(body?.detail || "Parcelle introuvable");
      }
      const data: Fiche = await r.json();
      setFiche(data);
      const lastPhoto = data.photos?.[data.photos.length - 1];
      setDateAt((lastPhoto?.millesime_pci || data.actuel?.millesime_pci || "").slice(0, 10));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Recherche impossible.");
      setFiche(null);
    } finally {
      setFicheLoading(false);
    }
  };

  const search = async (ev?: FormEvent) => {
    ev?.preventDefault();
    const query = q.trim();
    if (query.length < 2) return;
    setSearching(true);
    setErr(null);
    try {
      if (demo) {
        setFiche(demoFiche("66008000BN0551"));
        setHits([]);
        return;
      }
      const r = await fetch(`${base}/parcelle?q=${encodeURIComponent(query)}`);
      if (!r.ok) throw new Error("recherche");
      const data = await r.json();
      const list = data.resultats || [];
      setHits(list);
      if (list.length === 1) await loadFiche(list[0].idu);
      else if (list.length === 0) setErr(`Aucune parcelle pour « ${query} ».`);
    } catch {
      setErr("Impossible de joindre l’API de recherche.");
    } finally {
      setSearching(false);
    }
  };

  const lookupDate = async (idu: string, iso: string) => {
    if (!iso) return;
    try {
      if (demo) {
        setDated({
          presente: true,
          source: "demo",
          note: "Mode démo — géométrie d’illustration.",
          parcelle: fiche?.actuel || null,
        });
        return;
      }
      const r = await fetch(`${base}/parcelle/${encodeURIComponent(idu)}/a-date?date=${iso}`);
      if (!r.ok) throw new Error("date");
      setDated(await r.json());
    } catch {
      setDated(null);
      setErr("Impossible de charger cette date.");
    }
  };

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (dateFilter && eventDay(e) !== dateFilter) return false;
      return true;
    });
  }, [events, typeFilter, dateFilter]);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      const day = eventDay(e);
      if (!day) continue;
      map.set(day, (map.get(day) || 0) + 1);
    }
    return map;
  }, [events]);

  const lastModif = useMemo(() => {
    const days = [...byDay.keys()].sort();
    return days[days.length - 1] || null;
  }, [byDay]);

  const statutCadastre = useMemo(() => {
    const verif = accueil?.last_run?.run_at;
    if (lastModif) {
      return `Cadastre à jour, dernière modification datant du ${fmtDate(lastModif)}`
        + (verif ? ` · vérifié le ${fmtDate(verif)}` : "");
    }
    if (verif) {
      return `Cadastre à jour · aucune modification cadastrale enregistrée · vérifié le ${fmtDate(verif)}`;
    }
    return "Cadastre à jour · aucune modification cadastrale enregistrée pour l’instant.";
  }, [accueil, lastModif]);

  const selectDay = (iso: string, count: number) => {
    setDateFilter((prev) => (prev === iso ? null : iso));
    if (count > 0) {
      requestAnimationFrame(() => {
        document.getElementById("vc-fil")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const counts = accueil?.counts || {};
  const mapFeatures = useMemo(() => collectMapFeatures(fiche, dated), [fiche, dated]);

  return (
    <div className="vc">
      <style>{VC_CSS}</style>

      <header className="rv__head">
        <div>
          <div className="rv__eyebrow">{cfg.departementLabel} · {cfg.communeLabel}</div>
          <h1 className="rv__title">Veille cadastrale</h1>
          <p className="rv__sub">
            Fil des divisions, fusions et recodages issus du PCI Etalab
            (millésime ~trimestriel — ce n’est pas le plan cadastral opposable des impôts).
            Chaque vraie mise à jour archive une photo complète : on peut rouvrir une parcelle à une date
            et remonter à ses parents.
          </p>
        </div>
      </header>

      {demo && <p className="rv__demo" style={{ marginBottom: "1rem" }}>mode démo — backend non connecté</p>}
      {accueil?.pending?.en_attente_apply && (
        <p className="vc__banner">
          Diff Etalab déjà calculé{accueil.pending.millesime_pci ? ` (PCI ${accueil.pending.millesime_pci})` : ""}.
          Le fil ci-dessous est en attente du premier archivage (<code>--apply</code>) :
          la carte latest n’a pas encore été remplacée, les photos sont encore vides.
        </p>
      )}
      {accueil && !accueil.schema_ready && !demo && (
        <p className="vc__banner">Tables d’archive absentes — exécuter le SQL ou <code>--ensure-schema</code>.</p>
      )}

      <div className="rv__overview">
        <span>{(accueil?.latest.nb_parcelles ?? 0).toLocaleString("fr-FR")} parcelles actuelles</span>
        <span className="rv__dot" />
        <span>Millésime PCI {accueil?.latest.millesime_pci || "non daté"}</span>
        <span className="rv__dot" />
        <span>{accueil?.photos.length ?? 0} photo{(accueil?.photos.length || 0) > 1 ? "s" : ""}</span>
        <span className="rv__dot" />
        <span><b>{accueil?.nb_evenements ?? 0}</b> mouvement{(accueil?.nb_evenements || 0) > 1 ? "s" : ""}</span>
      </div>

      <p className="vc__uptodate">{statutCadastre}</p>

      <ActivityHeatmap
        byDay={byDay}
        selected={dateFilter}
        onSelect={selectDay}
      />
      {dateFilter && (
        <p className="vc__daypick">
          Mouvements du <strong>{fmtDate(dateFilter)}</strong>
          {" · "}
          <button type="button" className="vc__linkbtn" onClick={() => setDateFilter(null)}>
            Afficher toutes les dates
          </button>
        </p>
      )}

      <form className="vc__search" onSubmit={search}>
        <Search size={16} aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une parcelle — BN 0551, IDU…"
          aria-label="Rechercher une parcelle"
        />
        <button type="submit" className="rv__btn" disabled={searching}>
          {searching ? <Loader2 size={14} className="rv__spin" /> : "Chercher"}
        </button>
      </form>

      {err && <p className="rv__statusline rv__statusline--err">{err}</p>}

      {hits.length > 1 && (
        <ul className="vc__hits">
          {hits.map((h) => (
            <li key={h.idu}>
              <button type="button" onClick={() => loadFiche(h.idu)}>
                <strong>{h.ref || h.idu}</strong>
                <span>{h.idu}{h.source === "archive" ? " · archive seule" : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {ficheLoading && (
        <p className="rv__statusline rv__statusline--wait">
          <Loader2 size={14} className="rv__spin" /> Chargement de la parcelle…
        </p>
      )}

      {fiche && !ficheLoading && (
        <section className="vc__fiche" aria-label={`Parcelle ${fiche.ref}`}>
          <div className="vc__fichehead">
            <div>
              <div className="vc__ref">{fiche.ref}</div>
              <div className="vc__idu">{fiche.idu}</div>
              <p className="vc__etat">
                {fiche.presente_aujourdhui
                  ? `Présente aujourd’hui · ${fmtM2(fiche.actuel?.contenance)} · PCI ${fiche.actuel?.millesime_pci || "—"}`
                  : "Absente du cadastre actuel — voir les parents ci-dessous."}
              </p>
            </div>
            <button type="button" className="rv__btn rv__btn--ghost" onClick={() => setFiche(null)}>
              Fermer
            </button>
          </div>

          <ParcelMiniMap features={mapFeatures} />

          <div className="vc__datebox">
            <label>
              <CalendarDays size={14} />
              Voir cette parcelle à la date
              <input
                type="date"
                value={dateAt}
                onChange={(e) => {
                  setDateAt(e.target.value);
                  void lookupDate(fiche.idu, e.target.value);
                }}
              />
            </label>
            {fiche.photos.length > 0 && (
              <div className="vc__photosel">
                {fiche.photos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`vc__photobtn${dateAt && p.millesime_pci === dateAt ? " vc__photobtn--on" : ""}`}
                    onClick={() => {
                      const iso = (p.millesime_pci || p.debut || "").slice(0, 10);
                      setDateAt(iso);
                      if (iso) void lookupDate(fiche.idu, iso);
                    }}
                  >
                    {p.millesime_pci || p.motif || "Photo"}
                  </button>
                ))}
                {fiche.actuel && (
                  <button
                    type="button"
                    className="vc__photobtn"
                    onClick={() => {
                      setDated({
                        presente: true,
                        source: "latest",
                        note: "État actuel.",
                        parcelle: fiche.actuel,
                      });
                    }}
                  >
                    Aujourd’hui
                  </button>
                )}
              </div>
            )}
            {dated && (
              <p className="vc__datenote">
                {dated.presente
                  ? `Présente à cette date (${dated.source === "archive" ? "photo d’archive" : "carte actuelle"}).`
                  : dated.note || "Absente à cette date."}
                {dated.parcelle?.contenance != null && ` · ${fmtM2(dated.parcelle.contenance)}`}
              </p>
            )}
          </div>

          <FiliationBlock
            title="Parents"
            empty="Aucun parent connu (création nette, ou fil pas encore archivé)."
            links={fiche.filiation.parents}
            side="parent"
            onIdu={loadFiche}
          />
          <FiliationBlock
            title="Enfants"
            empty="Aucun enfant connu (pas de division / fusion issue de cette parcelle)."
            links={fiche.filiation.enfants}
            side="enfant"
            onIdu={loadFiche}
          />
          {fiche.filiation.ancetres.length > 0 && (
            <FiliationBlock
              title="Ancêtres (plus haut)"
              empty=""
              links={fiche.filiation.ancetres}
              side="parent"
              onIdu={loadFiche}
            />
          )}
        </section>
      )}

      <div className="vc__filters" role="group" aria-label="Types de mouvements">
        <button
          type="button"
          className={`vc__chip${typeFilter === "all" ? " vc__chip--on" : ""}`}
          onClick={() => setTypeFilter("all")}
        >
          Tous <b>{events.length}</b>
        </button>
        {Object.entries(TYPE_META).map(([k, meta]) => (
          <button
            key={k}
            type="button"
            className={`vc__chip${typeFilter === k ? " vc__chip--on" : ""}`}
            style={{ ["--chip" as string]: meta.color }}
            onClick={() => setTypeFilter(typeFilter === k ? "all" : k)}
          >
            {meta.label} <b>{counts[k] ?? 0}</b>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rv__skel">{[0, 1, 2].map((i) => <div key={i} className="rv__skelcard" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rv__empty" id="vc-fil">
          <Split size={28} />
          <p>
            {dateFilter
              ? `Aucun mouvement cadastral le ${fmtDate(dateFilter)}.`
              : "Aucun mouvement enregistré pour l’instant. Le fil se remplit au premier --apply (photo + latest + événements)."}
          </p>
          {dateFilter && (
            <button type="button" className="rv__btn" onClick={() => setDateFilter(null)}>
              Toutes les dates
            </button>
          )}
        </div>
      ) : (
        <div id="vc-fil">
          {filtered.map((ev) => {
            const meta = TYPE_META[ev.type] || TYPE_META.remaniement;
            const open = openEv === ev.id;
            return (
              <article key={String(ev.id)} className="vc__ev" style={{ borderLeftColor: meta.color }}>
                <button type="button" className="vc__evhead" onClick={() => setOpenEv(open ? null : ev.id)} aria-expanded={open}>
                  <span className="vc__evtype" style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>
                  <span className="vc__evsum">
                    <strong>{refs(ev.parents)}</strong>
                    <span className="vc__arrow">→</span>
                    <strong>{refs(ev.enfants)}</strong>
                  </span>
                  <span className="vc__evmeta">{fmtDate(ev.millesime_pci || ev.run_at)}</span>
                  <ChevronDown size={16} className={open ? "rv__chevopen" : ""} />
                </button>
                {open && (
                  <div className="vc__evbody">
                    <p className="vc__evhint">{meta.hint}</p>
                    <div className="vc__cols">
                      <div>
                        <h4>Parents</h4>
                        <IdList items={ev.parents} onIdu={loadFiche} />
                      </div>
                      <div>
                        <h4>Enfants</h4>
                        <IdList items={ev.enfants} onIdu={loadFiche} />
                      </div>
                    </div>
                    {ev.en_attente_apply && (
                      <p className="vc__evhint">En attente d’archivage — les polygones historiques seront dans la photo au --apply.</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IdList({ items, onIdu }: { items: ParcelSnap[]; onIdu: (idu: string) => void }) {
  if (!items.length) return <p className="vc__muted">—</p>;
  return (
    <ul>
      {items.map((p) => (
        <li key={p.idu}>
          <button type="button" onClick={() => onIdu(p.idu)}>
            <MapPin size={12} /> {p.ref || p.idu}
          </button>
          <span>{fmtM2(p.contenance ?? p.area_m2)}</span>
        </li>
      ))}
    </ul>
  );
}

function FiliationBlock({
  title, empty, links, side, onIdu,
}: {
  title: string;
  empty: string;
  links: FiliationLink[];
  side: "parent" | "enfant";
  onIdu: (idu: string) => void;
}) {
  return (
    <div className="vc__fil">
      <h3><GitBranch size={14} /> {title}</h3>
      {links.length === 0 ? (
        <p className="vc__muted">{empty}</p>
      ) : (
        <ul>
          {links.map((l, i) => {
            const idu = side === "parent" ? l.idu_parent : l.idu_enfant;
            const ref = side === "parent" ? l.ref_parent : l.ref_enfant;
            return (
              <li key={`${idu}-${i}`}>
                <button type="button" disabled={!idu} onClick={() => idu && onIdu(idu)}>
                  {ref || idu}
                </button>
                <span>{TYPE_META[l.type || ""]?.label || l.type} · {fmtDate(l.millesime_pci || l.run_at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function collectMapFeatures(
  fiche: Fiche | null,
  dated: { parcelle?: ParcelSnap | null } | null,
): Array<{ geojson: { type: string; coordinates: unknown }; color: string; label: string }> {
  const out: Array<{ geojson: { type: string; coordinates: unknown }; color: string; label: string }> = [];
  const add = (snap: ParcelSnap | null | undefined, color: string, label: string) => {
    if (snap?.geojson) out.push({ geojson: snap.geojson, color, label });
  };
  add(dated?.parcelle, "#1a6fa8", "À cette date");
  add(fiche?.actuel, "#1a7a3a", "Aujourd’hui");
  return out;
}

function ringsOf(geom: { type: string; coordinates: unknown }): number[][][] {
  if (geom.type === "Polygon") return geom.coordinates as number[][][];
  if (geom.type === "MultiPolygon") return (geom.coordinates as number[][][][]).flat();
  return [];
}

function ParcelMiniMap({ features }: { features: Array<{ geojson: { type: string; coordinates: unknown }; color: string; label: string }> }) {
  if (!features.length) {
    return (
      <div className="vc__map vc__map--empty">
        Contour indisponible tant que la photo n’est pas archivée (ou parcelle sans géométrie).
      </div>
    );
  }
  const pts: number[][] = [];
  for (const f of features) {
    for (const ring of ringsOf(f.geojson)) {
      for (const c of ring) pts.push(c as number[]);
    }
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 0.08;
  const w = Math.max(maxX - minX, 1e-8);
  const h = Math.max(maxY - minY, 1e-8);
  const W = 560;
  const H = 220;
  const sx = (W * (1 - 2 * pad)) / w;
  const sy = (H * (1 - 2 * pad)) / h;
  const s = Math.min(sx, sy);
  const ox = (W - w * s) / 2;
  const oy = (H - h * s) / 2;
  const proj = (c: number[]) => `${ox + (c[0] - minX) * s},${oy + (maxY - c[1]) * s}`;

  return (
    <div className="vc__map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Contour de la parcelle">
        {features.map((f, i) =>
          ringsOf(f.geojson).map((ring, j) => {
            const d = ring.map((c, k) => `${k === 0 ? "M" : "L"}${proj(c as number[])}`).join(" ") + "Z";
            return (
              <path
                key={`${i}-${j}`}
                d={d}
                fill={f.color}
                fillOpacity={0.18}
                stroke={f.color}
                strokeWidth={1.6}
              />
            );
          }),
        )}
      </svg>
      <div className="vc__mapleg">
        {features.map((f) => (
          <span key={f.label}><i style={{ background: f.color }} />{f.label}</span>
        ))}
      </div>
    </div>
  );
}

function ActivityHeatmap({
  byDay,
  selected,
  onSelect,
}: {
  byDay: Map<string, number>;
  selected: string | null;
  onSelect: (iso: string, count: number) => void;
}) {
  const { weeks, months } = useMemo(() => buildHeatmapWeeks(53), []);
  return (
    <div className="vc__heat">
      <div className="vc__heathead">
        <span>Activité cadastrale (12 derniers mois)</span>
        <span className="vc__heatleg">
          Moins
          <i className="vc__sq vc__sq--0" />
          <i className="vc__sq vc__sq--1" />
          <i className="vc__sq vc__sq--2" />
          <i className="vc__sq vc__sq--3" />
          Plus
        </span>
      </div>
      <div className="vc__heatscroll">
        <div
          className="vc__heatgrid"
          style={{
            gridTemplateColumns: `auto repeat(${weeks.length}, 11px)`,
            gridTemplateRows: "14px repeat(7, 11px)",
          }}
        >
          {months.map((m) => (
            <span
              key={`${m.label}-${m.col}`}
              className="vc__heatmonth"
              style={{ gridColumn: `${m.col + 2} / span ${Math.max(m.span, 1)}`, gridRow: 1 }}
            >
              {m.label}
            </span>
          ))}
          {["L", "M", "M", "J", "V", "S", "D"].map((lab, row) => (
            <span key={lab + row} className="vc__heatdow" style={{ gridRow: row + 2, gridColumn: 1 }}>
              {row % 2 === 0 ? lab : ""}
            </span>
          ))}
          {weeks.map((week, wi) =>
            week.map((iso, di) => {
              if (!iso) {
                return <span key={`${wi}-${di}`} className="vc__sq vc__sq--empty" style={{ gridColumn: wi + 2, gridRow: di + 2 }} />;
              }
              const n = byDay.get(iso) || 0;
              const lvl = n === 0 ? 0 : n < 5 ? 1 : n < 13 ? 2 : 3;
              return (
                <button
                  key={iso}
                  type="button"
                  className={`vc__sq vc__sq--${lvl}${selected === iso ? " vc__sq--on" : ""}`}
                  style={{ gridColumn: wi + 2, gridRow: di + 2 }}
                  title={`${fmtDate(iso)} — ${n} mouvement${n > 1 ? "s" : ""}`}
                  aria-label={`${fmtDate(iso)}, ${n} mouvement${n > 1 ? "s" : ""}`}
                  onClick={() => onSelect(iso, n)}
                />
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

function buildHeatmapWeeks(weekCount: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekday = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const endMonday = new Date(today);
  endMonday.setDate(today.getDate() - weekday);
  const start = new Date(endMonday);
  start.setDate(start.getDate() - (weekCount - 1) * 7);

  const weeks: Array<Array<string | null>> = [];
  for (let w = 0; w < weekCount; w++) {
    const week: Array<string | null> = [];
    for (let d = 0; d < 7; d++) {
      const cell = new Date(start);
      cell.setDate(start.getDate() + w * 7 + d);
      week.push(cell > today ? null : toLocalIso(cell));
    }
    weeks.push(week);
  }

  const months: Array<{ label: string; col: number; span: number }> = [];
  let current: { label: string; col: number; span: number } | null = null;
  for (let w = 0; w < weeks.length; w++) {
    const iso = weeks[w].find(Boolean);
    if (!iso) continue;
    const label = new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { month: "short" });
    if (!current || current.label !== label) {
      if (current) months.push(current);
      current = { label, col: w, span: 1 };
    } else {
      current.span += 1;
    }
  }
  if (current) months.push(current);
  return { weeks, months };
}

function demoAccueil(cfg: RaaCommuneConfig): Accueil {
  return {
    commune: cfg.communeLabel,
    insee: "66008",
    schema_ready: true,
    latest: { nb_parcelles: 15585, millesime_pci: "2026-06-01", imported_at: "2026-09-14T01:01:32Z" },
    photos: [],
    last_run: { run_at: "2026-09-14T01:01:32Z", millesime_pci: "2026-06-01" },
    counts: { division: 17, fusion: 0, recodage: 0, remaniement: 0, suppression: 0, creation: 2 },
    nb_evenements: 19,
    pending: { en_attente_apply: true, millesime_pci: "2026-06-01" },
  };
}

function demoEvents(): VeilleEvent[] {
  return [
    {
      id: "d1",
      type: "division",
      millesime_pci: "2026-06-01",
      en_attente_apply: true,
      parents: [{ idu: "66008000AL0120", ref: "AL:0120", area_m2: 1840 }],
      enfants: [
        { idu: "66008000AL0801", ref: "AL:0801", area_m2: 920 },
        { idu: "66008000AL0802", ref: "AL:0802", area_m2: 910 },
      ],
    },
    {
      id: "c1",
      type: "creation",
      millesime_pci: "2026-06-01",
      en_attente_apply: true,
      parents: [],
      enfants: [{ idu: "66008000BN0551", ref: "BN:0551", area_m2: 412 }],
    },
  ];
}

function demoFiche(idu: string): Fiche {
  const ref = idu.length >= 14 ? `${idu.slice(8, 10)}:${idu.slice(10, 14)}` : idu;
  return {
    idu,
    ref,
    presente_aujourdhui: idu.includes("BN0551") || idu.includes("AL080"),
    actuel: idu.includes("AL0120") ? null : {
      idu, ref, contenance: 412, millesime_pci: "2026-06-01",
    },
    versions: [],
    photos: [],
    evenements: demoEvents().filter((e) =>
      JSON.stringify(e).includes(idu.slice(-6)),
    ),
    filiation: {
      parents: idu.includes("AL080")
        ? [{ type: "division", idu_parent: "66008000AL0120", ref_parent: "AL:0120", idu_enfant: idu, ref_enfant: ref, millesime_pci: "2026-06-01" }]
        : [],
      enfants: idu.includes("AL0120")
        ? [
          { type: "division", idu_parent: idu, ref_parent: ref, idu_enfant: "66008000AL0801", ref_enfant: "AL:0801", millesime_pci: "2026-06-01" },
          { type: "division", idu_parent: idu, ref_parent: ref, idu_enfant: "66008000AL0802", ref_enfant: "AL:0802", millesime_pci: "2026-06-01" },
        ]
        : [],
      ancetres: [],
    },
  };
}

const VC_CSS = `
.vc{display:flex; flex-direction:column; gap:0;}
.vc__uptodate{margin:0 0 1rem; padding:.7rem .9rem; border-radius:.7rem; background:#eef8f1;
  border:1px solid #c8e6d0; color:#1a7a3a; font-size:.86rem; line-height:1.45; font-weight:600;}
.vc__heat{margin:0 0 1.1rem; padding:.75rem .85rem .85rem; border:1px solid var(--border);
  border-radius:.85rem; background:#fff;}
.vc__heathead{display:flex; justify-content:space-between; align-items:center; gap:.75rem;
  font-size:.78rem; font-weight:600; color:var(--muted); margin-bottom:.55rem; flex-wrap:wrap;}
.vc__heatleg{display:inline-flex; align-items:center; gap:.28rem; font-weight:500; font-size:.7rem; color:var(--faint);}
.vc__heatscroll{overflow-x:auto; padding-bottom:.15rem;}
.vc__heatgrid{display:grid; gap:3px; align-items:center; min-width:max-content;}
.vc__heatmonth{font-size:.65rem; color:var(--faint); line-height:14px; overflow:hidden; white-space:nowrap;}
.vc__heatdow{font-size:.6rem; color:var(--faint); line-height:11px; padding-right:.35rem;}
.vc__sq{width:11px; height:11px; padding:0; border:none; border-radius:2px; background:#ebedf0; display:inline-block;}
button.vc__sq{cursor:pointer;}
button.vc__sq:hover{outline:1px solid #1a7a3a; outline-offset:1px;}
.vc__sq--empty{visibility:hidden;}
.vc__sq--0{background:#ebedf0;}
.vc__sq--1{background:#9be9a8;}
.vc__sq--2{background:#40c463;}
.vc__sq--3{background:#216e39;}
.vc__sq--on{box-shadow:0 0 0 2px #1a7a3a;}
.vc__daypick{margin:0 0 .85rem; font-size:.82rem; color:var(--muted);}
.vc__linkbtn{border:none; background:none; padding:0; font:inherit; font-weight:700; color:#1a6fa8; cursor:pointer;}
.vc__linkbtn:hover{text-decoration:underline;}
.vc__banner{margin:0 0 1rem; padding:.7rem .9rem; border-radius:.7rem; background:#fffaf0;
  border:1px solid #f0d9a8; color:#7a5a00; font-size:.82rem; line-height:1.45;}
.vc__banner code{font-size:.78rem; background:#fff6e0; padding:.05rem .3rem; border-radius:.3rem;}
.vc__search{display:flex; align-items:center; gap:.55rem; padding:.55rem .75rem; margin-bottom:1rem;
  border:1px solid var(--border); border-radius:.75rem; background:#fff;}
.vc__search input{flex:1; border:none; outline:none; font:inherit; font-size:.9rem; min-width:0;}
.vc__hits{list-style:none; margin:0 0 1rem; padding:0; display:flex; flex-direction:column; gap:.4rem;}
.vc__hits button{width:100%; text-align:left; border:1px solid var(--border); background:#fff;
  border-radius:.6rem; padding:.55rem .75rem; font:inherit; cursor:pointer;}
.vc__hits button:hover{border-color:#b8d4f0; background:#f4f9fd;}
.vc__hits strong{display:block; font-size:.88rem;}
.vc__hits span{font-size:.74rem; color:var(--faint);}
.vc__fiche{padding:1rem 1.05rem 1.1rem; margin-bottom:1.2rem; border:1px solid #cfe3f4;
  border-radius:.85rem; background:#f7fbfe;}
.vc__fichehead{display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; margin-bottom:.75rem;}
.vc__ref{font-size:1.25rem; font-weight:700; letter-spacing:-.02em;}
.vc__idu{font-size:.75rem; color:var(--faint); margin-top:.1rem;}
.vc__etat{margin:.35rem 0 0; font-size:.82rem; color:var(--muted);}
.vc__datebox{margin:.85rem 0; padding:.7rem .8rem; background:#fff; border:1px solid var(--border); border-radius:.65rem;}
.vc__datebox label{display:flex; align-items:center; flex-wrap:wrap; gap:.45rem; font-size:.82rem; font-weight:600;}
.vc__datebox input[type=date]{border:1px solid var(--border); border-radius:.45rem; padding:.25rem .4rem; font:inherit;}
.vc__photosel{display:flex; flex-wrap:wrap; gap:.4rem; margin-top:.55rem;}
.vc__photobtn{border:1px solid var(--border); background:#fff; border-radius:.45rem; padding:.25rem .55rem;
  font:inherit; font-size:.74rem; font-weight:600; cursor:pointer;}
.vc__photobtn--on,.vc__photobtn:hover{border-color:#1a6fa8; background:#eef6fc; color:#1a6fa8;}
.vc__datenote{margin:.5rem 0 0; font-size:.8rem; color:var(--muted);}
.vc__fil{margin-top:.75rem;}
.vc__fil h3{display:flex; align-items:center; gap:.35rem; font-size:.82rem; margin:0 0 .35rem;}
.vc__fil ul,.vc .vc__evbody ul{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:.3rem;}
.vc__fil li,.vc .vc__evbody li{display:flex; align-items:center; justify-content:space-between; gap:.6rem; font-size:.82rem;}
.vc__fil button,.vc .vc__evbody button{border:none; background:none; padding:0; font:inherit; font-weight:700;
  color:#1a6fa8; cursor:pointer; display:inline-flex; align-items:center; gap:.25rem;}
.vc__fil button:hover,.vc .vc__evbody button:hover{text-decoration:underline;}
.vc__muted{margin:0; font-size:.8rem; color:var(--faint);}
.vc__filters{display:flex; flex-wrap:wrap; gap:.4rem; margin:0 0 1rem;}
.vc__chip{border:1px solid var(--border); background:#fff; border-radius:999px; padding:.28rem .65rem;
  font:inherit; font-size:.74rem; font-weight:600; cursor:pointer; color:var(--muted);}
.vc__chip b{margin-left:.25rem; color:var(--text);}
.vc__chip--on{border-color:var(--chip, #1a6fa8); background:var(--accent-soft); color:var(--chip, #1a6fa8);}
.vc__ev{border:1px solid var(--border); border-left:4px solid #1a6fa8; border-radius:.75rem;
  background:#fff; margin-bottom:.65rem; overflow:hidden;}
.vc__evhead{display:flex; align-items:center; gap:.55rem; width:100%; padding:.7rem .8rem;
  border:none; background:transparent; font:inherit; text-align:left; cursor:pointer;}
.vc__evtype{flex-shrink:0; font-size:.7rem; font-weight:700; padding:.12rem .45rem; border-radius:.4rem;}
.vc__evsum{flex:1; min-width:0; font-size:.84rem;}
.vc__arrow{margin:0 .35rem; color:var(--faint);}
.vc__evmeta{flex-shrink:0; font-size:.72rem; color:var(--faint);}
.vc__evbody{padding:0 .9rem .85rem; border-top:1px dashed var(--border);}
.vc__evhint{font-size:.78rem; color:var(--muted); margin:.55rem 0;}
.vc__cols{display:grid; grid-template-columns:1fr 1fr; gap:1rem;}
.vc__cols h4{margin:0 0 .35rem; font-size:.72rem; text-transform:uppercase; letter-spacing:.04em; color:var(--faint);}
.vc__map{margin:.2rem 0 .4rem; background:#fff; border:1px solid var(--border); border-radius:.65rem; overflow:hidden;}
.vc__map svg{display:block; width:100%; height:auto;}
.vc__map--empty{padding:1.1rem; font-size:.8rem; color:var(--faint); text-align:center;}
.vc__mapleg{display:flex; gap:.8rem; padding:.35rem .7rem .5rem; font-size:.72rem; color:var(--muted);}
.vc__mapleg i{display:inline-block; width:8px; height:8px; border-radius:2px; margin-right:.3rem;}
@media (max-width:560px){
  .vc__cols{grid-template-columns:1fr;}
  .vc__evhead{flex-wrap:wrap;}
  .vc__evmeta{width:100%;}
}
`;
