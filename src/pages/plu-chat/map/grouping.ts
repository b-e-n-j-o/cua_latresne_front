import type { InformationsMap, LegendGroup, PrescriptionsMap } from "./types";

export type GroupField = "libelle" | "nom_servitude" | "suptype";

export function featureGroupKey(
  props: Record<string, unknown> | null | undefined,
  field: GroupField,
): string {
  if (field === "nom_servitude") {
    const nom = props?.nom_servitude != null ? String(props.nom_servitude).trim() : "";
    if (nom) return nom;
    const code = props?.suptype != null ? String(props.suptype).trim() : "";
    if (code) return code;
    return "(non renseigné)";
  }
  const raw = props?.[field];
  const s = raw != null ? String(raw).trim() : "";
  return s || "(non renseigné)";
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = s.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h);
}

/** Couleur stable par clé de groupe (même teinte de famille). */
export function colorForGroupKey(key: string, hueBase: number, fallback: string): string {
  if (key === "(non renseigné)") return fallback;
  const offset = hashString(key) % 36;
  const hue = (hueBase + offset) % 360;
  return `hsl(${hue}, 52%, 42%)`;
}

export function buildLegendGroups(
  features: GeoJSON.Feature[],
  field: GroupField,
  hueBase: number,
  fallbackColor: string,
): { groups: LegendGroup[]; colorByKey: Map<string, string> } {
  const counts = new Map<string, number>();
  for (const f of features) {
    const key = featureGroupKey(f.properties as Record<string, unknown>, field);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "fr"),
  );

  const colorByKey = new Map<string, string>();
  const groups: LegendGroup[] = sorted.map(([key, count]) => {
    const color = colorForGroupKey(key, hueBase, fallbackColor);
    colorByKey.set(key, color);
    return { key, label: key, color, count };
  });

  return { groups, colorByKey };
}

export function collectPrescriptionFeatures(
  presc: PrescriptionsMap | undefined,
): GeoJSON.Feature[] {
  if (!presc) return [];
  return [
    ...(presc.surfaciques?.features ?? []),
    ...(presc.lineaires?.features ?? []),
    ...(presc.ponctuelles?.features ?? []),
  ];
}

export function collectInformationFeatures(
  infos: InformationsMap | undefined,
): GeoJSON.Feature[] {
  if (!infos) return [];
  return [
    ...(infos.surfaciques?.features ?? []),
    ...(infos.lineaires?.features ?? []),
    ...(infos.ponctuelles?.features ?? []),
  ];
}

export function filterFeaturesByGroup<T extends GeoJSON.Geometry>(
  features: GeoJSON.Feature<T>[],
  visible: Set<string>,
  field: GroupField,
  colorByKey: Map<string, string>,
  fallbackColor: string,
): GeoJSON.Feature<T>[] {
  return features
    .filter((f) =>
      visible.has(featureGroupKey(f.properties as Record<string, unknown>, field)),
    )
    .map((f) => {
      const key = featureGroupKey(f.properties as Record<string, unknown>, field);
      const color = colorByKey.get(key) ?? fallbackColor;
      return {
        ...f,
        properties: {
          ...(f.properties as object),
          color,
          groupKey: key,
        },
      } as GeoJSON.Feature<T>;
    });
}
