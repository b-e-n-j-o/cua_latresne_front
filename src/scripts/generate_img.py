"""
generate_france_map.py
Génère une carte de France sur fond noir avec :
- Autres régions : vert Kerelia à 50 % d’opacité · Nouvelle-Aquitaine : vert plein (#85e372)
- Contours France, régions et départements en gris clair
- Un point vert foncé (#289f01) sur Bordeaux avec halo

Usage :
    python src/scripts/generate_img.py
    python src/scripts/generate_img.py --geojson public/geojson --output public/images/france-map.png
"""

import argparse
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import Circle
from matplotlib.colors import to_rgba
import geopandas as gpd
import pandas as pd
from shapely.geometry import Point

# ── Charte graphique Kerelia ──────────────────────────────────────────────────
COLOR_BG         = "#000000"
COLOR_LINE          = "#7a7a7a"        # contours France / régions / départements
COLOR_NA_FILL    = "#85e372"           # vert Kerelia accent (Nouvelle-Aquitaine)
COLOR_OTHER_FILL = to_rgba(COLOR_NA_FILL, 0.2)  # hors NA : 50 % du vert NA
LW_REGION        = 0.55
LW_DEPT          = 0.4
COLOR_BORDEAUX   = "#289f01"           # point Bordeaux
COLOR_HALO       = "#85e372"           # halo Bordeaux

BORDEAUX_COORDS  = (-0.5792, 44.8378)  # lon, lat

# ── Résolution de sortie ──────────────────────────────────────────────────────
WIDTH_PX  = 960
HEIGHT_PX = 1040
DPI       = 150

# Racine cua-frontend (src/scripts → ../..)
ROOT        = Path(__file__).resolve().parent.parent.parent
GEOJSON_DIR = ROOT / "public" / "geojson"
OUTPUT_PNG  = ROOT / "public" / "images" / "france-map.png"


def load_regions(regions_dir: Path) -> gpd.GeoDataFrame:
    """Charge tous les fichiers GeoJSON du dossier regions/."""
    gdfs = []
    for f in sorted(regions_dir.glob("region-*.geojson")):
        gdf = gpd.read_file(f)
        gdf["source_file"] = f.name
        gdfs.append(gdf)
    if not gdfs:
        sys.exit(f"❌ Aucun fichier region-*.geojson trouvé dans {regions_dir}")
    return gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=gdfs[0].crs)


