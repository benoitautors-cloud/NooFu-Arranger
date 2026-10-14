# NooFu Arranger v0.1.3

Application mobile locale pour écouter un audio, sélectionner des mesures, annoter l’arrangement et transmettre un plan précis à une autre tâche Codex. Elle ne modifie ni ne génère le son. Les fichiers importés restent dans IndexedDB sur l’appareil ; aucun upload n’est effectué.

## Développement

Node 22 ou supérieur. Depuis `app/` :

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

Vite sert `/NooFu-Arranger/`. `dist/` contient uniquement l’application et ses icônes, jamais les fichiers du projet musical. Les contrôles Playwright sont dans `e2e/` : après le build, lancer `npm run test:e2e` (Chromium et FFmpeg requis ; deux audios synthétiques sont créés dans le dossier temporaire système, jamais dans public/). Playwright lance le serveur de preview. Chromium système est détecté ; sinon installer le navigateur Playwright ou définir CHROMIUM_PATH.

## Mode tuto

Activer Mode tuto en haut de l’application. Toucher une commande, un champ ou la timeline affiche une explication, sans exécuter l’action. Compris ferme seulement le texte ; Quitter le tuto réactive l’utilisation normale. Les notes et projets restent intacts.

## Utilisation Android

Importer WAV/MP3 (ou un format décodable par Chrome). Saisir le BPM puis appuyer sur Appliquer BPM ou Entrée ; définir la signature ; glisser sur l’onde pour une sélection, défiler horizontalement sur la règle. Les boutons de longueur et les limites de mesures affinent la sélection. PLAY SELECTION permet l’audition avec boucle. Ajouter une annotation, nommer une référence, l’insérer dans les instructions suivantes. Les champs sont autosauvegardés ; Terminé ferme l’éditeur. Undo/Redo fonctionne dans la session.

Le BPM exprime toujours des noires : en 6/8 une mesure contient trois noires. La première mesure commence à 0 s. La dernière peut être partielle. Changer le tempo/signature recalcule les régions après confirmation ; choisir donc la grille avant d’annoter.

## Persistance et sauvegardes

IndexedDB v1 stocke métadonnées et Blob audio dans deux stores. Les imports JSON sont validés et les versions inconnues refusées ; les imports créent un nouvel ID pour préserver les projets existants. Pour migrer vers un autre appareil, exporter `project.json`, l’importer et réimporter le même audio (nom et taille identiques). Cette réassociation conserve les annotations. Le ZIP Codex n’est pas un format d’import ; extraire `project.json`.

La fermeture/recharge conserve les projets, mais effacer les données Chrome ou la pression de stockage Android peut supprimer les données locales. Toujours exporter une sauvegarde. Échec de quota/IndexedDB signalé. Ne pas supprimer les stores dans une future migration ; ajouter une migration testée via `storage.ts` et `model.ts`. Un update du service worker conserve IndexedDB.

## Architecture

- `model.ts` : schéma Zod, validation/migrations, mesures et exports déterministes.
- `storage.ts` : IndexedDB et audio local.
- `Timeline.tsx` : WaveSurfer, grille synchronisée, transport et sélection tactile.
- `App.tsx` : projets, annotations/références, undo et autosave séquentielle.
- `export.ts` : ZIP et téléchargements.

WaveSurfer utilise le décodage du navigateur ; la mémoire requise augmente avec la longueur de l’audio. L’état de chargement reste visible, le décodage est asynchrone. Des fichiers très longs peuvent dépasser la mémoire du téléphone : importer un MP3 plus léger ou travailler par section. Pas de promesse de streaming de forme d’onde en V1. ZIP source désactivé par défaut et limité à 100 Mo ; la compression est désactivée pour éviter le travail inutile. Zoom à deux doigts sur la règle des mesures, boutons Dézoomer/Zoomer et Vue complète. Le point entre les doigts reste ancré pendant le geste ; un doigt sur la règle fait défiler. Un appui bref sur la règle place le curseur à la position audio exacte sans changer les mesures sélectionnées.

## Déploiement PWA

`.github/workflows/arranger-pages.yml` vérifie et déploie seulement `app/dist` à chaque push main qui concerne l’app. GitHub Settings → Pages → Source : GitHub Actions. Le dépôt reste privé ; GitHub Pages sur dépôt privé peut nécessiter un forfait compatible. Ne jamais rendre le dépôt musical public pour contourner cela. Si indisponible, publier seulement `app/dist` chez un hébergeur HTTPS statique ou utiliser un dépôt distinct contenant exclusivement l’app, après choix de l’utilisateur.

Le manifest, les icônes PNG 192/512 et le service worker precache assurent le shell hors ligne après une première visite en ligne. Android : ouvrir l’URL déployée dans Chrome → Installer l’application → lancer NooFu depuis l’accueil. L’installabilité réelle dépend du domaine HTTPS et doit être vérifiée après déploiement.

## Transmission Codex

EXPORT FOR CODEX crée `project.json`, `edit_plan.json` et `CODEX_INSTRUCTIONS.md`. L’audio est optionnel. Fournir le fichier source séparément s’il n’est pas inclus. Les références sont des régions exactes du source ; l’agent doit préserver tout ce qui n’est pas demandé. Lire [le format](docs/EDIT_PLAN_FORMAT.md). Mettre à jour version et CHANGELOG lors des évolutions.
