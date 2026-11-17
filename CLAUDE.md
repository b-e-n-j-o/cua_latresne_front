# CLAUDE.md — Édition de la landing Kerelia

> **Ces règles s'appliquent quand l'utilisateur est Christophe.**
> Si l'utilisateur est Ben (CTO, mainteneur du code), elles ne s'appliquent pas :
> ses instructions sont dans `CLAUDE.local.md`.

Ce fichier est lu automatiquement par Claude Code à chaque session. Il décrit
comment aider **Christophe (CEO de Kerelia, non-développeur)** à modifier la
page d'accueil du site, en autonomie, sans casser le reste de l'application.

Le code est maintenu par **Ben**. Christophe travaille sur une copie locale
(zip envoyé par Ben) et lui transmet ses modifications sous forme de fichier
`.patch`. C'est Ben qui met en ligne.

---

## 1. Ton rôle

- Christophe décrit ce qu'il veut en langage naturel (« change le titre »,
  « ajoute un membre à l'équipe », « remplace cette image »). Tu fais les
  modifications, tu lui montres le résultat dans le navigateur, tu itères.
- Il n'est pas développeur : explique ce que tu fais en une phrase simple,
  sans jargon. Ne lui demande jamais de taper des commandes : lance-les toi-même.
- Tu es responsable de ne rien casser. En cas de doute, demande-lui avant.

## 2. Périmètre — RÈGLE ABSOLUE

**À privilégier : la grande majorité des demandes se font ici.**
- `src/pages/website/landingpage/content/**` — tout le contenu éditorial de la
  landing et du formulaire de démo, un fichier par section (textes, liens,
  listes, équipe, partenaires, domaines, chemins des images et vidéos…).
  `index.ts` réexporte tout.

**Tu peux modifier (mise en page, style) :**
- `src/pages/website/landingpage/LandingPage.tsx`, `landingPageSections.tsx`
- `src/pages/website/landingpage/components/**` (sauf restrictions ci-dessous)
- `src/pages/website/landingpage/kereliaLandingPage.css`, `components/**/*.css`
- `public/images/landing/**` — **nouvelles** images de la landing (créer le dossier si besoin)
- `public/logos-banniere/**` — logos partenaires (ajout/remplacement)
- `public/videos/nos-domaines/**` — vidéos des panneaux domaines (ajout/remplacement)

**Médias existants ailleurs dans `public/`** (`benjamin.png`, `christophe.png`,
`bg-bdx-mtropole.png`, logos Kerelia…) : ne pas les écraser ni les supprimer,
certains servent aussi à l'application. Pour remplacer une image, ajoute la
nouvelle dans `public/images/landing/` et change son chemin dans `content/`.

**Uniquement en passant par `content/` (pas la logique du composant) :**
- `components/KereliaSiteHeader.tsx` — ne pas toucher à l'affichage
  connecté/déconnecté, au bouton de connexion ni à tout ce qui concerne la session.
- `src/pages/website/DemoRequestPage.tsx` — ne pas toucher à l'envoi du
  formulaire, aux noms des champs envoyés (`email`, `subject`, `message`) ni
  aux appels réseau.

**Interdit sans accord explicite de Ben** (animations GSAP/Lenis fragiles) :
- `src/pages/website/landingpage/hooks/**`
- `src/pages/website/landingpage/lib/**`

**Tu ne modifies JAMAIS :**
- `src/pages/website/set-password/**` (authentification)
- `src/pages/website/websitePages.ts`, `src/pages/website/placeholders/**` (routing)
- dans `public/` : `fonts/`, `tinymce/`, `data/`, `geojson/`, `svgs/`, `icons/`,
  `assets/`, `images/france-map-frames/`, favicons, `robots.txt`, `sitemap.xml`,
  `landing_page.html`, `og.jpg`
- tout ce qui est hors de `src/pages/website/` et des dossiers `public/` autorisés ci-dessus :
  pages applicatives (CUA, KerERC, KerFoncier…), auth, Supabase, API, `App.tsx`,
  `index.html`, `vite.config.*`, `tsconfig*`, `package.json`, `pnpm-lock.yaml`, `.env*`
- ce fichier `CLAUDE.md` et `DEMARRAGE_CHRIS.md`

**Relèvent de Ben** (à noter dans `DEMANDES-POUR-BEN.md`, ne pas faire) :
- les libellés du bouton de session (« connexion » / « mon espace ») — ils
  viennent du hook d'auth ;
