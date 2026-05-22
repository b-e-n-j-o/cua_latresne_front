import type { MapData, ZoneFeature } from "./types";

export function geometryHasArea(geom: GeoJSON.Geometry | null | undefined): boolean {
  if (!geom) return false;
  if (geom.type === "Polygon" || geom.type === "MultiPolygon") return true;
  if (geom.type === "GeometryCollection") {
    return geom.geometries.some(geometryHasArea);
  }
  return false;
}

export function parcelleHasGeometry(
  parcelle: MapData["parcelle"] | null | undefined,
): boolean {
  if (!parcelle) return false;
  if (parcelle.type === "Feature") return geometryHasArea(parcelle.geometry);
  if (parcelle.type === "FeatureCollection") {
    return parcelle.features.some((f) => geometryHasArea(f.geometry));
  }
  return false;
}

export function collectAllCoordinates(geojson: unknown, coords: number[][]): void {
  if (!geojson) return;
  if (Array.isArray(geojson) && typeof geojson[0] === "number") {
    coords.push(geojson as number[]);
    return;
  }
  if (Array.isArray(geojson)) {
    geojson.forEach((item) => collectAllCoordinates(item, coords));
    return;
  }
  if (typeof geojson === "object" && geojson !== null) {
    const g = geojson as GeoJSON.Geometry | GeoJSON.Feature | GeoJSON.FeatureCollection;
    if ("type" in g && g.type === "Feature") {
      collectAllCoordinates((g as GeoJSON.Feature).geometry, coords);
      return;
    }
    if ("type" in g && g.type === "FeatureCollection") {
      (g as GeoJSON.FeatureCollection).features.forEach((f) =>
        collectAllCoordinates(f.geometry, coords),
      );
      return;
    }
    if ("coordinates" in g && (g as GeoJSON.Geometry).coordinates) {
      collectAllCoordinates((g as GeoJSON.Geometry).coordinates, coords);
    }
    if ("geometries" in g && (g as GeoJSON.GeometryCollection).geometries) {
      (g as GeoJSON.GeometryCollection).geometries.forEach((sub) =>
        collectAllCoordinates(sub, coords),
      );
    }
  }
}

/** Bornes [sw, ne] sans spread (évite stack overflow sur gros jeux de coords). */
export function boundsFromCoordinates(
  coords: number[][],
): [[number, number], [number, number]] | null {
  if (coords.length === 0) return null;
  let minLng = coords[0][0];
  let maxLng = minLng;
  let minLat = coords[0][1];
  let maxLat = minLat;
  for (let i = 1; i < coords.length; i++) {
    const lng = coords[i][0];
    const lat = coords[i][1];
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

export function enrichZoneFeatures(features: ZoneFeature[]): GeoJSON.Feature[] {
  return features
    .filter((f) => geometryHasArea(f.geometry))
    .map((f) => ({
      type: "Feature" as const,
      geometry: f.geometry,
      properties: {
        ...f.properties,
        color: f.properties.color || "#9CA3AF",
      },
    }));
}
