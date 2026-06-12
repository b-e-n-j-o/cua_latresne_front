import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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
  layerPctFromObjets,
  totalUfSurfaceM2,
  type ParcelleResumeView,
} from "../../../../utils/argeles/sigResume";
import FullIntersectionsPanel from "./FullIntersectionsPanel";

type Props = {
  communeSlug?: string;
  parcelles: ParcelleResumeRef[];
  cadastre: GeoJSON.FeatureCollection | null;
  /** true = UF en cours de construction sur la carte */
  isDraftUf?: boolean;
};

function formatM2(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} m²`;
}

function formatPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function LayerBlock({
  layerKey,
  view,
}: {
  layerKey: SigResumeLayerKey;
  view: ParcelleResumeView;
}) {
  const layer = view.sig?.layers?.[layerKey];
  const objets = filterSignificantObjets(layer?.objets);
  if (!objets.length) {
    const reason = layerMissingReason(view.sig, layerKey);
    return (
      <div className="text-xs text-gray-400 italic py-0.5 leading-snug">
        <span className="text-gray-600 not-italic font-medium">
          {layerDisplayName(layerKey, layer)}
        </span>
        {" — "}
        {reason}
      </div>
    );
  }

  return (
    <div className="rounded border border-gray-100 bg-gray-50/80 p-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-700">
          {layerDisplayName(layerKey, layer)}
        </span>
        <span className="text-[10px] text-gray-500 shrink-0">
          {formatPct(layerPctFromObjets(objets))} parcelle
        </span>
      </div>
      <ul className="space-y-1">
        {objets.map((obj, idx) => (
          <li
            key={`${layerKey}-${idx}`}
            className="text-[11px] leading-snug text-gray-700 bg-white rounded px-1.5 py-1 border border-gray-100"
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
  const contenance =
    view.sig?.contenance_m2 ?? view.surface_m2 ?? undefined;

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
          {idu ? (
            <div className="text-[10px] text-gray-500 truncate">{idu}</div>
          ) : null}
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
      {loading ? (
        <p className="text-xs text-gray-500 italic">Chargement des données SIG…</p>
      ) : null}
      {fetchError ? (
        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded p-2">
          Impossible de charger sig_resume : {fetchError}
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
            Synthèse UF
          </h4>
          {SIG_RESUME_LAYER_ORDER.map((layerKey) => {
            const rows = ufAggregates[layerKey];
            const sampleLayer = views.find((v) => v.sig?.layers?.[layerKey])?.sig
              ?.layers?.[layerKey];
            return (
              <div
                key={layerKey}
                className="rounded border border-blue-100 bg-blue-50/50 p-2"
              >
                <div className="text-xs font-semibold text-blue-900 mb-1">
                  {layerDisplayName(layerKey, sampleLayer)}
                </div>
                {!rows.length ? (
                  <div className="text-[11px] text-gray-500 italic">Aucune intersection</div>
                ) : (
                  <ul className="space-y-0.5">
                    {rows.map((row) => (
                      <li
                        key={row.key}
                        className="text-[11px] text-blue-950 flex justify-between gap-2"
                      >
                        <span className="min-w-0 truncate" title={row.label}>
                          {row.label}
                        </span>
                        <span className="shrink-0 font-medium">{formatPct(row.pct_uf)}</span>
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
          {isUf ? "Détail par parcelle" : "Couches SIG"}
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
        parcelles={parcelles}
        parcellesKey={parcellesKey}
      />
    </div>
  );
}
