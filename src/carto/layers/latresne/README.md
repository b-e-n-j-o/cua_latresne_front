# Personnalisation des couches Latresne

Ce dossier contient les fichiers de configuration et d'enregistrement des couches cartographiques pour Latresne.

## Structure

- **`plu.ts`** : Enregistrement et personnalisation de la couche PLU Latresne avec couleurs dynamiques
- **`config.ts`** : Configuration centralisée des couleurs et styles pour les autres couches
- **`index.ts`** : Configuration générale (peut être utilisé pour d'autres projets)

## Comment personnaliser les couleurs

### 1. Pour le PLU Latresne (`plu_latresne`)

Le fichier `plu.ts` gère automatiquement les couleurs basées sur `zonage_reglement` avec une palette de 30 couleurs. Les couleurs sont assignées dynamiquement au fur et à mesure du chargement des tuiles.

Pour modifier la palette, éditez le tableau `PALETTE` dans `plu.ts` :

```typescript
const PALETTE = [
  "#4C51BF", "#6B46C1", "#805AD5", // ... vos couleurs
];
```

### 2. Pour les autres couches

Éditez le fichier `config.ts` :

#### Option A : Personnaliser par ID de couche

Ajoutez une entrée dans `LAYER_STYLES` :

```typescript
export const LAYER_STYLES: Record<string, LayerStyleConfig> = {
  "ac1": {
    fill: "#F6AD55",
    fillOpacity: 0.35,
    outline: "#DD6B20",
    outlineWidth: 1.2
  },
  "votre_couche_id": {
    fill: "#VOTRE_COULEUR",
    fillOpacity: 0.4,
    outline: "#VOTRE_COULEUR_OUTLINE",
    outlineWidth: 1.5
  }
};
```

#### Option B : Personnaliser par type de couche

Modifiez `DEFAULT_COLORS_BY_TYPE` :

```typescript
const DEFAULT_COLORS_BY_TYPE: Record<string, LayerStyleConfig> = {
  "Servitudes": {
    fill: "#VOTRE_COULEUR",
    fillOpacity: 0.4,
    outline: "#VOTRE_COULEUR_OUTLINE",
    outlineWidth: 1.2
  },
  // ...
};
```

### 3. Créer une nouvelle couche spéciale

Si vous avez besoin d'une couche avec un système de couleurs dynamique (comme le PLU), créez un nouveau fichier dans ce dossier :

1. Créez `votre_couche.ts` en vous inspirant de `plu.ts`
2. Ajoutez `"votre_couche_id"` dans `isSpecialLayer()` dans `config.ts`
3. Importez et enregistrez la couche dans `LatresneMap.tsx` :

```typescript
import registerVotreCoucheLayer from "../carto/layers/latresne/votre_couche";

// Dans map.on("load")
registerVotreCoucheLayer(map, API_BASE);
```

## Exemples

### Personnaliser une couche spécifique

```typescript
// Dans config.ts
LAYER_STYLES["prescriptions_surf_latresne"] = {
  fill: "#FF0000",
  fillOpacity: 0.5,
  outline: "#CC0000",
  outlineWidth: 2
};
```

### Personnaliser tous les zonages PLU

```typescript
// Dans config.ts
DEFAULT_COLORS_BY_TYPE["Zonage PLU"] = {
  fill: "#00FF00",
  fillOpacity: 0.6,
  outline: "#00CC00",
  outlineWidth: 1.5
};
```

