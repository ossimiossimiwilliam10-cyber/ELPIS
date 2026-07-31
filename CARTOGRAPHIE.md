# 🗺️ CARTOGRAPHIE ELPIS — Atlas Complet du Projet

> **Dernière mise à jour** : 2026-07-20
> **Objectif** : Pouvoir trouver n'importe quel fichier, comprendre n'importe quel module, en un coup d'œil.

---

## 📐 VUE D'ENSEMBLE — Les 5 Couches

```
┌─────────────────────────────────────────────────────┐
│  📱 FRONTEND (React + Vite + PWA + Capacitor)       │
│  interface/web/src/  —  49 fichiers JSX, 82 JS      │
│  Pages, Composants, Store Zustand, RxDB, FSRS       │
├─────────────────────────────────────────────────────┤
│  🌉 BRIDGE (Express.js — Backend API)               │
│  interface/bridge/  —  server.js + routes + moteur  │
│  REST API, Orchestrateur, Intelligence, SQLite      │
├─────────────────────────────────────────────────────┤
│  🛡️ AGENT AUDIT (Python — Immune System v3.2)       │
│  agent_audit/  —  57 règles, 10 scanners, auto-fix  │
│  Analyse statique, ESLint/Ruff, GitHub auto-commit   │
├─────────────────────────────────────────────────────┤
│  🗄️ DATA (SQLite + JSON)                            │
│  data/  —  elpis.sqlite, espoir_*.json              │
│  Persistance 100% locale, backups auto               │
├─────────────────────────────────────────────────────┤
│  📦 INFRA (Config, Déploiement, Scripts)            │
│  render.yaml, .github/workflows/, scripts/          │
│  Déploiement Render, CI/CD GitHub Actions            │
└─────────────────────────────────────────────────────┘
```

**Chiffres clés** : ~217 fichiers source · ~33 000 lignes de code écrites à la main · 57 règles d'audit automatique · ~600 tests

---

## 🌳 ARBORESCENCE COMPLÈTE — Chaque Fichier Expliqué

### 📱 COUCHE 1 : FRONTEND — `interface/web/src/`

#### 🔷 POINT D'ENTRÉE

| Fichier | Rôle |
|---------|------|
| `main.jsx` | Bootstrap Vite : monte `<App/>` dans le DOM avec `StrictMode` + `ErrorBoundary` |
| `App.jsx` | **Composant racine** (~388 lignes). Routing par `activeTab`, thème dark/light + dynamique horaire, `React.lazy` + `Suspense`, `initData()` au montage, page Config inline |
| `index.css` | **Design system complet** (~660 lignes). Variables CSS, 4 thèmes horaires, layout flexbox (sidebar 260px + main), responsive mobile, cards, glass-panels, toasts, progress bars |

#### 🔷 PAGES (16 pages)

