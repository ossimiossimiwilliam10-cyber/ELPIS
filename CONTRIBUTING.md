# 🤝 Contribuer à ELPIS — Guide pas à pas

Bienvenue ! Ce guide t'emmène de "je veux aider" à "ma première PR fusionnée". Aucune connaissance préalable du projet n'est requise.

---

## 📋 Table des matières

1. [Premiers pas](#1-premiers-pas)
2. [Comprendre le projet en 5 minutes](#2-comprendre-le-projet-en-5-minutes)
3. [Installer l'environnement de développement](#3-installer-lenvironnement-de-développement)
4. [Lancer ELPIS en mode développement](#4-lancer-elpisen-mode-développement)
5. [Structure du code — Où trouver quoi](#5-structure-du-code--où-trouver-quoi)
6. [Écrire du code](#6-écrire-du-code)
7. [Lancer les tests](#7-lancer-les-tests)
8. [Faire une Pull Request](#8-faire-une-pull-request)
9. [Déploiement](#9-déploiement)
10. [Conventions de code](#10-conventions-de-code)
11. [Ajouter une règle d'audit](#11-ajouter-une-règle-daudit)
12. [Ressources](#12-ressources)

---

## 1. Premiers pas

### Prérequis obligatoires

Avant toute chose, assure-toi d'avoir installé :

| Logiciel | Version minimum | Comment vérifier |
|----------|----------------|-----------------|
| **Node.js** | 20.x | `node --version` |
| **npm** | 10.x | `npm --version` |
| **Python** | 3.10+ | `python --version` |
| **Git** | 2.x | `git --version` |

Si une commande n'est pas reconnue, installe le logiciel correspondant :
- [Node.js](https://nodejs.org/) (prends la version LTS)
- [Python](https://www.python.org/downloads/)
- [Git](https://git-scm.com/downloads)

### Prérequis recommandés

- **Visual Studio Code** — l'éditeur recommandé. Installe les extensions :
  - ESLint
  - Prettier
  - Python (Microsoft)
  - ES7+ React/Redux/React-Native snippets
- **Anki** (optionnel) — pour tester la synchronisation AnkiConnect
- **Docker Desktop** (optionnel) — pour lancer ELPIS en conteneur

---

## 2. Comprendre le projet en 5 minutes

Commence par lire ces 3 documents, dans l'ordre :

1. **[README.md](README.md)** (5 min) — Vue d'ensemble, ce que fait ELPIS, comment le lancer.
2. **[docs/guide_debutant.md](docs/guide_debutant.md)** (10 min) — Guide pour débutants, concepts de base.
3. **[CARTOGRAPHIE.md](CARTOGRAPHIE.md)** (15 min) — Atlas complet du projet, chaque fichier expliqué.

Ensuite, ouvre le projet dans VS Code et explore les dossiers :

```
ELPIS/
├── interface/web/src/    → Le frontend React (ce que tu vois à l'écran)
├── interface/bridge/     → Le backend Express (le serveur)
├── agent_audit/          → L'outil d'audit Python (Système Immunitaire)
├── data/                 → La base SQLite et les fichiers JSON
├── docs/                 → Toute la documentation
└── scripts/              → Scripts utilitaires
```

**La règle d'or** : le frontend parle au backend via l'API REST. Le backend lit/écrit dans SQLite. L'agent d'audit scanne tout le code.

---

## 3. Installer l'environnement de développement

### Étape 1 : Cloner le dépôt

```bash
git clone https://github.com/TON-COMPTE/ELPIS.git
cd ELPIS
```

### Étape 2 : Installer les dépendances

Deux dossiers ont besoin d'un `npm install` :

```bash
# Backend (Bridge API)
cd interface/bridge
npm install

# Frontend (React)
cd ../web
npm install
```

### Étape 3 : Fichier .env (optionnel mais recommandé)

Copie le fichier d'exemple et remplis les clés :

```bash
cp .env.example .env
```

Contenu typique :

```env
ADMIN_PASSWORD=mon_mot_de_passe
```

C'est la seule variable. **Sans elle, ELPIS fonctionne quand même** — l'accès sera simplement public. Aucune clé d'API n'existe dans le projet : rien n'appelle de service extérieur.

### Étape 4 : Vérifier que tout est prêt

```bash
# Depuis la racine
node --version   # Doit afficher v20.x.x ou v22.x.x
npm --version    # Doit afficher 10.x.x ou +
python --version # Doit afficher 3.10.x ou +
```

---

## 4. Lancer ELPIS en mode développement

Le mode développement utilise **deux terminaux séparés** :

### Terminal 1 — Le backend (API)

```bash
cd interface/bridge
npm start
# → Serveur démarré sur http://localhost:3001
# → Les logs apparaissent en vert [INFO], jaune [WARN], rouge [ERROR]
```

Tu dois voir :
```
[INFO] Serveur ELPIS démarré sur le port 3001
[INFO] Base de données initialisée (SQLite WAL)
```

### Terminal 2 — Le frontend (React + Vite)

```bash
cd interface/web
npm run dev
# → Interface démarrée sur http://localhost:5173
# → Hot Reload activé : chaque modification est visible instantanément
```

**Ouvre** `http://localhost:5173` dans ton navigateur.

### Alternative : Docker

```bash
docker-compose up --build
# → Tout est lancé automatiquement sur http://localhost:3000
```

### Alternative Windows : le lanceur

Double-clique sur `Lancer ELPIS.vbs` à la racine, ou sur le raccourci ELPIS du
bureau. Le lanceur démarre le moteur sans terminal, attend que `/api/health`
réponde — donc que la base soit réellement ouverte — puis ouvre l'application en
fenêtre autonome et se range dans la zone de notification.

Son journal de démarrage est dans `outils/lanceur/journal.log` : c'est là qu'il
faut regarder quand ELPIS ne s'ouvre pas.

---

## 5. Structure du code — Où trouver quoi

### "Je veux modifier..."

| Objectif | Fichier(s) à toucher |
|----------|----------------------|
| **Ajouter une page** | `App.jsx` (lazy import + routing) + `Sidebar.jsx` (navigation) + nouveau `MaPage.jsx` |
| **Ajouter un composant** | `interface/web/src/components/MonComposant.jsx` |
| **Ajouter un paramètre de config** | `moteur/config.js` (DEFAULT_CONFIG) + `moteur/schemas.js` (Zod) + `App.jsx` (UI config) |
| **Modifier le scoring** | `moteur/scoring.js` → `getPrioScore()` |
| **Ajouter une carte d'intelligence** | `moteur/intelligence.js` (nouvelle fonction) + `moteur/orchestrateur.js` (intégration) |
| **Ajouter une route API** | `routes/monEndpoint.js` + `server.js` (app.use) |
| **Modifier le design system** | `index.css` (variables CSS) |
| **Ajouter une règle d'audit** | `agent_audit/rules.json` (+ `scanners.py` si nouveau pattern) |

### Arbre simplifié des dépendances

```
App.jsx
├── store.js (Zustand) ← TOUS les composants y accèdent
├── database.js (RxDB) ← persistance locale navigateur
├── Pages/
│   ├── Dashboard.jsx → hooks/useTaskCompletion, hooks/useDashboardStats
│   ├── EntrainementPage.jsx → fsrsEngine.js
│   ├── CoursPage.jsx → components/cours/
│   └── BulletinPage.jsx, StatistiquesPage.jsx, ...
└── Components/
    ├── GlobalChrono.jsx → chronoStore (Zustand séparé)
    ├── TaskCompletionModal.jsx → hooks/useTaskCompletion
    └── ...
```

```
server.js
├── routes/
│   ├── orchestrateur.js → moteur/orchestrateur.js
│   ├── config.js → moteur/config.js
│   ├── cours.js → moteur/cours.js
│   └── ...
├── moteur/
│   ├── orchestrateur.js → scoring.js + intelligence.js + rlEngine.js
│   ├── schemas.js (Zod) → validé dans TOUTES les routes
│   └── ...
└── db/
    ├── setup.js → initialise SQLite (7 tables)
    └── migrate.js → migration JSON → SQLite
```

---

## 6. Écrire du code

### Avant de commencer

1. **Crée une branche** :
   ```bash
   git checkout -b feature/ma-super-fonctionnalite
   ```

2. **Choisis UNE chose à faire**. Ne mélange pas plusieurs modifications dans la même PR.

3. **Vérifie que les tests passent AVANT de modifier** :
   ```bash
   cd interface/bridge && npm test
   cd interface/web && npm test
   ```

### Conventions à respecter IMPÉRATIVEMENT

Voir [la section 10](#10-conventions-de-code) pour le détail. En résumé :

- **Jamais `window.prompt()`** — utiliser `InputModal` à la place.
- **Toujours `fetchWithRetry`** au lieu de `fetch` nu dans les appels API.
- **Toujours un sélecteur avec `useStore()`** (ex: `useStore(s => s.config)`).
- **Zod pour toute validation** de données entrantes côté backend.
- **JSDoc** pour les nouveaux types/store (pas besoin de TypeScript).
- **Pas de `console.log`** — utiliser le logger du projet.

### Tester localement pendant le développement

- Le **Hot Reload** de Vite met à jour le frontend automatiquement.
- Pour le backend, utilise `nodemon` (inclus) : `npm start` relance le serveur à chaque modification.
- Pour l'agent d'audit : `python agent_audit/main.py --once --dry-run` (simule sans écrire).

---

## 7. Lancer les tests

### Tests backend (Bridge API)

```bash
cd interface/bridge
npm test              # Tous les tests (11 fichiers, ~400 scénarios)
npm run test:watch    # Mode watch (relance à chaque sauvegarde)
```

Pour lancer un test spécifique :
```bash
npx vitest tests/scoring.test.js
npx vitest tests/intelligence.test.js -t "burnout"
```

### Tests frontend (React)

```bash
cd interface/web
npm test              # Tests unitaires (Vitest)
npm run test:e2e      # Tests E2E (Playwright — 17 scénarios)
```

### Tests agent d'audit (Python)

```bash
cd agent_audit
python -m pytest *_test.py -v
```

### CI/CD

Les tests sont lancés automatiquement sur **chaque push** et **chaque PR** via GitHub Actions (`.github/workflows/ci.yml`). Si les tests échouent, la PR ne peut pas être fusionnée.

---

## 8. Faire une Pull Request

### Checklist avant de soumettre

- [ ] **Les tests passent** : `npm test` dans `interface/bridge` ET `interface/web`
- [ ] **Pas de `console.log`** ni de code commenté
- [ ] **Les nouveaux composants utilisent `InputModal`** (pas `window.prompt`)
- [ ] **Les appels API utilisent `fetchWithRetry`**
- [ ] **Validation Zod** pour toute nouvelle donnée entrante
- [ ] **JSDoc** sur les nouvelles fonctions exportées
- [ ] **Mise à jour de CARTOGRAPHIE.md** si tu ajoutes/déplaces des fichiers
- [ ] **Mise à jour de docs/INDEX.md** si tu ajoutes des fichiers
- [ ] **Commit message clair** en français ou anglais

### Workflow Git

```bash
# 1. Mets à jour ta branche
git checkout main
git pull origin main
git checkout feature/ma-fonctionnalite
git rebase main

# 2. Vérifie que tout est propre
git status

# 3. Commit avec un message descriptif
git add -A
git commit -m "feat: ajout de la page X avec le composant Y"

# 4. Push
git push origin feature/ma-fonctionnalite
```

### Convention de messages de commit

Utilise le format [Conventional Commits](https://www.conventionalcommits.org/) :

- `feat:` nouvelle fonctionnalité
- `fix:` correction de bug
- `docs:` documentation
- `refactor:` refactoring sans changement fonctionnel
- `test:` ajout/modification de tests
- `chore:` maintenance (dépendances, config)
- `style:` formatage, point-virgules, etc.

Exemple : `feat: ajout du mode sombre automatique selon l'heure`

---

## 9. Déploiement

### Déploiement automatique (Render.com)

Le projet est configuré pour Render.com via `render.yaml`. Il suffit de connecter le dépôt GitHub à Render, et le déploiement est automatique à chaque push sur `main`.

### Déploiement manuel

```bash
# 1. Build du frontend
cd interface/web
npm install --include=dev
npm run build      # → crée le dossier dist/

# 2. Préparation du backend
cd ../bridge
npm install

# 3. Lancement
node server.js     # → sert le frontend buildé + API sur le port 3000
```

### Variables d'environnement obligatoires en production

```env
MONGODB_URI=mongodb+srv://...    # Optionnel (ELPIS fonctionne 100% en local)
ADMIN_PASSWORD=...               # Pour protéger l'accès (recommandé)
```

---

## 10. Conventions de code

### JavaScript / React

| Règle | Exemple ✅ | Contre-exemple ❌ |
|-------|-----------|------------------|
| `InputModal` au lieu de `window.prompt()` | `const nom = await openModal('Entrez un nom')` | `const nom = window.prompt('Nom ?')` |
| `fetchWithRetry` pour les appels API | `fetchWithRetry('/api/config')` | `fetch('/api/config')` |
| Sélecteur Zustand | `useStore(s => s.config)` | `useStore()` (tout le store → re-rendus inutiles) |
| `const` > `let` > jamais `var` | `const x = 5` | `var x = 5` |
| Arrow functions pour callbacks | `items.map(i => i.name)` | `items.map(function(i) { return i.name })` |
| Optional chaining | `user?.profile?.name` | `user && user.profile && user.profile.name` |

### CSS

- Utiliser les variables CSS définies dans `index.css` (`var(--primary)`, `var(--bg)`, etc.)
- Classes en kebab-case : `.mon-composant`, `.glass-panel`
- Jamais de `!important` (règle d'audit `NO_IMPORTANT_IN_CSS`)
- Responsive : mobile-first avec les breakpoints définis dans `index.css`

### Node.js / Backend

- Routes dans des fichiers séparés sous `routes/`
- Validation Zod dans `schemas.js` pour toute entrée API
- Écritures atomiques via `fileUtils.js` (`atomicWriteFileSync`)
- Gestion d'erreurs via `middleware/errorHandler.js` (pas de try/catch nus)
- Logging structuré : `log('info', 'message', { data })` (pas de `console.log`)

### Python

- Ruff pour le linting (équivalent ESLint)
- Pas de `except:` nu → toujours spécifier le type d'exception
- Pas de `print()` → utiliser le module `logging`
- Type hints sur les nouvelles fonctions

---

## 11. Ajouter une règle d'audit

Le Système Immunitaire scanne le code avec 57 règles configurables dans `agent_audit/rules.json`.

### Pour ajouter une règle simple (regex)

Ajoute une entrée dans `rules.json` :

```json
{
  "id": "NO_ALERT_IN_CODE",
  "category": "code_quality",
  "severity": "warning",
  "description": "Utilisation de alert() interdite, utiliser le système de toast",
  "detection_strategy": "regex",
  "file_pattern": "\\.(js|jsx)$",
  "pattern": "\\balert\\s*\\(",
  "fix": {
    "action": "replace_regex",
    "search": "\\balert\\s*\\(([^)]*)\\)",
    "replacement": "toast.error($1)"
  }
}
```

Champs obligatoires :
- `id` : identifiant unique en UPPER_SNAKE_CASE
- `category` : `security`, `performance`, `code_quality`, `react`, `testing`, `accessibility`, `css`, `python`, `pwa`, `elpis`, `intelligence`
- `severity` : `info`, `warning`, `critical`
- `detection_strategy` : `regex`, `import_graph`, `structural`, `test_pairing`, `layer_boundary`, `custom_python`
- `file_pattern` : regex pour filtrer les fichiers à scanner
- `pattern` : le pattern à détecter

Si `fix` est défini, l'agent corrigera automatiquement. Si `fix: null`, l'agent escalade.

### Pour ajouter une règle complexe (Python)

Si la détection nécessite plus qu'une regex, modifie `scanners.py` pour ajouter une nouvelle stratégie, puis référence cette stratégie dans `rules.json`.

### Tester une règle

```bash
cd agent_audit
python main.py --once --dry-run    # Scan sans corriger
python main.py --once              # Scan + corrige si confiance ≥ 70%
```

---

## 12. Ressources

### Documentation du projet

| Document | Contenu | Pour qui |
|----------|---------|----------|
| [README.md](README.md) | Vue d'ensemble, démarrage rapide | Tout le monde |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Architecture détaillée, flux de données | Développeurs |
| [CARTOGRAPHIE.md](CARTOGRAPHIE.md) | Atlas complet — chaque fichier expliqué | Développeurs |
| [docs/GLOSSAIRE.md](docs/GLOSSAIRE.md) | 60+ termes expliqués simplement | Débutants |
| [docs/guide_debutant.md](docs/guide_debutant.md) | Guide premier contact | Débutants |
| [docs/FAQ.md](docs/FAQ.md) | 40 questions/réponses | Tout le monde |
| [docs/INDEX.md](docs/INDEX.md) | Index alphabétique des fichiers | Développeurs |
| [docs/backend.md](docs/backend.md) | Documentation backend | Développeurs backend |
| [docs/frontend.md](docs/frontend.md) | Documentation frontend | Développeurs frontend |
| [docs/devops.md](docs/devops.md) | CI/CD, backups, déploiement | DevOps |
| [docs/immune_system.md](docs/immune_system.md) | Agent d'audit | Développeurs |
| [agent_audit/README.md](agent_audit/README.md) | Documentation agent audit | Développeurs |

### Liens externes

- [React Documentation](https://react.dev/)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [FSRS Algorithm](https://github.com/open-spaced-repetition/fsrs.js)
- [Express.js Guide](https://expressjs.com/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [RxDB Documentation](https://rxdb.info/)
- [Zod Documentation](https://zod.dev/)

### Obtenir de l'aide

1. **Lis les logs** : les messages `[ERROR]` dans le terminal donnent souvent la solution.
2. **Consulte la FAQ** : [docs/FAQ.md](docs/FAQ.md)
3. **Ouvre une issue** GitHub avec :
   - Ce que tu essayais de faire
   - Ce qui s'est passé (message d'erreur complet)
   - Ton environnement (`node --version`, OS)
4. **Utilise le Glossaire** : [docs/GLOSSAIRE.md](docs/GLOSSAIRE.md) pour comprendre les termes techniques.

---

> **Mainteneurs** : Ce document est le point d'entrée pour les nouveaux contributeurs. Gardez-le à jour, simple, et accueillant.