- les champs du formulaire de démo et ce qu'il envoie ;
- les animations, la carte de France animée, le scroll ;
- toute nouvelle page, toute modification de l'application ;
- **toute nouvelle dépendance** (`pnpm add`, `npm install <paquet>`…).

**Si une demande sort du périmètre** : ne la fais pas. Explique simplement à
Christophe que ça touche à l'application, et ajoute la demande dans
`DEMANDES-POUR-BEN.md` (à la racine, format indiqué dans le fichier). C'est le
seul fichier hors périmètre que tu as le droit de modifier.

## 3. Règles techniques

- Stack : React + TypeScript + Vite + Tailwind v4 (`@tailwindcss/vite`), gestionnaire **pnpm**.
- **Contenu ≠ code** : tout texte, lien, liste ou chemin de média va dans le
  fichier de `content/` de la section concernée, jamais en dur dans un
  composant. Respecte les types exportés : si le build casse, c'est souvent
  qu'un champ manque ou est mal typé.
- Contenu riche (gras, lien dans un paragraphe) : utilise le format déjà en
  place dans `content/`, pas de JSX dans les fichiers de contenu.
- Styles de la landing **scopés sous `.kerelia-landing`**. Toute nouvelle règle
  CSS doit l'être aussi (`.kerelia-landing .ma-classe { … }`). Jamais de règle
  globale sur `body`, `*`, `a`, `button`, `h1`… : ça casse les autres pages.
- Pas de `!important` : augmente la spécificité avec `.kerelia-landing`.
- Images : `.webp` ou `.jpg` optimisés, < 300 Ko si possible, dans
  `public/images/landing/`, référencées dans le fichier de `content/` de la section. Toujours un `alt` descriptif en français.
- Respecte le style existant (couleurs, typographies, espacements). Pour une
  nouvelle section, inspire-toi des sections existantes.
- Responsive : vérifie le rendu **desktop (> 834 px)** ET **mobile (~390 px)**.
  Sous 834 px, le fond photo du hero est volontairement masqué.
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
4. **Aperçu** — lance `pnpm dev` en tâche de fond et ouvre la page d'accueil
   (en général http://localhost:5173/). Laisse-le tourner : les modifications
   s'affichent automatiquement.
5. **Modifs en attente** — si `git status` ou `git log envoye..HEAD` montrent
   des modifications non envoyées d'une session précédente, rappelle-le à Christophe.

## 5. Pendant le travail

- Une demande = une modification ciblée, puis montre le résultat.
- Après chaque série de changements validée par Christophe, commit local
  avec un message clair en français :
  ```bash
  git add -A && git commit -m "Landing : nouveau titre du hero"
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
   Tous doivent être autorisés par la section 2 (plus éventuellement
   `DEMANDES-POUR-BEN.md`). Sinon, annule la partie hors périmètre avant d'envoyer.
3. **Générer le patch** :
   ```bash
   git add -A && git commit -m "<résumé>"   # si des modifs ne sont pas commitées
   BASE=$(git rev-parse -q --verify envoye || echo baseline)
   git diff --binary $BASE HEAD > modifs-landing-$(date +%Y%m%d-%H%M).patch
   git tag -f envoye
   ```
4. **Résumé pour Ben** — rédige une liste à puces simple en français des
   modifications (+ mention des nouvelles entrées dans `DEMANDES-POUR-BEN.md`
   s'il y en a), que Christophe collera dans son message.
5. Dis à Christophe où se trouve le fichier `.patch` (chemin complet) et :
   « Envoie ce fichier à Ben avec ce résumé. Si tu en envoies plusieurs,
   précise l'ordre : ils doivent être appliqués dans l'ordre. »

## 7. Nouveau zip de Ben

Quand Ben envoie un zip plus récent, Christophe repart de ce nouveau zip dans
un **nouveau dossier** et n'utilise plus l'ancien. Avant de changer, vérifie
qu'il n'y a pas de modifications non envoyées dans l'ancien dossier
(`git status` + `git log envoye..HEAD`) ; sinon, génère d'abord un patch.

## 8. Ce que tu ne fais jamais

- Supprimer ou réécrire massivement des fichiers sans le dire à Christophe.
- Toucher à quoi que ce soit hors du périmètre de la section 2.
- Mettre des secrets, clés ou mots de passe dans le code ou dans un patch.
- Lancer des commandes de publication (Vercel, `git push`, déploiement) :
  la mise en ligne, c'est Ben.
