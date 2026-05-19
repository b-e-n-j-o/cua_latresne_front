"""
generate_france_map_frames.py
Génère N images PNG de la carte de France pour l'animation d'expansion Kerelia.

Frame 0  : Nouvelle-Aquitaine seule en vert, reste gris foncé opaque
Frame 1+ : régions supplémentaires colorées en vert clair, dans l'ordre de FRAMES

Usage :
    python src/scripts/generate_france_map_frames.py
    python src/scripts/generate_france_map_frames.py --geojson public/geojson --output public/images/france-map-frames

Les fichiers produits : frame-00.png, frame-01.png, ... frame-11.png
"""

import argparse
import sys
from pathlib import Path

import geopandas as gpd
import matplotlib.pyplot as plt
import pandas as pd
from matplotlib.colors import to_rgba
from matplotlib.patches import Circle
from shapely.geometry import Point

# ── Charte Kerelia ────────────────────────────────────────────────────────────
COLOR_BG          = "#000000"
COLOR_NA_FILL     = "#85e372"   # vert accent — Nouvelle-Aquitaine + régions ajoutées
COLOR_NA_EDGE     = "#289f01"   # vert foncé — bords internes NA (départements)
COLOR_GREEN_EDGE  = "#289f01"   # bords des régions vertes
COLOR_OTHER_FILL  = "#0d1f0d"   # vert très sombre pour les régions pas encore couvertes
COLOR_OTHER_EDGE  = "#1a3a1a"   # contour régions non couvertes
COLOR_BORDEAUX    = "#289f01"
COLOR_HALO        = "#85e372"

BORDEAUX_COORDS   = (-0.5792, 44.8378)  # lon, lat WGS84

# ── Résolution ────────────────────────────────────────────────────────────────
WIDTH_PX  = 960
HEIGHT_PX = 1040
DPI       = 150

# Racine cua-frontend (src/scripts → ../..)
ROOT         = Path(__file__).resolve().parent.parent.parent
GEOJSON_DIR  = ROOT / "public" / "geojson"
OUTPUT_DIR   = ROOT / "public" / "images" / "france-map-frames"

# ── Codes départements Nouvelle-Aquitaine ─────────────────────────────────────
NA_DEP_CODES = {"16","17","19","23","24","33","40","47","64","79","86","87"}

# ── Mapping slug → nom dans les fichiers GeoJSON regions/ ────────────────────
# Les slugs correspondent aux noms de fichiers : region-{slug}.geojson
REGION_SLUGS = {
    "occitanie":                   "occitanie",
    "pays-de-la-loire":            "pays-de-la-loire",
    "auvergne-rhone-alpes":        "auvergne-rhone-alpes",
    "centre-val-de-loire":         "centre-val-de-loire",
    "bretagne":                    "bretagne",
    "normandie":                   "normandie",
    "ile-de-france":               "ile-de-france",
    "bourgogne-franche-comte":     "bourgogne-franche-comte",
    "hauts-de-france":             "hauts-de-france",
    "grand-est":                   "grand-est",
    "provence-alpes-cote-d-azur":  "provence-alpes-cote-d-azur",
}