| Fichier | Rôle | Notes |
|---------|------|-------|
| `Dashboard.jsx` | Tableau de bord principal — tâches du jour, progression, insights IA, drag-and-drop | Utilise `useWorkloadEngine`, `useSoundEffects`, `@hello-pangea/dnd` |
| `CoursPage.jsx` | Bibliothèque de cours — arborescence Licence > Semestre > UE > Matière, CRUD complet | Recherche full-text, `MatiereCard`, `MarkdownModal` |
| `EntrainementPage.jsx` | Session du jour FSRS — évalue les CM (1-4), TD/TP/ANNALE, suspendre, alerte fatigue | Barre de progression, filtres par matière |
| `RevisionsAvanceesPage.jsx` | Révisions avancées — ciblage manuel d'exercices spécifiques | Verrouillée si tâches en attente |
| `ProjetsPage.jsx` | Projets personnels — phases, progression, chronomètre intégré | Phases séquentielles |
| `PreparationHebdoPage.jsx` | Préparation hebdomadaire — quotas TD/TP/Annales, upload PDF | Engagement fixes, `ExerciceRow` |
| `StatistiquesPage.jsx` | Stats et performances — Recharts, KPIs, projections IA | Export CSV, sync Anki |
| `GraphPage.jsx` | Graphe 3D des connaissances — `react-force-graph-3d` | Nodes = matières, couleur = maîtrise |
| `ClassementPage.jsx` | Classement — score composite (académique 40%, FSRS 40%, effort 20%) | Loi normale, percentiles |
| `BulletinPage.jsx` | Bulletin de notes — saisie évaluations, moyenne pondérée ECTS, mode What-If | Compensation UE, projections IA |
| `MesVideosPage.jsx` | Vidéos YouTube par matière | Détection doublons |
| `Sidebar.jsx` | Navigation latérale — 3 groupes : Quotidien, Scolarité, Système | Badge tâches, streak, statut online/offline |
| `GlobalSearchModal.jsx` | Recherche globale Ctrl+K — cross-matière | Limité à 10 résultats, navigation par événement |
| `MarkdownModal.jsx` | Éditeur Markdown avec preview — utilisé pour les notes | ReactMarkdown |
| `ToastProvider.jsx` | Système de notifications toast | Contexte React, 4 types, animation spring |
| `ErrorBoundary.jsx` | Capture les erreurs de rendu React | Bouton "Recharger" |

#### 🔷 COMPOSANTS (9 composants)

| Fichier | Rôle | Spécificités |
|---------|------|-------------|
| `components/AICoachSidebar.jsx` | Coach IA — panneau chat DeepSeek | Bouton 🤖 flottant, historique, isTyping |
| `components/AuditDashboard.jsx` | Dashboard d'audit — anomalies détectées par l'agent Python | Fetch `/api/audit`, sévérité critical/warning/info |
| `components/BackgroundMusicPlayer.jsx` | Lecteur musique de fond — adaptatif au contexte | calm/motivational, auto-play |
| `components/DisclaimerModal.jsx` | Modal conditions d'utilisation — premier lancement | Protocole FSRS |
| `components/GlobalChrono.jsx` | **Chronomètre flottant** — suit le temps d'étude | Store Zustand séparé, draggable, PiP, confetti |
| `components/MusicSettingsModal.jsx` | Gestion bibliothèque musicale — upload/suppression | calm / motivational |
| `components/TaskCompletionModal.jsx` | Modal validation — temps réel, score FSRS, difficulté | CM: 1-4, TD/TP/ANNALE: difficulté |
| `components/InfoTooltip.jsx` | Infobulle contextuelle | Glass, animation, auto-fermeture au scroll |
| `components/cours/` | *(6 composants spécialisés cours)* | |

#### 🔷 COMPOSANTS COURS (6 composants)

| Fichier | Rôle |
|---------|------|
| `components/cours/MatiereCard.jsx` | Carte matière complète — CM, TD, TP, Annales, NotebookLM, deck Anki, synergies, **input dateDebut** pour CM (dateCM), TD/Annales (datePrevue), TP (dateTP) |
  - Added UI field for exams dates
| `components/cours/ExerciceCard.jsx` | Carte exercice — utilisée dans EntrainementPage, évaluation + chrono intégré |
| `components/cours/ExerciceRow.jsx` | Ligne exercice éditable — utilisée dans PreparationHebdoPage et MatiereCard |
| `components/cours/EditableLabel.jsx` | Texte éditable inline — renommage par `window.prompt` |
| `components/cours/EditableNote.jsx` | Note éditable — clic → MarkdownModal |
| `components/cours/StarRating.jsx` | Étoiles de difficulté 1-5 |

#### 🔷 HOOKS, UTILS, CONSTANTES

