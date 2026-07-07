import { useMemo, useState } from "react";
import { Cloud, Mountain } from "lucide-react";
import { LidarVisualizationEmbed } from "../../../../../components/tools/lidar/LidarVisualizationEmbed";
import { MntVisualizationEmbed } from "../../../../../components/tools/mnt/MntVisualizationEmbed";

export type TerrainParcelleRef = {
  section: string;
  numero: string;
  insee: string;
};

type Props = {
  parcelles: TerrainParcelleRef[];
  unionGeometry?: GeoJSON.Geometry | null;
  className?: string;
};

export default function ParcelleTerrainActions({
  parcelles,
  unionGeometry,
  className = "",
}: Props) {
  const [terrainViz, setTerrainViz] = useState<"mnt" | "lidar" | null>(null);

  const lidarParcelles = useMemo(
    () =>
      parcelles.map((p) => ({
        code_insee: p.insee.trim(),
        section: p.section.trim(),
        numero: p.numero.trim(),
      })),
    [parcelles]
  );

  const mntPrimary = lidarParcelles[0] ?? null;

  if (!parcelles.length) return null;

  return (
    <>
      <div className={`space-y-2 ${className}`.trim()}>
        <div className="text-xs text-slate-500 pt-1 border-t border-slate-100">
          Visualisation 3D
        </div>
        <button
          type="button"
          onClick={() => setTerrainViz("mnt")}
          disabled={!mntPrimary}
          title={
            parcelles.length > 1
              ? "MNT sur la 1re parcelle listée ; pour l'ensemble UF utiliser LiDAR."
              : "Topographie MNT 3D"
          }
          className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white py-2 px-3 rounded text-sm transition-colors"
        >
          <Mountain size={16} />
          <span>Topographie (MNT)</span>
        </button>
        <button
          type="button"
          onClick={() => setTerrainViz("lidar")}
          disabled={lidarParcelles.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 px-3 rounded text-sm transition-colors"
        >
          <Cloud size={16} />
          <span>Nuage LiDAR HD</span>
        </button>
      </div>

      {terrainViz && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-3 sm:p-6"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTerrainViz(null);
          }}
        >
          <div
            className="flex h-[min(88vh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={terrainViz === "mnt" ? "Topographie MNT" : "Nuage LiDAR"}
            onClick={(e) => e.stopPropagation()}
          >
            {terrainViz === "mnt" && mntPrimary && unionGeometry && (
              <MntVisualizationEmbed
                codeInsee={mntPrimary.code_insee}
                section={mntPrimary.section}
                numero={mntPrimary.numero}
                unionGeometry={unionGeometry}
                parcelles={lidarParcelles}
                onClose={() => setTerrainViz(null)}
                className="min-h-0 flex-1"
              />
            )}
            {terrainViz === "lidar" && (
              <LidarVisualizationEmbed
                key={lidarParcelles.map((p) => `${p.section}-${p.numero}`).join("|")}
                parcelles={lidarParcelles}
                onClose={() => setTerrainViz(null)}
                className="min-h-0 flex-1"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
