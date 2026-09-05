# 📑 INDEX ALPHABÉTIQUE — Projet ELPIS

> **Trouve n'importe quel fichier en un clin d'œil.**
> **Dernière mise à jour** : 2026-07-21
> **Voir aussi** : [CARTOGRAPHIE.md](../CARTOGRAPHIE.md) pour une description détaillée de chaque fichier

---

## Catégories

| Code | Signification |
|------|--------------|
| 🖥️ Frontend | React, JSX, CSS — interface utilisateur |
| 🌉 Backend | Express.js, routes API |
| ⚙️ Moteur | Logique métier (orchestrateur, scoring, intelligence) |
| 🛡️ Audit | Agent Python — Système Immunitaire |
| 🧪 Test | Tests unitaires, intégration, E2E |
| 🔧 Config | Fichiers de configuration |
| 📜 Script | Scripts utilitaires |
| 📖 Doc | Documentation |
| 🏗️ Infra | CI/CD, Docker, déploiement |

---

## A

| Fichier | Catégorie | Description |
|---------|-----------|-------------|
| `ARCHITECTURE.md` | 📖 Doc | Documentation complète de l'architecture (11 sections, flux de données) |
| `agent_audit/README.md` | 📖 Doc | Documentation de l'agent d'audit — Immune System v3.2 |
| `agent_audit/_analyze.py` | 🛡️ Audit | Module d'analyse Python pour l'agent d'audit |
| `agent_audit/_analyze_test.py` | 🧪 Test | Tests du module d'analyse Python |
| `agent_audit/_test_rules.py` | 🧪 Test | Tests des règles d'audit |
| `agent_audit/_test_rules_test.py` | 🧪 Test | Meta-tests des tests de règles |
| `agent_audit/ast_scanner.py` | 🛡️ Audit | Scanner AST Python pour analyse structurelle (~500 lignes) |
| `agent_audit/ast_scanner_test.py` | 🧪 Test | Tests du scanner AST |
| `agent_audit/deadcode.py` | 🛡️ Audit | Détecteur de code mort (fichiers/fonctions inutilisés) |
| `agent_audit/deadcode_test.py` | 🧪 Test | Tests du détecteur de code mort |
| `agent_audit/engine.py` | 🛡️ Audit | Moteur décisionnel — priorisation, confiance, auto-fix, multi-passe |
| `agent_audit/engine_test.py` | 🧪 Test | Tests du moteur décisionnel |
| `agent_audit/escalation.py` | 🛡️ Audit | Escalade — création de tickets pour anomalies non corrigibles |
| `agent_audit/escalation_test.py` | 🧪 Test | Tests du module d'escalade |
| `agent_audit/fixers.py` | 🛡️ Audit | Correcteurs automatiques — 6 stratégies (delete, replace, regex, npm) |
| `agent_audit/fixers_test.py` | 🧪 Test | Tests des fixers |
| `agent_audit/health.py` | 🛡️ Audit | Auto-diagnostic — statut agent, règles actives, escalades critiques |
| `agent_audit/health_test.py` | 🧪 Test | Tests du module health |
| `agent_audit/linters.py` | 🛡️ Audit | Interface ESLint + Ruff — exécute et parse les résultats |
| `agent_audit/linters_test.py` | 🧪 Test | Tests du module linters |
| `agent_audit/main.py` | 🛡️ Audit | Point d'entrée CLI — 4 modes (continu, one-shot, dry-run, emergency-check) |
| `agent_audit/main_test.py` | 🧪 Test | Tests du point d'entrée main.py |
| `agent_audit/perf.py` | 🛡️ Audit | Analyse de performance |
| `agent_audit/perf_test.py` | 🧪 Test | Tests du module performance |
| `agent_audit/refactor.py` | 🛡️ Audit | Refactoring automatique |
| `agent_audit/refactor_test.py` | 🧪 Test | Tests du module refactoring |
| `agent_audit/rules.json` | 🛡️ Audit | 57 règles d'audit en 13 catégories (sécurité, perf, React, etc.) |
| `agent_audit/scanners.py` | 🛡️ Audit | 6 stratégies de scan (REGEX, IMPORT_GRAPH, STRUCTURAL, etc.) |
| `agent_audit/scanners_test.py` | 🧪 Test | Tests des scanners |
| `agent_audit/testgen.py` | 🛡️ Audit | Génération automatique de tests |
| `agent_audit/testgen_test.py` | 🧪 Test | Tests du générateur de tests |
| `agent_audit/trending.py` | 🛡️ Audit | Analyse de tendances (dette technique, santé du code) |
| `agent_audit/trending_test.py` | 🧪 Test | Tests du module trending |
| `agent_audit/validators.py` | 🛡️ Audit | Validation post-fix — exécute tests, vérifie syntaxe |
| `agent_audit/validators_test.py` | 🧪 Test | Tests des validateurs |

