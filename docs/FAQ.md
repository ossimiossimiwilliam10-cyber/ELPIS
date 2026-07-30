# FAQ ELPIS — Foire Aux Questions

> **Dernière mise à jour** : 2026-07-21
> **Tu ne trouves pas ta réponse ?** Consulte le [Glossaire](GLOSSAIRE.md) ou ouvre une issue GitHub.

---

# UTILISATION

## Comment ajouter un cours ou une matière ?

Va dans l'onglet **Cours** dans la barre latérale, clique sur le **+** à côté de la licence, du semestre, ou de l'UE, remplis le formulaire et sauvegarde. Les modifications sont envoyées immédiatement au serveur.

*Voir aussi : [guide_debutant.md](guide_debutant.md), [CARTOGRAPHIE.md](../CARTOGRAPHIE.md)*

## Comment fonctionne le planning quotidien ?

ELPIS analyse tes cours, ton historique et ta configuration pour générer un planning optimisé chaque jour. L'algorithme priorise selon l'urgence (date d'examen), le poids ECTS, et ton état (fatigue, chronobiologie). Le planning est mis en cache 60 secondes.

*Voir aussi : [ARCHITECTURE.md](../ARCHITECTURE.md), [backend.md](backend.md)*

## Comment changer le thème (clair/sombre) ?

ELPIS a 4 thèmes qui changent automatiquement selon l'heure : matin (tons chauds), après-midi (neutre), soir (tons froids), nuit (sombre). Tu peux aussi forcer le mode sombre ou clair dans les paramètres (engrenage en bas de la barre latérale).

*Fichier clé : `interface/web/src/index.css`*

## Comment utiliser le chronomètre ?

Le chronomètre flottant (bouton en bas à droite) suit ton temps d'étude. Clique dessus pour lancer/mettre en pause. Il continue même si tu changes de page. Quand tu valides une tâche, le temps est automatiquement suggéré.

*Fichier clé : `interface/web/src/components/GlobalChrono.jsx`*

## Comment fonctionne le Coach IA ?

Le Coach IA (bouton robot en bas à gauche) utilise DeepSeek. Il connaît ton profil, tes cours et ton historique pour te donner des conseils personnalisés. Nécessite la variable `DEEPSEEK_API_KEY` dans le fichier `.env`.

*Fichier clé : `interface/bridge/aiAdapter.js`*

## Comment synchroniser avec Anki ?

Ouvre Anki avec le plugin AnkiConnect installé, va dans Statistiques, puis clique sur Synchroniser Anki. ELPIS mappe automatiquement tes decks vers tes matières.

*Fichier clé : `interface/bridge/moteur/ankiSync.js`*

## Comment sauvegarder mes données ?

Les sauvegardes sont automatiques : la base SQLite est copiée chaque jour dans `data/backups/` (5 jours conservés). Pour une sauvegarde manuelle, copie simplement le dossier `data/` ailleurs.

## Comment fonctionne le Bulletin de notes ?

L'onglet Bulletin te permet de saisir les notes, calculer les moyennes par UE et semestre, simuler avec le mode What-If ("et si j'avais 14 ?"), et gérer les absences (EXC = justifié, DEF = défaillance).

*Fichier clé : `interface/web/src/BulletinPage.jsx`*

## Comment uploader un PDF ?

Dans l'onglet Préparation Hebdo, tu peux uploader des PDF (annales, sujets). Ils sont stockés dans `documents/` et liés à la matière. Le backend extrait le texte automatiquement.

---

# TECHNIQUE / DÉPANNAGE

## Le site ne s'ouvre pas — que faire ?

Vérifie : 1) le serveur est lancé (`cd interface/bridge && npm start`), 2) le port 3001 est libre, 3) les dépendances sont installées (`npm install` dans bridge ET web). Vérifie les messages dans le terminal.

*Voir aussi : [guide_debutant.md](guide_debutant.md) section 8*

## Erreur "Cannot find module"

