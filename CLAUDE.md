# CLAUDE.md — Édition du site vitrine Kerelia

> **Ces règles s'appliquent quand l'utilisateur est Christophe.**
> Si l'utilisateur est Ben (CTO, mainteneur du code), elles ne s'appliquent pas :
> ses instructions sont dans `CLAUDE.local.md`.

Ce fichier est lu automatiquement par Claude Code à chaque session. Il décrit
comment aider **Christophe (CEO de Kerelia, non-développeur)** à faire évoluer
le **site vitrine** (page d'accueil et pages éditoriales) en autonomie, sans
casser l'application.

Le code est maintenu par **Ben**. Christophe travaille sur une copie locale
(zip envoyé par Ben) et lui transmet ses modifications sous forme de fichier
`.patch`. C'est Ben qui met en ligne.

---

## 1. Ton rôle

- Christophe décrit ce qu'il veut en langage naturel (« change le titre »,
  « crée une page sur la veille réglementaire », « refais cette section avec
  un visuel en deux colonnes »). Tu fais les modifications, tu lui montres le
  résultat dans le navigateur, tu itères.
- Il n'est pas développeur : explique ce que tu fais en une phrase simple,
  sans jargon. Ne lui demande jamais de taper des commandes : lance-les toi-même.
- Sur le site vitrine, **il est libre** : ne le bride pas aux éléments visuels
  existants, propose et construis ce qu'il demande.
- Tu es responsable de ne pas casser l'application. En cas de doute, demande.

## 2. Périmètre

### Zone libre : le site vitrine

Christophe est libre de faire évoluer le site vitrine comme il le souhaite :
nouveaux composants, nouvelles sections, nouveaux styles, nouvelles pages,
suppression de pages, refonte visuelle, animations… Cette zone comprend :

- `src/pages/website/**` — landing (`landingpage/`, y compris `content/`,
  `components/`, `hooks/`, `lib/`), pages éditoriales (`editorial/`),
  formulaire de démo (textes et apparence), header/footer du site
- le **registre des pages éditoriales** dans `src/pages/website/websitePages.tsx`
- `public/images/landing/**`, `public/images/website/**`,
  `public/logos-banniere/**`, `public/videos/**` — médias du site
  (créer les dossiers si besoin)
- `public/sitemap.xml` — à tenir à jour quand une page est créée ou supprimée

Contenu de la landing : de préférence dans `src/pages/website/landingpage/content/`.

### Pages éditoriales

Le modèle de blocs (`editorial/types.ts`, `EditorialPage.tsx`) est un **point
de départ, pas une contrainte**. Si Christophe veut un rendu qu'aucun bloc ne
permet :
- crée un **nouveau type de bloc** réutilisable (type dans `types.ts` +
  composant dans `editorial/components/`), ou
- donne à la page **son propre composant** avec une mise en page libre
  (déclaré dans le registre avec `component` au lieu de `content`).

Avant de modifier un bloc existant, vérifie les autres pages qui l'utilisent.

### Créer / supprimer des pages éditoriales

Christophe est libre de créer, renommer ou supprimer des pages éditoriales.

**Créer une page :**
1. Le contenu (blocs) ou le composant dédié dans `src/pages/website/editorial/`.
2. L'entrée dans le registre (`websitePages.tsx`) — URL en minuscules avec
   tirets, sans accents (ex. `/urbanisme/carte-identite-fonciere`).
3. Si Christophe le souhaite : les liens vers la page (menu du header,
   footer, landing).
4. Ajouter l'URL dans `public/sitemap.xml`.

**Supprimer une page :**
1. Retirer l'entrée du registre, puis le contenu/composant de la page.
2. Chercher et retirer **tous les liens** vers son URL :
   `grep -rn "/l-url-de-la-page" src/ public/sitemap.xml`
   Si un lien est trouvé hors de `src/pages/website/` (dans l'application),
   ne le touche pas : signale-le dans `DEMANDES-POUR-BEN.md`.
3. Retirer l'URL de `public/sitemap.xml`.
4. Prévenir Christophe : si la page était déjà en ligne et référencée sur
   Google, une redirection peut être utile → noter dans `DEMANDES-POUR-BEN.md`.

Ne supprime **jamais** une page qui n'est pas éditoriale (/cua, pages
applicatives, set-password, démo), même si Christophe le demande : explique-lui
pourquoi.

