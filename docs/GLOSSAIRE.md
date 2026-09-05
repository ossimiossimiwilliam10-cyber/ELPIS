# 📖 GLOSSAIRE ELPIS — Tous les termes expliqués simplement

> **Pour qui ?** Débutants comme experts. Chaque terme est expliqué en langage simple, puis en détail technique.
> **Dernière mise à jour** : 2026-07-21

---

## A

### API (Application Programming Interface)
*Interface de Programmation*

- **Explication simple** : C'est le "langage" que le navigateur (frontend) et le serveur (backend) utilisent pour se parler. Comme un menu au restaurant : le navigateur commande un plat (ex: "donne-moi la liste des cours"), le serveur le prépare et le renvoie.
- **Dans ELPIS** : Toutes les routes API sont dans `interface/bridge/routes/`. Exemple : `GET /api/cours` renvoie l'arborescence des cours en JSON.
- **Fichier clé** : `interface/bridge/server.js` (lignes 30-70), `interface/bridge/routes/`

### Anti-Burnout
*Module de protection contre la fatigue*

- **Explication simple** : Le garde-fou d'ELPIS. Si tu as trop étudié hier, ELPIS réduit automatiquement ta charge de travail aujourd'hui pour éviter l'épuisement.
- **Dans ELPIS** : Implémenté dans `intelligence.js` → fonction `detectBurnoutRisk()`. Analyse l'historique sur 7 jours, détecte les tendances de fatigue, et applique un coefficient réducteur au planning.
- **Fichier clé** : `interface/bridge/moteur/intelligence.js`

### AnkiConnect
*Plugin de synchronisation avec Anki*

- **Explication simple** : Un petit programme qui fait le pont entre ELPIS et l'application de flashcards Anki. Il permet d'importer/exporter tes decks de révision.
- **Dans ELPIS** : Le module `ankiSync.js` communique avec AnkiConnect (localhost:8765) pour synchroniser les decks. Cache de 5 minutes, traitement par lots de 5.
- **Fichier clé** : `interface/bridge/moteur/ankiSync.js`

### Atomicité (Écriture Atomique)
*Atomic Write*

- **Explication simple** : Une technique pour éviter de casser un fichier si l'ordinateur s'éteint pendant une sauvegarde. On écrit d'abord dans un fichier temporaire, puis on le "renomme" d'un coup.
- **Dans ELPIS** : `fileUtils.js` implémente `atomicWriteFileSync()` : écriture dans `.tmp` → `fs.renameSync()` (opération atomique sur le système de fichiers). Fallback `copyFileSync` si les partitions diffèrent.
- **Fichier clé** : `interface/bridge/utils/fileUtils.js`

---

## B

### Backend
*La partie "cachée" de l'application*

- **Explication simple** : Le serveur. C'est lui qui fait les calculs, stocke les données, et répond aux demandes du navigateur. Tu ne le vois pas, mais il fait tout le travail lourd.
- **Dans ELPIS** : Le backend = tout le dossier `interface/bridge/`. Express.js + SQLite + le moteur d'intelligence.
- **Dossier clé** : `interface/bridge/`

### Basic Auth
*Authentification Basique HTTP*

- **Explication simple** : Un cadenas simple sur le site. Quand il est activé, il faut entrer un nom d'utilisateur et un mot de passe pour accéder à ELPIS.
- **Dans ELPIS** : Activé en définissant la variable d'environnement `ADMIN_PASSWORD`. Le middleware vérifie l'en-tête `Authorization` de chaque requête.
- **Fichier clé** : `interface/bridge/server.js`

### better-sqlite3
*Bibliothèque SQLite pour Node.js*

- **Explication simple** : La façon la plus rapide d'utiliser une base de données SQLite en JavaScript. C'est ce qui permet à ELPIS de stocker et retrouver tes données instantanément.
- **Dans ELPIS** : Utilisé dans `db/setup.js`. Mode WAL activé pour des lectures rapides même pendant les écritures.
- **Fichier clé** : `interface/bridge/db/setup.js`

### Bridge
*Le pont entre l'interface et les données*

- **Explication simple** : C'est le "chef d'orchestre" d'ELPIS. Il reçoit les commandes du navigateur, fait les calculs, lit/écrit dans la base de données, et renvoie les résultats.
- **Dans ELPIS** : Le Bridge = `interface/bridge/`. C'est la couche centrale de l'architecture Clean Architecture.
- **Dossier clé** : `interface/bridge/`

### Burnout
*Épuisement / Surmenage*

- **Explication simple** : Quand on étudie trop sans pause, le cerveau sature. ELPIS détecte ce risque et adapte le planning pour protéger l'étudiant.
- **Dans ELPIS** : Voir **Anti-Burnout**.