| Fichier | Rôle |
|---------|------|
| `hooks/useSoundEffects.js` | Sons synthétisés Web Audio — taskComplete (Do-Mi-Sol), streakUp, click |
| `utils/apiConfig.js` | Configuration URL API — support IP custom (Wi-Fi sync), fallback `/api` |
| `utils/timeParser.js` | Parsing flexible de saisies temps — `35`, `35.5`, `35:44`, `35m44s` |
| `constants.js` | `DIFFICULTY_LEVELS` — 5 niveaux (difficile → très facile) |

#### 🔷 STATE & PERSISTENCE LOCALE

| Fichier | Rôle | Détail |
|---------|------|--------|
| `store.js` | **Store Zustand principal** — config, coursConfig, historique, projets, orchestratorData, intelligence | Immer middleware, debounce 500ms, mode hors-ligne, `useChronoStore` séparé |
| `database.js` | **RxDB (IndexedDB)** — stockage offline + sync serveur | Dexie storage, 4 collections (config, cours, historique, projets), LeaderElection |

#### 🔷 MOTEURS LOCAUX (Frontend)

| Fichier | Rôle | Algorithme |
|---------|------|-----------|
| `fsrsEngine.js` | **Moteur FSRS** — répétition espacée nouvelle génération | `ts-fsrs`, `maximum_interval: 36500`, `request_retention: 0.90` |
| `sm2.js` | Algorithme SM-2 legacy — rétrocompatibilité | Fast-Track, pénalité/bonus temporel, load balancing |
| `useWorkloadEngine.js` | Moteur charge de travail — estime le temps d'étude quotidien | Coefficient × 15h, divisé par jours avant examen |
| `parseDateLocal.js` | Parsing dates — ISO + legacy DD-MM-YYYY | Retourne Date locale à minuit |

---

### 🌉 COUCHE 2 : BRIDGE — `interface/bridge/`

#### 🔷 POINT D'ENTRÉE

| Fichier | Rôle |
|---------|------|
| `server.js` | **Serveur Express** (port 3001). Helmet, CORS, rate limiting (500/15min), Basic Auth optionnelle, 9 routes API, sert le build React, backup SQLite auto |
| `package.json` | Dépendances : express 5, better-sqlite3 12, helmet, zod 4, multer, pdf-parse |

#### 🔷 ROUTES API (10 fichiers)

| Fichier | Endpoints | Rôle |
|---------|-----------|------|
| `routes/config.js` | `GET/POST /api/config`, `POST /api/config/skip-rest` | CRUD configuration |
| `routes/cours.js` | `GET/POST /api/cours` | CRUD arborescence cours |
| `routes/historique.js` | `GET/POST /api/historique`, `POST /api/historique/clear` | CRUD historique |
| `routes/orchestrateur.js` | `GET /api/orchestrateur`, `POST /api/orchestrateur/force-task` | **Rapport quotidien** (cache LRU 60s) + tâche forcée |
| `routes/projets.js` | `GET/POST /api/projets` | CRUD projets |
| `routes/anki.js` | `GET /api/anki/decks`, `POST /api/anki/sync`, `GET /api/anki/today-stats` | Synchronisation AnkiConnect |
| `routes/chat.js` | `GET/POST/DELETE /api/chat` | Chat DeepSeek (Coach IA) |
| `routes/music.js` | `GET /api/music/recommendation`, `POST /api/music/upload`, `DELETE /api/music/:category/:filename` | Recommandation + upload musique |
| `routes/system.js` | `POST /api/open/anki`, `POST /api/upload/pdf`, `POST /api/shutdown`, `GET /api/audit` | Ouverture Anki, upload PDF, shutdown, rapport audit |
| `routes/telemetry.js` | `POST /api/telemetry/session`, `POST /api/telemetry/action` | Télémétrie sessions |

#### 🔷 MOTEUR MÉTIER (12 fichiers) — Le Cerveau d'ELPIS

