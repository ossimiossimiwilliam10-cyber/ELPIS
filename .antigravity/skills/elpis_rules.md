# 🧠 Compétences et Règles "Élite" pour ELPIS

Ce fichier sert de "Skill File" (Context Memory) pour Antigravity (ou tout autre agent IA travaillant sur ce dépôt). Il définit les standards absolus de qualité et la méthodologie à suivre sur le projet ELPIS.

## 1. Méthodologie : Test-Driven (TDD) Obligatoire
*   **Ne jamais assumer que le code fonctionne sans test.**
*   **Création Systématique de Tests :** Pour **CHAQUE** nouveau composant UI ou module backend créé, le fichier de test associé (`.test.jsx` ou `.test.js`) **DOIT** être écrit en même temps. C'est non négociable.
*   **Diversité des Tests :** Ne pas s'arrêter aux tests unitaires. Si la fonctionnalité implique plusieurs systèmes (ex: l'IA qui lit l'historique FSRS), un **test d'intégration** simulant le flux complet doit être rédigé.
*   **Anti-régression obligatoire :** Lors de la correction d'un bug, un test spécifique "anti-régression" DOIT être créé.
*   Si tu modifies `orchestrateur.js`, `scoring.js` ou `intelligence.js`, tu **DOIS** lancer `npx vitest run` dans `interface/bridge`.
*   Si tu modifies l'UI, tu **DOIS** t'assurer que les composants passent dans `interface/web/src/__tests__`.
*   Tolérance zéro pour la baisse de couverture.

## 2. Architecture et Philosophie FSRS
*   ELPIS n'est pas une simple To-Do list. C'est un moteur algorithmique de révision (FSRS + Heuristiques).
*   Ne **dénature jamais** les facteurs FSRS originaux (les `MAGIC_CONSTANTS`) sans une preuve mathématique ou un test de validation.
*   Toute nouvelle fonctionnalité de tri doit conserver la logique de : "Charge Cognitive > Synergie UE > Compensation Note".

## 3. Autonomie de l'Agent (Mon mode de fonctionnement)
*   En tant qu'Agent, j'ai le droit et le devoir de :
    1. Lancer le terminal pour vérifier les erreurs (ESLint, Vitest, Vite Build).
    2. Utiliser `grep_search` pour trouver toutes les dépendances d'une fonction avant de la supprimer.
    3. Mettre à jour `RAPPORT_ANALYSE_COMPLET.md` si je fais un changement structurel.
*   Si on me donne la commande `/goal`, je ne m'arrête pas tant que la CI (Tests + Lint + Build) n'est pas 100% au vert.

## 4. UI / UX Standards
*   Le design d'ELPIS est "Dark Mode, Glassmorphism, Premium". 
*   Toujours utiliser les variables CSS de `index.css` (`var(--primary)`, `var(--glass-bg)`).
*   Ne jamais inclure de styles inline bruts si une classe utilitaire ou un composant existe.
*   **Saisie du Temps (Smart Time Parsing)** : Ne jamais utiliser un simple `parseInt` pour les inputs de durée. Toujours utiliser une fonction robuste capable de convertir les formats complexes (ex: "35:44", "35m44s", "35.5") en décimales (ex: 35.73) pour conserver la précision.

## 5. Frontière IA vs Algorithme (Le Coach Virtuel)
*   **Cœur 100% Algorithmique :** L'IA ne doit **JAMAIS** être utilisée pour des tâches complexes de fond (configuration, déblocage de tâches, calcul de FSRS, orchestration). Le moteur doit rester purement mathématique et déterministe.
*   **L'IA comme "Façade" (Coach) :** L'IA doit agir exclusivement comme un "Petit Agent" flottant dans l'interface (à l'image du chronomètre global). Son unique rôle est de lire les résultats algorithmiques et de formuler des commentaires contextuels et d'encouragement au fil de la journée.

> **Directive d'Initialisation :** À chaque début de session complexe, relis ce fichier ainsi que l'`algorithm_evaluation.md` pour te re-contextualiser immédiatement au niveau "Élite".
