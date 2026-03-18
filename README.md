
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
- `GEMINI_API_KEY` : clé API Gemini côté serveur uniquement.
- `GEMINI_MODEL` : modèle Gemini à utiliser. Par défaut `gemini-2.0-flash`.
- `PORT` : port du backend local. Par défaut `8787`.

## Build extension

```bash
npm run build
```

Charger ensuite le dossier généré `dist` comme extension non packée dans Chrome.

## MEP (Mise En Production)

### 1. Préparer l'environnement serveur

Configurer `.env` sur la machine serveur:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optionnel)
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
- L'insertion écrit dans la colonne `App. A : Appréciations`.
- Le backend répond sur `GET /api/health`.

## Endpoints backend

- `GET /api/health`
- `POST /api/generate-appreciation`

## Notes

- La clé Gemini n'est jamais exposée au frontend.
- Le content script parcourt la grille Pronote pour extraire et injecter même si la liste est virtualisée.
  