---

## C

### Capacitor
*Outil de transformation web → app mobile*

- **Explication simple** : Prend une application web (comme ELPIS) et l'empaquète en application Android/iOS installable depuis le Play Store.
- **Dans ELPIS** : Configuré dans `capacitor.config.json`. Le build Android est dans `interface/web/android/`.
- **Fichier clé** : `interface/web/capacitor.config.json`

### Chronobiologie
*Science du rythme biologique*

- **Explication simple** : Ton corps a une horloge interne. Certaines personnes sont plus efficaces le matin ("alouettes"), d'autres le soir ("hiboux"). ELPIS s'adapte à ton rythme.
- **Dans ELPIS** : Paramètre `chronobiologie` dans la config (`morning_lark` ou `night_owl`). Le module `intelligence.js` optimise le placement des tâches difficiles selon ce profil.
- **Fichier clé** : `interface/bridge/moteur/intelligence.js`, `interface/bridge/moteur/config.js`

### CI/CD (Continuous Integration / Continuous Deployment)
*Intégration et Déploiement Continus*

- **Explication simple** : Des robots qui testent ton code automatiquement à chaque modification, et peuvent le déployer tout seuls. Comme un inspecteur qualité qui vérifie tout avant que ça parte en production.
- **Dans ELPIS** : GitHub Actions dans `.github/workflows/`. `ci.yml` lance les tests à chaque push. `agent_audit.yml` lance l'audit toutes les heures.
- **Fichier clé** : `.github/workflows/ci.yml`

### Clean Architecture
*Architecture "Propre"*

- **Explication simple** : Une façon d'organiser le code en couches indépendantes (comme un oignon). Chaque couche ne connaît que la couche juste en dessous. Ça rend le code plus facile à comprendre et à modifier.
- **Dans ELPIS** : 3 couches : Frontend (React) → Bridge (Express) → Persistance (SQLite/JSON). Chaque couche est indépendante et testable isolément.
- **Fichier clé** : `ARCHITECTURE.md`

### CM (Cours Magistral)
- **Explication simple** : Un cours théorique en amphithéâtre. Dans ELPIS, c'est une matière à réviser avec le système de répétition espacée FSRS.
- **Dans ELPIS** : Les CM sont notés de 1 à 4 (1 = "facile/maîtrisé", 4 = "difficile/à réviser"). Ils suivent l'algorithme FSRS pour la planification.
- **Fichier clé** : `interface/web/src/fsrsEngine.js`

### Compensation (UE)
- **Explication simple** : Dans certaines universités, si ta moyenne du semestre est ≥ 10/20, tu peux valider une UE même si tu as en dessous de 10 dedans (selon des règles strictes). ELPIS simule ces calculs.
- **Dans ELPIS** : Implémentée dans `intelligence.js`. Analyse les notes, applique les règles de compensation entre UEs d'un même semestre, et alerte si une UE est "compensable" ou "rédhibitoire".
- **Fichier clé** : `interface/bridge/moteur/intelligence.js`

### CORS (Cross-Origin Resource Sharing)
*Partage de ressources entre origines*

- **Explication simple** : Une règle de sécurité du navigateur. Par défaut, un site ne peut pas parler à un serveur d'une autre adresse. CORS dit "ce site a le droit de me parler".
- **Dans ELPIS** : Configuré dans `server.js` avec le middleware `cors`. Autorise `localhost:5173` (Vite dev) et l'URL de production.
- **Fichier clé** : `interface/bridge/server.js`

### CRUD (Create, Read, Update, Delete)
*Créer, Lire, Modifier, Supprimer*

- **Explication simple** : Les 4 opérations de base sur des données. Presque tout ce qu'on fait avec un ordinateur est un CRUD.
- **Dans ELPIS** : Chaque ressource (cours, config, historique) a ses routes CRUD : `GET` pour lire, `POST` pour créer/modifier, `DELETE` pour supprimer.
- **Fichier clé** : `interface/bridge/routes/`

### CSP (Content Security Policy)
*Politique de Sécurité du Contenu*

- **Explication simple** : Une couche de sécurité qui dit au navigateur "tu as le droit de charger du JavaScript seulement depuis ces sources, pas d'ailleurs". Protège contre les attaques XSS.
- **Dans ELPIS** : Configuré avec Helmet dans `server.js`. Directives strictes : pas de `eval()`, pas de scripts inline.
- **Fichier clé** : `interface/bridge/server.js`

---

## D

### Répétiteur (Le)
*Celui qui répond à tes questions*

