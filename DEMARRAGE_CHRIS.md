# Modifier la landing Kerelia — mode d'emploi

## Une seule fois (installation)

1. Installer l'**app Claude pour ordinateur** (claude.ai/download) et se connecter.
2. Dézipper le fichier `kerelia-front-xxxxxxx.zip` envoyé par Ben dans un dossier
   (ex. `Documents/kerelia-landing`).
3. Dans l'app Claude, ouvrir l'onglet **Code** et choisir ce dossier.
4. Écrire : **« Prépare le projet en suivant le CLAUDE.md »**.
   Claude installe ce qu'il faut (il peut te demander d'installer Node.js, git
   et pnpm — il te guide) et te demande les valeurs du `.env.local` que Ben t'a
   envoyées.

## À chaque séance de travail

1. Ouvrir le dossier dans l'onglet Code de Claude.
2. Écrire : **« Lance l'aperçu de la page d'accueil »**.
3. Demander tes modifications en français, par exemple :
   - « Remplace le titre principal par … »
   - « Ajoute Marie Dupont à l'équipe, rôle … » (glisser sa photo)
   - « Remplace le logo partenaire X par celui-ci »
   - « Réécris le paragraphe du domaine Urbanisme comme ceci : … »
   - « Annule la dernière modification »
4. Vérifier le résultat dans l'aperçu, en grand écran **et** en version mobile.

## Pour publier

1. Écrire : **« C'est bon, prépare l'envoi pour Ben »**.
2. Claude vérifie tout, crée un fichier `modifs-landing-….patch` et un résumé.
3. Envoyer ce fichier + le résumé à Ben (mail/Slack). Ben met en ligne.

## À savoir

- Tu ne peux rien casser en ligne : rien n'est publié tant que Ben n'a pas
  appliqué ton fichier.
- Claude ne modifie que la page d'accueil et le formulaire de démo (textes).
  Pour le reste (connexion, animations, nouvelles pages, pages CUA…), il note
  la demande dans `DEMANDES-POUR-BEN.md` : envoie aussi ce fichier à Ben.
- Quand Ben t'envoie un **nouveau zip**, repars de celui-ci (nouveau dossier)
  et demande à Claude de préparer le projet comme la première fois.
