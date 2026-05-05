Bonne question, voilà les 4 leçons à retenir pour la prochaine fois qu'on intègre deck.gl + loaders.gl :

**1. Ne jamais hardcoder les enums deck.gl**
`coordinateSystem: 1` est invalide — deck.gl attend ses propres constantes. Toujours importer et utiliser :
```typescript
import { COORDINATE_SYSTEM } from "@deck.gl/core";
// puis : coordinateSystem: COORDINATE_SYSTEM.CARTESIAN
```

**2. La structure retournée par ArrowLoader est `{ shape, schema, data }`**
Les colonnes sont dans `data.x`, `data.y`, `data.z` directement — pas dans `data.children`, pas dans `data.attributes`, pas via `.getChild()`. Ajouter un `addLog(Object.keys(table))` et `addLog(Object.keys(table.data))` en premier réflexe pour voir la forme réelle avant d'écrire les accessors.

**3. Passer des objets simples à PointCloudLayer plutôt que des typed arrays "maison"**
La structure `{ length, attributes: { x, y, z } }` qu'on avait tenté n'est pas reconnue par deck.gl sans configuration avancée. Le tableau d'objets `{ position, color }[]` est moins optimal mais fonctionne sans ambiguïté. Optimisation typed arrays possible plus tard si les perfs le demandent.

**4. Avec CARTESIAN et des coordonnées relatives centrées sur 0, le viewState initial doit viser `[0, 0, zCenter]`**
Le Z reste en coordonnées absolues Lambert-93 (altitude NGF), donc le target doit être centré sur la vraie altitude moyenne du nuage, pas sur 0. Sinon la caméra pointe dans le vide.