- **Explication simple** : Il ne devine pas, il calcule. Chaque chiffre qu'il avance — ta moyenne, tes retards, tes heures, tes délais de justification — est lu dans la base, pas produit par un modèle. Et quand une question sort de ce qu'il sait traiter, il le dit.
- **D'où vient le nom** : dans l'enseignement supérieur français, un répétiteur fait réciter la leçon et constate ce qui est su. Le terme est ancien, précis, et ne doit rien au vocabulaire de l'IA — ce qui convient à un programme qui ne fait que rendre compte.
- **Dans ELPIS** : `connaissances.js` rassemble les faits, `intentions.js` reconnaît la question (et rend `null` si rien ne correspond), `reponses.js` formule, `reglement.js` cite le règlement des études.
- **Fichier clé** : `interface/bridge/moteur/repetiteur/index.js` → `consulter()`

### DEF (Défaillance)
- **Explication simple** : Une absence non justifiée à un examen. Dans le bulletin, une DEF se propage : elle bloque la matière → bloque l'UE → bloque la compensation du semestre. C'est la pire note possible.
- **Dans ELPIS** : Statut dans le `BulletinPage.jsx`. Une DEF entraîne un blocage en cascade via le modèle de calcul des moyennes.
- **Fichier clé** : `interface/web/src/BulletinPage.jsx`, `interface/bridge/moteur/schemas.js`

### Docker
*Conteneur applicatif*

- **Explication simple** : Une "boîte" qui contient toute l'application et ses dépendances. Permet de lancer ELPIS sur n'importe quel ordinateur sans rien installer d'autre.
- **Dans ELPIS** : `Dockerfile` à la racine (multi-stage Node 20 Alpine). `docker-compose.yml` pour le lancement simplifié avec volume persistant.
- **Fichier clé** : `Dockerfile`, `docker-compose.yml`

---

## E

### ECTS (European Credit Transfer System)
*Crédits européens*

- **Explication simple** : Les "points" que tu gagnes en validant une UE. Une année de licence = 60 ECTS. ELPIS les utilise pour prioriser les matières : plus une matière a d'ECTS, plus elle est importante.
- **Dans ELPIS** : Les ECTS sont stockés au niveau de l'UE (`ueSchema.ects`). Le scoring (`scoring.js`) pondère les matières par leurs ECTS.
- **Fichier clé** : `interface/bridge/moteur/schemas.js`, `interface/bridge/moteur/scoring.js`

### EMA (Exponential Moving Average)
*Moyenne Mobile Exponentielle*

- **Explication simple** : Une moyenne qui donne plus de poids aux données récentes qu'aux anciennes. Comme ta mémoire : ce que tu as fait hier compte plus que ce que tu as fait il y a un mois.
- **Dans ELPIS** : Utilisée dans `intelligence.js` pour calculer la "vélocité d'apprentissage" : à quelle vitesse tu progresses dans chaque matière.
- **Fichier clé** : `interface/bridge/moteur/intelligence.js`

### ESLint
*Linter JavaScript*

- **Explication simple** : Un correcteur orthographique pour le code. Il lit ton code JavaScript et signale les erreurs (variables inutilisées, mauvaises pratiques, bugs potentiels).
- **Dans ELPIS** : L'agent d'audit (`linters.py`) lance ESLint sur les fichiers JS/JSX du projet et rapporte les warnings/erreurs.
- **Fichier clé** : `agent_audit/linters.py`

### EXC (Excusé)
- **Explication simple** : Une absence justifiée à une évaluation (certificat médical, etc.). La note est neutralisée : elle ne compte ni en bien ni en mal dans la moyenne.
- **Dans ELPIS** : Statut dans `BulletinPage.jsx`. Le coefficient de l'évaluation EXC est mis à zéro dans le calcul de la moyenne.
- **Fichier clé** : `interface/web/src/BulletinPage.jsx`

### Express.js
*Framework serveur pour Node.js*

- **Explication simple** : La "colonne vertébrale" du serveur d'ELPIS. C'est Express qui écoute les requêtes HTTP, les dirige vers la bonne route, et renvoie les réponses.
- **Dans ELPIS** : `server.js` crée une app Express, ajoute des middlewares (Helmet, CORS, rate limiting) et monte les routes.
- **Fichier clé** : `interface/bridge/server.js`

---

## F

### Frontend
*La partie visible de l'application*

- **Explication simple** : Tout ce que tu vois dans le navigateur : les boutons, les menus, les animations, les graphiques. C'est la "façade" d'ELPIS.
- **Dans ELPIS** : Le frontend = tout le dossier `interface/web/src/`. React 19 + Vite + PWA.
- **Dossier clé** : `interface/web/src/`

### FSRS (Free Spaced Repetition Scheduler)
*Planificateur libre de répétition espacée*

