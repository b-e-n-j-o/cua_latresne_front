# Modifications apportées au site Kerelia.fr

## Fichiers modifiés (à remplacer dans le dépôt)

Les 7 fichiers de l'archive `kerelia_modifs.zip` remplacent directement leurs équivalents dans le dépôt `cua_latresne_front`. Il suffit de les copier à la racine du projet en conservant l'arborescence.

---

## Résumé des modifications

### 1. Header — Menu "Vous êtes…" (`KereliaSiteHeader.tsx`)
- Ajout d'un composant `VousEtesDropdown` entre le logo KERELIA et la navigation
- 6 profils visiteurs : Collectivité territoriale, Service de l'État, Bureau d'études, Aménageur, Opérateur de compensation, Profession du foncier
- Chaque profil redirige vers `/profil/[slug]` (pages à créer)

### 2. Hero — Textes mis à jour (`LandingPageContent.ts`)
- Sous-titre : "Kerelia produit des analyses réglementaires, environnementales et foncières à partir des référentiels publics et propriétaires."
- Coordonnées : "BORDEAUX 44.836° N 0.578° W" / "INCUBÉE A TECHNOWEST"

### 3. Ordre des sections inversé (`LandingPage.tsx`)
- "Nos domaines" (carrousel) passe AVANT "Sources & partenariats"
- Ordre final : Hero → Nos domaines → Sources & partenariats → En détail → Nos engagements → En chiffres → Qui sommes-nous → Contact → Footer

### 4. Section "Nos engagements" (ex-Méthodologie) (`LandingPageContent.ts` + `landingPageSections.tsx`)
- Nouveau titre : "Nos engagements."
- Introduction : souveraineté des données
- 4 piliers : Souveraineté / Traçabilité / Conformité / Identité
- Grille passée de 5 à 4 colonnes

### 5. Nouvelle section "En chiffres." (`LandingPageContent.ts` + `landingPageSections.tsx` + CSS)
- 4 métriques : 1 min (CUa) / 15 min (étude enviro) / −30% (instruction) / 24/7 (veille)
- 3 témoignages placeholder (à remplacer par de vrais témoignages)

### 6. Section "Qui sommes-nous." (ex-À propos + Équipe) (`LandingPageContent.ts` + `landingPageSections.tsx` + `TeamSection.tsx`)
- Titre changé : "Qui sommes-nous."
- Tagline : "Fondée en 2025 · Bordeaux · Incubée à Technowest · Couverture nationale"
- Suppression des 3 piliers redondants (Urbanisme/Environnement/Logiciels)
- Carte de France conservée (classe `about__map-col--small` pour la réduire)
- Citations ajoutées aux profils d'équipe (blockquote au-dessus de la description)
- Ligne partenaires en bas de section

### 7. Supabase Client (`supabaseClient.ts`)
- Mode dégradé ajouté : si les credentials sont absents, un proxy noop évite le crash de l'app (utile pour le dev local sans backend)

---

## Styles CSS ajoutés (`kereliaLandingPage.css`)
- `.kh__vous-etes-*` : styles du menu déroulant "Vous êtes…"
- `.metrics__*` : styles de la section chiffres et témoignages
- `.team__quote` : style des citations d'équipe
- `.about__map-col--small` : carte de France réduite
- `.method__intro` : paragraphe d'introduction de la section engagements
- Grille `.method__steps` passée de `repeat(5, 1fr)` à `repeat(4, 1fr)`

---

## À faire côté développeur
1. Remplacer les fichiers dans le dépôt
2. Créer les routes `/profil/collectivite`, `/profil/etat`, etc. (pages dédiées par profil)
3. Remplacer les 3 témoignages placeholder par de vrais témoignages quand disponibles
4. Optionnel : réduire visuellement la carte de France animée (ajuster le CSS `about__map-col--small`)
