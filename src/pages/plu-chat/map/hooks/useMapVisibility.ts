import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  GROUP_HUE,
  INFO_SURF_COLOR,
  PRESCRIPTION_SURF_COLOR,
  SERVITUDES_COLOR,
} from "../colors";
import { buildExtraLayerMeta } from "../extraLayers";
import {
  buildLegendGroups,
  collectInformationFeatures,
  collectPrescriptionFeatures,
} from "../grouping";
import type { LegendGroup, MapData } from "../types";

function toggleInSet(setter: Dispatch<SetStateAction<Set<string>>>, key: string) {
  setter((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
}

export function useMapVisibility(mapData: MapData | null) {
  const [legendOpen, setLegendOpen] = useState(true);
  const [visibleZones, setVisibleZones] = useState<Set<string>>(new Set());
  const [visibleServitudes, setVisibleServitudes] = useState<Set<string>>(new Set());
  const [visiblePrescriptions, setVisiblePrescriptions] = useState<Set<string>>(new Set());
  const [visibleInformations, setVisibleInformations] = useState<Set<string>>(new Set());
  const [visibleExtra, setVisibleExtra] = useState<Set<string>>(new Set());

  const servitudeFeatures = useMemo(
    () => mapData?.servitudes?.features ?? [],
    [mapData],
  );
  const prescriptionFeatures = useMemo(
    () => collectPrescriptionFeatures(mapData?.prescriptions),
    [mapData],
  );
  const informationFeatures = useMemo(
    () => collectInformationFeatures(mapData?.informations),
    [mapData],
  );

  const { groups: servitudeGroups, colorByKey: servitudeColors } = useMemo(
    () =>
      buildLegendGroups(
        servitudeFeatures,
        "nom_servitude",
        GROUP_HUE.servitudes,
        SERVITUDES_COLOR,
      ),
    [servitudeFeatures],
  );

  const { groups: prescriptionGroups, colorByKey: prescriptionColors } = useMemo(
    () =>
      buildLegendGroups(
        prescriptionFeatures,
        "libelle",
        GROUP_HUE.prescriptions,
        PRESCRIPTION_SURF_COLOR,
      ),
    [prescriptionFeatures],
  );

  const extraLayers = useMemo(
    () => buildExtraLayerMeta(mapData?.extra),
    [mapData?.extra],
  );

  const { groups: informationGroups, colorByKey: informationColors } = useMemo(
    () =>
      buildLegendGroups(
        informationFeatures,
        "libelle",
        GROUP_HUE.informations,
        INFO_SURF_COLOR,
      ),
    [informationFeatures],
  );

  useEffect(() => {
    if (!mapData) return;
    setVisibleZones(new Set(mapData.zones.features.map((f) => f.properties.code_zone)));
  }, [mapData]);

  useEffect(() => {
    setVisibleServitudes(new Set(servitudeGroups.map((g) => g.key)));
  }, [servitudeGroups]);

  useEffect(() => {
    setVisiblePrescriptions(new Set(prescriptionGroups.map((g) => g.key)));
  }, [prescriptionGroups]);

  useEffect(() => {
    setVisibleInformations(new Set(informationGroups.map((g) => g.key)));
  }, [informationGroups]);

  useEffect(() => {
    setVisibleExtra(new Set(extraLayers.map((l) => l.id)));
  }, [extraLayers]);

  const toggleZone = useCallback((code: string) => toggleInSet(setVisibleZones, code), []);
  const toggleServitude = useCallback((key: string) => toggleInSet(setVisibleServitudes, key), []);
  const togglePrescription = useCallback((key: string) => toggleInSet(setVisiblePrescriptions, key), []);
  const toggleInformation = useCallback((key: string) => toggleInSet(setVisibleInformations, key), []);
  const toggleExtra = useCallback((id: string) => toggleInSet(setVisibleExtra, id), []);

  const hasLegendContent =
    (mapData?.zones.features.length ?? 0) > 0 ||
    servitudeGroups.length > 0 ||
    prescriptionGroups.length > 0 ||
    informationGroups.length > 0 ||
    extraLayers.length > 0;

  return {
    legendOpen,
    setLegendOpen,
    hasLegendContent,
    visibleZones,
    toggleZone,
    visibleServitudes,
    servitudeGroups,
    servitudeColors,
    toggleServitude,
    visiblePrescriptions,
    prescriptionGroups,
    prescriptionColors,
    togglePrescription,
    visibleInformations,
    informationGroups,
    informationColors,
    toggleInformation,
    extraLayers,
    visibleExtra,
    toggleExtra,
  };
}

export type MapVisibilityState = ReturnType<typeof useMapVisibility>;