Une dépendance manquante. Lance `npm install` dans `interface/bridge` et `interface/web`. Si l'erreur persiste, supprime `node_modules/` et `package-lock.json`, puis relance.

## Erreur "EADDRINUSE: address already in use :::3001"

Le port 3001 est déjà utilisé. Windows : `netstat -ano | findstr :3001` puis `taskkill /PID <PID> /F`. Mac/Linux : `lsof -i :3001` puis `kill -9 <PID>`.

## Les données ne chargent pas (écran vide)

Vérifie que `data/elpis.sqlite` existe. Si tu viens d'une ancienne version, la migration JSON vers SQLite se lance automatiquement. Ouvre les DevTools (F12) et regarde l'onglet Console/Network.

## Erreur "Unexpected token in JSON"

Un fichier JSON est corrompu. Vérifie les fichiers dans `data/` avec VS Code (il souligne les erreurs en rouge) ou restaure une sauvegarde depuis `backups/`.

## Comment voir les logs du serveur ?

Le terminal affiche : [INFO] (vert, tout va bien), [WARN] (jaune, avertissement), [ERROR] (rouge, problème). Les logs apparaissent aussi dans la console du navigateur (F12).

## Le mode hors-ligne ne fonctionne pas

Ouvre les DevTools (F12) > Application > Service Workers. Le statut doit être "activated and is running". Sinon, désinscris-le et rafraîchis la page.

## Comment réinitialiser complètement l'application ?

Supprime `data/elpis.sqlite` (garde une copie si besoin), vide le cache dans DevTools > Application > Clear Storage, puis redémarre le serveur.

---

# INSTALLATION

## Quels sont les prérequis ?

Node.js 20+, npm 10+, et Python 3.10+ (pour l'agent d'audit uniquement). Pas besoin de MySQL, MongoDB, ni Docker.

## Comment installer Node.js ?

