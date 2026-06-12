import "./ArgelesMapOverlays.css";

export {
  MapLoadingOverlay,
  MapTooltipOverlay,
  HistoryPipelinePopup,
  type HistoryPopupPosition,
  type MapTooltipState,
} from "../../latresne/cua/LatresneMapOverlays";

function ufBannerMessage(selectedCount: number, maxCount: number): string {
  if (selectedCount === 0) return "Cliquer sur une parcelle";
  if (selectedCount === 1) return `1 / ${maxCount}`;
  return `Constituer votre unité foncière : ${selectedCount} parcelles / ${maxCount}`;
}

export function UfBuilderModeBanner({
  ufBuilderMode,
  currentZoom,
  minZoom,
  selectedCount,
  maxCount = 20,
}: {
  ufBuilderMode: boolean;
  currentZoom: number;
  minZoom: number;
  selectedCount: number;
  maxCount?: number;
}) {
  if (!ufBuilderMode || currentZoom < minZoom) return null;

  return (
    <div
      className="argeles-uf-banner absolute bottom-8 left-1/2 -translate-x-1/2 z-40 kerelia-uf-banner px-4 py-2 rounded-lg pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <span className="text-sm font-medium">{ufBannerMessage(selectedCount, maxCount)}</span>
    </div>
  );
}
