import type { MutableRefObject } from "react";
import maplibregl from "maplibre-gl";
import {
  INFO_LINE_COLOR,
  INFO_POINT_COLOR,
  INFO_SURF_COLOR,
  INFO_SURF_OPACITY,
  PARCELLE_FILL,
  PARCELLE_LABEL_COLOR,
  PARCELLE_OUTLINE,
  PARCELLE_UNION_FILL,
  PRESCRIPTION_LINE_COLOR,
  PRESCRIPTION_POINT_COLOR,
  PRESCRIPTION_SURF_COLOR,
  PRESCRIPTION_SURF_OPACITY,
  SERVITUDES_COLOR,
  SERVITUDES_FILL_OPACITY,
  ZONE_FILL_OPACITY,
} from "./colors";
import {
  boundsFromCoordinates,
  collectAllCoordinates,
  enrichZoneFeatures,
  geometryHasArea,
  parcelleHasGeometry,
} from "./geo";
import { filterFeaturesByGroup } from "./grouping";
import { applyExtraMapLayers, clearExtraMapLayers, type ExtraLayerHandlers } from "./extraLayers";
import { LAYER_IDS, SOURCE_IDS } from "./layerIds";
import type {
  InformationProperties,
  MapData,
  ParcelleProperties,
  PrescriptionProperties,
  ServitudeProperties,
  ZoneFeature,
} from "./types";

export type LayerHandlers = {
  zone: { onZoneClick?: (e: maplibregl.MapLayerMouseEvent) => void; onEnter?: () => void; onLeave?: () => void };
  parcel: { onParcelClick?: (e: maplibregl.MapLayerMouseEvent) => void; onEnter?: () => void; onLeave?: () => void };
  presc: { onClick?: (e: maplibregl.MapLayerMouseEvent) => void; onEnter?: () => void; onLeave?: () => void; layers?: string[] };
  serv: { onClick?: (e: maplibregl.MapLayerMouseEvent) => void; onEnter?: () => void; onLeave?: () => void };
  info: { onClick?: (e: maplibregl.MapLayerMouseEvent) => void; onEnter?: () => void; onLeave?: () => void; layers?: string[] };
  extra?: ExtraLayerHandlers | null;
};

export type ApplyLayersParams = {
  map: maplibregl.Map;
  mapData: MapData;
  popupRef: MutableRefObject<maplibregl.Popup | null>;
  visibleZones: Set<string>;
  visibleServitudes: Set<string>;
  servitudeColors: Map<string, string>;
  visiblePrescriptions: Set<string>;
  prescriptionColors: Map<string, string>;
  visibleInformations: Set<string>;
  informationColors: Map<string, string>;
  visibleExtra: Set<string>;
  handlers: LayerHandlers;
};

function detachHandlers(map: maplibregl.Map, handlers: LayerHandlers): void {
  const z = handlers.zone;
  if (z.onZoneClick) map.off("click", "plu-zones-fill", z.onZoneClick);
  if (z.onEnter) map.off("mouseenter", "plu-zones-fill", z.onEnter);
  if (z.onLeave) map.off("mouseleave", "plu-zones-fill", z.onLeave);

  const p = handlers.parcel;
  if (p.onParcelClick) map.off("click", "parcelle-outline", p.onParcelClick);
  if (p.onEnter) map.off("mouseenter", "parcelle-outline", p.onEnter);
  if (p.onLeave) map.off("mouseleave", "parcelle-outline", p.onLeave);

  const pr = handlers.presc;
  if (pr.onClick && pr.layers) {
    for (const lid of pr.layers) {
      map.off("click", lid, pr.onClick);
      map.off("mouseenter", lid, pr.onEnter!);
      map.off("mouseleave", lid, pr.onLeave!);
    }
  }

  const s = handlers.serv;
  if (s.onClick) map.off("click", "servitudes-fill", s.onClick);
  if (s.onEnter) map.off("mouseenter", "servitudes-fill", s.onEnter);
  if (s.onLeave) map.off("mouseleave", "servitudes-fill", s.onLeave);

  const i = handlers.info;
  if (i.onClick && i.layers) {
    for (const lid of i.layers) {
      map.off("click", lid, i.onClick);
      map.off("mouseenter", lid, i.onEnter!);
      map.off("mouseleave", lid, i.onLeave!);
    }
  }

  if (handlers.extra) {
    for (const lid of handlers.extra.clickLayers) {
      map.off("click", lid, handlers.extra.onClick);
      map.off("mouseenter", lid, handlers.extra.onEnter);
      map.off("mouseleave", lid, handlers.extra.onLeave);
    }
  }
}

function clearLayers(map: maplibregl.Map): void {
  clearExtraMapLayers(map);
  LAYER_IDS.forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  SOURCE_IDS.forEach((id) => {
    if (map.getSource(id)) map.removeSource(id);
  });
}