- **Explication simple** : Un algorithme qui détermine QUAND réviser chaque sujet pour une mémorisation optimale. Plus sophistiqué que l'ancien système SM-2 (Anki), il utilise 17 paramètres pour modéliser ta mémoire.
- **Dans ELPIS** : Implémenté dans `fsrsEngine.js` (frontend) avec la bibliothèque `ts-fsrs`. Paramètres : `maximum_interval: 36500` jours (~100 ans max), `request_retention: 0.90` (90% de rétention souhaitée). Le scoring backend (`scoring.js`) utilise aussi FSRS pour prioriser les CM.
- **Fichier clé** : `interface/web/src/fsrsEngine.js`, `interface/bridge/moteur/scoring.js`

---

## G

### GitHub Actions
*Automatisation GitHub*

- **Explication simple** : Des "robots" qui s'exécutent sur les serveurs de GitHub quand tu modifies le code. Ils peuvent lancer des tests, déployer l'application, ou corriger des bugs automatiquement.
- **Dans ELPIS** : `.github/workflows/ci.yml` pour les tests, `agent_audit.yml` pour l'audit automatique horaire.
- **Dossier clé** : `.github/workflows/`

---

## H

### Helmet
*Middleware de sécurité Express*

- **Explication simple** : Un bouclier pour le serveur. Il ajoute des en-têtes HTTP qui protègent contre les attaques courantes (XSS, clickjacking, sniffing).
- **Dans ELPIS** : Activé dans `server.js` avec des directives CSP strictes.
- **Fichier clé** : `interface/bridge/server.js`

### Holt-Winters
*Méthode de prévision de séries temporelles*

- **Explication simple** : Une formule mathématique pour prédire le futur en se basant sur le passé, en tenant compte des tendances et des saisons. ELPIS l'utilise pour estimer ta charge de travail future.
- **Dans ELPIS** : Utilisé dans `intelligence.js` pour la prévision de charge ("workload forecast"). Triple lissage exponentiel (niveau + tendance + saisonnalité).
- **Fichier clé** : `interface/bridge/moteur/intelligence.js`

### Hot Reload
*Rechargement à chaud*

- **Explication simple** : Quand tu modifies le code, le navigateur se met à jour tout seul instantanément sans que tu aies à rafraîchir la page. Magique pour développer vite.
- **Dans ELPIS** : Le mode dev (`npm run dev` dans `interface/web/`) utilise Vite qui fournit le Hot Module Replacement (HMR).
- **Fichier clé** : `interface/web/vite.config.js`

---

## I

### Immer
*Bibliothèque d'immuabilité*

- **Explication simple** : Travailler avec des données "en lecture seule" peut être compliqué. Immer simplifie ça en te laissant écrire du code comme si tu modifiais les données directement, tout en gardant l'original intact.
- **Dans ELPIS** : Intégré à Zustand dans `store.js`. Le middleware Immer permet d'écrire `state.config.profil.fatigueChronique = true` au lieu d'une syntaxe immutable complexe.
- **Fichier clé** : `interface/web/src/store.js`

### IndexedDB
*Base de données dans le navigateur*

- **Explication simple** : Une mini base de données qui vit DANS ton navigateur. Même sans Internet, ELPIS peut fonctionner parce que toutes tes données sont stockées localement dans IndexedDB.
- **Dans ELPIS** : RxDB utilise IndexedDB (via Dexie) comme stockage pour le mode hors-ligne. 4 collections : config, cours, historique, projets.
- **Fichier clé** : `interface/web/src/database.js`

### Intelligence (Module)
- **Explication simple** : Le "cerveau" d'ELPIS qui analyse tes données et produit des insights. Il détecte si tu es en burnout, prédit tes notes, trouve des synergies entre matières, etc. Il produit 12 "cartes d'intelligence" affichées dans le Dashboard.
- **Dans ELPIS** : `intelligence.js` (~600 lignes). 12 fonctions d'analyse : compensation UE, vélocité, burnout, projections (régression linéaire + IC 95%), synergie Jaccard, workload Holt-Winters, charge cognitive K-Means, optimisation chronotype.
- **Fichier clé** : `interface/bridge/moteur/intelligence.js`

---

## J

### Jaccard (Indice de)
*Mesure de similarité*

- **Explication simple** : Une formule qui mesure à quel point deux choses se ressemblent. ELPIS l'utilise pour trouver les matières qui se "renforcent mutuellement" (ex: Maths et Physique).
- **Dans ELPIS** : Dans `intelligence.js`, l'indice de Jaccard compare les ensembles de concepts entre matières. Si Maths ∩ Physique ≥ 40%, les deux matières sont synergiques et ELPIS les planifie ensemble.
- **Fichier clé** : `interface/bridge/moteur/intelligence.js`