Windows/Mac : télécharge sur [nodejs.org](https://nodejs.org/) (version LTS). Linux : `sudo apt install nodejs npm` ou utilise `nvm`.

## Comment lancer ELPIS en mode développement ?

Deux terminaux : Terminal 1 : `cd interface/bridge && npm install && npm start`. Terminal 2 : `cd interface/web && npm install && npm run dev`. Ouvre `http://localhost:5173`.

## Comment lancer ELPIS en mode production ?

```bash
cd interface/web && npm install --include=dev && npm run build
cd ../bridge && npm install && node server.js
```

Ouvre `http://localhost:3000`. Le serveur sert à la fois l'API et le frontend.

## Comment utiliser Docker ?

`docker-compose up --build` puis ouvre `http://localhost:3000`. Le volume `data/` est persistant.

## Puis-je utiliser ELPIS sans Python ?

Oui ! Python n'est requis que pour l'agent d'audit automatique. Le frontend et le backend fonctionnent sans.

---

# CONCEPTS

## C'est quoi FSRS ?

Free Spaced Repetition Scheduler : un algorithme de répétition espacée plus moderne que SM-2 (Anki). Il utilise 17 paramètres pour modéliser ta mémoire et planifier le moment optimal pour réviser chaque CM.

*Voir aussi : [GLOSSAIRE.md](GLOSSAIRE.md#fsrs)*

## C'est quoi le Bridge ?

Le pont entre l'interface (React) et les données (SQLite). C'est un serveur Express.js qui expose l'API REST, exécute le moteur métier (orchestrateur, scoring, intelligence) et gère la persistance.

*Voir aussi : [ARCHITECTURE.md](../ARCHITECTURE.md)*

## Pourquoi SQLite et pas MySQL ?

ELPIS est conçu pour être 100% local et portable. Un seul fichier, pas de serveur à installer, copiable comme un document, extrêmement rapide pour un usage personnel. Le mode WAL permet lectures et écritures simultanées.

## Différence entre mode Dev et mode Prod ?

En Dev : frontend sur `localhost:5173` (Vite HMR), backend sur `localhost:3001`. En Prod : tout sur `localhost:3000`, le backend sert le frontend compilé. La Basic Auth est désactivée en Dev, activable en Prod.

*Voir aussi : [guide_debutant.md](guide_debutant.md) section 8.1*

## C'est quoi une PWA ?

Progressive Web App : un site web qui se comporte comme une app mobile. Installable sur l'écran d'accueil, fonctionne hors-ligne, peut envoyer des notifications. ELPIS est une PWA grâce à son Service Worker.

## Comment fonctionne le mode hors-ligne ?

RxDB (IndexedDB) stocke toutes les données dans le navigateur. Le Service Worker intercepte les requêtes et sert les pages en cache. Au retour en ligne, la synchronisation est automatique.

## C'est quoi l'Anti-Burnout ?

ELPIS analyse ton historique sur 7 jours. Si tu as trop étudié, il réduit automatiquement la charge de travail du lendemain. Tu peux activer le mode "fatigue chronique" dans la configuration.

*Voir aussi : [GLOSSAIRE.md](GLOSSAIRE.md#anti-burnout)*

## C'est quoi le Système Immunitaire ?

Un robot Python qui scanne le code source 24h/24 pour détecter bugs et failles. Il peut les corriger automatiquement et pousser les corrections sur GitHub. 57 règles actives.

*Voir aussi : [immune_system.md](immune_system.md)*

---

# CONTRIBUTION

## Comment contribuer au projet ?

Lis le [CONTRIBUTING.md](../CONTRIBUTING.md). En résumé : fork, branche, code, tests (`npm test`), Pull Request.

## Où sont les tests ?

Tests backend : `interface/bridge/tests/` (11 fichiers, ~400 scénarios). Tests frontend : `interface/web/src/__tests__/`. Tests E2E Playwright : `interface/web/tests/elpis.spec.js` (17 scénarios). Lancement : `npm test` dans le dossier.

## Comment ajouter une règle d'audit ?

Ajoute une entrée dans `agent_audit/rules.json` avec un id, une catégorie, un pattern regex et un fix optionnel. Voir [immune_system.md](immune_system.md) pour le guide complet.

## Comment déployer ELPIS en production ?

Option 1 (Render.com) : connecte ton GitHub, le `render.yaml` fait tout. Option 2 (manuelle) : build du frontend puis `node server.js`. Option 3 : `docker-compose up -d`.

*Voir aussi : [CONTRIBUTING.md](../CONTRIBUTING.md), [devops.md](devops.md)*

## Comment mettre à jour ELPIS ?

```bash
git pull
cd interface/web && npm install && npm run build
cd ../bridge && npm install
```

Puis redémarre le serveur. Pense à sauvegarder `data/` avant toute mise à jour majeure.

---

# QUESTIONS RAPIDES

## Mon planning semble vide ou incomplet

Vérifie que des CM/TD/TP sont bien définis dans tes cours, qu'aucune UE n'est cochée "acquise" par erreur, et que l'anti-burnout n'a pas tout filtré.

## Le Coach IA ne répond pas

Vérifie que `DEEPSEEK_API_KEY` est bien définie dans le fichier `.env` à la racine, que la clé est valide, et que ta connexion Internet fonctionne.

## Puis-je utiliser ELPIS sur mon téléphone ?

Oui ! Sur Android : Chrome > Menu > Ajouter à l'écran d'accueil. Sur iOS : Safari > Partager > Sur l'écran d'accueil. Un build Android (APK) est aussi disponible via Capacitor.

## Puis-je utiliser ELPIS à plusieurs ?

Oui, chaque utilisateur peut avoir sa propre base SQLite. Lance le serveur avec une variable d'environnement pointant vers une base différente.

## Le chronomètre ne s'affiche plus

Cherche le bouton en bas à droite de l'écran. Si invisible, rafraîchis la page (F5).

---

> **Pas de réponse à ta question ?** Ouvre une [issue GitHub](https://github.com/TON-COMPTE/ELPIS/issues) avec le tag `question`.