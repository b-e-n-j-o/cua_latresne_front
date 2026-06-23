import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Map as MapIcon, X } from "lucide-react";
import type { FullIntersectionsReport } from "../../../../types/fullIntersections";
import type { ParcelleResumeRef, SigResume, SigResumeLayerKey } from "../../../../types/sigResume";
import {
  SIG_RESUME_LAYER_ORDER,
  aggregateLayerForUf,
  buildParcelleResumeViews,
  fetchParcellesResume,
  filterSignificantObjets,
  formatLayerObjectLabel,
  layerDisplayName,
  layerMissingReason,
  layerPctFromLayer,
  totalUfSurfaceM2,
  type ParcelleResumeView,
} from "../../../../utils/argeles/sigResume";
import FullIntersectionsPanel from "./FullIntersectionsPanel";
import ParcelleCuaGenerateAction from "./ParcelleCuaGenerateAction";

type Props = {
  communeSlug?: string;
  parcelles: ParcelleResumeRef[];
  cadastre: GeoJSON.FeatureCollection | null;
  /** true = UF en cours de construction sur la carte */
  isDraftUf?: boolean;
  studyZoneActive?: boolean;
  studyZoneLoading?: boolean;
  studyZoneLabel?: string;
  onEnterStudyZone?: () => void;
  onExitStudyZone?: () => void;
  intersectionsReport?: FullIntersectionsReport | null;
  intersectionsLoading?: boolean;
  intersectionsError?: string | null;
  onRecalculateIntersections?: () => void;
  userId?: string | null;
  userEmail?: string | null;
  onPipelineCreated?: (slug: string) => void;
};

const SIG_LAYER_UI: Record<
  SigResumeLayerKey,
  { dot: string; bg: string; border: string; title: string; empty: string }
> = {
  zonage_plu: {
    dot: "bg-blue-600",
    bg: "bg-blue-50/90",
    border: "border-blue-200",
    title: "text-blue-950",
    empty: "text-blue-700/70",
  },
  hauteurs: {
    dot: "bg-violet-600",
    bg: "bg-violet-50/90",
    border: "border-violet-200",
    title: "text-violet-950",
    empty: "text-violet-700/70",
  },
  sup_assiette_s: {
    dot: "bg-rose-600",
    bg: "bg-rose-50/90",
    border: "border-rose-200",
    title: "text-rose-950",
    empty: "text-rose-700/70",
  },
  ppr: {
    dot: "bg-orange-600",
    bg: "bg-orange-50/90",
    border: "border-orange-200",
    title: "text-orange-950",
    empty: "text-orange-700/70",
  },
  pprif: {
    dot: "bg-red-700",
    bg: "bg-red-50/90",
    border: "border-red-200",
    title: "text-red-950",
    empty: "text-red-700/70",
  },
};

