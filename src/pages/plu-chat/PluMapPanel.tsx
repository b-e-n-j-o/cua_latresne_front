import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./PluMapPanel.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ZoneFeature = {
  type: "Feature";
  geometry: GeoJSON.Geometry;
  properties: {
    code_zone:             string;
    libelle:               string | null;
    libelong:              string | null;
    typezone:              string | null;
    pct_parcelle_couverte: number | null;
    color:                 string;
  };
};

type ParcelleProperties = {
  section?:           string | null;
  numero?:            string | null;
  idu?:               string | null;
  contenance?:        number | null;
  label?:             string | null;
  nb_parcelles?:      number;
  contenance_totale?: number | null;
  superficie_m2?:     number | null;
  parcelles?:         unknown[];
};

type ParcelleFeature = GeoJSON.Feature<GeoJSON.Geometry, ParcelleProperties>;

type PrescriptionProperties = {
  gml_id?:    string | null;
  libelle?:   string | null;
  typepsc?:   string | null;
  stypepsc?:  string | null;
  kind?:      string | null;
  color?:     string;
  label?:     string | null;
};

type PrescriptionFeature = GeoJSON.Feature<GeoJSON.Geometry, PrescriptionProperties>;

export type PrescriptionsMap = {
  surfaciques?:  GeoJSON.FeatureCollection<GeoJSON.Geometry, PrescriptionProperties>;
  lineaires?:    GeoJSON.FeatureCollection<GeoJSON.Geometry, PrescriptionProperties>;
  ponctuelles?:  GeoJSON.FeatureCollection<GeoJSON.Geometry, PrescriptionProperties>;
};

type InformationProperties = {
  gml_id?:    string | null;
  libelle?:   string | null;
  typeinf?:   string | null;
  stypeinf?:  string | null;
  kind?:      string | null;
  color?:     string;
  label?:     string | null;
};

export type InformationsMap = {
  surfaciques?:  GeoJSON.FeatureCollection<GeoJSON.Geometry, InformationProperties>;
  lineaires?:    GeoJSON.FeatureCollection<GeoJSON.Geometry, InformationProperties>;
  ponctuelles?:  GeoJSON.FeatureCollection<GeoJSON.Geometry, InformationProperties>;
};

type ServitudeProperties = {
  gid?:         number | null;
  idass?:       string | null;
  nomass?:      string | null;
  suptype?:     string | null;
  typeass?:     string | null;
  nomsuplitt?:  string | null;
  nomreg?:      string | null;
  color?:       string;
  label?:       string | null;
};

export type MapData = {
  /** Une feuille = Feature ; unité foncière = FeatureCollection (contours distincts). */
  parcelle:       ParcelleFeature | GeoJSON.FeatureCollection<GeoJSON.Geometry, ParcelleProperties>;
  /** Enveloppe fusionnée (remplissage léger), présente si plusieurs parcelles. */
  parcelle_union?: ParcelleFeature | null;
  zones:          { type: "FeatureCollection"; features: ZoneFeature[] };
  /** Prescriptions intersectant l'unité foncière (affichées si non vides). */
  prescriptions?: PrescriptionsMap;
  /** Assiettes surfaciques de servitudes SUP (sup_assiette_s). */
  servitudes?: GeoJSON.FeatureCollection<GeoJSON.Geometry, ServitudeProperties>;
  /** Informations GPU (infos_surf / infos_lin / infos_pct). */
  informations?: InformationsMap;
};

type Props = {
  sessionId:  string | null;
  mapData:    MapData | null;          // données déjà chargées (push depuis chat)
  apiBase:    string;
  isVisible:  boolean;
  onClose:    () => void;
};

// ---------------------------------------------------------------------------
// Couleurs fixes pour la cohérence avec le backend
// ---------------------------------------------------------------------------
const PARCELLE_OUTLINE      = "#FFD600";
const PARCELLE_FILL         = "rgba(255, 214, 0, 0.12)";
const PARCELLE_UNION_FILL   = "rgba(255, 214, 0, 0.05)";
const PARCELLE_LABEL_COLOR  = "#FFD600";
const MAP_BUFFER_M          = 100;
const ZONE_FILL_OPACITY     = 0.48;