### Ce qui fait tourner l'application — INTERDIT

- La page métier **/cua** et toutes les pages applicatives (CUA, KerERC,
  KerFoncier, cartes, espaces connectés…) et leurs composants
- **L'authentification et la session** : `src/pages/website/set-password/**`,
  les hooks d'auth, la logique connecté/déconnecté et le bouton de connexion
  du header (tu peux changer son apparence, pas son comportement, ses libellés
  « connexion » / « mon espace » ni sa destination)
- **Formulaire de démo** : noms des champs envoyés (`email`, `subject`,
  `message`), requête d'envoi, appels réseau (textes et apparence : libres)
- Supabase, appels API, données
- `App.tsx` et le routing de l'application (les pages éditoriales passent
  uniquement par le registre de `websitePages.tsx`)
- Configuration du projet : `index.html`, `vite.config.*`, `tsconfig*`,
  `package.json`, `pnpm-lock.yaml`, `.env*`
- **Dépendances** : pas de `pnpm add` / `npm install <paquet>`
- Fichiers partagés avec l'application : tout `src/` hors `pages/website/`,
  et dans `public/` : `fonts/`, `tinymce/`, `data/`, `geojson/`, `svgs/`,
  `icons/`, `assets/`, `images/france-map-frames/`, favicons, `robots.txt`,
  `og.jpg`, `landing_page.html`, et les **images existantes à la racine de
  `public/`** (ne pas les écraser ni les supprimer, certaines servent à
  l'application : pour remplacer une image, ajoute la nouvelle dans
  `public/images/website/` et change son chemin dans le code du site)
- `CLAUDE.md`, `DEMARRAGE_CHRIS.md`

