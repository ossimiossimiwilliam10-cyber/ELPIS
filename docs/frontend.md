# Interface & Frontend React

## Stack

- **React 19** avec hooks, lazy loading (`React.lazy` + `Suspense`)
- **Zustand v5** + **Immer** pour le state management
- **RxDB v17** avec stockage Dexie (IndexedDB) pour le offline-first
- **Framer Motion** pour les animations
- **Canvas Confetti** pour les célébrations
- **Recharts** + **react-force-graph-3d** pour les graphiques
- **@hello-pangea/dnd** pour le drag-and-drop
- **Vite** pour le build
- **Capacitor** pour le déploiement Android

## Structure des fichiers

```
interface/web/src/
├── App.jsx                  # Point d'entrée, routing par onglets
├── Dashboard.jsx            # Accueil (352 lignes après refacto)
├── EntrainementPage.jsx     # Session du Jour
├── CoursPage.jsx            # Bibliothèque de Cours
├── StatistiquesPage.jsx     # Graphiques et stats
├── store.js                 # Store Zustand (typé JSDoc)
├── database.js              # RxDB initialisation + sync
├── fsrsEngine.js            # Moteur FSRS (remplace sm2.js)
├── components/
│   ├── dashboard/           # Sous-composants Dashboard (refacto)
│   │   ├── WelcomeCard.jsx
│   │   ├── TaskList.jsx
│   │   ├── InsightsPanel.jsx
│   │   ├── ProjectsWidget.jsx
│   │   └── StatsSection.jsx
│   ├── cours/               # Composants liés aux cours
│   ├── InputModal.jsx       # Remplace window.prompt()
│   ├── GlobalChrono.jsx     # Chronomètre flottant (PiP)
│   ├── TaskCompletionModal.jsx
│   ├── Repetiteur.jsx
│   └── ...
├── hooks/
│   ├── useTaskCompletion.js # Logique CM/FSRS partagée
│   ├── useDashboardStats.js # Stats et progression
│   ├── useInputModal.js     # Hook pour InputModal
│   └── useSoundEffects.js
├── utils/
│   ├── fetchWithRetry.js    # Wrapper fetch avec retry
│   ├── apiConfig.js
│   └── timeParser.js
└── __tests__/
```

## Tests

- **Vitest** : Tests unitaires (`store.test.js`, `fsrsEngine.test.js`, etc.)
- **Playwright** : 17 tests E2E dans `tests/elpis.spec.js`
- **CI** : Lancés automatiquement sur chaque push/PR

## Conventions

- Tous les nouveaux composants utilisent `InputModal` (jamais `window.prompt()`)
- Tous les appels API passent par `fetchWithRetry` ou `fetchFireAndForget`
- La logique métier CM/FSRS est dans `useTaskCompletion` (partagée Dashboard ↔ EntrainementPage)
- Les stats sont calculées dans `useDashboardStats`
- Pas de `useStore()` sans sélecteur dans les nouveaux composants
