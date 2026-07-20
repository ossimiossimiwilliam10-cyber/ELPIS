# Architecture ELPIS

## Vue d'ensemble

ELPIS est une PWA full-stack offline-first. L'architecture suit une séparation en couches distinctes :

```
┌─────────────────────────────────────────────┐
│  interface/web (React 19 + Zustand + RxDB)  │  ← PWA offline-first
│  - Dashboard, EntrainementPage, Cours...    │
│  - RxDB pour persistance locale (Dexie)     │
│  - fetchWithRetry pour résilience réseau    │
├─────────────────────────────────────────────┤
│  interface/bridge (Express + SQLite)        │  ← Serveur local
│  - Routes API REST                          │
│  - Orchestrateur v3 (moteur/)               │
│  - Intelligence (FSRS, burnout, velocity)   │
│  - Système Immunitaire (agent_audit)        │
├─────────────────────────────────────────────┤
│  data/                                      │  ← Stockage
│  - elpis.sqlite (base principale)           │
│  - backups/ (rotations automatiques)        │
└─────────────────────────────────────────────┘
```

## Couche Frontend (`interface/web/`)

### Architecture des composants

- **Pages** : `Dashboard.jsx`, `EntrainementPage.jsx`, `CoursPage.jsx`, etc.
- **Composants partagés** : `InputModal`, `TaskCompletionModal`, `GlobalChrono`
- **Dashboard (refactoré)** : Utilise `hooks/useTaskCompletion` et `hooks/useDashboardStats` pour la logique métier, et 5 sous-composants (`WelcomeCard`, `TaskList`, `InsightsPanel`, `ProjectsWidget`, `StatsSection`) pour la vue.

### State Management

- **Zustand + Immer** : Store central (`store.js`) avec `ElpisConfig` et `ElpisStore` (types JSDoc)
- **RxDB** : Persistance locale avec synchronisation bidirectionnelle vers le bridge
- **ChronoStore** : Store séparé pour le chronomètre global (évite les re-rendus)

### Résilience

- `utils/fetchWithRetry.js` : Retry exponentiel avec timeout sur tous les appels API
- `utils/fetchFireAndForget` : Pour la télémétrie et les appels non-critiques
- Détection offline/online avec événements DOM et `localStorage`

## Couche Bridge (`interface/bridge/`)

- **server.js** : Express, sert le frontend buildé + API REST
- **routes/** : API config, cours, historique, projets, orchestrateur, Anki
- **moteur/** : Orchestrateur v3 avec FSRS, UCB bandits, détection burnout
- **db/** : SQLite avec migrations, écritures atomiques (.tmp + renameSync)
- **services/** : Anki connect, IA, musique

## Couche Audit (`agent_audit/`)

- Daemon Python exécuté périodiquement (GitHub Actions ou manuel)
- Lance ESLint, Ruff, vérifie la cohérence JSON, applique des fixers
- Auto-PR via GitHub Actions en cas de corrections

## DevOps

- **Dockerfile** : Multi-stage build (Node 20 Alpine)
- **docker-compose.yml** : Volume persistant, port 3000
- **CI/CD** : GitHub Actions (lint, vitest, playwright, build)
- **Immune System** : GitHub Actions schedule (daily audit + auto-fix PR)