### JSON (JavaScript Object Notation)
*Format de données*

- **Explication simple** : Le format "universel" pour échanger des données. C'est du texte lisible par les humains ET les machines. Ressemble à un dictionnaire avec des `{accolades}` et des `[crochets]`.
- **Dans ELPIS** : Format legacy de stockage (`data/espoir_*.json`). Les échanges API utilisent du JSON. Le frontend et le backend se parlent en JSON.
- **Fichier clé** : `data/espoir_config.json`, `data/espoir_cours.json`

### JSDoc
*Documentation dans le code JavaScript*

- **Explication simple** : Des commentaires spéciaux (avec `/** */`) qui décrivent ce que fait une fonction, ses paramètres, sa valeur de retour. Comme un mode d'emploi intégré dans le code.
- **Dans ELPIS** : Le store Zustand (`store.js`) utilise des types JSDoc (`@typedef {Object} ElpisConfig`) pour documenter la structure des données sans avoir besoin de TypeScript.
- **Fichier clé** : `interface/web/src/store.js`

---

## K

### K-Means
*Algorithme de clustering*

- **Explication simple** : Une formule qui regroupe automatiquement des choses similaires. ELPIS l'utilise pour estimer ta "charge cognitive" en regroupant les matières par difficulté.
- **Dans ELPIS** : K-Means 1D dans `intelligence.js` pour classer les matières en 3 clusters de charge cognitive (faible, moyenne, élevée).
- **Fichier clé** : `interface/bridge/moteur/intelligence.js`

---

## L

### LRU Cache (Least Recently Used)
*Cache "moins récemment utilisé"*

- **Explication simple** : Une mémoire temporaire qui garde les résultats récents pour répondre plus vite. Si la mémoire est pleine, elle jette ce qui n'a pas été demandé depuis le plus longtemps.
- **Dans ELPIS** : Le rapport de l'orchestrateur est mis en cache LRU pendant 60 secondes. Si tu rafraîchis le Dashboard dans la minute, pas besoin de tout recalculer.
- **Fichier clé** : `interface/bridge/routes/orchestrateur.js`

### LLM (Large Language Model)
*Grand modèle de langage*

- **Explication simple** : Le type d'intelligence artificielle qui comprend et génère du texte.
- **Dans ELPIS** : aucun. Le projet n'en appelle plus aucun, et n'en embarque aucun. Le Répétiteur a été écrit en calcul local, et le module Langues se contente de préparer une consigne que tu portes toi-même dans la fenêtre de conversation de ton choix.
- **Fichier clé** : `interface/bridge/moteur/vocabulaire.js` → `promptVocabulaire()`

---

## M

### Middleware
*Intercepteur de requêtes*

- **Explication simple** : Un "filtre" par lequel passe chaque requête avant d'arriver à destination. Comme la sécurité à l'aéroport : chaque passager (requête) est inspecté avant d'embarquer.
- **Dans ELPIS** : Plusieurs middlewares dans `server.js` : Helmet (sécurité), CORS (autorisations), rate limiting (anti-abus), Basic Auth (authentification), et `errorHandler.js` (gestion des erreurs).
- **Fichier clé** : `interface/bridge/server.js`, `interface/bridge/middleware/errorHandler.js`

### Morning Lark / Night Owl
*Alouette / Hibou*

- **Explication simple** : Profils chronobiologiques. "Alouette" = efficace le matin. "Hibou" = efficace le soir. ELPIS adapte le planning selon ton profil.
- **Dans ELPIS** : Paramètre `chronobiologie` dans la config. Pour un Morning Lark, les tâches difficiles sont placées le matin. Pour un Night Owl, elles sont décalées en soirée.
- **Fichier clé** : `interface/bridge/moteur/config.js`

---

## N

### Node.js
*Environnement JavaScript côté serveur*

- **Explication simple** : D'habitude, JavaScript ne tourne que dans le navigateur. Node.js permet de l'exécuter aussi sur un serveur. C'est ce qui fait tourner le backend d'ELPIS.
- **Dans ELPIS** : Le bridge (`interface/bridge/`) tourne sur Node.js. Version 20 minimum.
- **Fichier clé** : `interface/bridge/package.json`

---

## O

### Offline-first
*Hors-ligne d'abord*

- **Explication simple** : L'application fonctionne D'ABORD sans Internet, et se synchronise quand la connexion revient. Comme Google Docs : tu peux écrire sans connexion, ça sauvegarde dès que ça reconnecte.
- **Dans ELPIS** : RxDB (IndexedDB) stocke tout localement. Le Service Worker PWA intercepte les requêtes et sert le cache si hors-ligne. La sync se fait automatiquement au retour en ligne.
- **Fichier clé** : `interface/web/src/database.js`, `interface/web/vite.config.js`