**Si une demande touche à cette zone** (nouvelle librairie, parcours de
connexion, modification de l'appli…) : ne la fais pas. Explique-le simplement
à Christophe et ajoute la demande dans `DEMANDES-POUR-BEN.md` (à la racine,
format indiqué dans le fichier).

## 3. Règles techniques

- Stack : React + TypeScript + Vite + Tailwind v4 (`@tailwindcss/vite`),
  gestionnaire **pnpm**.
- **CSS toujours scopé — règle non négociable.** Styles de la landing sous
  `.kerelia-landing`, pages éditoriales sous `.kerelia-editorial` (ou une
  classe propre à la page). Jamais de règle globale sur `body`, `*`, `a`,
  `button`, `h1`… : ça casse /cua et les autres pages de l'application.
- Pas de `!important` : augmente la spécificité avec la classe de scope.
- Contenu ≠ code (recommandé) : quand c'est simple, mets les textes dans des
  fichiers de contenu (`landingpage/content/`, contenu en blocs des pages
  éditoriales). Pas bloquant si une mise en page particulière l'exige.
- Christophe peut créer de nouveaux styles et éléments visuels. Garde par
  défaut la typographie et la palette Kerelia, sauf demande contraire.
- Images : `.webp` ou `.jpg` optimisés, < 300 Ko si possible, dans
  `public/images/website/` (ou `public/images/landing/` pour la landing).
  Toujours un `alt` descriptif en français.
- Responsive : vérifie le rendu **desktop (> 834 px)** ET **mobile (~390 px)**.
  Sous 834 px, le fond photo du hero de la landing est volontairement masqué.
- Textes en français, orthographe soignée. N'invente jamais de chiffres,
  clients, références ou témoignages : demande les vrais à Christophe.

## 4. Démarrage d'une session

Vérifie dans cet ordre :

1. **Git local** — s'il n'y a pas de dossier `.git` (premier lancement uniquement) :
   ```bash
   git init && git add -A && git commit -m "baseline"
   ```
   `baseline` = l'état exact du zip envoyé par Ben.
2. **Variables d'environnement** — s'il n'y a pas de `.env.local`, demande à
   Christophe les valeurs que Ben lui a transmises et crée le fichier.
   Ne jamais le committer ni l'inclure dans un patch.
3. **Outils et dépendances** — le projet utilise **pnpm** (pas npm).
   - Si `node` ou `git` manquent : guide Christophe pas à pas (Node.js LTS, git).
   - Si `pnpm` manque : `corepack enable pnpm` ; si corepack n'est pas
     disponible : `npm install -g pnpm`.
   - Si `node_modules` est absent : `pnpm install --frozen-lockfile`
     (ne jamais modifier `pnpm-lock.yaml`).
4. **Aperçu** — lance `pnpm dev` en tâche de fond et ouvre la page concernée
   (en général http://localhost:5173/). Laisse-le tourner : les modifications
   s'affichent automatiquement.
5. **Modifs en attente** — si `git status` ou `git log envoye..HEAD` montrent
   des modifications non envoyées d'une session précédente, rappelle-le à Christophe.

## 5. Pendant le travail

- Une demande = une modification ciblée, puis montre le résultat.
- Après chaque série de changements validée par Christophe, commit local
  avec un message clair en français :
  ```bash
  git add -A && git commit -m "Site : nouvelle page veille réglementaire"
  ```
  « Annule la dernière modif » → `git revert HEAD` (ou `git reset --hard HEAD~1`
  si ce commit n'a pas encore été envoyé à Ben).
- Si l'aperçu affiche une erreur, corrige-la avant de continuer. Ne laisse
  jamais Christophe sur une page cassée.

## 6. Envoi des modifications à Ben

Quand Christophe est satisfait et veut publier :

1. **Build** (doit passer sans erreur) :
   ```bash
   pnpm build
   ```
2. **Contrôle du périmètre** — liste les fichiers modifiés depuis le dernier envoi :
   ```bash
   BASE=$(git rev-parse -q --verify envoye || echo baseline)
   git diff --name-only $BASE HEAD
   ```
   Tous doivent appartenir à la zone libre de la section 2 (plus
   éventuellement `DEMANDES-POUR-BEN.md`). Sinon, annule la partie hors
   périmètre avant d'envoyer.
3. **Vérifier que l'application n'est pas impactée** : ouvre /cua dans
   l'aperçu et vérifie que son apparence n'a pas changé (signe d'une règle CSS
   non scopée).
4. **Générer le patch** :
   ```bash
   git add -A && git commit -m "<résumé>"   # si des modifs ne sont pas commitées
   BASE=$(git rev-parse -q --verify envoye || echo baseline)
   git diff --binary $BASE HEAD > modifs-site-$(date +%Y%m%d-%H%M).patch
   git tag -f envoye
   ```
5. **Résumé pour Ben** — rédige une liste à puces simple en français des
   modifications (pages créées/supprimées en premier, puis le reste, + les
   nouvelles entrées de `DEMANDES-POUR-BEN.md` s'il y en a), que Christophe
   collera dans son message.
6. Dis à Christophe où se trouve le fichier `.patch` (chemin complet) et :
   « Envoie ce fichier à Ben avec ce résumé. Si tu en envoies plusieurs,
   précise l'ordre : ils doivent être appliqués dans l'ordre. »

## 7. Nouveau zip de Ben

Quand Ben envoie un zip plus récent, Christophe repart de ce nouveau zip dans
un **nouveau dossier** et n'utilise plus l'ancien. Avant de changer, vérifie
qu'il n'y a pas de modifications non envoyées dans l'ancien dossier
(`git status` + `git log envoye..HEAD`) ; sinon, génère d'abord un patch.

## 8. Ce que tu ne fais jamais

- Supprimer ou réécrire massivement des fichiers sans le dire à Christophe.
- Toucher à la zone INTERDIT de la section 2.
- Écrire une règle CSS globale (non scopée).
- Mettre des secrets, clés ou mots de passe dans le code ou dans un patch.
- Lancer des commandes de publication (Vercel, `git push`, déploiement) :
  la mise en ligne, c'est Ben.