# ── Séquence d'expansion (contiguïté respectée depuis NA) ────────────────────
# Chaque frame = toutes les régions vertes CUMULÉES en plus de la NA
FRAMES: list[list[str]] = [
    # frame-00 : NA seule
    [],
    # frame-01 : + Occitanie (voisine directe au sud-est)
    ["occitanie"],
    # frame-02 : + Pays de la Loire (voisine au nord)
    ["occitanie", "pays-de-la-loire"],
    # frame-03 : + Auvergne-Rhône-Alpes (voisine Occitanie + NA)
    ["occitanie", "pays-de-la-loire", "auvergne-rhone-alpes"],
    # frame-04 : + Centre-Val de Loire (voisine PDL + NA)
    ["occitanie", "pays-de-la-loire", "auvergne-rhone-alpes", "centre-val-de-loire"],
    # frame-05 : + Bretagne (voisine PDL)
    ["occitanie", "pays-de-la-loire", "auvergne-rhone-alpes", "centre-val-de-loire", "bretagne"],
    # frame-06 : + Normandie (voisine Bretagne + Centre)
    ["occitanie", "pays-de-la-loire", "auvergne-rhone-alpes", "centre-val-de-loire", "bretagne", "normandie"],
    # frame-07 : + Île-de-France (voisine Centre + Normandie)
    ["occitanie", "pays-de-la-loire", "auvergne-rhone-alpes", "centre-val-de-loire", "bretagne", "normandie", "ile-de-france"],
    # frame-08 : + Bourgogne-Franche-Comté (voisine Centre + ARA)
    ["occitanie", "pays-de-la-loire", "auvergne-rhone-alpes", "centre-val-de-loire", "bretagne", "normandie", "ile-de-france", "bourgogne-franche-comte"],
    # frame-09 : + Hauts-de-France (voisine Normandie + IDF)
    ["occitanie", "pays-de-la-loire", "auvergne-rhone-alpes", "centre-val-de-loire", "bretagne", "normandie", "ile-de-france", "bourgogne-franche-comte", "hauts-de-france"],
    # frame-10 : + Grand Est (voisine BFC + HdF)
    ["occitanie", "pays-de-la-loire", "auvergne-rhone-alpes", "centre-val-de-loire", "bretagne", "normandie", "ile-de-france", "bourgogne-franche-comte", "hauts-de-france", "grand-est"],
    # frame-11 : + PACA → France complète
    ["occitanie", "pays-de-la-loire", "auvergne-rhone-alpes", "centre-val-de-loire", "bretagne", "normandie", "ile-de-france", "bourgogne-franche-comte", "hauts-de-france", "grand-est", "provence-alpes-cote-d-azur"],
]


def load_regions(regions_dir: Path) -> dict[str, gpd.GeoDataFrame]:
    """Charge chaque fichier region-{slug}.geojson → dict slug → GeoDataFrame."""
    gdfs: dict[str, gpd.GeoDataFrame] = {}
    for slug in REGION_SLUGS:
        path = regions_dir / f"region-{slug}.geojson"
        if not path.exists():
            print(f"   ⚠️  Fichier manquant : {path.name}")
            continue
        gdfs[slug] = gpd.read_file(path)
    return gdfs