---

## C

| Fichier | Catégorie | Description |
|---------|-----------|-------------|
| `CARTOGRAPHIE.md` | 📖 Doc | Atlas complet du projet — chaque fichier expliqué en détail |
| `CONTRIBUTING.md` | 📖 Doc | Guide de contribution pas à pas (12 sections) |
| `check_ocr.py` | 📜 Script | Vérification de la configuration OCR |
| `check_tools.py` | 📜 Script | Vérification des outils installés |

---

## D

| Fichier | Catégorie | Description |
|---------|-----------|-------------|
| `Dockerfile` | 🏗️ Infra | Build multi-stage Node 20 Alpine pour conteneurisation |
| `docker-compose.yml` | 🏗️ Infra | Configuration Docker Compose (volume persistant, port 3000) |
| `docs/FAQ.md` | 📖 Doc | Foire Aux Questions — 40 questions/réponses |
| `docs/GLOSSAIRE.md` | 📖 Doc | Glossaire — 60+ termes techniques expliqués simplement |
| `docs/backend.md` | 📖 Doc | Documentation backend — schémas JSON, orchestrateur, écritures atomiques |
| `docs/devops.md` | 📖 Doc | DevOps — CI/CD, agent autonome, backups, gitignore |
| `docs/frontend.md` | 📖 Doc | Documentation frontend — composants, Zustand, PWA, conventions |
| `docs/guide_debutant.md` | 📖 Doc | Guide premier contact — installation, démarrage, dépannage |
| `docs/immune_system.md` | 📖 Doc | Documentation agent audit — architecture, cycle de vie, règles |
| `dump_db.js` | 📜 Script | Script de dump de la base de données SQLite |
| `data/elpis.sqlite` | 🗄️ Data | Base de données principale — 7 tables SQLite (WAL mode) |
| `data/espoir_audit.json` | 🗄️ Data | Dernier rapport d'audit JSON |
| `data/espoir_audit_health.json` | 🗄️ Data | Dernier diagnostic santé de l'agent |

---

## E

| Fichier | Catégorie | Description |
|---------|-----------|-------------|
| `extract_pdf.py` | 📜 Script | Extraction de texte depuis les PDFs uploadés |
| `.editorconfig` | 🔧 Config | Configuration de style d'édition (indentation, charset, fin de ligne) |
| `.env.example` | 🔧 Config | Exemple de fichier d'environnement (ADMIN_PASSWORD seul) |
| `.github/workflows/agent_audit.yml` | 🏗️ Infra | GitHub Action — audit cloud cron horaire avec auto-commit |
| `.github/workflows/ci.yml` | 🏗️ Infra | GitHub Action — CI : tests à chaque push/PR |

---

## I