| Fichier | Rôle | Algorithmes & Détails |
|---------|------|----------------------|
| `moteur/orchestrateur.js` | **Orchestrateur central v3** (~800 lignes). Génère le planning quotidien | 4 pools (CM/TD/TP/Annales), boosters (découverte ×2, inactivité ×3, urgence ×5), interleaving, ordonnancement chronobiologique |
| `moteur/scoring.js` | **Moteur de scoring FSRS v3** — priorité des exercices | `getPrioScore()` = 1/√(pratiques+1) × 12 multiplicateurs, fuzzy matching examens |
| `moteur/intelligence.js` | **Module d'intelligence v3** (~600 lignes). 12 cartes d'intelligence | Compensation UE, vélocité EMA, burnout detection, projection scores (régression linéaire + IC 95%), synergie Jaccard, workload forecast Holt-Winters, charge cognitive K-Means 1D, optimisation chronotype |
| `moteur/config.js` | Gestion configuration — load/save/validate/sanitize | 30+ valeurs par défaut, clamping plages |
| `moteur/cours.js` | Gestion arborescence cours — SQLite 5 tables | Transaction DELETE+INSERT, deepMerge |
| `moteur/historique.js` | Gestion historique — sessions d'étude | Trim à 10 000 entrées |
| `moteur/projets.js` | Gestion projets | Table `projets` |
| `moteur/schemas.js` | Schémas Zod 4.x — validation | `configSchema`, `coursSchema`, `historiqueSchema`. `cmSchema` inclut `dateCM`, `exSchema` inclut `datePrevue` et `dateTP` |
| `moteur/ankiSync.js` | Synchronisation AnkiConnect | HTTP localhost:8765, cache 5min, batching 5, 5 étapes de matching |
| `moteur/rlEngine.js` | **Reinforcement Learning** — UCB Bandits | UCB = Q + C×√(ln(N)/n), mise à jour incrémentale, lissage 0.8-2.5 |
| `moteur/telemetry.js` | Télémétrie — log sessions et actions | Persistance JSON |
| `moteur/utils.js` | Utilitaires dates — normalisation ISO | DD-MM-YYYY → YYYY-MM-DD, pas de bugs timezone |

#### 🔷 SERVICES, MIDDLEWARE, DB, UTILS

| Fichier | Rôle |
|---------|------|
| `services/auditAgent.js` | Lanceur agent Python — spawn `agent_audit/main.py --once` |
| `middleware/errorHandler.js` | Gestionnaire global Express — ValidationError → 400, autres → 500 |
| `db/setup.js` | **Initialisation SQLite** — better-sqlite3, WAL mode, 7 tables (licences→semestres→ues→matieres→cours_cm→exercices, historique, config, projets) |
| `db/migrate.js` | Migration JSON legacy → SQLite — config, historique, arbre cours complet |
| `utils/fileUtils.js` | Écriture atomique — `.tmp` + `rename` (fallback `copyFileSync`) |
| `mongoAdapter.js` | **Stub MongoDB** — désactivé, retourne null/false (ELPIS 100% local) |
| `aiAdapter.js` | **Adaptateur DeepSeek** — `callDeepSeek()`, `buildAIContext()`, system prompt avec règles strictes |

#### 🔷 TESTS BACKEND (11 fichiers)

| Fichier | Type | Scénarios |
|---------|------|-----------|
| `tests/orchestrateur.test.js` | Unitaires | Structure rapport, extraTimeMin, cartes v3, time-awareness |
| `tests/orchestrateur.integration.test.js` | Intégration | 50 scénarios CM (due/new, burnout check) |
| `tests/orchestrateur.stress.test.js` | Stress | 279 scénarios (CM+TD+TP+Annales, difficultés variées) |
| `tests/orchestrateur.coverage.test.js` | Couverture | Branches rares : burnout forcé, repos, engagements, fillGap, Annales unlocking |
| `tests/scoring.test.js` | Scoring | 36 CM + 24 TD paramétrés, fuzzy matching examens |
| `tests/intelligence.test.js` | Intelligence | 45 burnout paramétrés, compensation, projections, charge cognitive, Night Owl |
| `tests/rlEngine.test.js` | RL Engine | UCB, Q-values, multiplicateur, persistence |
| `tests/config.test.js` | Config | Validation, sanitize (clamping), load/save |
| `tests/cours.test.js` | Cours | Validation, load/save (DB vide, multiple licences) |
| `tests/projets.test.js` | Projets | Load/save (vide, valide, non-array rejeté) |
| `tests/aiAdapter.test.js` | AI Adapter | buildAIContext (fichiers manquants → fallback) |

