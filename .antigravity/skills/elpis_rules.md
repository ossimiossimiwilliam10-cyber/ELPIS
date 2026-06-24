# 🧠 Compétences et Règles "Élite" pour ELPIS

Ce fichier sert de "Skill File" (Context Memory) pour Antigravity (ou tout autre agent IA travaillant sur ce dépôt). Il définit les standards absolus de qualité et la méthodologie à suivre sur le projet ELPIS.

## 1. Méthodologie : Test-Driven (TDD) Obligatoire
*   **Ne jamais assumer que le code fonctionne sans test.**
*   **Anti-régression obligatoire :** Systématiquement, lors de la détection et de la correction d'un bug (notamment dans l'algorithme), un test unitaire spécifique "anti-régression" DOIT être créé pour valider la correction et garantir que ce bug ne réapparaisse plus jamais.
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

> **Directive d'Initialisation :** À chaque début de session complexe, relis ce fichier ainsi que l'`algorithm_evaluation.md` pour te re-contextualiser immédiatement au niveau "Élite".