const PRESCRIPTION_SURF_COLOR   = "#9D4EDD";
const PRESCRIPTION_LINE_COLOR   = "#E63946";
const PRESCRIPTION_POINT_COLOR  = "#FFBE0B";
const PRESCRIPTION_SURF_OPACITY = 0.4;
const SERVITUDES_COLOR          = "#457B9D";
const SERVITUDES_FILL_OPACITY   = 0.35;
const INFO_SURF_COLOR           = "#2A9D8F";
const INFO_LINE_COLOR           = "#1D3557";
const INFO_POINT_COLOR          = "#F4A261";
const INFO_SURF_OPACITY         = 0.38;

const LAYER_IDS = [
  "plu-zones-fill",
  "plu-zones-outline",
  "plu-zones-label",
  "prescriptions-surf-fill",
  "prescriptions-surf-outline",
  "prescriptions-line",
  "prescriptions-point",
  "servitudes-fill",
  "servitudes-outline",
  "informations-surf-fill",
  "informations-surf-outline",
  "informations-line",
  "informations-point",
  "parcelle-union-fill",
  "parcelle-fill",
  "parcelle-outline",
  "parcelle-label",
] as const;

const SOURCE_IDS = [
  "plu-zones",
  "prescriptions-surf",
  "prescriptions-line",
  "prescriptions-point",
  "servitudes",
  "informations-surf",
  "informations-line",
  "informations-point",
  "parcelle-union",
  "parcelle",
] as const;

function parcelleHasGeometry(
  parcelle: MapData["parcelle"] | null | undefined,
): boolean {
  if (!parcelle) return false;
  if (parcelle.type === "Feature") {
    return geometryHasArea(parcelle.geometry);
  }
  if (parcelle.type === "FeatureCollection") {
    return parcelle.features.some((f) => geometryHasArea(f.geometry));
  }
  return false;
}