---

### 🛡️ COUCHE 3 : AGENT AUDIT — `agent_audit/`

**Immune System v3.2** — 57 règles, 10 phases d'audit, auto-correction avec backup/rollback.

#### 🔷 CORE (2 fichiers)

| Fichier | Rôle | Détail |
|---------|------|--------|
| `main.py` | **Point d'entrée CLI** (~300 lignes). Boucle d'audit en 10 phases | 4 modes : continu (1h), one-shot, dry-run, emergency-check, health |
| `engine.py` | **Moteur décisionnel** (~250 lignes). Priorisation, score de confiance, auto-fix, multi-passe | `should_auto_fix()` (confiance ≥ 70%), `calculate_health_score()` (NASA-grade, log₂, exponentielle), hash différentiel |

#### 🔷 SCANNERS (1 fichier, 6 stratégies)

| Fichier | Stratégies | Détail |
|---------|-----------|--------|
| `scanners.py` | **6 stratégies** (~300 lignes) | 1. REGEX (ligne par ligne) · 2. IMPORT_GRAPH (cycles) · 3. STRUCTURAL (fonctions, nesting, taille) · 4. TEST_PAIRING (couverture) · 5. LAYER_BOUNDARY (architecture) · 6. CUSTOM_PYTHON (useEffect cleanup, JSON.parse, Express async, fetch sans abort) + Scanners globaux : NPM Audit, Broken Tests |

#### 🔷 FIXERS (1 fichier, 6 stratégies)

| Fichier | Stratégies | Détail |
|---------|-----------|--------|
| `fixers.py` | **6 stratégies** (~200 lignes) | `delete_line` · `replace` · `replace_regex` · `comment_out` · `delete_line_or_comment` · `npm_update` (sécurité). Protocole : backup → fix → validate → rollback si échec |

#### 🔷 VALIDATION & INFRA (5 fichiers)

| Fichier | Rôle |
|---------|------|
| `validators.py` | Validation post-fix — exécute les tests, vérifie la syntaxe |
| `escalation.py` | Escalade — crée des tickets pour les anomalies non corrigibles |
| `health.py` | Auto-diagnostic — statut agent, règles actives/inactives, escalades critiques |
| `refactor.py` | Refactoring automatique |
| `linters.py` | Interface ESLint + Ruff — exécute et parse les résultats |

#### 🔷 RÈGLES (57 règles dans `rules.json`)

| Catégorie | Nb règles | Exemples |
|-----------|-----------|----------|
| SECURITY | 8 | NO_HARDCODED_SECRETS, NO_EVAL, NO_UNSAFE_INNERHTML, NO_HTTP_IN_PRODUCTION, NO_SQL_INJECTION, NO_WILDCARD_CORS |
| PERFORMANCE | 5 | LARGE_IMPORT, MISSING_REACT_MEMO, NO_SYNCHRONOUS_FILE_IO |
| ARCHITECTURE | 4 | NO_CIRCULAR_IMPORTS, LAYER_VIOLATION, EXCESSIVE_FILE_SIZE (>500 lignes) |
| CODE_QUALITY | 7 | EXCESSIVE_FUNCTION_LENGTH (>50), EXCESSIVE_NESTING (>4), NO_VAR, MAGIC_NUMBERS |
| REACT | 7 | MISSING_KEY_IN_MAP, USEEFFECT_MISSING_CLEANUP (2 règles), FETCH_WITHOUT_ABORT |
| TESTING | 7 | MISSING_TEST_FILE, TEST_WITH_ONLY, TEST-HEAL (3 règles auto-fix) |
| ACCESSIBILITY | 5 | MISSING_ALT, MISSING_ARIA_LABEL, NO_POSITIVE_TABINDEX, NO_WINDOW_PROMPT |
| PYTHON | 4 | NO_BARE_EXCEPT, NO_PRINT, MISSING_TYPE_HINTS, FIX_CONFIDENCE_DECIMAL |
| CSS | 1 | NO_IMPORTANT_IN_CSS |
| INTELLIGENCE | 3 | INTELLIGENCE_EXPORT_COVERAGE, SCORING_NEW_PARAM, RAPPORT_V3_KEYS |
| PWA | 1 | PWA_STATIC_ROUTE_EXCLUSION |
| ELPIS | 2 | TOAST_DIRECT_CALL, ZUSTAND_FULL_STORE_DESTRUCTURE |

