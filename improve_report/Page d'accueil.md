# 🔬 Audit Complet — Page Accueil (Dashboard)

Revue exhaustive du code, de l'UX, de la logique, et de l'ergonomie de la page d'accueil d'ELPIS.
Date cible de livraison : **07/09/2026** — Délai restant : ~36 jours.

---

## 🚨 Bugs Critiques (Fonctionnalités Cassées)

### BUG-01 : Le bouton "Non, je suis en forme ! (Travailler)" ne fonctionne pas

> [!CAUTION]
> **Impact : Fonctionnalité morte.** Le bouton appelle `/api/skip-rest` mais la route est montée à `/api/config/skip-rest` (voir [server.js](file:///c:/Users/User/Desktop/Dev%20&%20Code/ELPIS/interface/bridge/server.js#L130) : `app.use('/api/config', require('./routes/config'))`).

**Fichier :** [Dashboard.jsx L79](file:///c:/Users/User/Desktop/Dev%20&%20Code/ELPIS/interface/web/src/Dashboard.jsx#L79)
```javascript
const res = await fetch('/api/skip-rest', { method: 'POST' }); // ❌ 404 -> retourne du HTML (SPA fallback)
```

**De plus**, ce `fetch` n'utilise pas `getApiUrl()`, ce qui casse aussi en mode mobile (Capacitor) où l'IP du serveur est customisée.

**Correction :**
```javascript
const res = await fetch(`${getApiUrl()}/config/skip-rest`, { method: 'POST' });
```

---

### BUG-02 : `getTodayStr()` dupliquée 4 fois (risque de divergence)

> [!WARNING]
> La même fonction est copiée-collée dans 4 fichiers différents. Si la logique de "période de grâce" (Night Owl -4h) devait changer, il faudrait toucher 4 endroits.

| Fichier | Ligne |
|---------|-------|
| [Dashboard.jsx](file:///c:/Users/User/Desktop/Dev%20&%20Code/ELPIS/interface/web/src/Dashboard.jsx#L118) | L118-122 |
| [useDashboardStats.js](file:///c:/Users/User/Desktop/Dev%20&%20Code/ELPIS/interface/web/src/hooks/useDashboardStats.js#L11) | L11-15 |
| [useTaskCompletion.js](file:///c:/Users/User/Desktop/Dev%20&%20Code/ELPIS/interface/web/src/hooks/useTaskCompletion.js#L25) | L25-29 |
| [EntrainementPage.jsx](file:///c:/Users/User/Desktop/Dev%20&%20Code/ELPIS/interface/web/src/EntrainementPage.jsx#L57) | L57+ |

**Correction :** Extraire dans un utilitaire partagé (ex: `utils/dateUtils.js`).

---

### BUG-03 : 13+ appels `fetch()` en dur sans `getApiUrl()`

> [!WARNING]
> Tous ces appels casseront en mode mobile (Capacitor) où l'IP du serveur est configurée via `localStorage('serverIp')`.

Fichiers affectés : Dashboard, Sidebar, StatistiquesPage, RevisionsAvanceesPage, PreparationHebdoPage, EntrainementPage, CoursPage, MusicSettingsModal, ExerciceCard, MatiereCard.

---

## ⚡ Bugs Logiques (Comportement Incorrect)

### BUG-04 : Export iCal produit des dates UTC incorrectes

**Fichier :** [Dashboard.jsx L189-203](file:///c:/Users/User/Desktop/Dev%20&%20Code/ELPIS/interface/web/src/Dashboard.jsx#L186)

Le `formatICSDate` utilise `toISOString()` qui retourne UTC et ajoute "Z" (= Zulu/UTC). Mais le `currentBlockStart` est initialisé avec `new Date()` en heure locale, puis manipulé en local. Résultat : les événements dans Google Calendar seront décalés de ±1-2h selon le fuseau horaire.

**Solution :** Utiliser `DTSTART;TZID=Europe/Paris:20260802T080000` au lieu du format UTC, ou convertir correctement en UTC avant le formatage.

---

### BUG-05 : `handleTaskComplete` appelle `getTodayStr()` qui est définie APRÈS dans le code

**Fichier :** [Dashboard.jsx L100](file:///c:/Users/User/Desktop/Dev%20&%20Code/ELPIS/interface/web/src/Dashboard.jsx#L100) vs [L118](file:///c:/Users/User/Desktop/Dev%20&%20Code/ELPIS/interface/web/src/Dashboard.jsx#L118)

Ce n'est pas un crash car `getTodayStr` est une `function declaration` (hoistée), mais c'est du code confus. La lecture est non-linéaire.

---

### BUG-06 : Le `confirm()` natif pour "Activer Jour de Repos" est inapproprié

**Fichier :** [Dashboard.jsx L233](file:///c:/Users/User/Desktop/Dev%20&%20Code/ELPIS/interface/web/src/Dashboard.jsx#L233)

`window.confirm()` casse l'immersion de l'app, bloque le thread UI, et n'est pas stylisable. Le reste de l'app utilise des modals avec Framer Motion — incohérence UX.

---

### BUG-07 : `useWorkloadEngine` peut déclencher des boucles de re-render

**Fichier :** [useWorkloadEngine.js L124-127](file:///c:/Users/User/Desktop/Dev%20&%20Code/ELPIS/interface/web/src/useWorkloadEngine.js#L124)

Le hook appelle `setConfig()` à l'intérieur d'un `useEffect`, ce qui modifie le store, ce qui déclenche `debouncedSaveConfig`, qui appelle `fetchOrchestrator()`, qui met à jour `orchestratorData`, qui re-déclenche le rendu du Dashboard. Le throttle de 60s atténue le problème mais ne le supprime pas.

---

## 🎨 Problèmes d'Ergonomie et de Design (UX/UI)

### UX-01 : La section "Chronobiologie Activée" est illisible

Visible sur le screenshot 2 : le bloc violet "Chronobiologie Activée" liste TOUTES les matières du matin sur une seule ligne gigantesque. Avec 20+ matières, ça déborde et l'information est noyée.

**Proposition :** Limiter à 5 matières visibles + un `+12 autres` avec un tooltip/expand, ou séparer en deux colonnes (Matin / Soir) avec des chips.

---

### UX-02 : Le texte "Aucun projet en cours" dans ProjectsWidget manque de call-to-action visuel

**Fichier :** [ProjectsWidget.jsx L34](file:///c:/Users/User/Desktop/Dev%20&%20Code/ELPIS/interface/web/src/components/dashboard/ProjectsWidget.jsx#L34)

Le texte "Rendez-vous dans l'onglet Projets pour en créer un !" n'a pas de bouton cliquable pour naviguer directement. L'utilisateur doit chercher dans la sidebar.

**Proposition :** Ajouter un bouton `+ Créer un projet` qui fait `setActiveTab('projets')`.

---

### UX-03 : Les boutons de difficulté (🔴🟠🟡🟢🔵) sur chaque tâche sont cryptiques

**Fichier :** [TaskList.jsx L73-79](file:///c:/Users/User/Desktop/Dev%20&%20Code/ELPIS/interface/web/src/components/dashboard/TaskList.jsx#L73)

Un simple cercle coloré avec `opacity: 0.7` ne communique pas son rôle. Un nouvel utilisateur ne sait pas que cliquer 🔴 valide la tâche comme "Difficile". Le `title` tooltip est le seul indice, mais invisible sur mobile.

**Proposition :** Soit les supprimer de la liste (et les garder uniquement dans la modale de complétion), soit ajouter un label textuel au survol.

---

### UX-04 : Le carousel des matières dans StatsSection n'a pas d'indicateurs de scroll

**Fichier :** [StatsSection.jsx L29](file:///c:/Users/User/Desktop/Dev%20&%20Code/ELPIS/interface/web/src/components/dashboard/StatsSection.jsx#L29)

Le `overflow-x: auto` crée un scroll horizontal invisible. Sur le screenshot 3, les barres de matières sont coupées à droite sans aucun indicateur visuel qu'il y a du contenu au-delà.

**Proposition :** Ajouter des flèches de navigation gauche/droite ou un dégradé de fondu sur les bords.

---

### UX-05 : Les boutons d'action du Dashboard ne sont pas priorisés visuellement

Visible sur le screenshot 1 : 5 boutons alignés (Activité Libre, Code Health, Activer Jour de Repos, Exporter PDF, Exporter iCal) tous de la même taille. L'action primaire (commencer à travailler) n'est pas mise en avant.

**Proposition :** Réorganiser avec une hiérarchie claire :
- **Primaire :** "Activité Libre" (déjà vert, c'est bien)
- **Secondaire :** "Jour de Repos"
- **Tertiaire :** PDF / iCal dans un menu déroulant "⬇️ Exporter"
- **Code Health :** le déplacer dans le footer ou la sidebar (c'est un outil dev, pas une action quotidienne)

---

### UX-06 : Pas de rappel visuel du temps *écoulé* depuis l'ouverture du Dashboard

L'utilisateur voit "Cible IA : 5h" et "Prévu : 0h" mais ne sait pas combien de temps il a déjà travaillé aujourd'hui en un coup d'œil (c'est caché dans "Progression de la journée" qui n'est visible que quand `tempsDispoMin > 0` et `statut !== REPOS`).

**Proposition :** Ajouter une stat "Travaillé" dans le `WelcomeCard` avec le temps déjà travaillé aujourd'hui.

---

## 🏗️ Dette Technique

### TECH-01 : Dashboard.jsx contient trop de logique inline (376 lignes)

Le fichier mélange : fetch orchestrator, iCal export, drag-and-drop, modals custom task, greeting logic, loading state. C'est devenu un "God Component".

**Proposition :** Extraire en hooks supplémentaires :
- `useICalExport()` — pour `exportToICal`
- `useCustomTask()` — pour la modal d'activité libre
- Déplacer `handleSkipRest` dans le store ou un hook

---

### TECH-02 : Le composant `TaskCompletionModal` utilise un anti-pattern React

**Fichier :** [TaskCompletionModal.jsx L31-38](file:///c:/Users/User/Desktop/Dev%20&%20Code/ELPIS/interface/web/src/components/TaskCompletionModal.jsx#L31)

```javascript
if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    // ...
}
```

Ce pattern de "state derivé du props" pendant le render est un anti-pattern documenté par React. C'est un mini-bug : le state est mis à jour **pendant le render**, pas dans un effet. Ça fonctionne mais force un double-render à chaque ouverture.

**Correction :** Utiliser un `useEffect` avec `isOpen` comme dépendance, ou une `key` prop pour forcer le remount.

---

### TECH-03 : `handleSubmit` dans `TaskCompletionModal` crée un closure stale

**Fichier :** [TaskCompletionModal.jsx L46-53](file:///c:/Users/User/Desktop/Dev%20&%20Code/ELPIS/interface/web/src/components/TaskCompletionModal.jsx#L46)

Le `handleKeyDown` callback dans `useEffect` capture `handleSubmit` via closure, mais `handleSubmit` dépend de `minutes`, `score`, `difficulte` qui ne sont pas dans les deps. Cela signifie que presser `Enter` peut soumettre avec des valeurs obsolètes.

Les deps listées `[isOpen, onClose, onSubmit, minutes, score, difficulte, taskType]` sont correctes au niveau ESLint, mais `handleSubmit` (la function référencée) est redéfinie à chaque render sans `useCallback`, donc le `useEffect` se relance constamment — ce qui est un leak de performance.

---

### TECH-04 : Le Drag-and-Drop ne persiste pas l'ordre

**Fichier :** [Dashboard.jsx L89-95](file:///c:/Users/User/Desktop/Dev%20&%20Code/ELPIS/interface/web/src/Dashboard.jsx#L89)

`onDragEnd` réordonne le state local `orderedTaches`, mais ce nouvel ordre est perdu au prochain refresh (le prochain `fetchOrchestrator` écrase tout). L'utilisateur qui réorganise ses tâches les retrouve dans l'ordre original après un rechargement.

**Proposition :** Soit sauvegarder l'ordre custom dans `sessionStorage`, soit le communiquer au backend.

---

### TECH-05 : Double `CircularProgress` — WelcomeCard vs StatsSection

[WelcomeCard.jsx L63-88](file:///c:/Users/User/Desktop/Dev%20&%20Code/ELPIS/interface/web/src/components/dashboard/WelcomeCard.jsx#L63) contient un SVG animé `CircularProgress`, et [StatsSection.jsx L17-21](file:///c:/Users/User/Desktop/Dev%20&%20Code/ELPIS/interface/web/src/components/dashboard/StatsSection.jsx#L17) utilise un `conic-gradient` CSS fait à la main pour la même donnée (`globalPercent`).

Deux implémentations visuellement différentes pour la même information. Confusion UX + duplication.

---

## 📋 Améliorations Recommandées (Non-bugs)

### AMÉL-01 : Ajouter un compteur de tâches restantes dans la section "Objectifs du Jour"

Actuellement, la liste est scrollable (`maxHeight: 400px`) mais l'utilisateur ne sait pas s'il y a des tâches cachées en-dessous.

---

### AMÉL-02 : Le message d'accueil devrait être plus contextuel

`"Tu as tout terminé pour aujourd'hui. Bravo !"` est le même message quel que soit le contexte. Serait plus engageant avec des variations : heure de la journée, streak en cours, nombre de jours avant l'examen le plus proche.

---

### AMÉL-03 : La barre de "Charge du Jour" ne montre pas le temps déjà travaillé

Le widget "Charge du Jour" compare `Prévu` vs `Cible IA` mais n'indique pas où l'utilisateur en est *réellement* dans sa journée. La barre de progression de la section "Objectifs" le fait, mais elle est dans un autre bloc.

---

### AMÉL-04 : L'`inscriptionPedagogiqueDone` est un rappel hardcodé

Le rappel "Inscription Pédagogique" est codé en dur dans le Dashboard. Ce mécanisme devrait être généralisé : un système de rappels/alertes configurable (date d'échéance, texte custom) dans la config.

---

## ✅ Points Positifs (Ce qui fonctionne bien)

- **Architecture de composants bien découpée** : WelcomeCard, TaskList, InsightsPanel, ProjectsWidget, StatsSection — bonne séparation des responsabilités.
- **Skeleton loading** : L'état de chargement est bien géré avec des squelettes animés.
- **Dynamic Theme** : Le système de thème horaire (morning/afternoon/evening/night) est élégant.
- **Streak logic robuste** : La gestion du streak avec période de grâce Night Owl et tolérance des jours de repos est solide.
- **Chrono store séparé** : Bonne décision d'avoir isolé le chrono dans un store séparé pour éviter les re-renders.
- **RxDB + offline support** : L'architecture hors-ligne est bien pensée.
- **FSRS pour les CM** : Algorithme de révision espacée de qualité.

---

## 📊 Priorisation Proposée

| Priorité | ID | Type | Effort |
|----------|----|------|--------|
| 🔴 P0 | BUG-01 | Bug cassant | 5 min |
| 🔴 P0 | BUG-03 | Bug cassant (mobile) | 30 min |
| 🟡 P1 | BUG-02 | Refactor dette | 15 min |
| 🟡 P1 | BUG-04 | Bug logique | 20 min |
| 🟡 P1 | BUG-06 | UX incohérente | 15 min |
| 🟡 P1 | UX-01 | Lisibilité | 30 min |
| 🟡 P1 | UX-03 | Clarté | 20 min |
| 🟢 P2 | UX-02 | Call-to-action | 10 min |
| 🟢 P2 | UX-04 | Scroll feedback | 20 min |
| 🟢 P2 | UX-05 | Hiérarchie boutons | 30 min |
| 🟢 P2 | UX-06 | Stat manquante | 15 min |
| 🟢 P2 | TECH-01 | Refactor | 1h |
| 🟢 P2 | TECH-02 | Anti-pattern | 10 min |
| 🟢 P2 | TECH-04 | Persistance DnD | 30 min |
| 🟢 P2 | TECH-05 | Duplication | 15 min |
| 🔵 P3 | AMÉL-01-04 | Nice to have | 1h+ |

---

## Open Questions

> [!IMPORTANT]
> 1. **BUG-01** : As-tu déjà remarqué que le bouton "Non, je suis en forme" ne marchait pas en mode REPOS_OPTIONNEL ? C'est un bug silencieux — le fetch retourne du HTML sans erreur visible.
> 2. **UX-05** : Le bouton "Code Health" est-il destiné à rester sur le Dashboard à long terme, ou c'est un outil de développement temporaire ?
> 3. **TECH-04** : Le drag-and-drop des tâches est-il une vraie feature utilisée, ou un gadget ? Ça détermine si on investit dans la persistance.

## Verification Plan

### Après correction des bugs :
- Tester le bouton "Non, je suis en forme" en mode REPOS_OPTIONNEL → vérifier que le backend reçoit bien le POST et que le planning se recharge
- Tester l'export iCal → importer le fichier .ics dans Google Calendar et vérifier que les heures correspondent
- Tester en mode Capacitor (mobile) → vérifier que tous les `fetch` utilisent `getApiUrl()`

### Tests automatiques :
```bash
cd interface/web && npx vitest run
cd interface/bridge && npm test
```
