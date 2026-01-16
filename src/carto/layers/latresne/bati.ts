import maplibregl from "maplibre-gl";

export default function registerBatiLatresneLayer(
  map: maplibregl.Map,
  apiBase: string
) {
  const MBTILES_BASE = `${apiBase}/latresne/mbtiles`;
  const LAYER_ID = "bati_latresne-fill";

  // 1. Source MBTiles (Bâti extrait de Supabase)
  if (!map.getSource("bati_latresne")) {
    map.addSource("bati_latresne", {
      type: "vector",
      tiles: [`${MBTILES_BASE}/batiments_latresne/{z}/{x}/{y}.mvt`],
      minzoom: 14,
      maxzoom: 19
    });
  }

  // 2. Layer : Remplissage 3D-ish (ou flat)
  if (!map.getLayer("bati_latresne-fill")) {
    map.addLayer({
      id: "bati_latresne-fill",
      type: "fill",
      source: "bati_latresne",
      "source-layer": "batiments", // Doit correspondre à l'option --layer de tippecanoe
      minzoom: 14,
      paint: {
        // Gris foncé par défaut, vous pouvez varier selon le champ 'type' si besoin
        "fill-color": [
          "match",
          ["get", "type"],
          "Indifférencié", "#4A5568",
          "Industriel", "#2D3748",
          "#718096" // couleur par défaut
        ],
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14, 0.4,
          16, 0.8
        ],
        "fill-outline-color": "#1A202C"
      }
    });
  }

  // 3. Optionnel : Effet 3D d'ombre portée (si vous voulez du relief sans extrusion)
  // Ou simplement une ligne de contour plus marquée au zoom maximum
  if (!map.getLayer("bati_latresne-outline")) {
    map.addLayer({
      id: "bati_latresne-outline",
      type: "line",
      source: "bati_latresne",
      "source-layer": "batiments",
      minzoom: 17,
      paint: {
        "line-color": "#000000",
        "line-width": 0.5,
        "line-opacity": 0.3
      }
    });
  }

  // ============================================================
  // 🖱️ Gestion du clic et Popup
  // ============================================================
  // Vérifier si les event listeners n'ont pas déjà été ajoutés
  // en utilisant une propriété sur la map pour éviter les doublons
  if (!(map as any)._batiLatresneListenersAdded) {
    map.on("click", LAYER_ID, (e) => {
      if (!e.features || e.features.length === 0) return;

      const feature = e.features[0];
      const props = feature.properties as any;
      const coordinates = e.lngLat;

      // Construction du contenu HTML de la popup
      const html = `
        <div style="font-family: sans-serif; padding: 8px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; border-bottom: 1px solid #ccc;">
              Bâtiment ${props.id || 'N/A'}
          </h3>
          <p style="margin: 4px 0; font-size: 12px;"><strong>Type:</strong> ${props.type || 'N/A'}</p>
          <p style="margin: 4px 0; font-size: 12px;"><strong>Code INSEE:</strong> ${props.code_insee || 'N/A'}</p>
          <p style="margin: 4px 0; font-size: 12px; color: #666; font-style: italic;">GID: ${props.gid || 'N/A'}</p>
        </div>
      `;

      new maplibregl.Popup({ closeButton: true, maxWidth: '300px' })
        .setLngLat(coordinates)
        .setHTML(html)
        .addTo(map);
    });

    // ============================================================
    // 👆 Changement du curseur au survol
    // ============================================================
    map.on("mouseenter", LAYER_ID, () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", LAYER_ID, () => {
      map.getCanvas().style.cursor = "";
    });

    (map as any)._batiLatresneListenersAdded = true;
  }
}