### Orchestrateur
*Le chef d'orchestre du planning*

- **Explication simple** : Le module le plus important d'ELPIS. C'est lui qui chaque jour décide QUOI étudier, COMBIEN DE TEMPS, et DANS QUEL ORDRE. Comme un chef d'orchestre qui coordonne tous les musiciens.
- **Dans ELPIS** : `orchestrateur.js` v3 (~800 lignes). 4 pools (CM/TD/TP/Annales), boosters (découverte ×2, inactivité ×3, urgence ×5), interleaving, ordonnancement chronobiologique. Appelé via `GET /api/orchestrateur`.
- **Fichier clé** : `interface/bridge/moteur/orchestrateur.js`

---

## P

### Path Traversal (Protection contre)
*Navigation dans les dossiers*

- **Explication simple** : Une attaque où on essaie d'accéder à des fichiers auxquels on n'a pas le droit en mettant `../` dans l'URL. ELPIS bloque ces tentatives.
- **Dans ELPIS** : La route `/api/open/file` vérifie que le chemin demandé est bien dans le répertoire autorisé. Désactivé en production.
- **Fichier clé** : `interface/bridge/server.js`

### Playwright
*Outil de test automatisé dans le navigateur*

- **Explication simple** : Un robot qui ouvre un vrai navigateur, clique sur des boutons, et vérifie que tout fonctionne comme prévu. Comme si quelqu'un testait l'application à ta place.
- **Dans ELPIS** : 17 tests E2E dans `interface/web/tests/elpis.spec.js`. Lancés dans la CI GitHub Actions.
- **Fichier clé** : `interface/web/playwright.config.js`

### PWA (Progressive Web App)
*Application web progressive*

- **Explication simple** : Un site web qui se comporte comme une application mobile. Tu peux l'installer sur ton téléphone, il fonctionne hors-ligne, et il peut envoyer des notifications. Pas besoin de passer par le Play Store.
- **Dans ELPIS** : Configurée dans `vite.config.js` avec le plugin `VitePWA`. Service Worker via Workbox, manifest `manifest.json`, icônes 192/512px.
- **Fichier clé** : `interface/web/vite.config.js`, `interface/web/public/manifest.json`

---

## R

### Rate Limiting
*Limitation du débit*

- **Explication simple** : Une protection qui empêche quelqu'un d'envoyer trop de requêtes d'un coup. Comme un guichet où on ne peut pas passer 500 fois en 1 minute.
- **Dans ELPIS** : 500 requêtes max par période de 15 minutes. Configuré dans `server.js`.
- **Fichier clé** : `interface/bridge/server.js`

### React
*Framework JavaScript pour interfaces utilisateur*

- **Explication simple** : La "boîte à outils" qui permet de construire l'interface d'ELPIS avec des composants réutilisables (boutons, menus, pages entières).
- **Dans ELPIS** : React 19 avec hooks, lazy loading, Suspense, error boundaries. Tout le frontend est en React.
- **Dossier clé** : `interface/web/src/`

### Render.com
*Plateforme d'hébergement cloud*

- **Explication simple** : Un service qui héberge ELPIS sur Internet pour que tu puisses y accéder depuis n'importe où. Comme un hôtel pour applications web.
- **Dans ELPIS** : Configuré dans `render.yaml`. Build automatique, plan free, Node 20.
- **Fichier clé** : `render.yaml`

### REST (Representational State Transfer)
*Style d'architecture API*

- **Explication simple** : Une façon standard d'organiser les URLs d'une API. `GET /api/cours` pour lire, `POST /api/cours` pour écrire. Simple et prévisible.
- **Dans ELPIS** : Toutes les routes API suivent le style REST. Chaque ressource a ses verbes HTTP (GET, POST, DELETE).
- **Fichier clé** : `interface/bridge/routes/`

### RL Engine (Reinforcement Learning Engine)
*Moteur d'apprentissage par renforcement*

- **Explication simple** : Un algorithme qui apprend par essai-erreur quels exercices sont les plus efficaces pour toi. Comme un joueur d'échecs qui devient meilleur à chaque partie.
- **Dans ELPIS** : `rlEngine.js` implémente UCB Bandits. UCB = Q + C×√(ln(N)/n). Met à jour les "Q-values" après chaque exercice pour améliorer les recommandations futures.
- **Fichier clé** : `interface/bridge/moteur/rlEngine.js`

### Ruff
*Linter Python*