function formatM2(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} m²`;
}

function formatPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function StudyZoneActionButton({
  loading,
  active,
  onEnter,
}: {
  loading?: boolean;
  active?: boolean;
  onEnter?: () => void;
}) {
  if (!onEnter) return null;

  return (
    <button
      type="button"
      disabled={loading || active}
      onClick={onEnter}
      className={`w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-lg text-sm shadow-md ${
        active
          ? "kerelia-btn-accent kerelia-btn-accent--active"
          : "kerelia-btn-accent"
      }`}
    >
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin shrink-0" />
          Zone d&apos;étude et analyse SIG…
        </>
      ) : active ? (
        <>
          <MapIcon className="w-5 h-5 shrink-0" />
          Zonage affiché sur la carte
        </>
      ) : (
        <>
          <MapIcon className="w-5 h-5 shrink-0" strokeWidth={2.25} />
          Afficher le zonage de la zone sélectionnée
        </>
      )}
    </button>
  );
}

function StudyZoneModeBanner({
  label,
  onExit,
}: {
  label?: string;
  onExit?: () => void;
}) {
  if (!onExit) return null;

  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-blue-300 bg-blue-600 px-2.5 py-2 text-white shadow-sm">
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wide opacity-90">
          Mode zone d&apos;étude
        </div>
        {label ? (
          <div className="text-xs font-medium mt-0.5 truncate" title={label}>
            {label}
          </div>
        ) : null}
        <p className="text-[10px] opacity-80 mt-1 leading-snug">
          Sélection cadastre verrouillée — utilisez ✕ pour revenir à la vue communale.
        </p>
      </div>
      <button
        type="button"
        onClick={onExit}
        className="shrink-0 p-1 rounded-md hover:bg-white/20 transition-colors"
        title="Quitter la zone d'étude"
        aria-label="Quitter la zone d'étude"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function LayerBlock({
  layerKey,
  view,
}: {
  layerKey: SigResumeLayerKey;
  view: ParcelleResumeView;
}) {
  const ui = SIG_LAYER_UI[layerKey];
  const layer = view.sig?.layers?.[layerKey];
  const title = layerDisplayName(layerKey, layer);
  const objets = filterSignificantObjets(layer?.objets);

  if (!objets.length) {
    const reason = layerMissingReason(view.sig, layerKey);
    return (
      <div className={`rounded-lg border ${ui.border} ${ui.bg} overflow-hidden`}>
        <div className="flex items-center gap-2 px-2.5 py-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${ui.dot}`} />
          <span className={`text-xs font-semibold ${ui.title}`}>{title}</span>
        </div>
        <p className={`px-2.5 pb-2 text-[11px] italic leading-snug ${ui.empty}`}>{reason}</p>
      </div>
    );
  }

  const rawSurface =
    view.sig?.surface_sig_m2 ?? view.surface_m2 ?? view.sig?.contenance_m2;
  const parcelSurface =
    rawSurface != null && rawSurface > 0 ? rawSurface : undefined;
  const pct = layerPctFromLayer(layer, objets, parcelSurface);

  return (
    <div className={`rounded-lg border ${ui.border} ${ui.bg} overflow-hidden`}>
      <div className="flex items-center justify-between gap-2 px-2.5 py-2 border-b border-black/5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${ui.dot}`} />
          <span className={`text-xs font-semibold ${ui.title} truncate`}>{title}</span>
        </div>
        <span className="text-[10px] font-medium text-gray-600 shrink-0 tabular-nums">
          {formatPct(pct)} parcelle
        </span>
      </div>
      <ul className="p-2 space-y-1">
        {objets.map((obj, idx) => (
          <li
            key={`${layerKey}-${idx}`}
            className="text-[11px] leading-snug text-gray-800 bg-white/80 rounded-md px-2 py-1.5 border border-white/60"
          >
            <LayerObjectLine layerKey={layerKey} obj={obj} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function LayerObjectLine({
  layerKey,
  obj,
}: {
  layerKey: SigResumeLayerKey;
  obj: Record<string, unknown>;
}) {
  const pct = obj.pct_sig as number | undefined;
  const area = obj.surface_inter_m2 as number | undefined;
  const main = formatLayerObjectLabel(layerKey, obj);

  return (
    <span>
      {main}
      {(pct != null || area != null) && (
        <span className="text-gray-500">
          {" "}
          ({[area != null ? formatM2(area) : null, pct != null ? formatPct(pct) : null]
            .filter(Boolean)
            .join(" · ")}
          )
        </span>
      )}
    </span>
  );
}

function ParcelleDetail({
  view,
  defaultOpen,
}: {
  view: ParcelleResumeView;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const idu = view.sig?.idu;
  const contenance = view.sig?.contenance_m2 ?? view.surface_m2 ?? undefined;

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 bg-white hover:bg-gray-50 text-left"
      >
        <div className="min-w-0">
          <div className="text-xs font-semibold text-gray-800">
            {view.section} {view.numero}
          </div>
          {idu ? <div className="text-[10px] text-gray-500 truncate">{idu}</div> : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-gray-500">{formatM2(contenance)}</span>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>
      {open ? (
        <div className="px-2.5 pb-2.5 space-y-2 border-t border-gray-100 bg-white">
          {!view.sig?.layers ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded p-2 mt-2">
              Pas de sig_resume pour cette parcelle.
            </p>
          ) : (
            SIG_RESUME_LAYER_ORDER.map((layerKey) => (
              <LayerBlock key={layerKey} layerKey={layerKey} view={view} />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function ParcelleResumePanel({
  communeSlug = "argeles",
  parcelles,
  cadastre,
  isDraftUf = false,
  studyZoneActive,
  studyZoneLoading,
  studyZoneLabel,
  onEnterStudyZone,
  onExitStudyZone,
  intersectionsReport = null,
  intersectionsLoading = false,
  intersectionsError = null,
  onRecalculateIntersections,
  userId,
  userEmail,
  onPipelineCreated,
}: Props) {
  const [apiResumes, setApiResumes] = useState<Record<string, SigResume>>({});
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const parcellesKey = useMemo(
    () =>
      parcelles
        .map((p) => `${p.section}:${p.numero}`)
        .sort()
        .join("|"),
    [parcelles]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    fetchParcellesResume(communeSlug, parcelles)
      .then((data) => {
        if (!cancelled) setApiResumes(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : "Erreur chargement");
          setApiResumes({});
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [communeSlug, parcellesKey, parcelles]);

  const views = useMemo(
    () => buildParcelleResumeViews(parcelles, cadastre, apiResumes),
    [parcelles, cadastre, apiResumes]
  );

  const allLayersFromCadastre =
    !loading &&
    !!fetchError &&
    views.length > 0 &&
    views.every((v) => v.sig?.layers != null);

  const missingSigAfterFetch = !!fetchError && views.some((v) => !v.sig?.layers);

  const isUf = views.length > 1;
  const ufSurface = useMemo(() => totalUfSurfaceM2(views), [views]);

  const ufAggregates = useMemo(() => {
    if (!isUf) return null;
    return Object.fromEntries(
      SIG_RESUME_LAYER_ORDER.map((key) => [key, aggregateLayerForUf(views, key)])
    ) as Record<SigResumeLayerKey, ReturnType<typeof aggregateLayerForUf>>;
  }, [isUf, views]);

  if (!views.length) {
    return (
      <p className="text-xs text-gray-500">Sélectionnez une ou plusieurs parcelles sur la carte.</p>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <StudyZoneActionButton
        loading={studyZoneLoading}
        active={studyZoneActive}
        onEnter={onEnterStudyZone}
      />

      <ParcelleCuaGenerateAction
        communeSlug={communeSlug}
        parcelles={parcelles}
        userId={userId}
        userEmail={userEmail}
        onPipelineCreated={onPipelineCreated}
      />

      {studyZoneActive ? (
        <StudyZoneModeBanner label={studyZoneLabel} onExit={onExitStudyZone} />
      ) : null}

      {loading ? (
        <p className="text-xs text-gray-500 italic">Chargement des données SIG…</p>
      ) : null}
      {fetchError && missingSigAfterFetch ? (
        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded p-2">
          Impossible de charger les données SIG : {fetchError}
        </p>
      ) : null}
      {allLayersFromCadastre ? (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 leading-snug">
          Données SIG affichées depuis le cadastre (requête API indisponible pour cette sélection).
        </p>
      ) : null}

      <div
        className={`rounded-md px-2.5 py-2 text-xs ${
          isUf
            ? "bg-amber-50 border border-amber-200 text-amber-900"
            : "bg-slate-50 border border-slate-200 text-slate-800"
        }`}
      >
        <div className="font-semibold">
          {isUf
            ? isDraftUf
              ? `Unité foncière en cours (${views.length} parcelles)`
              : `Unité foncière (${views.length} parcelles)`
            : "Parcelle sélectionnée"}
        </div>
        {isUf ? (
          <div className="mt-1 text-[11px] opacity-90">
            Surface indicative totale : {formatM2(ufSurface)}
          </div>
        ) : (
          <div className="mt-1 font-medium">
            {views[0].section} {views[0].numero}
            {views[0].sig?.idu ? (
              <span className="block text-[10px] font-normal text-gray-600 mt-0.5">
                {views[0].sig.idu}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {isUf && ufAggregates ? (
        <section className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Aperçu UF
          </h4>
          {SIG_RESUME_LAYER_ORDER.map((layerKey) => {
            const rows = ufAggregates[layerKey];
            const ui = SIG_LAYER_UI[layerKey];
            const sampleLayer = views.find((v) => v.sig?.layers?.[layerKey])?.sig?.layers?.[layerKey];
            return (
              <div key={layerKey} className={`rounded-lg border ${ui.border} ${ui.bg} p-2`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ui.dot}`} />
                  <span className={`text-xs font-semibold ${ui.title}`}>
                    {layerDisplayName(layerKey, sampleLayer)}
                  </span>
                </div>
                {!rows.length ? (
                  <div className={`text-[11px] italic ${ui.empty}`}>Aucune intersection</div>
                ) : (
                  <ul className="space-y-0.5">
                    {rows.map((row) => (
                      <li
                        key={row.key}
                        className="text-[11px] text-gray-800 flex justify-between gap-2 bg-white/70 rounded px-1.5 py-0.5"
                      >
                        <span className="min-w-0 truncate" title={row.label}>
                          {row.label}
                        </span>
                        <span className="shrink-0 font-medium tabular-nums">{formatPct(row.pct_uf)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      ) : null}

      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {isUf ? "Détail par parcelle" : "Aperçu parcelle"}
        </h4>

        {isUf ? (
          views.map((view, i) => (
            <ParcelleDetail key={`${view.section}-${view.numero}`} view={view} defaultOpen={i === 0} />
          ))
        ) : (
          <div className="space-y-2">
            {!views[0].sig?.layers ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded p-2">
                Aucune donnée SIG pré-calculée pour cette parcelle (colonne sig_resume vide ou couche
                non encore enrichie).
              </p>
            ) : (
              SIG_RESUME_LAYER_ORDER.map((layerKey) => (
                <LayerBlock key={layerKey} layerKey={layerKey} view={views[0]} />
              ))
            )}
            {views[0].sig?.contenance_m2 != null ? (
              <div className="text-[11px] text-gray-500 pt-1">
                Contenance cadastrale : {formatM2(views[0].sig.contenance_m2)}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <FullIntersectionsPanel
        communeSlug={communeSlug}
        report={intersectionsReport}
        loading={intersectionsLoading}
        error={intersectionsError}
        onRecalculate={onRecalculateIntersections}
        scrollIntoViewOnReport
      />
    </div>
  );
}
