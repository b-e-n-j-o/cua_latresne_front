import type { CSSProperties } from "react";
import HistoryPipelineCard, { type HistoryPipeline } from "../../components/tools/carto/HistoryPipelineCard";

export type MapTooltipState = { x: number; y: number; content: string } | null;

export function MapTooltipOverlay({ tooltip }: { tooltip: MapTooltipState }) {
  if (!tooltip) return null;

  return (
    <div
      className="absolute z-50 bg-black text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-pre-line"
      style={{
        left: `${tooltip.x}px`,
        top: `${tooltip.y}px`,
        transform: "translate(-50%, -100%)",
        marginTop: "-8px",
      }}
    >
      {tooltip.content}
    </div>
  );
}

export function MapLoadingOverlay({ isLoadingCadastre }: { isLoadingCadastre: boolean }) {
  if (!isLoadingCadastre) return null;

  return (
    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4" />
        <p className="text-sm text-gray-600">Chargement du cadastre...</p>
      </div>
    </div>
  );
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
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-40 bg-amber-600 text-white px-4 py-2 rounded-lg shadow-lg pointer-events-none">
      <span className="text-sm font-medium">
        Mode UF actif - Cliquez sur les parcelles ({selectedCount}/{maxCount})
      </span>
    </div>
  );
}

export type HistoryPopupPosition = { x: number; y: number; placement: "above" | "below" } | null;

const POPUP_GAP = 14;

export function HistoryPipelinePopup({
  selectedHistoryPipeline,
  historyPopupPosition,
  onClose,
}: {
  selectedHistoryPipeline: HistoryPipeline | null;
  historyPopupPosition: HistoryPopupPosition;
  onClose: () => void;
}) {
  if (!selectedHistoryPipeline || !historyPopupPosition) return null;

  return (
    <div className="absolute z-50 pointer-events-auto" style={getPopupStyle(historyPopupPosition)}>
      <div className="relative">
        {historyPopupPosition.placement === "below" && (
          <div
            className="absolute left-1/2 -top-2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[12px] border-b-white"
            style={{ filter: "drop-shadow(0 -1px 2px rgba(0,0,0,0.1))" }}
          />
        )}

        <HistoryPipelineCard
          pipeline={selectedHistoryPipeline}
          onClose={onClose}
          embedded={false}
          mapPopup
        />

        {historyPopupPosition.placement === "above" && (
          <div
            className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[12px] border-t-white"
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))" }}
          />
        )}
      </div>
    </div>
  );
}

function getPopupStyle(historyPopupPosition: NonNullable<HistoryPopupPosition>): CSSProperties {
  return historyPopupPosition.placement === "above"
    ? {
        left: historyPopupPosition.x,
        top: historyPopupPosition.y,
        transform: "translate(-50%, calc(-100% - 14px))",
      }
    : {
        left: historyPopupPosition.x,
        top: historyPopupPosition.y + POPUP_GAP,
        transform: "translate(-50%, 0)",
      };
}