def detect_na(dept_gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Filtre les départements Nouvelle-Aquitaine depuis dept_gdf."""
    # Essai colonne région
    for col in dept_gdf.columns:
        if any(k in col.lower() for k in ["region", "reg_name", "nom_reg", "libelle_reg"]):
            mask = dept_gdf[col].astype(str).str.contains("Nouvelle-Aquitaine", case=False, na=False)
            if mask.sum() > 0:
                return dept_gdf[mask]

    # Fallback codes département
    for col in dept_gdf.columns:
        if dept_gdf[col].dtype == object:
            mask = dept_gdf[col].astype(str).str.zfill(2).isin(NA_DEP_CODES)
            if mask.sum() >= 10:
                return dept_gdf[mask]

    print("   ⚠️  Impossible d'isoler la NA — fallback tous départements")
    return dept_gdf


def render_frame(
    frame_idx: int,
    green_slugs: list[str],
    na_gdf: gpd.GeoDataFrame,
    regions_gdfs: dict[str, gpd.GeoDataFrame],
    all_bounds: tuple,
    bordeaux_xy: tuple,
    out_dir: Path,
    crs: str,
) -> None:
    fig_w = WIDTH_PX / DPI
    fig_h = HEIGHT_PX / DPI
    fig, ax = plt.subplots(figsize=(fig_w, fig_h), dpi=DPI)
    fig.patch.set_facecolor(COLOR_BG)
    ax.set_facecolor(COLOR_BG)
    ax.set_axis_off()

    green_set = set(green_slugs)

    # 1. Régions non vertes — fond très sombre
    grey_gdfs = [gdf for slug, gdf in regions_gdfs.items() if slug not in green_set]
    if grey_gdfs:
        grey_all = gpd.GeoDataFrame(
            pd.concat(grey_gdfs, ignore_index=True), crs=crs
        )
        grey_all.plot(
            ax=ax,
            facecolor=COLOR_OTHER_FILL,
            edgecolor=COLOR_OTHER_EDGE,
            linewidth=0.6,
            zorder=1,
        )

    # 2. Régions vertes supplémentaires (hors NA)
    for slug in green_slugs:
        if slug in regions_gdfs:
            regions_gdfs[slug].plot(
                ax=ax,
                facecolor=COLOR_NA_FILL,
                edgecolor=COLOR_GREEN_EDGE,
                linewidth=0.6,
                zorder=2,
            )

    # 3. Nouvelle-Aquitaine — départements filled (toujours en vert)
    na_gdf.plot(
        ax=ax,
        facecolor=COLOR_NA_FILL,
        edgecolor=COLOR_NA_EDGE,
        linewidth=0.8,
        zorder=3,
    )

    # 4. Point Bordeaux
    bx, by = bordeaux_xy
    halo = Circle(
        (bx, by), radius=18000,
        facecolor=to_rgba(COLOR_HALO, 0.25),
        edgecolor=to_rgba(COLOR_HALO, 0.55),
        linewidth=1.0, zorder=4,
    )
    dot = Circle(
        (bx, by), radius=6000,
        facecolor=COLOR_BORDEAUX,
        edgecolor="#ffffff",
        linewidth=0.8, zorder=5,
    )
    ax.add_patch(halo)
    ax.add_patch(dot)

    # Limites fixes (identiques pour toutes les frames → pas de saut)
    pad = 30000
    ax.set_xlim(all_bounds[0] - pad, all_bounds[2] + pad)
    ax.set_ylim(all_bounds[1] - pad, all_bounds[3] + pad)

    out_path = out_dir / f"frame-{frame_idx:02d}.png"
    fig.savefig(
        out_path, dpi=DPI, bbox_inches="tight",
        pad_inches=0, facecolor=COLOR_BG,
    )
    plt.close(fig)
    size_kb = out_path.stat().st_size / 1024
    print(f"   ✅ frame-{frame_idx:02d}.png  ({size_kb:.0f} kb)  — {len(green_slugs)+1} région(s) vertes")


def main() -> None:
    parser = argparse.ArgumentParser(description="Génère les frames PNG de l'animation d'expansion Kerelia")
    parser.add_argument(
        "--geojson",
        default=str(GEOJSON_DIR),
        help="Dossier contenant departements-simplified.geojson et regions/ (défaut: public/geojson)",
    )
    parser.add_argument(
        "--output",
        default=str(OUTPUT_DIR),
        help="Dossier de sortie des PNG (défaut: public/images/france-map-frames)",
    )
    args = parser.parse_args()

    geojson_dir = Path(args.geojson)
    dept_path   = geojson_dir / "departements-simplified.geojson"
    regions_dir = geojson_dir / "regions"
    out_dir     = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    CRS = "EPSG:2154"

    print("📂 Chargement des GeoJSON…")
    if not dept_path.exists():
        sys.exit(f"❌ {dept_path} introuvable")
    if not regions_dir.exists():
        sys.exit(f"❌ {regions_dir} introuvable")

    dept_gdf    = gpd.read_file(dept_path).to_crs(CRS)
    regions_gdfs = {slug: gpd.read_file(regions_dir / f"region-{slug}.geojson").to_crs(CRS)
                    for slug in REGION_SLUGS
                    if (regions_dir / f"region-{slug}.geojson").exists()}

    na_gdf = detect_na(dept_gdf)
    print(f"   Nouvelle-Aquitaine : {len(na_gdf)} départements")
    print(f"   Régions chargées   : {list(regions_gdfs.keys())}")

    # Bordeaux en Lambert-93
    bx_pt = gpd.GeoDataFrame(geometry=[Point(BORDEAUX_COORDS)], crs="EPSG:4326").to_crs(CRS)
    bordeaux_xy = (bx_pt.geometry.iloc[0].x, bx_pt.geometry.iloc[0].y)

    # Emprise globale fixe (toutes régions + NA)
    all_gdf = gpd.GeoDataFrame(
        pd.concat(list(regions_gdfs.values()) + [na_gdf], ignore_index=True), crs=CRS
    )
    all_bounds = all_gdf.total_bounds  # minx, miny, maxx, maxy

    print(f"\n🎨 Génération de {len(FRAMES)} frames…")
    for i, green_slugs in enumerate(FRAMES):
        render_frame(i, green_slugs, na_gdf, regions_gdfs, all_bounds, bordeaux_xy, out_dir, CRS)

    print(f"\n✅ {len(FRAMES)} frames générées dans {out_dir.resolve()}")
    print("   Import React suggéré :")
    print("   const frames = Array.from({length: 12}, (_, i) => `/images/france-map-frames/frame-${String(i).padStart(2,'0')}.png`)")


if __name__ == "__main__":
    main()