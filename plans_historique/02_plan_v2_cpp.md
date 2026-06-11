# Projet Espoir - Compagnon d'Étude L2 Sciences pour l'Ingénieur (Option Santé)

Ce document détaille le plan de création de **Espoir**, l'application compagnon conçue pour vous accompagner tout au long de votre année de **L2 Sciences pour l'Ingénieur, option Santé**, et vous aider à préparer le concours de médecine.

L'objectif principal est de pallier les baisses de motivation en proposant un outil intelligent qui structure vos révisions et compile vos cours de manière optimale, jusqu'à votre rentrée le 7 septembre 2026 et au-delà.

## Historique des plans
Vous retrouverez l'historique de nos réflexions dans le dossier `plans_historique` du projet.
- **V1 :** Proposition initiale avec moteur Python.
- **V2 (Actuel) :** Moteur en C/C++ (plus adapté à un profil Ingénieur) et correction de l'intitulé de la formation.

## User Review Required

> [!IMPORTANT]
> Avant de commencer à coder, merci de valider cette nouvelle orientation avec le **moteur en C/C++**. Lisez la section "Choix Technologiques" pour voir comment les langages vont interagir.

## Open Questions

> [!NOTE]
> 1. **Compilation du C/C++ :** Avez-vous un compilateur déjà installé sur votre ordinateur (comme GCC, MinGW, ou Visual Studio) ? Sinon, nous devrons commencer par le configurer.
> 2. **Interface Visuelle :** Toujours la même question : avez-vous une préférence pour l'esthétique (thème sombre, clair, minimaliste, coloré) ?
> 3. **Gestion des cours :** Comment imaginez-vous ajouter vos cours dans l'application au début ? (Fichiers texte, PDF, interface de saisie ?)

## Choix Technologiques (La combinaison optimale C/C++ et Web)

Pour allier la **puissance brute** que vous recherchez avec le C/C++ et une **interface premium et magnifique**, voici la combinaison :

1. **Le Cerveau / Moteur Intelligent (C ou C++) :**
   - **Pourquoi :** C'est le cœur du système. En tant qu'étudiant en Sciences pour l'Ingénieur, utiliser le C/C++ pour concevoir des algorithmes ultra-performants est très pertinent.
   - **Rôle :** Un exécutable (ou une bibliothèque) qui prendra en entrée vos données de révision et calculera instantanément l'emploi du temps optimal sans dépendre d'aucune IA externe.

2. **L'Interface Utilisateur (React + Vite + Vanilla CSS) :**
   - **Pourquoi :** Les interfaces en C/C++ natives peuvent être lourdes à rendre belles. Le web moderne (React) est parfait pour créer une application dynamique, motivante, avec des animations fluides (glassmorphism, thèmes soignés).
   - **Rôle :** Afficher l'application, interagir avec vous de façon agréable.

3. **Le Pont de Communication (Node.js) :**
   - **Rôle :** Un petit serveur local ultra-léger (en Node.js ou même un script Python très simple) qui fera le lien entre la magnifique interface Web et votre Moteur en C/C++. Il transmettra les requêtes de l'interface au programme C/C++ et renverra les résultats.

## Plan d'Action (Étape par Étape)

Allons-y **très lentement**.

### Phase 1 : L'Architecture de Base (Notre prochain objectif)
- Créer la structure des dossiers : un dossier `moteur` (pour le C/C++) et un dossier `interface` (pour le Web).
- Écrire un tout premier programme C/C++ basique (ex: `moteur.c`) qui teste la compilation sur votre machine.

### Phase 2 : Fondation de l'Interface Web
- Initialiser le projet Frontend (Vite + React) avec un design system de base (couleurs, typographies).
- S'assurer de la communication entre l'interface web et le programme C/C++.

### Phase 3 : Modélisation des Données
- Définir comment nous allons stocker vos cours (fichiers locaux ou petite base de données SQLite).
- Créer l'interface pour ajouter ces cours.

### Phase 4 : Le Moteur de Planification (L'algorithme C/C++)
- Coder la logique mathématique et de planification en C/C++ pour organiser vos révisions jusqu'au 7 septembre.

## Verification Plan

### Test de fonctionnement local
- Vérifier la bonne compilation du code C/C++ sur Windows.
- Vérifier que l'interface React se lance et est esthétique.
- S'assurer que le pont de communication fonctionne (l'interface envoie "Calcule planning" -> Le C++ calcule -> l'interface affiche).
