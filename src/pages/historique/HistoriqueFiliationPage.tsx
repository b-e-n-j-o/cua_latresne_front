import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import CadastreTemporelMap, { type SelectionCarte } from "./CadastreTemporelMap";
import DescendanceBlock from "./DescendanceBloc";
import EvenementsTab from "./EvennementsTab";
import FriseTab from "./FriseTab";
import GrapheTab from "./GrapheTab";
import PreuveSpatialeTab from "./PreuveSpatialeTab";
import TimeSlider from "./TimeSlider";
import { NotFoundError, cached, filiationApi, useFiliation } from "./filiationApi";
import { formatAire, formatRef, moisAnnee, parseRef, jourMoisAnnee } from "./libelles";
import { useHistoriqueUrlState } from "./useHistoriqueUrlState";
import type { IsoDate, Vue } from "./types";

/** À ADAPTER : reprendre la config communes existante si elle porte déjà ces infos. */
const COMMUNES_FILIATION: Record<string, { insee: string; nom: string; bounds: [number, number, number, number] }> = {
  argeles: { insee: "66008", nom: "Argelès-sur-Mer", bounds: [3.005104, 42.531832, 3.063641, 42.559276] },
  latresne: { insee: "33234", nom: "Latresne", bounds: [-0.515, 44.766, -0.465, 44.798] },
};

const ONGLETS: { id: Vue; label: string }[] = [
  { id: "frise", label: "Frise" },
  { id: "spatial", label: "Preuve spatiale" },
  { id: "graphe", label: "Graphe" },
  { id: "evenements", label: "Événements" },
];