---

### 🗄️ COUCHE 4 : DATA — `data/`

| Fichier | Rôle | Format |
|---------|------|--------|
| `elpis.sqlite` | **Base de données principale** — tables licences, semestres, ues, matieres, cours_cm, exercices, historique, config, projets | SQLite (better-sqlite3, WAL) |
| `espoir_config.json` | Configuration utilisateur (legacy) | JSON |
| `espoir_cours.json` | Arborescence des cours (legacy) | JSON |
| `espoir_historique.json` | Historique d'étude (legacy) | JSON |
| `espoir_audit.json` | Dernier rapport d'audit | JSON |
| `espoir_audit_health.json` | Dernier diagnostic santé agent | JSON |
| `espoir_chat.json` | Historique chat IA | JSON |
| `espoir_telemetry_rl.json` | État RL Engine | JSON |
| `backups/` | Backups SQLite quotidiens (5j) + backups config/cours/historique | `.db` + `.json` |

> **Note** : Les fichiers `espoir_*.json` sont l'ancien format. La migration vers SQLite est gérée par `db/migrate.js`. Le système fonctionne en SQLite-first avec fallback JSON.

---

### 📦 COUCHE 5 : INFRA — Configuration, Déploiement, Scripts

#### 🔷 DÉPLOIEMENT

| Fichier | Rôle |
|---------|------|
| `render.yaml` | Déploiement Render.com — plan free, Node 20, build frontend+bridge |
| `.github/workflows/ci.yml` | CI GitHub Actions — tests à chaque push/PR |
| `.github/workflows/agent_audit.yml` | Agent audit cloud — cron horaire, auto-commit des corrections |

#### 🔷 CONFIGURATION

