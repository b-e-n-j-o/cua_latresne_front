import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { CartoCatalogue, FullIntersectionsReport } from "../../../../types/fullIntersections";
import {
  FAMILY_ACCENT,
  fetchCartoCatalogue,
  groupIntersectionsByFamily,
  objectLabelFromTip,
} from "../../../../utils/argeles/fullIntersections";

type Props = {
  communeSlug: string;
  report: FullIntersectionsReport | null;
  loading: boolean;
  error: string | null;
  onRecalculate?: () => void;
  scrollIntoViewOnReport?: boolean;
};

function formatM2(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} m²`;
}

function formatPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function formatLengthM(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} m`;
}

function PctBar({ pct, accent }: { pct: number; accent: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <div className="h-1.5 flex-1 rounded-full bg-gray-200 overflow-hidden min-w-[48px]">
        <div
          className={`h-full rounded-full ${accent}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-gray-600 shrink-0 w-10 text-right">
        {formatPct(pct)}
      </span>
    </div>
  );
}

function FamilyBlock({
  group,
  defaultOpen,
}: {
  group: ReturnType<typeof groupIntersectionsByFamily>[number];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const accent = FAMILY_ACCENT[group.familyId] ?? FAMILY_ACCENT._other;
  const hitCount = group.layers.filter((l) => l.significantObjets.length > 0).length;

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 bg-gray-50/90 hover:bg-gray-100 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${accent}`} />
          <span className="text-xs font-semibold text-gray-800 truncate">{group.familyTitle}</span>
          <span className="text-[10px] text-gray-500 shrink-0">
            {hitCount}/{group.layers.length}
          </span>
        </div>
        {open ? <ChevronDown size={14} className="shrink-0 text-gray-400" /> : <ChevronRight size={14} className="shrink-0 text-gray-400" />}
      </button>
      {open ? (
        <div className="px-2.5 pb-2.5 pt-1 space-y-2 border-t border-gray-100">
          {group.layers.map((layer) => (
            <div key={layer.layerId} className="rounded border border-gray-100 bg-gray-50/60 p-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-semibold text-gray-700">{layer.title}</span>
                {layer.result.geom_type === "surfacique" && layer.significantObjets.length > 0 ? (
                  <span className="text-[10px] text-gray-500 shrink-0">
                    {formatPct(layer.result.pct_sig)} parcelle
                  </span>
                ) : null}
              </div>
              {!layer.significantObjets.length ? (
                <p className="text-[10px] text-gray-400 italic">Aucune intersection</p>
              ) : (
                <ul className="space-y-1.5">
                  {layer.significantObjets.map((obj, idx) => {
                    const label = objectLabelFromTip(layer.tip, obj);
                    const geom = layer.result.geom_type;
                    return (
                      <li key={`${layer.layerId}-${idx}`} className="space-y-0.5">
                        <div className="flex items-center gap-2 text-[11px] text-gray-800">
                          <span className="min-w-0 flex-1 truncate" title={label}>
                            {label}
                          </span>
                        </div>
                        {geom === "surfacique" && typeof obj.pct_sig === "number" ? (
                          <PctBar pct={obj.pct_sig} accent={accent} />
                        ) : geom === "lineaire" && typeof obj.longueur_inter_m === "number" ? (
                          <span className="text-[10px] text-gray-500">
                            {formatLengthM(obj.longueur_inter_m)} linéaire
                          </span>
                        ) : geom === "ponctuel" ? (
                          <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                            Présent
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function FullIntersectionsPanel({
  communeSlug,
  report,
  loading,
  error,
  onRecalculate,
  scrollIntoViewOnReport = false,
}: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const [catalogue, setCatalogue] = useState<CartoCatalogue | null>(null);
  const lastScrolledAt = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCartoCatalogue(communeSlug)
      .then((data) => {
        if (!cancelled) setCatalogue(data);
      })
      .catch(() => {
        if (!cancelled) setCatalogue(null);
      });
    return () => {
      cancelled = true;
    };
  }, [communeSlug]);

  const layerCount = useMemo(() => {
    if (!catalogue) return 0;
    return Object.entries(catalogue.layers).filter(
      ([id, l]) => id !== "parcelles" && l.src !== "geojson"
    ).length;
  }, [catalogue]);

  const groups = useMemo(() => {
    if (!catalogue || !report) return [];
    return groupIntersectionsByFamily(catalogue, report);
  }, [catalogue, report]);

  useEffect(() => {
    if (!scrollIntoViewOnReport || !report?.computed_at) return;
    if (lastScrolledAt.current === report.computed_at) return;
    lastScrolledAt.current = report.computed_at;
    requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [report, scrollIntoViewOnReport]);

  if (!loading && !report && !error) return null;

  return (
    <section ref={sectionRef} className="space-y-2 pt-1 border-t border-gray-200">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Analyse SIG complète
      </h4>

      {loading && !report ? (
        <div className="flex items-center gap-2 text-[11px] text-gray-600 px-1 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          Analyse des intersections sur l&apos;unité foncière…
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded p-2">{error}</p>
      ) : null}

      {report ? (
        <>
          <div className="rounded-md bg-slate-50 border border-slate-200 px-2.5 py-2 text-[11px] text-slate-800">
            <div className="font-semibold">
              {report.n_couches_concernees ?? 0} / {report.n_couches ?? layerCount} couches concernées
            </div>
            <div className="text-gray-600 mt-0.5">
              Surface SIG : {formatM2(report.surface_m2)}
              <span className="block text-[10px] text-gray-500 mt-0.5">
                Intersections strictes sur l&apos;UF (hors buffer cartographique)
              </span>
              {report.computed_at ? (
                <span className="block text-[10px] text-gray-400 mt-0.5">
                  Calculé le {new Date(report.computed_at).toLocaleString("fr-FR")}
                </span>
              ) : null}
            </div>
          </div>

          {groups.length === 0 ? (
            <p className="text-xs text-gray-500 italic">Aucune intersection significative sur le catalogue.</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-0.5">
              {groups.map((group, i) => (
                <FamilyBlock key={group.familyId} group={group} defaultOpen={i === 0} />
              ))}
            </div>
          )}

          {onRecalculate ? (
            <button
              type="button"
              disabled={loading}
              onClick={onRecalculate}
              className="w-full text-[11px] text-gray-500 hover:text-gray-800 underline disabled:opacity-50"
            >
              {loading ? "Recalcul…" : "Recalculer"}
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