function collectAllCoordinates(geojson: unknown, coords: number[][]): void {
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

function geometryHasArea(geom: GeoJSON.Geometry | null | undefined): boolean {
  if (!geom) return false;
  if (geom.type === "Polygon" || geom.type === "MultiPolygon") {
    return true;
  }
  if (geom.type === "GeometryCollection") {
    return geom.geometries.some(geometryHasArea);
  }
  return false;
}

/** MapLibre attend des propriétés plates ; on force la couleur pour le style data-driven. */
function enrichZoneFeatures(features: ZoneFeature[]): GeoJSON.Feature[] {
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

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export default function PluMapPanel({ sessionId, mapData: propMapData, apiBase, isVisible, onClose }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<maplibregl.Map | null>(null);
  const popupRef        = useRef<maplibregl.Popup | null>(null);
  const zoneHandlersRef = useRef<{
    onZoneClick?: (e: maplibregl.MapLayerMouseEvent) => void;
    onEnter?: () => void;
    onLeave?: () => void;
  }>({});
  const parcelHandlersRef = useRef<{
    onParcelClick?: (e: maplibregl.MapLayerMouseEvent) => void;
    onEnter?: () => void;
    onLeave?: () => void;
  }>({});
  const prescHandlersRef = useRef<{
    onClick?: (e: maplibregl.MapLayerMouseEvent) => void;
    onEnter?: () => void;
    onLeave?: () => void;
    layers?: string[];
  }>({});
  const servHandlersRef = useRef<{
    onClick?: (e: maplibregl.MapLayerMouseEvent) => void;
    onEnter?: () => void;
    onLeave?: () => void;
  }>({});
  const infoHandlersRef = useRef<{
    onClick?: (e: maplibregl.MapLayerMouseEvent) => void;
    onEnter?: () => void;
    onLeave?: () => void;
    layers?: string[];
  }>({});

  const [mapData, setMapData]   = useState<MapData | null>(propMapData);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [visibleZones, setVisibleZones] = useState<Set<string>>(new Set());

  // Sync données depuis prop (PluChat charge via GET /session/{id}/map)
  useEffect(() => {
    if (propMapData) {
      setMapData(propMapData);
      setError(null);
    }
  }, [propMapData]);

  // Fetch depuis l'API si on a un sessionId mais pas encore de données
  const fetchMapData = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBase}/api/plu/argeles/session/${sessionId}/map?buffer_m=${MAP_BUFFER_M}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MapData = await res.json();
      setMapData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [sessionId, apiBase]);

  useEffect(() => {
    if (isVisible && sessionId) {
      void fetchMapData();
    }
  }, [isVisible, sessionId, fetchMapData]);

  // Init zones visibles depuis les données
  useEffect(() => {
    if (!mapData) return;
    const codes = new Set(mapData.zones.features.map((f) => f.properties.code_zone));
    setVisibleZones(codes);
  }, [mapData]);

  // ---------------------------------------------------------------------------
  // Init MapLibre
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isVisible || !mapContainerRef.current) return;
    if (mapRef.current) return; // déjà initialisée

    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          "esri-satellite": {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            attribution: "© Esri, Maxar, Earthstar Geographics",
          },
        },
        layers: [{ id: "background", type: "raster", source: "esri-satellite" }],
      },
      center: [3.027, 42.547],
      zoom: 14,
    });

    mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");

    mapRef.current.on("load", () => {
      // Les sources/couches sont ajoutées via updateMapLayers
    });

    return () => {
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [isVisible]);

  // ---------------------------------------------------------------------------
  // Mise à jour des couches quand mapData ou visibleZones changent
  // ---------------------------------------------------------------------------
  const updateMapLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapData || !map.isStyleLoaded()) return;

    const h = zoneHandlersRef.current;
    if (h.onZoneClick) map.off("click", "plu-zones-fill", h.onZoneClick);
    if (h.onEnter) map.off("mouseenter", "plu-zones-fill", h.onEnter);
    if (h.onLeave) map.off("mouseleave", "plu-zones-fill", h.onLeave);

    const ph = parcelHandlersRef.current;
    if (ph.onParcelClick) map.off("click", "parcelle-outline", ph.onParcelClick);
    if (ph.onEnter) map.off("mouseenter", "parcelle-outline", ph.onEnter);
    if (ph.onLeave) map.off("mouseleave", "parcelle-outline", ph.onLeave);

    const prh = prescHandlersRef.current;
    if (prh.onClick && prh.layers) {
      for (const lid of prh.layers) {
        map.off("click", lid, prh.onClick);
        map.off("mouseenter", lid, prh.onEnter!);
        map.off("mouseleave", lid, prh.onLeave!);
      }
    }

    const srh = servHandlersRef.current;
    if (srh.onClick) map.off("click", "servitudes-fill", srh.onClick);
    if (srh.onEnter) map.off("mouseenter", "servitudes-fill", srh.onEnter);
    if (srh.onLeave) map.off("mouseleave", "servitudes-fill", srh.onLeave);

    const irh = infoHandlersRef.current;
    if (irh.onClick && irh.layers) {
      for (const lid of irh.layers) {
        map.off("click", lid, irh.onClick);
        map.off("mouseenter", lid, irh.onEnter!);
        map.off("mouseleave", lid, irh.onLeave!);
      }
    }

    LAYER_IDS.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    SOURCE_IDS.forEach((id) => {
      if (map.getSource(id)) map.removeSource(id);
    });

    const visibleFeatures = enrichZoneFeatures(
      mapData.zones.features.filter((f) => visibleZones.has(f.properties.code_zone)),
    );

    if (visibleFeatures.length > 0) {
      map.addSource("plu-zones", {
        type: "geojson",
        data: { type: "FeatureCollection", features: visibleFeatures },
      });

      map.addLayer({
        id: "plu-zones-fill",
        type: "fill",
        source: "plu-zones",
        paint: {
          "fill-color": ["coalesce", ["get", "color"], "#9CA3AF"],
          "fill-opacity": ZONE_FILL_OPACITY,
        },
      });

      map.addLayer({
        id: "plu-zones-outline",
        type: "line",
        source: "plu-zones",
        paint: {
          "line-color": ["coalesce", ["get", "color"], "#9CA3AF"],
          "line-width": 2,
          "line-opacity": 0.9,
        },
      });

      map.addLayer({
        id: "plu-zones-label",
        type: "symbol",
        source: "plu-zones",
        layout: {
          "text-field": ["get", "code_zone"],
          "text-size": 12,
          "text-anchor": "center",
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#000000",
          "text-halo-width": 1.5,
        },
      });

      const onZoneClick = (e: maplibregl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f?.properties) return;
        const p = f.properties as ZoneFeature["properties"];
        const color = typeof p.color === "string" ? p.color : "#9CA3AF";
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "260px" })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="plu-map-popup">
              <div class="plu-map-popup__zone" style="background:${color}">${p.code_zone}</div>
              <div class="plu-map-popup__title">${p.libelong ?? p.libelle ?? p.code_zone}</div>
              ${p.pct_parcelle_couverte != null
                ? `<div class="plu-map-popup__pct">${p.pct_parcelle_couverte} % de la parcelle</div>`
                : ""}
              ${p.typezone ? `<div class="plu-map-popup__type">Type : ${p.typezone}</div>` : ""}
            </div>
          `)
          .addTo(map);
      };
      const onEnter = () => { map.getCanvas().style.cursor = "pointer"; };
      const onLeave = () => { map.getCanvas().style.cursor = ""; };

      zoneHandlersRef.current = { onZoneClick, onEnter, onLeave };
      map.on("click", "plu-zones-fill", onZoneClick);
      map.on("mouseenter", "plu-zones-fill", onEnter);
      map.on("mouseleave", "plu-zones-fill", onLeave);
    }

    const presc = mapData.prescriptions;
    const surfFc = presc?.surfaciques?.features ?? [];
    const linFc = presc?.lineaires?.features ?? [];
    const pctFc = presc?.ponctuelles?.features ?? [];

    if (surfFc.length > 0) {
      map.addSource("prescriptions-surf", {
        type: "geojson",
        data: presc!.surfaciques!,
      });
      map.addLayer({
        id: "prescriptions-surf-fill",
        type: "fill",
        source: "prescriptions-surf",
        paint: {
          "fill-color": ["coalesce", ["get", "color"], PRESCRIPTION_SURF_COLOR],
          "fill-opacity": PRESCRIPTION_SURF_OPACITY,
        },
      });
      map.addLayer({
        id: "prescriptions-surf-outline",
        type: "line",
        source: "prescriptions-surf",
        paint: {
          "line-color": ["coalesce", ["get", "color"], PRESCRIPTION_SURF_COLOR],
          "line-width": 2,
        },
      });
    }

    if (linFc.length > 0) {
      map.addSource("prescriptions-line", {
        type: "geojson",
        data: presc!.lineaires!,
      });
      map.addLayer({
        id: "prescriptions-line",
        type: "line",
        source: "prescriptions-line",
        paint: {
          "line-color": ["coalesce", ["get", "color"], PRESCRIPTION_LINE_COLOR],
          "line-width": 3,
        },
      });
    }

    if (pctFc.length > 0) {
      map.addSource("prescriptions-point", {
        type: "geojson",
        data: presc!.ponctuelles!,
      });
      map.addLayer({
        id: "prescriptions-point",
        type: "circle",
        source: "prescriptions-point",
        paint: {
          "circle-color": ["coalesce", ["get", "color"], PRESCRIPTION_POINT_COLOR],
          "circle-radius": 7,
          "circle-stroke-color": "#1a1a1a",
          "circle-stroke-width": 1,
        },
      });
    }

    const prescClickLayers = [
      ...(surfFc.length ? ["prescriptions-surf-fill"] : []),
      ...(linFc.length ? ["prescriptions-line"] : []),
      ...(pctFc.length ? ["prescriptions-point"] : []),
    ];
    if (prescClickLayers.length > 0) {
      const onPrescClick = (e: maplibregl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f?.properties) return;
        const p = f.properties as PrescriptionProperties;
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "280px" })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="plu-map-popup">
              <div class="plu-map-popup__title">${p.libelle ?? p.label ?? "Prescription"}</div>
              ${p.typepsc ? `<div class="plu-map-popup__type">Type : ${p.typepsc}${p.stypepsc ? ` / ${p.stypepsc}` : ""}</div>` : ""}
              ${p.kind ? `<div class="plu-map-popup__pct">Nature : ${p.kind}</div>` : ""}
            </div>
          `)
          .addTo(map);
      };
      const onPrescEnter = () => { map.getCanvas().style.cursor = "pointer"; };
      const onPrescLeave = () => { map.getCanvas().style.cursor = ""; };
      prescHandlersRef.current = {
        onClick: onPrescClick,
        onEnter: onPrescEnter,
        onLeave: onPrescLeave,
        layers: prescClickLayers,
      };
      for (const lid of prescClickLayers) {
        map.on("click", lid, onPrescClick);
        map.on("mouseenter", lid, onPrescEnter);
        map.on("mouseleave", lid, onPrescLeave);
      }
    }

    const servFc = mapData.servitudes?.features ?? [];
    if (servFc.length > 0) {
      map.addSource("servitudes", {
        type: "geojson",
        data: mapData.servitudes!,
      });
      map.addLayer({
        id: "servitudes-fill",
        type: "fill",
        source: "servitudes",
        paint: {
          "fill-color": ["coalesce", ["get", "color"], SERVITUDES_COLOR],
          "fill-opacity": SERVITUDES_FILL_OPACITY,
        },
      });
      map.addLayer({
        id: "servitudes-outline",
        type: "line",
        source: "servitudes",
        paint: {
          "line-color": ["coalesce", ["get", "color"], SERVITUDES_COLOR],
          "line-width": 2,
          "line-dasharray": [2, 1],
        },
      });

      const onServClick = (e: maplibregl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f?.properties) return;
        const p = f.properties as ServitudeProperties;
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "300px" })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="plu-map-popup">
              <div class="plu-map-popup__title">${p.suptype ?? p.label ?? "Servitude"}</div>
              ${p.typeass ? `<div class="plu-map-popup__type">${p.typeass}</div>` : ""}
              ${p.nomsuplitt ? `<div class="plu-map-popup__pct">${p.nomsuplitt}</div>` : ""}
              ${p.nomass ? `<div class="plu-map-popup__type">Assiette : ${p.nomass}</div>` : ""}
            </div>
          `)
          .addTo(map);
      };
      const onServEnter = () => { map.getCanvas().style.cursor = "pointer"; };
      const onServLeave = () => { map.getCanvas().style.cursor = ""; };
      servHandlersRef.current = { onClick: onServClick, onEnter: onServEnter, onLeave: onServLeave };
      map.on("click", "servitudes-fill", onServClick);
      map.on("mouseenter", "servitudes-fill", onServEnter);
      map.on("mouseleave", "servitudes-fill", onServLeave);
    }

    const infos = mapData.informations;
    const infoSurfFc = infos?.surfaciques?.features ?? [];
    const infoLinFc = infos?.lineaires?.features ?? [];
    const infoPctFc = infos?.ponctuelles?.features ?? [];

    if (infoSurfFc.length > 0) {
      map.addSource("informations-surf", {
        type: "geojson",
        data: infos!.surfaciques!,
      });
      map.addLayer({
        id: "informations-surf-fill",
        type: "fill",
        source: "informations-surf",
        paint: {
          "fill-color": ["coalesce", ["get", "color"], INFO_SURF_COLOR],
          "fill-opacity": INFO_SURF_OPACITY,
        },
      });
      map.addLayer({
        id: "informations-surf-outline",
        type: "line",
        source: "informations-surf",
        paint: {
          "line-color": ["coalesce", ["get", "color"], INFO_SURF_COLOR],
          "line-width": 2,
        },
      });
    }

    if (infoLinFc.length > 0) {
      map.addSource("informations-line", {
        type: "geojson",
        data: infos!.lineaires!,
      });
      map.addLayer({
        id: "informations-line",
        type: "line",
        source: "informations-line",
        paint: {
          "line-color": ["coalesce", ["get", "color"], INFO_LINE_COLOR],
          "line-width": 3,
        },
      });
    }

    if (infoPctFc.length > 0) {
      map.addSource("informations-point", {
        type: "geojson",
        data: infos!.ponctuelles!,
      });
      map.addLayer({
        id: "informations-point",
        type: "circle",
        source: "informations-point",
        paint: {
          "circle-color": ["coalesce", ["get", "color"], INFO_POINT_COLOR],
          "circle-radius": 7,
          "circle-stroke-color": "#1a1a1a",
          "circle-stroke-width": 1,
        },
      });
    }

    const infoClickLayers = [
      ...(infoSurfFc.length ? ["informations-surf-fill"] : []),
      ...(infoLinFc.length ? ["informations-line"] : []),
      ...(infoPctFc.length ? ["informations-point"] : []),
    ];
    if (infoClickLayers.length > 0) {
      const onInfoClick = (e: maplibregl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f?.properties) return;
        const p = f.properties as InformationProperties;
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "280px" })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="plu-map-popup">
              <div class="plu-map-popup__title">${p.libelle ?? p.label ?? "Information"}</div>
              ${p.typeinf ? `<div class="plu-map-popup__type">Type : ${p.typeinf}${p.stypeinf ? ` / ${p.stypeinf}` : ""}</div>` : ""}
              ${p.kind ? `<div class="plu-map-popup__pct">Nature : ${p.kind}</div>` : ""}
            </div>
          `)
          .addTo(map);
      };
      const onInfoEnter = () => { map.getCanvas().style.cursor = "pointer"; };
      const onInfoLeave = () => { map.getCanvas().style.cursor = ""; };
      infoHandlersRef.current = {
        onClick: onInfoClick,
        onEnter: onInfoEnter,
        onLeave: onInfoLeave,
        layers: infoClickLayers,
      };
      for (const lid of infoClickLayers) {
        map.on("click", lid, onInfoClick);
        map.on("mouseenter", lid, onInfoEnter);
        map.on("mouseleave", lid, onInfoLeave);
      }
    }

    if (mapData.parcelle_union?.geometry && geometryHasArea(mapData.parcelle_union.geometry)) {
      map.addSource("parcelle-union", {
        type: "geojson",
        data: mapData.parcelle_union,
      });
      map.addLayer({
        id: "parcelle-union-fill",
        type: "fill",
        source: "parcelle-union",
        paint: { "fill-color": PARCELLE_UNION_FILL },
      });
    }

    if (parcelleHasGeometry(mapData.parcelle)) {
      map.addSource("parcelle", {
        type: "geojson",
        data: mapData.parcelle,
      });

      map.addLayer({
        id: "parcelle-fill",
        type: "fill",
        source: "parcelle",
        paint: { "fill-color": PARCELLE_FILL },
      });

      map.addLayer({
        id: "parcelle-outline",
        type: "line",
        source: "parcelle",
        paint: {
          "line-color": PARCELLE_OUTLINE,
          "line-width": 2.5,
        },
      });

      const isMulti =
        mapData.parcelle.type === "FeatureCollection" &&
        mapData.parcelle.features.length > 1;

      if (isMulti) {
        map.addLayer({
          id: "parcelle-label",
          type: "symbol",
          source: "parcelle",
          layout: {
            "text-field": ["coalesce", ["get", "label"], ""],
            "text-size": 11,
            "text-anchor": "center",
          },
          paint: {
            "text-color": PARCELLE_LABEL_COLOR,
            "text-halo-color": "#000000",
            "text-halo-width": 1.2,
          },
        });
      }

      const onParcelClick = (e: maplibregl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f?.properties) return;
        const p = f.properties as ParcelleProperties;
        popupRef.current?.remove();
        const label = p.label ?? (p.section && p.numero ? `${p.section} ${p.numero}` : p.idu);
        popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "220px" })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="plu-map-popup">
              <div class="plu-map-popup__title">Parcelle ${label ?? ""}</div>
              ${p.contenance != null ? `<div class="plu-map-popup__pct">Contenance : ${p.contenance} m²</div>` : ""}
              ${p.idu ? `<div class="plu-map-popup__type">IDU : ${p.idu}</div>` : ""}
            </div>
          `)
          .addTo(map);
      };
      const onParcelEnter = () => { map.getCanvas().style.cursor = "pointer"; };
      const onParcelLeave = () => { map.getCanvas().style.cursor = ""; };

      parcelHandlersRef.current = {
        onParcelClick,
        onEnter: onParcelEnter,
        onLeave: onParcelLeave,
      };
      map.on("click", "parcelle-outline", onParcelClick);
      map.on("mouseenter", "parcelle-outline", onParcelEnter);
      map.on("mouseleave", "parcelle-outline", onParcelLeave);
    }

    const coords: number[][] = [];
    collectAllCoordinates(mapData.parcelle, coords);
    if (mapData.parcelle_union) collectAllCoordinates(mapData.parcelle_union, coords);
    visibleFeatures.forEach((f) => collectAllCoordinates(f.geometry, coords));
    surfFc.forEach((f) => collectAllCoordinates(f.geometry, coords));
    linFc.forEach((f) => collectAllCoordinates(f.geometry, coords));
    pctFc.forEach((f) => collectAllCoordinates(f.geometry, coords));
    servFc.forEach((f) => collectAllCoordinates(f.geometry, coords));
    infoSurfFc.forEach((f) => collectAllCoordinates(f.geometry, coords));
    infoLinFc.forEach((f) => collectAllCoordinates(f.geometry, coords));
    infoPctFc.forEach((f) => collectAllCoordinates(f.geometry, coords));

    if (coords.length > 0) {
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 48, maxZoom: 18, duration: 800 },
      );
    }

    map.triggerRepaint();
  }, [mapData, visibleZones]);

  // Déclencher updateMapLayers quand la carte est prête ou quand les données arrivent
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      updateMapLayers();
    } else {
      map.once("load", updateMapLayers);
    }
  }, [updateMapLayers]);

  // Redimensionner MapLibre quand le panneau devient visible ou change de taille
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isVisible) return;

    const resize = () => map.resize();
    const t = window.setTimeout(resize, 320);

    const ro = new ResizeObserver(() => resize());
    if (mapContainerRef.current) ro.observe(mapContainerRef.current);

    return () => {
      window.clearTimeout(t);
      ro.disconnect();
    };
  }, [isVisible, mapData]);

  // ---------------------------------------------------------------------------
  // Toggle d'une zone dans la légende
  // ---------------------------------------------------------------------------
  const toggleZone = (code: string) => {
    setVisibleZones((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const zones = mapData?.zones.features ?? [];
  const prescCounts = {
    surf: mapData?.prescriptions?.surfaciques?.features?.length ?? 0,
    lin: mapData?.prescriptions?.lineaires?.features?.length ?? 0,
    pct: mapData?.prescriptions?.ponctuelles?.features?.length ?? 0,
  };
  const hasPresc = prescCounts.surf + prescCounts.lin + prescCounts.pct > 0;
  const servCount = mapData?.servitudes?.features?.length ?? 0;
  const infoCounts = {
    surf: mapData?.informations?.surfaciques?.features?.length ?? 0,
    lin: mapData?.informations?.lineaires?.features?.length ?? 0,
    pct: mapData?.informations?.ponctuelles?.features?.length ?? 0,
  };
  const hasInfo = infoCounts.surf + infoCounts.lin + infoCounts.pct > 0;

  return (
    <aside className={`plu-map-panel${isVisible ? " plu-map-panel--visible" : ""}`}>
      {/* Header */}
      <div className="plu-map-panel__header">
        <span className="plu-map-panel__title">Carte PLU</span>
        <button
          type="button"
          className="plu-map-panel__close"
          onClick={onClose}
          aria-label="Fermer la carte"
        >
          ✕
        </button>
      </div>

      {/* Légende servitudes */}
      {servCount > 0 && (
        <div className="plu-map-panel__legend plu-map-panel__legend--presc">
          <div className="plu-map-panel__legend-title">Servitudes</div>
          <div className="plu-map-panel__legend-item plu-map-panel__legend-item--static">
            <span className="plu-map-panel__legend-dot" style={{ background: SERVITUDES_COLOR }} />
            <span>Assiettes surfaciques ({servCount})</span>
          </div>
        </div>
      )}

      {/* Légende informations */}
      {hasInfo && (
        <div className="plu-map-panel__legend plu-map-panel__legend--presc">
          <div className="plu-map-panel__legend-title">Informations</div>
          {infoCounts.surf > 0 && (
            <div className="plu-map-panel__legend-item plu-map-panel__legend-item--static">
              <span className="plu-map-panel__legend-dot" style={{ background: INFO_SURF_COLOR }} />
              <span>Surfaciques ({infoCounts.surf})</span>
            </div>
          )}
          {infoCounts.lin > 0 && (
            <div className="plu-map-panel__legend-item plu-map-panel__legend-item--static">
              <span
                className="plu-map-panel__legend-line"
                style={{ background: INFO_LINE_COLOR }}
              />
              <span>Linéaires ({infoCounts.lin})</span>
            </div>
          )}
          {infoCounts.pct > 0 && (
            <div className="plu-map-panel__legend-item plu-map-panel__legend-item--static">
              <span className="plu-map-panel__legend-dot" style={{ background: INFO_POINT_COLOR }} />
              <span>Ponctuelles ({infoCounts.pct})</span>
            </div>
          )}
        </div>
      )}

      {/* Légende prescriptions */}
      {hasPresc && (
        <div className="plu-map-panel__legend plu-map-panel__legend--presc">
          <div className="plu-map-panel__legend-title">Prescriptions</div>
          {prescCounts.surf > 0 && (
            <div className="plu-map-panel__legend-item plu-map-panel__legend-item--static">
              <span className="plu-map-panel__legend-dot" style={{ background: PRESCRIPTION_SURF_COLOR }} />
              <span>Surfaciques ({prescCounts.surf})</span>
            </div>
          )}
          {prescCounts.lin > 0 && (
            <div className="plu-map-panel__legend-item plu-map-panel__legend-item--static">
              <span
                className="plu-map-panel__legend-line"
                style={{ background: PRESCRIPTION_LINE_COLOR }}
              />
              <span>Linéaires ({prescCounts.lin})</span>
            </div>
          )}
          {prescCounts.pct > 0 && (
            <div className="plu-map-panel__legend-item plu-map-panel__legend-item--static">
              <span className="plu-map-panel__legend-dot" style={{ background: PRESCRIPTION_POINT_COLOR }} />
              <span>Ponctuelles ({prescCounts.pct})</span>
            </div>
          )}
        </div>
      )}

      {/* Légende / toggle zones */}
      {zones.length > 0 && (
        <div className="plu-map-panel__legend">
          <div className="plu-map-panel__legend-title">Zonage PLU</div>
          {zones.map((f) => {
            const p  = f.properties;
            const on = visibleZones.has(p.code_zone);
            return (
              <button
                key={p.code_zone}
                type="button"
                className={`plu-map-panel__legend-item${on ? "" : " plu-map-panel__legend-item--off"}`}
                onClick={() => toggleZone(p.code_zone)}
                title={p.libelong ?? p.libelle ?? p.code_zone}
              >
                <span
                  className="plu-map-panel__legend-dot"
                  style={{ background: p.color, opacity: on ? 1 : 0.35 }}
                />
                <span className="plu-map-panel__legend-code">{p.code_zone}</span>
                {p.pct_parcelle_couverte != null && (
                  <span className="plu-map-panel__legend-pct">{p.pct_parcelle_couverte} %</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Carte */}
      <div className="plu-map-panel__map-wrap">
        {loading && (
          <div className="plu-map-panel__overlay">
            <span className="plu-map-panel__spinner" />
            <span>Chargement de la carte…</span>
          </div>
        )}
        {error && (
          <div className="plu-map-panel__overlay plu-map-panel__overlay--error">
            {error}
          </div>
        )}
        <div ref={mapContainerRef} className="plu-map-panel__map" />
      </div>
    </aside>
  );
}