export default function HistoriqueFiliationPage() {
  const { communeSlug: commune = "" } = useParams();
  const conf = COMMUNES_FILIATION[commune];
  const [state, update] = useHistoriqueUrlState();
  const [panneauOuvert, setPanneauOuvert] = useState(true);
  const [saisie, setSaisie] = useState("");
  const [erreurRecherche, setErreurRecherche] = useState<string | null>(null);
  const [survol, setSurvol] = useState<GeoJSON.Geometry[]>([]);

  // --- Données --------------------------------------------------------------------
  const millesimes = useFiliation(conf ? `mill:${commune}` : null, () => filiationApi.millesimes(commune));
  const dates = useMemo(() => (millesimes.data ?? []).map((m) => m.millesime), [millesimes.data]);
  const dernier = dates[dates.length - 1] ?? null;
  const date = state.date && dates.includes(state.date) ? state.date : dernier;

  const v = state.version;
  const version = useFiliation(conf && v ? `ver:${commune}:${v}` : null, () => filiationApi.version(commune, v!));
  const info = version.data;
  // Date de référence de l'emprise : actuelle, ou début de validité pour une parcelle disparue.
  const dateRef = info?.valid_to ? info.valid_from : undefined;

  const frise = useFiliation(info ? `frise:${commune}:${info.version_id}` : null, () => filiationApi.frise(commune, info!.version_id));
  const historique = useFiliation(
    info ? `hist:${commune}:${info.idu}:${dateRef ?? ""}` : null,
    () => filiationApi.historique(commune, [info!.idu], dateRef),
  );

  // Graphe : chargé pour l'onglet Graphe, et pour la descendance d'une parcelle disparue
  // (une version courante n'a jamais de descendants).
  const besoinGraphe = !!info && (state.vue === "graphe" || !!info.valid_to);
  const graphe = useFiliation(besoinGraphe ? `graphe:${commune}:${info!.version_id}` : null, () => filiationApi.graphe(commune, info!.version_id));
  const evenements = useFiliation(
    info && state.vue === "evenements" ? `evt:${commune}:${info.idu}` : null,
    () => filiationApi.evenements(commune, info!.idu),
  );

  const sousCible = useMemo(
    () =>
      date && historique.data
        ? historique.data.filter((p) => p.observe_depuis <= date && date <= p.observe_jusqu_au).map((p) => p.version_id)
        : [],
    [date, historique.data],
  );

  // --- Actions --------------------------------------------------------------------
  const setDate = useCallback((d: IsoDate) => update({ date: d }), [update]);
  const setVue = (vue: Vue) => update({ vue });
  const selectVersion = useCallback((id: number) => {
    setSurvol([]);
    update({ version: id }, { push: true });
  }, [update]);

  const onSelect = useCallback(
    (sel: SelectionCarte) => {
      // Lot 3 : Maj+clic ajoutera la parcelle à une unité foncière.
      setSurvol([]);
      update({ version: sel.versionId }, { push: true });
    },
    [update],
  );

  const survolReq = useRef(0);
  const onSurvolVersions = useCallback(
    (ids: number[] | null) => {
      const req = ++survolReq.current; // une réponse tardive ne doit pas écraser un survol plus récent
      if (!ids?.length) return setSurvol([]);
      const key = `geom:${commune}:${[...ids].sort().join(",")}`;
      cached(key, () => filiationApi.geomVersions(commune, ids)).then(
        (rows) => req === survolReq.current && setSurvol(rows.map((r) => r.geojson)),
        () => req === survolReq.current && setSurvol([]),
      );
    },
    [commune],
  );

  const rechercher = async (e: FormEvent) => {
    e.preventDefault();
    setErreurRecherche(null);
    const idu = parseRef(saisie, conf.insee);
    if (!idu) return setErreurRecherche("Saisissez une référence comme « AM 2150 » ou un idu complet.");
    try {
      const vid = await cached(`va:${commune}:${idu}`, () => filiationApi.versionActuelle(commune, idu));
      update({ version: vid, date: dernier }, { push: true });
    } catch (err) {
      setErreurRecherche(
        err instanceof NotFoundError
          ? `${formatRef(idu)} n'existe pas dans le cadastre actuel de ${conf.nom}. Cliquez-la sur la carte à une date passée.`
          : "La recherche n'a pas abouti. Réessayez dans un instant.",
      );
    }
  };

  // --- Rendu ----------------------------------------------------------------------
  if (!conf) {
    return <div className="p-6 text-sm text-slate-700">Commune non chargée dans l'historique.</div>;
  }
  if (millesimes.error) {
    return <div className="p-6 text-sm text-red-700">Impossible de charger les millésimes : {millesimes.error.message}</div>;
  }

  return (
    <div className="cua-map-workspace relative flex h-full min-h-0 w-full flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4">
        <h1 className="text-base font-semibold text-slate-900">Historique des parcelles, {conf.nom}</h1>
        <form onSubmit={rechercher} className="ml-auto flex items-center gap-2">
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="AM 2150"
            aria-label="Référence cadastrale"
            className="w-44 rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-600 focus:outline-none"
          />
          <button type="submit" className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700">
            Rechercher
          </button>
        </form>
      </header>
      {erreurRecherche ? <p className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-900">{erreurRecherche}</p> : null}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-[50%] min-w-0 flex-1 flex-col">
          <div className="relative min-h-[320px] w-full flex-1">
            {date ? (
              <CadastreTemporelMap
                commune={commune}
                bounds={conf.bounds}
                date={date}
                cacheVersion={dernier ?? ""}
                cible={info?.geojson ?? null}
                sousCible={sousCible}
                survol={survol}
                onSelect={onSelect}
              />
            ) : (
              <div className="p-6 text-sm text-slate-500">Chargement des millésimes…</div>
            )}
          </div>
          {date ? <TimeSlider dates={dates} value={date} onChange={setDate} /> : null}
        </div>

        {panneauOuvert ? (
          <aside className="flex max-h-[50%] w-full min-h-0 flex-col border-t border-slate-200 bg-white md:max-h-none md:w-[420px] md:border-l md:border-t-0">
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 p-4">
              {info ? (
                <div>
                  <h2 className="text-lg font-semibold text-slate-900" title={info.idu}>{formatRef(info.idu)}</h2>
                  <p className="text-xs text-slate-600">
                    {conf.nom}, {formatAire(info.aire_m2)}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {info.valid_to ? `Historique, jusqu'au ${jourMoisAnnee(info.valid_to)}` : "Parcelle actuelle"}
                    {", "}
                    {dates[0] && info.valid_from <= dates[0]
                      ? `présente depuis au moins ${moisAnnee(dates[0])}`
                      : `présente depuis ${moisAnnee(info.valid_from)}`}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  {version.loading ? "Chargement…" : version.error ? "Parcelle introuvable dans cette commune." : "Cliquez une parcelle ou recherchez une référence."}
                </p>
              )}
              <button type="button" onClick={() => setPanneauOuvert(false)} className="rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100" aria-label="Replier le panneau">
                ✕
              </button>
            </div>

            {info ? (
              <>
                <nav className="flex border-b border-slate-200" role="tablist">
                  {ONGLETS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      role="tab"
                      aria-selected={state.vue === o.id}
                      onClick={() => setVue(o.id)}
                      className={`flex-1 border-b-2 px-2 py-2 text-xs ${
                        state.vue === o.id ? "border-blue-600 font-semibold text-blue-700" : "border-transparent text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </nav>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  {state.vue === "spatial" ? (
                    historique.data && date ? (
                      <PreuveSpatialeTab
                        periodes={historique.data}
                        dates={dates}
                        date={date}
                        onSurvol={(g) => setSurvol(g ?? [])}
                        onDate={setDate}
                      />
                    ) : (
                      <Etat q={historique} />
                    )
                  ) : state.vue === "graphe" ? (
                    graphe.data ? <GrapheTab graphe={graphe.data} onSelectVersion={selectVersion} /> : <Etat q={graphe} />
                  ) : state.vue === "evenements" ? (
                    evenements.data ? <EvenementsTab evenements={evenements.data} onDate={setDate} /> : <Etat q={evenements} />
                  ) : frise.data ? (
                    <>
                      {graphe.data && info.valid_to ? (
                        <DescendanceBlock graphe={graphe.data} onSelectVersion={selectVersion} onSurvol={onSurvolVersions} onDate={setDate} />
                      ) : null}
                      <FriseTab
                        lignes={frise.data}
                        dates={dates}
                        onSurvol={onSurvolVersions}
                        onDate={setDate}
                        onVoirPreuve={() => setVue("spatial")}
                        descendance={!!info.valid_to}
                      />
                    </>
                  ) : (
                    <Etat q={frise} />
                  )}
                </div>
              </>
            ) : null}
          </aside>
        ) : (
          <button
            type="button"
            onClick={() => setPanneauOuvert(true)}
            className="absolute right-3 top-20 z-10 rounded bg-white px-3 py-1.5 text-xs shadow hover:bg-slate-50"
          >
            Afficher le panneau
          </button>
        )}
      </div>
    </div>
  );
}

function Etat({ q }: { q: { loading: boolean; error: Error | undefined } }) {
  if (q.loading) return <p className="p-4 text-sm text-slate-500">Chargement…</p>;
  if (q.error) return <p className="p-4 text-sm text-red-700">{q.error.message}</p>;
  return null;
}