- **Explication simple** : L'équivalent d'ESLint mais pour Python. Extrêmement rapide, il vérifie le style, les erreurs, et les mauvaises pratiques.
- **Dans ELPIS** : L'agent d'audit (`linters.py`) lance Ruff sur les fichiers Python du projet.
- **Fichier clé** : `agent_audit/linters.py`

### RxDB
*Base de données réactive*

- **Explication simple** : Une base de données JavaScript qui fonctionne dans le navigateur ET se synchronise automatiquement avec un serveur. C'est ce qui permet à ELPIS de fonctionner hors-ligne.
- **Dans ELPIS** : RxDB v17 avec stockage Dexie (IndexedDB). 4 collections, synchronisation bidirectionnelle avec le bridge, LeaderElection pour éviter les conflits entre onglets.
- **Fichier clé** : `interface/web/src/database.js`

---

## S

### Scoring
*Moteur de priorisation*

- **Explication simple** : Le système qui décide quelles matières sont les plus URGENTES à réviser. Plus l'examen est proche et la matière importante, plus le score est élevé.
- **Dans ELPIS** : `scoring.js` v3. Fonction `getPrioScore()` = 1/√(pratiques+1) × 12 multiplicateurs (ECTS, urgence examen, difficulté, etc.). Fuzzy matching pour les noms d'examens.
- **Fichier clé** : `interface/bridge/moteur/scoring.js`

### Service Worker
*Script d'arrière-plan du navigateur*

- **Explication simple** : Un programme invisible qui tourne dans ton navigateur même quand le site est fermé. Il intercepte les requêtes réseau et peut servir des pages en cache quand tu es hors-ligne.
- **Dans ELPIS** : Généré par Workbox (via VitePWA). Stratégies : NetworkFirst pour HTML, cache API pour 1 semaine.
- **Fichier clé** : `interface/web/public/sw.js`, `interface/web/vite.config.js`

### SM-2 (SuperMemo 2)
*Ancien algorithme de répétition espacée*

- **Explication simple** : L'ancêtre du FSRS. Moins précis mais plus simple. Encore utilisé dans Anki. Dans ELPIS, il sert de fallback rétrocompatible.
- **Dans ELPIS** : `sm2.js` implémente l'algorithme SM-2 avec Fast-Track, pénalité/bonus temporel, et load balancing.
- **Fichier clé** : `interface/web/src/sm2.js`

### SQLite
*Base de données légère*

- **Explication simple** : Une base de données qui tient dans UN SEUL FICHIER. Pas besoin de serveur, pas de configuration compliquée. Le standard pour les applications desktop et mobiles.
- **Dans ELPIS** : Base de données principale (`data/elpis.sqlite`) avec 7 tables. better-sqlite3 + mode WAL. Migration automatique depuis l'ancien format JSON via `migrate.js`.
- **Fichier clé** : `data/elpis.sqlite`, `interface/bridge/db/setup.js`

### Synergie (Matières)
- **Explication simple** : Deux matières qui se renforcent mutuellement. Exemple : travailler les Maths aide en Physique, et vice-versa. ELPIS les détecte et les planifie ensemble.
- **Dans ELPIS** : Calculée via l'indice de Jaccard dans `intelligence.js`. Si le chevauchement de concepts ≥ 40%, les matières sont synergiques.
- **Fichier clé** : `interface/bridge/moteur/intelligence.js`

### Système Immunitaire / Immune System
- **Explication simple** : Un robot qui surveille le code d'ELPIS 24h/24, détecte les bugs et les mauvaises pratiques, et les corrige automatiquement. Comme le système immunitaire du corps humain qui combat les infections.
- **Dans ELPIS** : `agent_audit/`. 57 règles, 10 phases d'audit, 6 stratégies de scan, 6 stratégies de correction. Auto-PR via GitHub Actions. Mode continu local (toutes les heures) et cloud (GitHub Actions cron).
- **Dossier clé** : `agent_audit/`

---

## T

### TD (Travaux Dirigés) / TP (Travaux Pratiques)
- **Explication simple** : Types d'exercices. TD = exercices d'application en petit groupe. TP = exercices pratiques en laboratoire. Dans ELPIS, chaque type a ses propres règles de planification.
- **Dans ELPIS** : Les TD/TP sont évalués sur une échelle de difficulté 1-5. L'orchestrateur les répartit dans des pools séparés (CM / TD / TP / Annales).
- **Fichier clé** : `interface/bridge/moteur/orchestrateur.js`

### ts-fsrs
*Bibliothèque FSRS pour TypeScript/JavaScript*

- **Explication simple** : L'implémentation de référence de l'algorithme FSRS en JavaScript. C'est elle qui fait les calculs mathématiques de répétition espacée.
- **Dans ELPIS** : Utilisée dans `fsrsEngine.js`. Le moteur FSRS du frontend est un wrapper autour de `ts-fsrs`.
- **Fichier clé** : `interface/web/src/fsrsEngine.js`