| Fichier | Rôle | Détail |
|---------|------|--------|
| `interface/web/vite.config.js` | Config Vite + PWA | Proxy `/api` → `localhost:3001`, Workbox (NetworkFirst HTML, cache API 1 semaine), navigateFallbackDenylist |
| `interface/web/capacitor.config.json` | Config Capacitor Android | `appId: com.elpis.app`, `webDir: dist` |
| `interface/web/android/.../AndroidManifest.xml` | Manifest Android | `MainActivity`, `INTERNET`, `usesCleartextTraffic` |
| `interface/web/playwright.config.js` | Tests E2E Playwright | |
| `interface/web/public/manifest.json` | Manifest PWA | `name: ELPIS`, `display: standalone`, icônes 192/512 |
| `interface/web/public/sw.js` | Service Worker | |
| `interface/bridge/.env` | Variables environnement | `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `ADMIN_PASSWORD` |

#### 🔷 SCRIPTS

| Fichier | Rôle |
|---------|------|
| `scripts/agent_qa.bat` | Lancement agent QA |
| `scripts/deploy_oracle.sh` | Déploiement Oracle |
| `scripts/map-anki-decks.js` | Mapping des decks Anki |
| `scripts/stress_test.ps1` | Stress test PowerShell |

#### 🔷 DOCUMENTATION EXISTANTE

| Fichier | Contenu |
|---------|---------|
| `README.md` | Guide rapide, architecture, API reference, déploiement |
| `ARCHITECTURE.md` | Architecture détaillée |
| `CONTRIBUTING.md` | Guide de contribution |
| `docs/guide_debutant.md` | Guide débutant — installation, dépannage |
| `docs/backend.md` | Documentation backend — schémas JSON, orchestrateur, écritures atomiques |
| `docs/frontend.md` | Documentation frontend — composants, Zustand, PWA, repos adaptatif |
| `docs/devops.md` | DevOps — CI/CD, agent autonome, backups, gitignore |
| `docs/immune_system.md` | Documentation agent audit |
| `agent_audit/README.md` | Documentation agent audit |

---

## 🔄 FLUX DE DONNÉES

### Démarrage de l'application

```
1. main.jsx → monte <App/>
2. App.jsx → initData()
3. initData() → RxDB.getDb() → syncFromBackend() → GET /api/config, /api/cours, /api/historique, /api/projets
4. Si hors-ligne → RxDB (IndexedDB) fournit les données en cache
5. Au retour en ligne → sync automatique
```

### Génération du planning quotidien

```
1. Dashboard → GET /api/orchestrateur
2. orchestrateur.js → loadCours() + loadConfig() + loadHistorique()
3. scoring.js → getPrioScore() pour chaque matière (12 multiplicateurs)
4. intelligence.js → 12 cartes d'intelligence (burnout, compensation, vélocité, projections, synergie...)
5. orchestrateur.js → construit 4 pools → tri par priorité → assigne matin/aprem/soir
6. Frontend → affiche les tâches dans le Dashboard
```

### Validation d'une tâche

```
1. TASK_COMPLETION_MODAL → onSubmit(timeMinutes, score, difficulty)
2. store.js → addHistoriqueEntry() + saveConfig() [debounced 500ms]
3. POST /api/historique → saveHistorique() → SQLite
4. store.js → fetchOrchestrator() → recharge le planning
5. fsrsEngine.js → evaluateFSRS(card, rating) → met à jour stabilité/difficulté
```

### Audit automatique

```
1. Toutes les heures → python agent_audit/main.py (mode continu)
   OU cron GitHub Actions → agent_audit.yml
