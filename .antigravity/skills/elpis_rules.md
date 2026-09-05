# 🧠 Compétences et Règles "Élite" pour ELPIS

Ce fichier sert de "Skill File" (Context Memory) pour Antigravity (ou tout autre agent IA travaillant sur ce dépôt). Il définit les standards absolus de qualité et la méthodologie à suivre sur le projet ELPIS.

## 1. Méthodologie : Test-Driven (TDD) Obligatoire
*   **Ne jamais assumer que le code fonctionne sans test.**
*   **Création Systématique de Tests :** Pour **CHAQUE** nouveau composant UI ou module backend créé, le fichier de test associé (`.test.jsx` ou `.test.js`) **DOIT** être écrit en même temps. C'est non négociable.
*   **Test-Driven Development (TDD) Strict** : Systématiquement, lors de la création d'une **nouvelle fonctionnalité** OU lors de la correction d'un bug, il est obligatoire de créer les tests unitaires/d'intégration correspondants dans la suite de tests (ex: via `vitest`). Aucune feature ne doit être poussée sans ses tests.
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

## 5. Frontière IA vs Algorithme (Le Répétiteur)
*   **Cœur 100% Algorithmique :** L'IA ne doit **JAMAIS** être utilisée pour des tâches complexes de fond (configuration, déblocage de tâches, calcul de FSRS, orchestration). Le moteur doit rester purement mathématique et déterministe.
*   **Le Répétiteur est local (plus d'IA distante) :** il lit les tables et calcule ses réponses (`moteur/repetiteur/`). Il n'appelle aucun service extérieur et n'invente aucun chiffre : ce qu'il ne sait pas traiter, il le dit. Son rôle reste celui d'une façade flottante — il lit les résultats algorithmiques, il ne les modifie pas.
*   **Trois interdits, à respecter dans toute réponse nouvelle :** ne jamais présenter un zéro issu d'une absence de mesure comme un zéro constaté ; ne jamais choisir entre deux matières homonymes (demander laquelle) ; ne jamais conclure à partir du règlement — on cite, la scolarité tranche.

> **Directive d'Initialisation :** À chaque début de session complexe, relis ce fichier ainsi que l'`algorithm_evaluation.md` pour te re-contextualiser immédiatement au niveau "Élite".

## 6. Sécurité et Configuration Externe
*   **Aucun service extérieur :** ELPIS n'appelle plus aucune API distante, et ne doit pas recommencer. Toute fonction nouvelle se calcule en local ; si elle exige une génération de texte, on prépare une consigne que l'utilisateur porte lui-même dans la fenêtre de son choix (voir `moteur/vocabulaire.js`).
*   **Utilisation de `.env` :** Toute configuration variable doit être injectée via `process.env`. Le code doit toujours prévoir une valeur par défaut cohérente (fallback) si la variable d'environnement facultative n'est pas fournie.

## 7. Appels à un modèle de langue (usage résiduel)
Le seul appel distant qui subsiste est la génération de cartes de vocabulaire (onglet Langues), déclenchée à la main. Tout le reste — Coach compris — se calcule en local.
*   **Ancrage Temporel :** ne jamais laisser un modèle deviner la date ; si une tâche future en dépend, injecter l'horodatage explicitement.
*   **Concision :** un prompt de chat doit brider la verbosité (2 ou 3 phrases). Un chat n'est pas un rapport.
*   **Dégradation propre :** une dépendance absente (Anki fermé, PC injoignable depuis le téléphone) ne doit jamais faire taire l'application : elle doit dire ce qui manque, jamais laisser croire à un résultat vide.

## 8. Mémoire Absolue (Omniscience)
*   **Omniscience du Coach :** le Coach interroge directement les tables SQLite — cursus, notes, historique complet, config, projets — et le rapport de l'orchestrateur, c'est-à-dire la même source que l'écran d'accueil. Il ne peut donc pas dire autre chose que ce que l'étudiant voit. Aucune troncature : il n'y a plus de fenêtre de contexte à ménager, puisqu'il n'y a plus d'envoi.
*   **Corollaire :** un chiffre affiché par le Coach doit être calculé, jamais formulé « au mieux ». Ce qui manque vaut `null`, et la réponse le dit.

## 9. Ton et Vocabulaire (Copywriting)
*   **Tutoiement respectueux :** Toujours tutoyer l'utilisateur ("ton historique", "tes révisions") de façon motivante et claire, sans jamais être familier ou infantilisant (niveau étudiant universitaire L2).
*   **Vulgarisation Algorithmique :** Bannir le jargon trop technique ou pompeux dans l'interface utilisateur. Utiliser des mots simples et clairs (ex: "Planificateur" au lieu d'"Orchestrateur", "Vitesse d'apprentissage" au lieu de "Vélocité", "Urgence" au lieu de "MODE CRISE"). Ne pas mentionner les détails internes comme "Axe X".
*   **Simplicité et Grammaire :** Les phrases doivent être courtes, grammaticalement parfaites, et faciles à lire entre deux sessions de travail.
