# Couches cartographiques (PMTiles) — guide d’ajout / retrait

Ce document décrit le cycle de vie d’une couche affichée sur la carte CUA (Latresne, Argelès, futures communes).

## Où vit quoi ?

| Zone | Fichiers | Rôle |
|------|----------|------|
| **Données** | PostGIS (`{schema}.{table}`) | Source géographique |
| **Tuiles** | `BACKEND_PRINCIPAL/.../services/pmtiles/` | Génération `.pmtiles` + upload Supabase |
| **Catalogue front** | `{commune}/cua/cartoLayers.tsx` | Déclaration couche, styles MapLibre, famille |
| **Filtres carte** | `{commune}/cua/cartoFilters.ts` | Visibilité, filtres par classe (`groupField`) |
| **Légende** | `communs/carto/legend/` + wrapper `{commune}/cua/CartoLegendPanel.tsx` | UI (automatique si catalogue OK) |
| **Tooltips** | `communs/carto/cartoTooltips.ts` | Survol parcelle + couches |
| **Page** | `{commune}/cua/*Page.tsx` | Monte la carte, branche légende / tooltips |

Les fichiers **par commune** (non mutualisés volontairement) :

- `latresne/cua/cartoLayers.tsx`, `cartoFilters.ts`, `CartoLegendPanel.tsx`
- `argeles/cua/cartoLayers.tsx`, `cartoFilters.ts`, `CartoLegendPanel.tsx`

---

## Ajouter une couche — checklist

### 1. Backend / données

1. **Table PostGIS** prête dans le schéma de la commune (`latresne`, `argeles`, …).
2. **Colonnes utiles** présentes dans la table *et* exportées vers les tuiles :
   - attributs de **style** (`typezone`, `libelle`, `suptype`, …)
   - attributs de **tooltip** (`libelle`, `nom_code`, …)
   - attribut de **filtre légende** si sous-classes dynamiques (`groupField`)
3. **Générer le PMTiles** :
   - Argelès : `python services/pmtiles/pmtiles_batch.py --schema argeles [--only table1,table2]`
   - Latresne : même outillage (`pmtiles.py` / `pmtiles_batch.py`) — cibler le schéma `latresne`
4. **Vérifier l’upload** Supabase Storage :  
   `pmtiles/{commune}/{nom_fichier}.pmtiles`  
   (URL utilisée côté front : `VITE_SUPABASE_URL/storage/v1/object/public/pmtiles/...`)

> Le `sourceLayer` côté front doit correspondre au **nom de couche** dans le fichier PMTiles (souvent = nom de table à la génération).

### 2. Frontend — `cartoLayers.tsx` (commune)

Ajouter une entrée dans `CARTO_LAYERS` :

```ts
{
  id: "ma-couche",              // id source MapLibre (= clé unique)
  title: "Libellé légende",
  family: "risques",            // voir CARTO_FAMILIES — ou omettre = standalone
  defaultVisible: false,
  pmtilesUrl: `${TILES_BASE}/mon_fichier.pmtiles`,
  sourceLayer: "nom_couche_pmtiles",
  tooltipField: "libelle",    // optionnel
  groupField: "nom_code",     // optionnel — active filtres par classe
  filterPalette: [...],       // si groupField + couleurs auto
  staticGroupLegend: [...],   // OU légende fixe (prioritaire pour l’affichage)
  colorLegend: [...],         // OU légende couleur sans filtre (ex. zonage)
  layers: [ /* fill, line, symbol… */ ],
}
```

**Familles** (`CARTO_FAMILIES`) — mêmes ids Latresne / Argelès :

| `id` | Titre |
|------|--------|
| `zonages_plu` | Zonage PLU |
| `prescriptions` | Prescriptions |
| `informations` | Informations |
| `servitudes` | Servitudes |
| `risques` | Risques |
| `environnement` | Environnement |
| `reseaux` | Réseaux |
| `cadastre` | Cadastre |

Une famille **sans couche rattachée** n’apparaît pas dans la légende.

**Cas particuliers**

- **Cadastre parcelles** : souvent GeoJSON embarqué + entrée catalogue pour la légende (Argelès : `parcelles` sans `pmtilesUrl`).
- **Bâtiments** : actuellement **standalone** (pas de `family`), comme à Argelès.

### 3. Frontend — `cartoFilters.ts`

En règle générale **aucune modification** si la couche suit les patterns existants :

- visibilité globale → gérée par `syncCartoOnMap`
- sous-filtres → `groupField` + `buildGroupFilter`

Modifier seulement si la couche a un comportement spécial (ex. cadastre, ordre des calques).

### 4. Légende

Si `cartoLayers.tsx` est correct, **rien à toucher** dans `CartoLegendPanel.tsx` (wrapper de 15 lignes).

Voir `legend/readme_legend.md` pour le détail UI.

### 5. Tooltips (optionnel)

Si la couche doit apparaître au survol : vérifier `communs/carto/cartoTooltips.ts` et la liste `CARTO_LAYERS` passée à `attachCartoHoverHandlers` dans la page.

### 6. Intersections CUA (backend métier)

Pour qu’une couche participe aux **intersections** du certificat d’urbanisme, l’ajouter aussi au catalogue intersections de la commune (ex. `catalogue_cua_argeles.json`). Ce n’est pas requis pour l’affichage carte seule.

---

## Retirer une couche

1. **Front** : supprimer l’entrée dans `CARTO_LAYERS` (et références éventuelles tooltips / page).
2. **Optionnel** : retirer du catalogue intersections CUA.
3. **Storage** : supprimer ou archiver le `.pmtiles` sur Supabase (sinon fichier orphelin).
4. **PostGIS** : la table peut rester ; seule l’exposition carto est coupée.

---

## Arborescence type (Latresne)

```
latresne/cua/
├── cartoLayers.tsx      ← AJOUT PRINCIPAL nouvelle couche
├── cartoFilters.ts      ← rarement
├── CartoLegendPanel.tsx ← ne pas modifier (wrapper communs)
└── LatresnePage.tsx     ← tooltips / mount carte

communs/carto/
├── legend/              ← UI légende partagée
└── cartoTooltips.ts
```

---

## Rappels importants

- Tout attribut utilisé dans `paint`, `groupField`, `tooltipField` **doit exister** dans les tuiles ; sinon regénérer le PMTiles.
- `id` (source) et ids des sous-couches MapLibre (`zonage-fill`, …) doivent rester **uniques** sur la carte.
- Après ajout, tester : toggle légende, sous-classes, tooltip, zoom min/max des labels.