def main():
    parser = argparse.ArgumentParser(description="Génère france-map.png sur fond noir")
    parser.add_argument(
        "--geojson",
        default=str(GEOJSON_DIR),
        help="Dossier contenant departements-simplified.geojson et regions/ (défaut: public/geojson)",
    )
    parser.add_argument(
        "--output",
        default=str(OUTPUT_PNG),
        help="Chemin du PNG de sortie (défaut: public/images/france-map.png)",
    )
    args = parser.parse_args()

    geojson_dir  = Path(args.geojson)
    dept_path    = geojson_dir / "departements-simplified.geojson"
    regions_dir  = geojson_dir / "regions"
    out_path     = Path(args.output)

    # ── Chargement des données ────────────────────────────────────────────────
    print("📂 Chargement des GeoJSON…")

    if not dept_path.exists():
        sys.exit(f"❌ Fichier introuvable : {dept_path}")
    if not regions_dir.exists():
        sys.exit(f"❌ Dossier introuvable : {regions_dir}")

    dept_gdf    = gpd.read_file(dept_path)
    regions_gdf = load_regions(regions_dir)

    # ── Projection Lambert-93 (RGF93) pour la France métropolitaine ──────────
    CRS = "EPSG:2154"
    dept_gdf    = dept_gdf.to_crs(CRS)
    regions_gdf = regions_gdf.to_crs(CRS)

    # Bordeaux en Lambert-93
    bordeaux_pt = gpd.GeoDataFrame(
        geometry=[Point(BORDEAUX_COORDS)], crs="EPSG:4326"
    ).to_crs(CRS)
    bx, by = bordeaux_pt.geometry.iloc[0].x, bordeaux_pt.geometry.iloc[0].y

    # ── Filtrage Nouvelle-Aquitaine dans dept_gdf ─────────────────────────────
    # On cherche la colonne qui identifie la région
    possible_region_cols = [
        c for c in dept_gdf.columns
        if any(k in c.lower() for k in ["region", "reg_name", "nom_reg", "libelle_reg"])
    ]
    print(f"   Colonnes région détectées : {possible_region_cols or 'aucune — on se base sur le code'}")

    # Fallback : codes département Nouvelle-Aquitaine (16,17,19,23,24,33,40,47,64,79,86,87)
    NA_DEP_CODES = {"16","17","19","23","24","33","40","47","64","79","86","87"}

    if possible_region_cols:
        col = possible_region_cols[0]
        na_mask = dept_gdf[col].str.contains("Nouvelle-Aquitaine", case=False, na=False)
        na_gdf  = dept_gdf[na_mask]
        if na_gdf.empty:
            print("   ⚠️  Colonne région trouvée mais aucun match — fallback codes dépt.")
            na_mask = dept_gdf.apply(
                lambda r: any(str(r.get(c,"")).zfill(2)[:2] in NA_DEP_CODES
                           for c in dept_gdf.columns), axis=1
            )
            na_gdf = dept_gdf[na_mask]
    else:
        # Cherche colonne code département
        code_cols = [c for c in dept_gdf.columns if "code" in c.lower() or "dep" in c.lower()]
        print(f"   Colonnes code : {code_cols}")
        if code_cols:
            col = code_cols[0]
            na_mask = dept_gdf[col].astype(str).str.zfill(2).isin(NA_DEP_CODES)
        else:
            # Dernier recours : on inspecte toutes les colonnes
            na_mask = pd.Series([False] * len(dept_gdf))
            for c in dept_gdf.columns:
                if dept_gdf[c].dtype == object:
                    m = dept_gdf[c].astype(str).str.zfill(2).isin(NA_DEP_CODES)
                    if m.sum() > na_mask.sum():
                        na_mask = m
        na_gdf = dept_gdf[na_mask]

    print(f"   Nouvelle-Aquitaine : {len(na_gdf)} départements")
    if na_gdf.empty:
        print("   ⚠️  Impossible d'isoler la Nouvelle-Aquitaine — tous les depts seront affichés")
        na_gdf = dept_gdf  # fallback visuel

    non_na_gdf = dept_gdf[~dept_gdf.index.isin(na_gdf.index)]

    # ── Figure ────────────────────────────────────────────────────────────────
    print("🎨 Rendu de la carte…")
    fig_w = WIDTH_PX  / DPI
    fig_h = HEIGHT_PX / DPI

    fig, ax = plt.subplots(figsize=(fig_w, fig_h), dpi=DPI)
    fig.patch.set_facecolor(COLOR_BG)
    ax.set_facecolor(COLOR_BG)
    ax.set_axis_off()

    # 1. Régions hors NA — vert Kerelia à 50 %
    regions_gdf.plot(
        ax=ax,
        facecolor=COLOR_OTHER_FILL,
        edgecolor=COLOR_LINE,
        linewidth=LW_REGION,
        zorder=1,
    )

    # 2. Départements hors NA — même teinte + maillage départemental
    non_na_gdf.plot(
        ax=ax,
        facecolor=COLOR_OTHER_FILL,
        edgecolor=COLOR_LINE,
        linewidth=LW_DEPT,
        zorder=2,
    )

    # 3. Nouvelle-Aquitaine — vert plein, contours départements en gris clair
    na_gdf.plot(
        ax=ax,
        facecolor=COLOR_NA_FILL,
        edgecolor=COLOR_LINE,
        linewidth=LW_DEPT,
        zorder=3,
    )

    # 4. Point Bordeaux — halo + point central
    halo_radius  = 18000   # mètres (Lambert-93)
    point_radius =  6000

    halo = Circle(
        (bx, by),
        radius=halo_radius,
        facecolor=to_rgba(COLOR_HALO, 0.25),
        edgecolor=to_rgba(COLOR_HALO, 0.55),
        linewidth=1.0,
        zorder=4,
    )
    dot = Circle(
        (bx, by),
        radius=point_radius,
        facecolor=COLOR_BORDEAUX,
        edgecolor="#ffffff",
        linewidth=0.8,
        zorder=5,
    )
    ax.add_patch(halo)
    ax.add_patch(dot)

    # Ajuste les limites sur l'emprise France métropolitaine
    all_bounds = regions_gdf.total_bounds  # minx, miny, maxx, maxy
    pad = 30000  # 30 km de marge
    ax.set_xlim(all_bounds[0] - pad, all_bounds[2] + pad)
    ax.set_ylim(all_bounds[1] - pad, all_bounds[3] + pad)

    # ── Export PNG ────────────────────────────────────────────────────────────
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(
        out_path,
        dpi=DPI,
        bbox_inches="tight",
        pad_inches=0,
        facecolor=COLOR_BG,
    )
    plt.close(fig)

    size_kb = out_path.stat().st_size / 1024
    print(f"✅ PNG généré → {out_path}  ({size_kb:.1f} kb)")


if __name__ == "__main__":
    main()