function fc<T extends GeoJSON.Geometry>(
  features: GeoJSON.Feature<T>[],
): GeoJSON.FeatureCollection<T> {
  return { type: "FeatureCollection", features };
}

export function applyMapLayers(params: ApplyLayersParams): LayerHandlers {
  const {
    map,
    mapData,
    popupRef,
    visibleZones,
    visibleServitudes,
    servitudeColors,
    visiblePrescriptions,
    prescriptionColors,
    visibleInformations,
    informationColors,
    visibleExtra,
    handlers: prev,
  } = params;

  detachHandlers(map, prev);
  clearLayers(map);

  const next: LayerHandlers = { zone: {}, parcel: {}, presc: {}, serv: {}, info: {} };

  const visibleZoneFeatures = enrichZoneFeatures(
    mapData.zones.features.filter((f) => visibleZones.has(f.properties.code_zone)),
  );

  if (visibleZoneFeatures.length > 0) {
    map.addSource("plu-zones", {
      type: "geojson",
      data: { type: "FeatureCollection", features: visibleZoneFeatures },
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
            ${p.pct_parcelle_couverte != null ? `<div class="plu-map-popup__pct">${p.pct_parcelle_couverte} % de la parcelle</div>` : ""}
            ${p.typezone ? `<div class="plu-map-popup__type">Type : ${p.typezone}</div>` : ""}
          </div>
        `)
        .addTo(map);
    };
    const onEnter = () => { map.getCanvas().style.cursor = "pointer"; };
    const onLeave = () => { map.getCanvas().style.cursor = ""; };
    next.zone = { onZoneClick, onEnter, onLeave };
    map.on("click", "plu-zones-fill", onZoneClick);
    map.on("mouseenter", "plu-zones-fill", onEnter);
    map.on("mouseleave", "plu-zones-fill", onLeave);
  }

  const presc = mapData.prescriptions;
  const prescSurf = filterFeaturesByGroup(
    presc?.surfaciques?.features ?? [],
    visiblePrescriptions,
    "libelle",
    prescriptionColors,
    PRESCRIPTION_SURF_COLOR,
  );
  const prescLin = filterFeaturesByGroup(
    presc?.lineaires?.features ?? [],
    visiblePrescriptions,
    "libelle",
    prescriptionColors,
    PRESCRIPTION_LINE_COLOR,
  );
  const prescPct = filterFeaturesByGroup(
    presc?.ponctuelles?.features ?? [],
    visiblePrescriptions,
    "libelle",
    prescriptionColors,
    PRESCRIPTION_POINT_COLOR,
  );

  if (prescSurf.length > 0) {
    map.addSource("prescriptions-surf", { type: "geojson", data: fc(prescSurf) });
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
  if (prescLin.length > 0) {
    map.addSource("prescriptions-line", { type: "geojson", data: fc(prescLin) });
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
  if (prescPct.length > 0) {
    map.addSource("prescriptions-point", { type: "geojson", data: fc(prescPct) });
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
    ...(prescSurf.length ? ["prescriptions-surf-fill"] : []),
    ...(prescLin.length ? ["prescriptions-line"] : []),
    ...(prescPct.length ? ["prescriptions-point"] : []),
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
            <div class="plu-map-popup__title">${p.libelle ?? p.label ?? p.groupKey ?? "Prescription"}</div>
            ${p.typepsc ? `<div class="plu-map-popup__type">Type : ${p.typepsc}${p.stypepsc ? ` / ${p.stypepsc}` : ""}</div>` : ""}
            ${p.kind ? `<div class="plu-map-popup__pct">Nature : ${p.kind}</div>` : ""}
          </div>
        `)
        .addTo(map);
    };
    const onPrescEnter = () => { map.getCanvas().style.cursor = "pointer"; };
    const onPrescLeave = () => { map.getCanvas().style.cursor = ""; };
    next.presc = { onClick: onPrescClick, onEnter: onPrescEnter, onLeave: onPrescLeave, layers: prescClickLayers };
    for (const lid of prescClickLayers) {
      map.on("click", lid, onPrescClick);
      map.on("mouseenter", lid, onPrescEnter);
      map.on("mouseleave", lid, onPrescLeave);
    }
  }

  const servFeatures = filterFeaturesByGroup(
    mapData.servitudes?.features ?? [],
    visibleServitudes,
    "nom_servitude",
    servitudeColors,
    SERVITUDES_COLOR,
  );

  if (servFeatures.length > 0) {
    map.addSource("servitudes", { type: "geojson", data: fc(servFeatures) });
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
            <div class="plu-map-popup__title">${p.nom_servitude ?? p.label ?? p.groupKey ?? "Servitude"}</div>
            ${p.suptype && p.suptype !== p.nom_servitude ? `<div class="plu-map-popup__type">Code : ${p.suptype}</div>` : ""}
            ${p.typeass ? `<div class="plu-map-popup__type">${p.typeass}</div>` : ""}
            ${p.nomsuplitt ? `<div class="plu-map-popup__pct">${p.nomsuplitt}</div>` : ""}
            ${p.nomass ? `<div class="plu-map-popup__type">Assiette : ${p.nomass}</div>` : ""}
          </div>
        `)
        .addTo(map);
    };
    const onServEnter = () => { map.getCanvas().style.cursor = "pointer"; };
    const onServLeave = () => { map.getCanvas().style.cursor = ""; };
    next.serv = { onClick: onServClick, onEnter: onServEnter, onLeave: onServLeave };
    map.on("click", "servitudes-fill", onServClick);
    map.on("mouseenter", "servitudes-fill", onServEnter);
    map.on("mouseleave", "servitudes-fill", onServLeave);
  }

  const infos = mapData.informations;
  const infoSurf = filterFeaturesByGroup(
    infos?.surfaciques?.features ?? [],
    visibleInformations,
    "libelle",
    informationColors,
    INFO_SURF_COLOR,
  );
  const infoLin = filterFeaturesByGroup(
    infos?.lineaires?.features ?? [],
    visibleInformations,
    "libelle",
    informationColors,
    INFO_LINE_COLOR,
  );
  const infoPct = filterFeaturesByGroup(
    infos?.ponctuelles?.features ?? [],
    visibleInformations,
    "libelle",
    informationColors,
    INFO_POINT_COLOR,
  );

  if (infoSurf.length > 0) {
    map.addSource("informations-surf", { type: "geojson", data: fc(infoSurf) });
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
  if (infoLin.length > 0) {
    map.addSource("informations-line", { type: "geojson", data: fc(infoLin) });
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
  if (infoPct.length > 0) {
    map.addSource("informations-point", { type: "geojson", data: fc(infoPct) });
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
    ...(infoSurf.length ? ["informations-surf-fill"] : []),
    ...(infoLin.length ? ["informations-line"] : []),
    ...(infoPct.length ? ["informations-point"] : []),
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
            <div class="plu-map-popup__title">${p.libelle ?? p.groupKey ?? "Information"}</div>
            ${p.typeinf ? `<div class="plu-map-popup__type">Type : ${p.typeinf}${p.stypeinf ? ` / ${p.stypeinf}` : ""}</div>` : ""}
            ${p.kind ? `<div class="plu-map-popup__pct">Nature : ${p.kind}</div>` : ""}
          </div>
        `)
        .addTo(map);
    };
    const onInfoEnter = () => { map.getCanvas().style.cursor = "pointer"; };
    const onInfoLeave = () => { map.getCanvas().style.cursor = ""; };
    next.info = { onClick: onInfoClick, onEnter: onInfoEnter, onLeave: onInfoLeave, layers: infoClickLayers };
    for (const lid of infoClickLayers) {
      map.on("click", lid, onInfoClick);
      map.on("mouseenter", lid, onInfoEnter);
      map.on("mouseleave", lid, onInfoLeave);
    }
  }

  if (mapData.parcelle_union?.geometry && geometryHasArea(mapData.parcelle_union.geometry)) {
    map.addSource("parcelle-union", { type: "geojson", data: mapData.parcelle_union });
    map.addLayer({
      id: "parcelle-union-fill",
      type: "fill",
      source: "parcelle-union",
      paint: { "fill-color": PARCELLE_UNION_FILL },
    });
  }

  if (parcelleHasGeometry(mapData.parcelle)) {
    map.addSource("parcelle", { type: "geojson", data: mapData.parcelle });
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
      paint: { "line-color": PARCELLE_OUTLINE, "line-width": 2.5 },
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
    next.parcel = { onParcelClick, onEnter: onParcelEnter, onLeave: onParcelLeave };
    map.on("click", "parcelle-outline", onParcelClick);
    map.on("mouseenter", "parcelle-outline", onParcelEnter);
    map.on("mouseleave", "parcelle-outline", onParcelLeave);
  }

  next.extra = applyExtraMapLayers({
    map,
    extra: mapData.extra,
    visibleExtra,
    popupRef,
    prev: prev.extra ?? null,
  });

  // Cadrage : parcelle + zonage (extra déjà clippés côté API au buffer)
  const boundsCoords: number[][] = [];
  collectAllCoordinates(mapData.parcelle, boundsCoords);
  if (mapData.parcelle_union) collectAllCoordinates(mapData.parcelle_union, boundsCoords);
  visibleZoneFeatures.forEach((f) => collectAllCoordinates(f.geometry, boundsCoords));

  const bounds = boundsFromCoordinates(boundsCoords);
  if (bounds) {
    map.fitBounds(bounds, { padding: 48, maxZoom: 18, duration: 800 });
  }

  map.triggerRepaint();
  return next;
}
