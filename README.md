
## PronoteBoost

Extension Chrome avec panneau latéral pour générer puis injecter des appréciations dans Pronote.

## Démarrage

1. Installer les dépendances frontend.

```bash
npm install
```

2. Copier l'environnement d'exemple puis renseigner la clé Gemini.

```bash
cp .env.example .env
```

3. Lancer le frontend Vite.

```bash
npm run dev
```

4. Dans un second terminal, lancer le backend minimal Gemini.

```bash
npm run dev:server
```

## Variables d'environnement

- `VITE_PRONOTEBOOST_API_URL` : URL publique du backend appelée par l'extension.
- `GEMINI_API_KEY` : **clé API Gemini côté serveur uniquement (obligatoire)**. Aucune clé côté client.
- `GEMINI_MODEL` : modèle Gemini à utiliser. Par défaut `gemini-2.0-flash`.
- `GEMINI_PROMPT_APPEND` : consignes supplémentaires injectées à la fin du prompt IA (optionnel).
- `PORT` : port du backend local. Par défaut `8787`.

## Configuration professeur

Chaque professeur peut configurer via l'écran "Générer":
- **Matière** : stockée en localStorage (e.g., "Anglais", "Mathématiques").
- **Phrases d'appréciation préférées** : liste d'exemples que l'IA utilisera pour imitér votre style, stockée en localStorage.

Ces paramètres aident l'IA à produire des appréciations plus adaptées à votre contexte disciplinaire et votre style pédagogique.

## Sécurité anti-inversion

L'extension impose un **matching strict par rowKey** pour éviter les inversions d'appréciations :
- Si un élève n'a pas de rowKey (extraction incomplète), l'insertion échoue avec un message clair.
- Aucun fallback par nom normalisé pour eliminer toute ambiguïté.
- Action corrective : recharger la liste élèves depuis Pronote.

## Build extension

```bash
npm run build
```

Charger ensuite le dossier généré `dist` comme extension non packée dans Chrome.

## MEP (Mise En Production)

### Déploiement recommandé: Render + GitHub

1. Pousser le repo sur GitHub (ex: `Cambrouillolage/pronoteboost`).
2. Sur Render, choisir **New +** -> **Blueprint** et sélectionner le repo.
3. Render lit `render.yaml` et crée le service `pronoteboost-api`.
4. Renseigner les variables d'environnement Render:
	- `OPENAI_API_KEY` (obligatoire)
	- `OPENAI_MODEL` (optionnel, défaut `gpt-4.1-mini`)
	- `OPENAI_FALLBACK_MODEL` (optionnel, défaut `gpt-4o-mini`)
	- `OPENAI_PROMPT_APPEND` (optionnel)
5. Après déploiement, récupérer l'URL publique Render, puis rebuild l'extension avec cette URL:

```bash
VITE_PRONOTEBOOST_API_URL=https://<service>.onrender.com npm run package:extension
```

6. Charger l'extension buildée (dossier `dist` ou zip généré) dans `chrome://extensions`.

### 1. Préparer l'environnement serveur

Configurer `.env` sur la machine serveur:

- `GEMINI_API_KEY` (obligatoire)
- `GEMINI_MODEL` (optionnel)
- `GEMINI_PROMPT_APPEND` (optionnel, pour consignes métier)
- `PORT` (optionnel)

Lancer ensuite le backend:

```bash
npm run start:server
```

### 2. Construire l'extension

```bash
npm run package:extension
```

Cette commande produit:

- `dist/` (dossier extension)
- `pronoteboost-extension.zip` (archive de livraison)

### 3. Déployer côté navigateur (collège/prof)

Option A (test rapide):

- Ouvrir `chrome://extensions`
- Activer le mode développeur
- Charger l'extension non empaquetée depuis `dist/`

Option B (distribution ZIP interne):

- Extraire `pronoteboost-extension.zip`
- Charger le dossier extrait via `chrome://extensions`

### 4. Validation post-MEP

- Le clic sur l'icône ouvre bien le panneau latéral.
- L'écran d'accueil s'affiche sans erreur 404.
- L'écran de génération affiche un bloc "Configuration Professeur" (matière + phrases préférées).
- L'insertion écrit dans la colonne `App. A : Appréciations` **sans jamais inverser les appréciations**.
- Le backend répond sur `GET /api/health` avec `acceptsClientGeminiKey: false`.

## Endpoints backend

- `GET /api/health` — infos serveur (modèle, clé présente, mode serveur-only).
- `POST /api/generate-appreciation` — génère une appréciation (body: `{ studentName, average, tone, principles, freeText, subject, teacherPreferences }`).

## Architecture IA

La logique IA est centralisée dans `server/aiService.js` :
- Construction du prompt enrichi (matière + phrases préférées + données étudiant).
- Appel API Gemini avec validation stricte de la réponse JSON.
- Rejet explicite de toute réponse non conforme.

## Notes

- La clé Gemini n'est jamais exposée au frontend.
- Les préférences du professeur (matière, phrases) restent en localStorage jusqu'à une future intégration base de données.
- Le content script parcourt la grille Pronote pour extraire et injecter même si la liste est virtualisée.
- En cas d'erreur extraction rowKey, un message bloquant guide l'utilisateur à recharger.
  