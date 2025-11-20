Voici une **documentation interne claire, complète et structurée**, conçue pour un développeur qui rejoint ton projet **Kerelia** et doit comprendre rapidement **la nouvelle interface avec éditeur CUA**, l’usage du bucket unique **visualisation**, et les endpoints associés.

---

# 🧠 **Documentation interne — Kerelia : Nouvelle interface CUA (Éditeur + téléchargements)**

*Version mise à jour — Novembre 2025*

---

# 🎯 **Objectif général**

La nouvelle interface Kerelia permet désormais :

1. **d’afficher automatiquement les CUA générés**,
2. **de les modifier directement dans la web-app**,
3. **de les réécrire sur Supabase au format DOCX**,
4. **de télécharger le CUA en DOCX ou PDF**,
5. **d’ouvrir les cartes 2D/3D via une page dédiée**,
6. **d’utiliser un bucket unique `visualisation/` pour tous les fichiers (html, docx, json)**.

Elle remplace complètement l’ancien système où l’agent devait récupérer les fichiers depuis Supabase ou via des endpoints séparés.

---

# 📁 **1. Architecture générale**

### Buckets utilisés (mise à jour)

Nous n’utilisons désormais **qu’un seul bucket** :

### **`visualisation/`**

Il contient, pour chaque dossier (= pipeline) :

```
visualisation/{slug}/
    ├── CUA_unite_fonciere.docx
    ├── carte_2d.html
    ├── carte_3d.html
    ├── pipeline_result.json
    ├── sub_orchestrator_result.json
    ├── autres fichiers éventuels...
```

Ainsi, toute récupération de fichier côté front-end utilise le même format de chemin.

---

# 🧬 **2. Fonctionnement du token CUA (`t=...`)**

Chaque bouton d’accès au CUA (viewer, éditeur ou downloads) fonctionne via un **token sécurisé** encodé en base64 contenant :

```json
{
  "docx": "WXAszF5YF7RfqrgW5iVoAGP4fW/CUA_unite_fonciere.docx",
  "slug": "WXAszF5YF7RfqrgW5iVoAGP4fW"
}
```

Ce token est utilisé pour éviter que le front ne manipule des chemins sensibles.

---

# 🧰 **3. Endpoints backend (FastAPI)**

### ✔ `/cua/html?t=`

Convertit le DOCX → HTML (via Mammoth)
→ Permet l’affichage dans TinyMCE

### ✔ `/cua/update`

Reconstruit un DOCX depuis HTML (via Pandoc) puis réécrit dans `visualisation/{slug}/`.

### ✔ `/cua/download/docx?t=`

Télécharge le DOCX depuis Supabase.

### ✔ `/cua/download/pdf?t=`

Convertit le DOCX → PDF **à la demande**
(ne dépend plus du pipeline)

### ✔ `/maps?t=`

Affiche la page publique de visualisation 2D+3D.

---

# 🖥️ **4. Front-End — Composants clés**

## ✔ `MainApp.tsx`

Rôles :

* affiche l’historique depuis `/pipelines/by_user`
* contient l’état `selectedSlug`
* affiche soit :

  * le **CuaEditor** si un dossier est sélectionné
  * un écran vide "Sélectionnez un dossier…"

**La zone "Nouveau dossier" a été déplacée dans la sidebar**.

---

## ✔ `HistorySidebar.tsx`

Rôles :

* liste de tous les dossiers CUA d’un utilisateur
* bouton **"Nouveau dossier"** ajouté en haut
* sélection → met à jour `selectedSlug` dans `MainApp`
* ouvre automatiquement l’éditeur

---

## ✔ `CuaEditor.tsx`

Cœur de la modification / export des CUA.

Fonctionnalités :

### 1. Charger le CUA (GET `/cua/html?t=...`)

* utilise le token généré à partir du champ `output_cua`
* convertit le DOCX → HTML via Mammoth

### 2. Enregistrer le CUA (POST `/cua/update`)

* convertit HTML → DOCX via Pandoc
* upload dans Supabase → bucket `visualisation/`

### 3. Télécharger DOCX / PDF

Boutons :

```
/cua/download/docx?t=...
/cua/download/pdf?t=...
```

### 4. Boutons d’accès aux cartes

**→ remplacés par un seul bouton "Afficher cartes"**
qui ouvre :

```
https://kerelia.fr/maps?t=...
```

Cette page charge correctement les HTML Supabase via blob URL.

---

# 🔧 **5. Le helper get_docx_path() (backend)**

Comme désormais *tout* est dans le bucket `visualisation`, le backend utilise une fonction générique pour récupérer le chemin :

```python
def get_docx_path(url_or_path: str) -> str:
    """
    Nettoie automatiquement un lien Supabase 'full' et renvoie
    uniquement le chemin relatif utilisé par supabase.storage.
    """
    if "/object/public/" in url_or_path:
        return url_or_path.split("/object/public/")[1]
    return url_or_path.lstrip("/")
```

Plus besoin de manipulation dans le front :

### ✔ **Ligne 36 de CuaEditor simplifiée**

Avant :

```ts
const idx = url.indexOf("/object/public/");
return url.substring(idx + "/object/public/".length);
```

Maintenant (plus simple) :

```ts
return dossier?.output_cua ? dossier.output_cua : null;
```

Le backend nettoie le path tout seul.

---

# 🗺️ **6. Système d'affichage des cartes**

### Pourquoi un endpoint intermédiaire `/maps` ?

Car Supabase renvoie :

* le code HTML brut
* sans exécuter les scripts JS (Leaflet, Plotly, etc)
  → résultat : un écran noir avec le code dans `<html>`

### `/maps?t=` est la page qui :

1. fetch le HTML depuis Supabase
2. le transforme en `Blob`
3. insère le blob dans un `<iframe>`
   → la carte fonctionne à 100%.

C’est ce lien qui est maintenant utilisé dans :

* QR code
* bouton "Afficher cartes" dans l’éditeur

---

# 💾 **7. Pipeline (orchestrateur global)**

Ce qui est produit dans `OUT_DIR` est ensuite uploadé dans :

```
visualisation/{slug}/
```

Parmi les fichiers uploadés :

* `CUA_unite_fonciere.docx`
* `carte_2d.html`
* `carte_3d.html`
* `sub_orchestrator_result.json`
* `pipeline_result.json`

Le pipeline fournit aussi :

* `maps_page` → lien `/maps?t=...`
* `cua_viewer_url` → lien `/cua?t=...`

---

# 🧭 **8. Workflow complet (du point de vue d’un utilisateur)**

### 1. Il dépose un CERFA → pipeline démarre

### 2. À la fin, le CUA se charge automatiquement

### 3. L’utilisateur peut :

* modifier la mise en forme / contenu
* sauvegarder (DOCX réécrit automatiquement)
* télécharger en DOCX
* télécharger en PDF
* afficher les cartes dans une page dédiée

### 4. Le dossier reste dans l’historique pour consultation ultérieure.

---

# 🚀 **9. Roadmap recommandée**

* Ajouter un bouton **“Voir pipeline_result.json”** dans l’éditeur
* Ajouter commentaires collaboratifs
* Gérer les versions du CUA
* Ajouter un second template CUA type B (CUb)

---

# 🎉 Fin de la documentation

Si tu veux, je peux aussi :

* générer la **documentation PDF prête à envoyer**,
* produire **un schéma d’architecture visuel** (Mermaid),
* rédiger **une doc backend only**,
* **commenter l'intégralité du code CuaEditor**,
* préparer un **onboarding dev complet de 5 pages**.