2. Phase 1 : Collecte fichiers (exclut node_modules, .git, backups...)
3. Phase 2 : Scanners globaux (imports, layers, tests, NPM audit)
4. Phase 3 : Linters (ESLint, Ruff) avec backup/rollback
5. Phase 4-10 : Construction rapport → health check → auto-commit Git
```

---

## 📑 INDEX DE RECHERCHE RAPIDE

### "Où se trouve..."
| Question | Réponse |
|----------|---------|
| Le planning quotidien ? | `interface/bridge/moteur/orchestrateur.js` (backend) → `Dashboard.jsx` (affichage) |
| L'algorithme FSRS ? | `interface/web/src/fsrsEngine.js` (frontend) + `interface/bridge/moteur/scoring.js` (backend) |
| L'anti-burnout ? | `interface/bridge/moteur/intelligence.js` → `detectBurnoutRisk()` |
| La config utilisateur ? | `interface/bridge/moteur/config.js` → `DEFAULT_CONFIG` |
| Le store Zustand ? | `interface/web/src/store.js` → `useStore` |
| La base de données locale ? | `interface/web/src/database.js` (RxDB/IndexedDB) + `data/elpis.sqlite` (SQLite) |
| Le thème CSS ? | `interface/web/src/index.css` → variables CSS, 4 thèmes horaires |
| Le Service Worker PWA ? | `interface/web/vite.config.js` → `VitePWA` + `interface/web/public/sw.js` |
| L'adaptateur DeepSeek ? | `interface/bridge/aiAdapter.js` → `callDeepSeek()` |
| Les schémas de validation ? | `interface/bridge/moteur/schemas.js` → Zod 4.x |
| Les règles d'audit ? | `agent_audit/rules.json` → 57 règles, 13 catégories |
| Le déploiement Render ? | `render.yaml` |
| La config Android ? | `interface/web/android/app/src/main/AndroidManifest.xml` |
| Le chronomètre global ? | `interface/web/src/components/GlobalChrono.jsx` → `useChronoStore` |
| Les sons ? | `interface/web/src/hooks/useSoundEffects.js` → Web Audio API |
| La synchro Anki ? | `interface/bridge/moteur/ankiSync.js` → AnkiConnect localhost:8765 |
| Le RL Engine ? | `interface/bridge/moteur/rlEngine.js` → UCB Bandits |
| Les tests backend ? | `interface/bridge/tests/` → 11 fichiers, ~400 scénarios |
| La migration JSON→SQLite ? | `interface/bridge/db/migrate.js` → `runMigration()` |
| L'écriture atomique ? | `interface/bridge/utils/fileUtils.js` → `atomicWriteFileSync()` |

### "Je veux modifier..."
| Objectif | Fichier(s) à toucher |
|----------|----------------------|
| Ajouter une page | `App.jsx` (lazy import + routing) + `Sidebar.jsx` (navigation) + nouveau `MaPage.jsx` |
| Ajouter un paramètre de config | `moteur/config.js` (DEFAULT_CONFIG) + `moteur/schemas.js` (Zod) + `App.jsx` (UI config) |
| Ajouter une règle d'audit | `agent_audit/rules.json` (règle) + `agent_audit/scanners.py` (si nouveau pattern) |
| Modifier le scoring | `moteur/scoring.js` → `getPrioScore()` |
| Ajouter une carte d'intelligence | `moteur/intelligence.js` (nouvelle fonction) + `moteur/orchestrateur.js` (intégration) |
| Ajouter une route API | `routes/monEndpoint.js` + `server.js` (app.use) |
| Modifier le design system | `index.css` (variables CSS et classes) |
| Changer l'algorithme de révision | `fsrsEngine.js` (frontend) + `scoring.js` (backend) |

---

> **Mainteneurs** : Ce fichier est la source de vérité. Après chaque modification structurelle du projet, mettez-le à jour.

## 📜 Règles Métier Spécifiques : Capitalisation
- **ECTS par UE** : Le modèle ueSchema (moteur/schemas.js) porte l'attribut ects. Les crédits sont acquis au niveau de l'UE, non des matières.
- **Blocage des UEs Acquises** : Le système de scoring (moteur/scoring.js) exclut automatiquement de la planification (orchestrateur.js) toute matière appartenant à une UE validée (ue.acquise = true ou ue.dispense = true).
- **Mesures Transitoires** : Gérées via l'attribut dispense, permettant de conserver les ECTS sans perturber le calcul de la moyenne semestrielle.
- Mise à jour de la logique de notation : Remplacement de la Super Moyenne pondérée par ECTS par des moyennes arithmétiques pour la Licence et le DEUG.
- Ajout de la Mention globale avec points de jury interactifs dans le Bulletin.
- Règles d'évaluation continue (BulletinPage) : Le poids de chaque note est calculé en temps réel. Un avertissement se déclenche si une évaluation pèse pour plus de 50% de la moyenne d'une UE, conformément au règlement de la CFVU. Les évaluations sont désormais définies dans le modèle Zod (schemas.js).
- **BulletinPage.jsx** : Vue consolidée des moyennes (Licence, DEUG, semestre).
  - Affichage détaillé de la progression ECTS de l'année courante (ECTS acquis au Semestre 1 et Semestre 2).
  - Outil "What-If" pour la simulation de scénarios d'examen.
  - Calcul dynamique AJAC et mention du jury. Une défaillance (DEF) se propage mathématiquement à la matière, l'UE, et bloque la compensation du semestre.
