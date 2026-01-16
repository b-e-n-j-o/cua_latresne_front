import maplibregl from "maplibre-gl";

export default function registerParcellesLayer(map: maplibregl.Map, apiBase: string) {
  const MBTILES_BASE = `${apiBase}/latresne/mbtiles`;
  const LAYER_ID = "parcelles-fill";
  const SOURCE_LAYER = "parcelles";

  if (!map.getSource("parcelles")) {
    map.addSource("parcelles", {
      type: "vector",
      tiles: [`${MBTILES_BASE}/latresne_parcelles/{z}/{x}/{y}.mvt`],
      minzoom: 14,
      maxzoom: 19,
      promoteId: "id" // Nécessaire pour utiliser setFeatureState avec l'ID
    });
  }

  // Couche de remplissage (pour le clic et l'interaction)
  if (!map.getLayer(LAYER_ID)) {
    map.addLayer({
      id: LAYER_ID,
      type: "fill",
      source: "parcelles",
      "source-layer": SOURCE_LAYER,
      paint: {
        "fill-color": "transparent", // On garde transparent pour voir le fond/PLU
        "fill-outline-color": "rgba(0,0,0,0.2)"
      }
    });
  }

  // Couche de highlight au survol (avec feature state)
  if (!map.getLayer("parcelles-hover-outline")) {
    map.addLayer({
      id: "parcelles-hover-outline",
      type: "line",
      source: "parcelles",
      "source-layer": SOURCE_LAYER,
      paint: {
        "line-color": "#000",
        "line-width": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          2.5, // Largeur quand survolée
          0    // Invisible sinon
        ]
      }
    }, "bati_latresne-fill"); // On s'assure que le highlight est sous le bâti
  }

  // Couche de sélection (pour mettre en gras la parcelle cliquée)
  if (!map.getLayer("parcelles-highlight")) {
    map.addLayer({
      id: "parcelles-highlight",
      type: "line",
      source: "parcelles",
      "source-layer": SOURCE_LAYER,
      paint: {
        "line-color": "#ffea00",
        "line-width": 3,
        "line-opacity": 0
      }
    }, "bati_latresne-fill"); // On s'assure que le surbrillance est sous le bâti
  }

  // ============================================================
  // 🖱️ Gestion du survol avec popup et highlight
  // ============================================================
  // Vérifier si les event listeners n'ont pas déjà été ajoutés
  if (!(map as any)._parcellesListenersAdded) {
    // Création d'une instance unique de Popup pour le survol
    const hoverPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'parcelle-hover-popup'
    });

    let hoveredId: string | number | null = null;

    // Événement de survol (Mousemove pour suivre le curseur)
    map.on("mousemove", LAYER_ID, (e) => {
      if (!e.features || e.features.length === 0) return;

      map.getCanvas().style.cursor = "pointer";
      
      const feature = e.features[0];
      const props = feature.properties as any;
      const { section, numero } = props; // Ajustez selon vos noms de champs réels

      // Gérer le feature state pour le highlight
      const currentId = feature.id;
      if (hoveredId !== null && hoveredId !== currentId) {
        // Réinitialiser l'ancien feature
        try {
          map.setFeatureState(
            { source: 'parcelles', sourceLayer: SOURCE_LAYER, id: hoveredId },
            { hover: false }
          );
        } catch (err) {
          // Ignorer si le feature n'existe plus
        }
      }
      
      if (currentId !== undefined && currentId !== null) {
        hoveredId = currentId as string | number;
        try {
          map.setFeatureState(
            { source: 'parcelles', sourceLayer: SOURCE_LAYER, id: hoveredId },
            { hover: true }
          );
        } catch (err) {
          // Ignorer si le feature n'existe plus
        }
      }

      // Positionner et remplir la popup
      hoverPopup
        .setLngLat(e.lngLat)
        .setHTML(`<strong>Parcelle :</strong> ${section || 'N/A'} ${numero || 'N/A'}`)
        .addTo(map);
    });

    // Événement de sortie (Mouseleave pour cacher la popup)
    map.on("mouseleave", LAYER_ID, () => {
      map.getCanvas().style.cursor = "";
      hoverPopup.remove();
      
      // Réinitialiser le feature state
      if (hoveredId !== null) {
        try {
          map.setFeatureState(
            { source: 'parcelles', sourceLayer: SOURCE_LAYER, id: hoveredId },
            { hover: false }
          );
        } catch (err) {
          // Ignorer si le feature n'existe plus
        }
        hoveredId = null;
      }
    });

    (map as any)._parcellesListenersAdded = true;
  }
}