| Fichier | Catégorie | Description |
|---------|-----------|-------------|
| `interface/bridge/server.js` | 🌉 Backend | Serveur Express — Helmet, CORS, rate limiting, 10 routes API, sert le build React |
| `interface/bridge/moteur/stockage.js` | 🌉 Backend | Registre de source du moteur — SQLite (PC) ou documents (téléphone) |
| `interface/web/src/moteur/sourceLocale.js` | 🖥️ Frontend | Branche le moteur sur les documents de l'appareil |
| `interface/web/src/moteur/rapportLocal.js` | 🖥️ Frontend | Programme du jour calculé sur le téléphone |
| `interface/web/src/utils/liaison.js` | 🖥️ Frontend | Sonde de liaison avec le PC (bouton Synchroniser) |
| `interface/bridge/moteur/repetiteur/` | 🌉 Backend | Le Répétiteur — connaissances.js, intentions.js, reponses.js, reglement.js, consulter() |
| `interface/bridge/mongoAdapter.js` | 🌉 Backend | Stub MongoDB — désactivé, ELPIS 100% local |
| `interface/bridge/package.json` | 🔧 Config | Dépendances backend (Express 5, better-sqlite3, Helmet, Zod 4) |
| `interface/bridge/db/setup.js` | 🌉 Backend | Initialisation SQLite — better-sqlite3, WAL, 7 tables |
| `interface/bridge/db/migrate.js` | 🌉 Backend | Migration JSON legacy → SQLite |
| `interface/bridge/middleware/errorHandler.js` | 🌉 Backend | Gestionnaire global d'erreurs Express |
| `interface/bridge/moteur/ankiSync.js` | ⚙️ Moteur | Synchronisation AnkiConnect (localhost:8765, cache 5min, batch 5) |
| `interface/bridge/moteur/config.js` | ⚙️ Moteur | Gestion configuration — load/save/validate/sanitize, 30+ valeurs par défaut |
| `interface/bridge/moteur/cours.js` | ⚙️ Moteur | Gestion arborescence cours — SQLite, transaction DELETE+INSERT, deepMerge |
| `interface/bridge/moteur/historique.js` | ⚙️ Moteur | Gestion historique — sessions d'étude, trim à 10 000 entrées |
| `interface/bridge/moteur/intelligence.js` | ⚙️ Moteur | Module d'intelligence v3 (~600 lignes) — 12 cartes d'intelligence |
| `interface/bridge/moteur/orchestrateur.js` | ⚙️ Moteur | Orchestrateur central v3 (~800 lignes) — génère le planning quotidien |
| `interface/bridge/moteur/projets.js` | ⚙️ Moteur | Gestion projets |
| `interface/bridge/moteur/rlEngine.js` | ⚙️ Moteur | Reinforcement Learning — UCB Bandits (Q + C×√(ln(N)/n)) |
| `interface/bridge/moteur/schemas.js` | ⚙️ Moteur | Schémas Zod 4.x — validation config, cours, historique |
| `interface/bridge/moteur/scoring.js` | ⚙️ Moteur | Moteur de scoring FSRS v3 — getPrioScore(), 12 multiplicateurs |
| `interface/bridge/moteur/telemetry.js` | ⚙️ Moteur | Télémétrie — log sessions et actions |
| `interface/bridge/moteur/utils.js` | ⚙️ Moteur | Utilitaires dates — normalisation ISO, DD-MM-YYYY → YYYY-MM-DD |
| `interface/bridge/routes/anki.js` | 🌉 Backend | Route Anki — GET/POST /api/anki/* |
| `interface/bridge/routes/chat.js` | 🌉 Backend | Route du Répétiteur — GET/POST/DELETE /api/chat (calcul local) |
| `interface/bridge/routes/config.js` | 🌉 Backend | Route Config — GET/POST /api/config |
| `interface/bridge/routes/cours.js` | 🌉 Backend | Route Cours — GET/POST /api/cours |
| `interface/bridge/routes/historique.js` | 🌉 Backend | Route Historique — GET/POST /api/historique |
| `interface/bridge/routes/music.js` | 🌉 Backend | Route Musique — GET/POST/DELETE /api/music/* |
| `interface/bridge/routes/orchestrateur.js` | 🌉 Backend | Route Orchestrateur — GET/POST /api/orchestrateur (cache LRU 60s) |
| `interface/bridge/routes/projets.js` | 🌉 Backend | Route Projets — GET/POST /api/projets |
| `interface/bridge/routes/system.js` | 🌉 Backend | Route Système — upload PDF, shutdown, audit |
| `interface/bridge/routes/telemetry.js` | 🌉 Backend | Route Télémétrie — POST /api/telemetry/* |
| `interface/bridge/services/auditAgent.js` | 🌉 Backend | Lanceur agent Python — spawn agent_audit/main.py |
| `interface/bridge/tests/repetiteur.test.js` | 🧪 Test | Le Répétiteur — intentions, chiffres, aveu d'incompréhension |
| `interface/bridge/tests/repetiteurEtendu.test.js` | 🧪 Test | Le Répétiteur — absences, épreuves, ambiguïté, garde « demain », règlement |
| `interface/bridge/tests/config.test.js` | 🧪 Test | Tests validation config |
| `interface/bridge/tests/cours.test.js` | 🧪 Test | Tests gestion cours |
| `interface/bridge/tests/intelligence.test.js` | 🧪 Test | Tests intelligence (45 scénarios burnout paramétrés) |
| `interface/bridge/tests/orchestrateur.coverage.test.js` | 🧪 Test | Tests couverture branches rares orchestrateur |
| `interface/bridge/tests/orchestrateur.integration.test.js` | 🧪 Test | Tests intégration orchestrateur (50 scénarios CM) |
| `interface/bridge/tests/orchestrateur.stress.test.js` | 🧪 Test | Tests stress orchestrateur (279 scénarios) |
| `interface/bridge/tests/orchestrateur.test.js` | 🧪 Test | Tests unitaires orchestrateur |
| `interface/bridge/tests/projets.test.js` | 🧪 Test | Tests gestion projets |
| `interface/bridge/tests/rlEngine.test.js` | 🧪 Test | Tests RL Engine (UCB, Q-values) |
| `interface/bridge/tests/scoring.test.js` | 🧪 Test | Tests scoring (36 CM + 24 TD paramétrés) |
| `interface/bridge/utils/fileUtils.js` | 🌉 Backend | Écriture atomique — .tmp + rename (fallback copyFileSync) |
| `interface/web/package.json` | 🔧 Config | Dépendances frontend (React 19, Zustand, RxDB, Framer Motion) |
| `interface/web/vite.config.js` | 🔧 Config | Config Vite + PWA + Workbox + proxy API |
| `interface/web/capacitor.config.json` | 🔧 Config | Config Capacitor Android (appId: com.elpis.app) |
| `interface/web/playwright.config.js` | 🔧 Config | Configuration tests E2E Playwright |
| `interface/web/public/manifest.json` | 🖥️ Frontend | Manifeste PWA (name: ELPIS, standalone, icônes 192/512) |
| `interface/web/public/sw.js` | 🖥️ Frontend | Service Worker PWA |
| `interface/web/src/App.jsx` | 🖥️ Frontend | Composant racine — routing, thème, initData(), Config inline |
| `interface/web/src/BulletinPage.jsx` | 🖥️ Frontend | Page Bulletin — notes, ECTS, compensation, mode What-If |
| `interface/web/src/ClassementPage.jsx` | 🖥️ Frontend | Page Classement — score composite, loi normale |
| `interface/web/src/CoursPage.jsx` | 🖥️ Frontend | Page Cours — arborescence Licence > UE > Matières, CRUD |
| `interface/web/src/Dashboard.jsx` | 🖥️ Frontend | Page Dashboard — planning, insights, drag-and-drop |
| `interface/web/src/EntrainementPage.jsx` | 🖥️ Frontend | Page Entraînement — session FSRS du jour |
| `interface/web/src/ErrorBoundary.jsx` | 🖥️ Frontend | Capture les erreurs React — bouton "Recharger" |
| `interface/web/src/GlobalSearchModal.jsx` | 🖥️ Frontend | Recherche globale Ctrl+K — cross-matière |
| `interface/web/src/GraphPage.jsx` | 🖥️ Frontend | Graphe 3D connaissances — react-force-graph-3d |
| `interface/web/src/MarkdownModal.jsx` | 🖥️ Frontend | Éditeur Markdown avec preview |
| `interface/web/src/MesVideosPage.jsx` | 🖥️ Frontend | Vidéos YouTube par matière |
| `interface/web/src/PreparationHebdoPage.jsx` | 🖥️ Frontend | Préparation hebdomadaire — quotas, upload PDF |
| `interface/web/src/ProjetsPage.jsx` | 🖥️ Frontend | Pages Projets — phases, progression, chronomètre |
| `interface/web/src/RevisionsAvanceesPage.jsx` | 🖥️ Frontend | Révisions avancées — ciblage manuel d'exercices |
| `interface/web/src/Sidebar.jsx` | 🖥️ Frontend | Navigation latérale — 3 groupes, badge tâches, streak |
| `interface/web/src/StatistiquesPage.jsx` | 🖥️ Frontend | Stats et performances — Recharts, KPIs, projections |
| `interface/web/src/ToastProvider.jsx` | 🖥️ Frontend | Système notifications toast — contexte React |
| `interface/web/src/components/Repetiteur.jsx` | 🖥️ Frontend | Le Répétiteur — panneau de questions/réponses, calcul local |
| `interface/web/src/components/AuditDashboard.jsx` | 🖥️ Frontend | Dashboard d'audit — anomalies agent Python |
| `interface/web/src/components/BackgroundMusicPlayer.jsx` | 🖥️ Frontend | Lecteur musique adaptatif — calm/motivational |
| `interface/web/src/components/DisclaimerModal.jsx` | 🖥️ Frontend | Modal conditions d'utilisation |
| `interface/web/src/components/GlobalChrono.jsx` | 🖥️ Frontend | Chronomètre flottant — draggable, PiP, confetti |
| `interface/web/src/components/InfoTooltip.jsx` | 🖥️ Frontend | Infobulle contextuelle — glass, animation |
| `interface/web/src/components/MusicSettingsModal.jsx` | 🖥️ Frontend | Gestion bibliothèque musicale |
| `interface/web/src/components/TaskCompletionModal.jsx` | 🖥️ Frontend | Modal validation — temps réel, score FSRS, difficulté |
| `interface/web/src/components/cours/EditableLabel.jsx` | 🖥️ Frontend | Texte éditable inline |
| `interface/web/src/components/cours/EditableNote.jsx` | 🖥️ Frontend | Note éditable — clic → MarkdownModal |
| `interface/web/src/components/cours/ExerciceCard.jsx` | 🖥️ Frontend | Carte exercice — évaluation + chrono intégré |
| `interface/web/src/components/cours/ExerciceRow.jsx` | 🖥️ Frontend | Ligne exercice éditable |
| `interface/web/src/components/cours/MatiereCard.jsx` | 🖥️ Frontend | Carte matière complète — CM, TD, TP, Annales, NotebookLM |
| `interface/web/src/components/cours/StarRating.jsx` | 🖥️ Frontend | Étoiles de difficulté 1-5 |
| `interface/web/src/components/dashboard/InsightsPanel.jsx` | 🖥️ Frontend | Panneau insights Dashboard |
| `interface/web/src/components/dashboard/ProjectsWidget.jsx` | 🖥️ Frontend | Widget projets Dashboard |
| `interface/web/src/components/dashboard/StatsSection.jsx` | 🖥️ Frontend | Section stats Dashboard |
| `interface/web/src/components/dashboard/TaskList.jsx` | 🖥️ Frontend | Liste des tâches Dashboard |
| `interface/web/src/components/dashboard/WelcomeCard.jsx` | 🖥️ Frontend | Carte d'accueil Dashboard |
| `interface/web/src/constants.js` | 🖥️ Frontend | DIFFICULTY_LEVELS — 5 niveaux |
| `interface/web/src/database.js` | 🖥️ Frontend | RxDB — IndexedDB, 4 collections, sync bidirectionnelle |
| `interface/web/src/fsrsEngine.js` | ⚙️ Moteur | Moteur FSRS frontend — ts-fsrs, répétition espacée |
| `interface/web/src/hooks/useSoundEffects.js` | 🖥️ Frontend | Sons Web Audio — taskComplete, streakUp, click |
| `interface/web/src/index.css` | 🖥️ Frontend | Design system complet — variables CSS, 4 thèmes horaires, responsive |
| `interface/web/src/main.jsx` | 🖥️ Frontend | Bootstrap Vite — monte App dans le DOM |
| `interface/web/src/parseDateLocal.js` | 🖥️ Frontend | Parsing dates — ISO + legacy DD-MM-YYYY |
| `interface/web/src/sm2.js` | ⚙️ Moteur | Algorithme SM-2 legacy — rétrocompatibilité |
| `interface/web/src/store.js` | 🖥️ Frontend | Store Zustand principal — config, cours, historique, Immer, debounce 500ms |
| `interface/web/src/useWorkloadEngine.js` | ⚙️ Moteur | Moteur charge de travail — estimation temps d'étude |
| `interface/web/src/utils/apiConfig.js` | 🖥️ Frontend | Configuration URL API — support IP custom, fallback /api |
| `interface/web/src/utils/timeParser.js` | 🖥️ Frontend | Parsing flexible saisies temps — 35, 35.5, 35m44s |

---

## O

| Fichier | Catégorie | Description |
|---------|-----------|-------------|
| `ocr_batch.py` | 📜 Script | Traitement OCR par lots |
| `ocr_screenshots.py` | 📜 Script | OCR sur captures d'écran |

---

## P

| Fichier | Catégorie | Description |
|---------|-----------|-------------|
| `package.json` | 🔧 Config | Dépendances racine du projet |

---

## R

| Fichier | Catégorie | Description |
|---------|-----------|-------------|
| `README.md` | 📖 Doc | Vue d'ensemble — guide rapide, architecture, API, déploiement |
| `render.yaml` | 🏗️ Infra | Configuration déploiement Render.com |

---

## S

| Fichier | Catégorie | Description |
|---------|-----------|-------------|
| `scripts/_count_lines.ps1` | 📜 Script | Compteur de lignes de code PowerShell |
| `scripts/_count_lines_v2.ps1` | 📜 Script | Compteur de lignes v2 — exclut backups, data, build |
| `scripts/agent_qa.bat` | 📜 Script | Lancement agent QA (batch Windows) |
| `scripts/deploy_oracle.sh` | 📜 Script | Déploiement Oracle (shell) |
| `scripts/map-anki-decks.js` | 📜 Script | Mapping des decks Anki vers matières ELPIS |
| `scripts/map-anki-decks.test.js` | 🧪 Test | Tests du mapping Anki |
| `scripts/stress_test.ps1` | 📜 Script | Stress tests PowerShell |
| `search_subjects.py` | 📜 Script | Recherche de sujets/matières |

---

## T

| Fichier | Catégorie | Description |
|---------|-----------|-------------|
| `tsconfig.json` | 🔧 Config | Configuration TypeScript (pour l'éditeur, JSDoc principalement) |

---

> **Mainteneurs** : Ajoutez les nouveaux fichiers ici dans la bonne lettre alphabétique. Format : `chemin`, catégorie, description une phrase.
