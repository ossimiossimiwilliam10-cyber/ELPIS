# Projet Espoir - Compagnon d'Étude L2 Sciences pour l'Ingénieur

Ce document détaille le plan de création de **Espoir**, l'application compagnon.

## Historique des plans
Les anciennes versions sont dans le dossier `plans_historique`.
- **V1 :** Moteur Python.
- **V2 :** Moteur C/C++.
- **V3 :** Architecture modulaire "Multi-Cerveaux".
- **V4 (Actuel) :** C++ confirmé et liste exhaustive des paramètres du Menu Configuration.

## Architecture Validée : C++ et Multi-Cerveaux

Nous utiliserons le **C++** (orienté objet) pour concevoir nos "cerveaux". Le C++ est optimal car il permet de créer des "Classes" (par exemple `class CerveauConfiguration`) qui encapsulent parfaitement les données.

## Étape 1 : Le Cerveau Configuration

Suite à mes recherches, pour qu'une application de révision médicale/ingénierie soit optimale (gestion de la charge de travail, répétition espacée, évitement du burn-out), le menu Configuration doit stocker les informations suivantes :

### 1. Paramètres Personnels et Horaires
- **Date du concours / Examens :** Pour générer un compte à rebours et augmenter la charge de travail à l'approche de la date (Lead-time).
- **Date de rentrée :** (Ex: 7 septembre 2026).
- **Horaires de sommeil :** Heure de coucher et de lever (pour bloquer ces heures et assurer la récupération).
- **Capacité de travail journalière :** Un "Cap" ou limite d'heures maximum d'étude par jour pour éviter le surmenage.

### 2. Engagements Fixes (Emploi du temps de base)
- **Créneaux incompressibles :** Heures de cours magistraux, TD, TP, ou temps de trajet. L'algorithme devra planifier *autour* de ces blocs.

### 3. Moteur d'Apprentissage (Spaced Repetition & Interleaving)
- **Interleaving (Entrelacement) :** Nombre maximum de matières différentes à étudier par jour. (La recherche conseille 2 à 3 matières max par jour pour mieux retenir sans s'épuiser).
- **Durée des blocs de révision :** Préférence pour des sessions courtes (ex: technique Pomodoro de 25 min) ou des blocs longs profonds (ex: 90 min).
- **Temps dédié au "Rappel Actif" :** Temps minimum imposé chaque jour pour revoir les notions passées (ex: 1h par jour dédiée uniquement à revoir les anciens cours).

### 4. Interface et Esthétique
- **Thème visuel :** Sombre (apaisant) ou Clair (énergisant).
- **Couleurs des catégories :** Attribuer des couleurs aux matières (Physique en bleu, Santé en rouge, etc.).

## Plan d'Action pour le Cerveau Configuration

Dès votre validation de ces paramètres :
1. Je créerai le dossier `moteur/cerveaux_secondaires/configuration/`.
2. Je coderai le fichier `CerveauConfig.cpp` et `CerveauConfig.h` (les classes C++).
3. Ce cerveau lira et écrira ces paramètres dans un fichier JSON local (ex: `espoir_config.json`), prêt à être lu par l'interface Web ou le Cerveau Principal.
