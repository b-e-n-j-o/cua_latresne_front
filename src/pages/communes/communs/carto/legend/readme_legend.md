# Légende cartographique — fonctionnement

La légende droite (dans `RightSidebarPatch`) est **partagée** entre les communes. Chaque commune ne fournit que son **catalogue de couches** et ses **filtres carte**.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `cartoLegendModel.ts` | Types, construction de l’arbre catégories/couches, logique **top-K** (affichage) |
| `CartoLegendPanel.tsx` | État React, découverte des classes, sync carte, rendu UI (œil / caret / pastilles) |
| `cartoLegendShell.css` | Styles du shell légende |
| `{commune}/cua/CartoLegendPanel.tsx` | Wrapper mince : injecte `CARTO_FAMILIES`, `CARTO_LAYERS`, `cartoFilters` |
| `{commune}/cua/cartoLayers.tsx` | Familles + définition des couches |
| `{commune}/cua/cartoFilters.ts` | `discoverGroupValues`, `syncCartoOnMap`, filtres MapLibre |
| `layout/RightSidebarPatch.tsx` | Coque repliable « Légende des couches » |

## Architecture

```
RightSidebarPatch
└── CartoLegendPanel (commune wrapper)
    └── CartoLegendPanel (communs)
        ├── lit CARTO_FAMILIES + CARTO_LAYERS
        ├── appelle cartoFilters (commune)
        └── affiche arbre 3 niveaux
```

La page (`LatresnePage` / `ArgelesPage`) passe :

- `map`, `layerVisible`, `onLayerVisibleChange`
- le panel est en `embedded` dans la sidebar droite

Argelès peut remplacer temporairement le panel par `StudyZoneLegendPanel` en mode zone d’étude.

---

## Les 3 niveaux de la légende

### Niveau 1 — Catégorie (famille)

Définie dans `CARTO_FAMILIES` du `cartoLayers.tsx` de la commune.

- Œil : affiche / masque **toutes** les couches de la famille
- Caret : replie / déplie la liste des couches
- Une catégorie n’apparaît que si **au moins une couche** a `family: "id_famille"`

### Niveau 2 — Couche

Une entrée de `CARTO_LAYERS`.

- Œil : visibilité globale (`layerVisible` → `syncCartoOnMap`)
- Caret : déplie le niveau 3 si la couche a des sous-classes
- **Standalone** : couche sans `family` (ex. `batiments`) listée à la racine

### Niveau 3 — Classes (sous-filtres)

Trois modes selon la config de la couche :

| Config | Comportement |
|--------|----------------|
| `groupField` | Classes découvertes dans les tuiles visibles (`discoverGroupValues`) |
| `staticGroupLegend` | Liste fixe (couleurs connues à l’avance) ; compteurs enrichis si tuiles chargées |
| `colorLegend` seul | Affichage informatif (ex. zonage U/AU/A/N), **sans** filtre carte |

Clic sur une classe : ajoute / retire la valeur du filtre MapLibre (`visibleGroups`).

Boutons **tout / aucun** : cochent ou décochent toutes les classes de la couche.

---

## Ajouter une famille

1. Ajouter `{ id: "mon_id", title: "Mon libellé" }` dans `CARTO_FAMILIES` (`cartoLayers.tsx`).
2. Rattacher les couches avec `family: "mon_id"`.
3. Aucun changement dans `communs/carto/legend/` si l’`id` est cohérent.

Les familles vides sont masquées automatiquement.

---

## Ajouter une couche à la légende

1. Suivre `../readme_layers.md` (PMTiles + entrée `CARTO_LAYERS`).
2. Choisir `family` (ou laisser vide pour standalone).
3. Si sous-classes souhaitées : renseigner `groupField` et/ou `staticGroupLegend` / `colorLegend`.

Le wrapper `{commune}/CartoLegendPanel.tsx` **n’a pas besoin d’être modifié**.

---

## Sync avec la carte

À chaque changement de visibilité ou de filtre :

1. `CartoLegendPanel` met à jour `layerVisible` et `visibleGroups`
2. `syncCartoOnMap` (dans `cartoFilters.ts` de la commune) applique :
   - `layout.visibility` sur les sous-couches
   - filtres `["in", …]` sur le `groupField` si défini
3. `onAfterSync` (ex. Latresne) peut remonter le cadastre au-dessus des overlays

La découverte des classes se refait sur `map.on("idle")` (debounce 400 ms) quand l’utilisateur déplace/zoome la carte.

---

## Top-K — à quoi ça sert ? (utilisateur)

**Problème** : certaines couches ont des dizaines de valeurs distinctes (ZNIEFF, servitudes, prescriptions…). Une liste complète rend la sidebar illisible.

**Comportement actuel** (implémenté dans `cartoLegendModel.ts`, seuil `LEGEND_CLASS_TOP_K = 8`) :

1. On compte les entités **visibles dans la vue courante** (tuiles déjà chargées — pas d’appel backend).
2. On affiche les **8 classes les plus fréquentes** + une ligne **« Autres »** qui regroupe le reste.
3. L’utilisateur peut masquer « Autres » d’un clic (toutes les classes rares disparaissent de la carte).
4. Un message indique : `N valeurs · 8 principales + Autres`.

**Quand c’est utile** : communes avec couches à forte cardinalité (Argelès ZNIEFF, servitudes détaillées…).  
**Quand c’est peu utile** : Latresne aujourd’hui (peu de classes par couche, souvent `staticGroupLegend`).

**Ce n’est pas utile pour** : le zonage (4 catégories fixes), le cadastre, les couches sans `groupField`.

Pour désactiver le regroupement plus tard : mettre `LEGEND_CLASS_TOP_K` à une valeur très élevée (ex. `999`) dans `cartoLegendModel.ts`, ou appeler `prepareClassListForDisplay` avec ce seuil — aucun travail backend.

---

## Fichiers volontairement séparés par commune

- `cartoLayers.tsx` — catalogue et styles (différent par commune)
- `cartoFilters.ts` — quasi identique mais importe le catalogue local

Tout le **rendu** et l’**arbre** légende sont dans `communs/carto/legend/`.

---

## Mode flottant (non embedded)

Si `embedded={false}`, le panel s’affiche en overlay bas-droite sur la carte (utilisé par `LatresnePagePMTiles.tsx`). Même logique, autre conteneur CSS.