---

## U

### UCB Bandits (Upper Confidence Bound)
*Algorithme de bandit manchot*

- **Explication simple** : Imagine que tu as plusieurs machines à sous. Tu veux jouer sur celle qui rapporte le plus, mais tu dois aussi en essayer d'autres pour être sûr. UCB trouve l'équilibre parfait entre "exploiter ce qui marche" et "explorer de nouvelles options".
- **Dans ELPIS** : `rlEngine.js`. UCB = Q + C×√(ln(N)/n) où Q = valeur estimée, C = facteur d'exploration, N = nombre total d'essais, n = nombre d'essais pour cette action.
- **Fichier clé** : `interface/bridge/moteur/rlEngine.js`

### UE (Unité d'Enseignement)
- **Explication simple** : Un bloc de matières qui forment un ensemble cohérent. Validée si la moyenne est ≥ 10/20. Porte un nombre d'ECTS.
- **Dans ELPIS** : Les UEs sont dans l'arborescence Licence > Semestre > UE > Matières. La validation d'une UE exclut ses matières du planning (`ue.acquise = true`).
- **Fichier clé** : `interface/bridge/moteur/schemas.js`

---

## V

### Vélocité
*Vitesse d'apprentissage*

- **Explication simple** : À quelle vitesse tu progresses dans une matière. Si tu valides beaucoup d'exercices en peu de temps, ta vélocité est élevée.
- **Dans ELPIS** : Calculée via EMA (Exponential Moving Average) dans `intelligence.js`. Mesurée en "progrès par heure d'étude".
- **Fichier clé** : `interface/bridge/moteur/intelligence.js`

### Vite
*Outil de build JavaScript rapide*

- **Explication simple** : Le "moteur" qui compile le code React en fichiers que le navigateur peut lire. Extrêmement rapide grâce à esbuild (Go).
- **Dans ELPIS** : Configuré dans `vite.config.js`. Développement : `npm run dev` (HMR instantané). Production : `npm run build` (dossier `dist/`).
- **Fichier clé** : `interface/web/vite.config.js`

### Vitest
*Framework de test JavaScript*

- **Explication simple** : L'outil qui lance les tests unitaires du code. Compatible avec Vite, donc très rapide. Vérifie que chaque fonction fait bien ce qu'elle est censée faire.
- **Dans ELPIS** : Tests dans `interface/web/src/__tests__/` et `interface/bridge/tests/`. Lancés par la CI GitHub Actions.
- **Fichier clé** : `interface/web/vite.config.js` (config test)

---

## W

### WAL (Write-Ahead Logging)
*Journalisation avant écriture*

- **Explication simple** : Une technique de base de données qui permet de lire ET écrire en même temps sans bloquer personne. Comme un guichet avec deux files : une pour les dépôts, une pour les retraits.
- **Dans ELPIS** : Activé dans `db/setup.js` avec `PRAGMA journal_mode=WAL`. Permet au frontend de lire les données même pendant une sauvegarde.
- **Fichier clé** : `interface/bridge/db/setup.js`

### Workbox
*Bibliothèque Service Worker de Google*

- **Explication simple** : Simplifie la création du Service Worker pour la PWA. Gère automatiquement le cache, la sync, et les notifications.
- **Dans ELPIS** : Intégré via le plugin VitePWA. Stratégies de cache configurées dans `vite.config.js`.
- **Fichier clé** : `interface/web/vite.config.js`

---

## Z

### Zod
*Bibliothèque de validation TypeScript/JavaScript*

- **Explication simple** : Un "agent de sécurité" qui vérifie que les données reçues par l'API sont bien au bon format. Si une donnée est invalide, il la bloque et explique pourquoi.
- **Dans ELPIS** : Zod 4.x dans `schemas.js`. Schémas pour `config`, `cours`, `historique`, `projets`. Chaque entrée API est validée avant traitement.
- **Fichier clé** : `interface/bridge/moteur/schemas.js`

### Zustand
*Gestionnaire d'état React*

- **Explication simple** : La "mémoire" de l'interface. Toutes les données (config, cours, planning) sont stockées dans un store Zustand. N'importe quel composant peut y accéder.
- **Dans ELPIS** : `store.js` (~500 lignes). Store unique avec middleware Immer. Debounce 500ms sur les sauvegardes. `useChronoStore` séparé pour le chronomètre.
- **Fichier clé** : `interface/web/src/store.js`

---

> **Mainteneurs** : Ajoutez les nouveaux termes ici quand vous introduisez un concept technique. Un seul paragraphe "explication simple" + contexte ELPIS + fichier clé.
