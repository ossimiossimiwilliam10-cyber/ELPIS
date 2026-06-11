# Projet Espoir - Compagnon d'Étude L2 SpS

Ce document détaille le plan de création de **Espoir** (traduction d'Elpis), l'application compagnon conçue pour vous accompagner tout au long de votre année de L2 SpS et vous aider à préparer le concours de médecine.

L'objectif principal est de pallier les baisses de motivation en proposant un outil intelligent qui structure vos révisions et compile vos cours de manière optimale, jusqu'à votre rentrée le 7 septembre 2026 et au-delà.

## User Review Required

> [!IMPORTANT]
> Étant donné que vous souhaitez procéder **très lentement et étape par étape**, je vous propose de valider ce plan initial avant d'écrire la moindre ligne de code. Lisez attentivement la stack technologique et les fonctionnalités de base proposées ci-dessous.

## Open Questions

> [!NOTE]
> 1. **Est-ce que le nom "Espoir" vous convient pour l'application finale ?**
> 2. **Avez-vous une préférence pour l'interface visuelle ?** (ex: Thème sombre apaisant, couleurs vives pour l'énergie, minimaliste, etc.)
> 3. **Comment souhaitez-vous gérer la "compilation de cours" dans un premier temps ?** (S'agit-il d'importer des PDF, d'écrire des notes directement dans l'app, ou de structurer des dossiers locaux ?)

## Choix Technologiques (La combinaison optimale)

Pour répondre à votre besoin de performances, d'une interface magnifique et d'un "moteur intelligent" codé sur mesure sans dépendre d'une IA externe :

1. **Backend & Moteur Intelligent (Python + FastAPI) :**
   - **Pourquoi :** Python est le langage idéal pour créer des algorithmes intelligents de planification et de gestion du temps. FastAPI est un framework moderne, ultra-rapide et très robuste.
   - **Rôle :** Gérer la base de données, générer les plannings de révision (le "moteur") et fournir les données à l'interface.

2. **Frontend & Interface Utilisateur (React + Vite + Vanilla CSS) :**
   - **Pourquoi :** React permet de créer une application web dynamique et très réactive. Vite assure une compilation instantanée lors du développement.
   - **Design :** Utilisation de Vanilla CSS pour concevoir une interface premium, unique, avec des micro-animations et un design motivant (glassmorphism, dégradés, etc.).

3. **Base de données (SQLite) :**
   - **Pourquoi :** Légère, intégrée directement dans Python, ne nécessite aucune installation complexe. Parfaite pour une application compagnon personnelle.

## Plan d'Action (Étape par Étape)

Comme demandé, nous allons y aller très lentement. Voici les premières phases envisagées :

### Phase 1 : Fondations et Environnement
- Initialiser le projet Frontend (Vite + React) dans le dossier `ELPIS`.
- Initialiser le projet Backend (Python + FastAPI).
- Mettre en place un design system de base (couleurs, typographies) pour l'interface "Espoir".

### Phase 2 : Gestion des Cours
- Créer l'interface permettant d'ajouter, de catégoriser (Physique, Chimie, Santé, etc.) et de lister les cours ou chapitres à réviser.
- Connecter cette interface au Backend et à la base de données.

### Phase 3 : Le Moteur de Planification (Le "Cerveau")
- Développer l'algorithme en Python qui va prendre en compte votre date de rentrée (7 septembre) et vos disponibilités pour générer un planning réaliste.
- L'algorithme devra ajuster la charge de travail pour éviter la surcharge et maintenir la motivation.

### Phase 4 : Suivi et Motivation
- Créer un tableau de bord (Dashboard) magnifique avec des indicateurs de progression.
- Intégrer des éléments de micro-récompenses visuelles lorsque vous validez une session de révision.

## Verification Plan

### Test de fonctionnement local
- S'assurer que le Frontend et le Backend communiquent parfaitement.
- Vérifier que l'algorithme Python génère des horaires cohérents sans générer d'erreurs.
- Valider que l'interface est esthétiquement plaisante et fluide.
