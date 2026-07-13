---
name: audit_dead_code
description: Scanne le projet à la recherche de code mort (fichiers inutilisés, dépendances fantômes, fonctions non appelées) en utilisant knip (JS) et vulture (Python).
---

# Compétence : Audit de Code Mort (audit_dead_code)

Cette compétence permet à l'agent de nettoyer la base de code en supprimant les branches déconnectées, les scripts abandonnés et les dépendances inutiles.

## Instructions d'exécution

1. **Pré-requis :**
   - Assure-toi d'être à la racine du projet ou dans le dossier ciblé (ex: `interface/web` ou `interface/bridge`).
   - Pour Python, vérifie que `vulture` est installé (`python -m pip install vulture`).

2. **Étape 1 : Analyse JavaScript (Knip)**
   - Exécute `npx --yes knip` dans les dossiers contenant un `package.json` (comme `interface/web` et `interface/bridge`).
   - Identifie les **Unused files**, **Unused dependencies**, et **Unused exports**.
   - Attention : ne supprime pas de fichiers d'entrée vitaux non détectés (comme les Service Workers `sw.js` ou scripts PWA implicites). Confirme toujours la nature d'un fichier scratch avant suppression.

3. **Étape 2 : Analyse Python (Vulture)**
   - Exécute `python -m vulture <dossiers>` (ex: `python -m vulture agent_audit scripts`).
   - Isole les fonctions ou variables signalées comme mortes avec une haute confiance.
   - Attention : certaines méthodes de classe ou hooks peuvent être signalés comme inutilisés par Vulture alors qu'ils sont appelés dynamiquement. Vérifie les usages avec `grep_search` avant de les effacer.

4. **Étape 3 : Nettoyage (Execution)**
   - Supprime les fichiers `.cjs` / `.js` / `.py` scratch ou corrompus avec la commande `Remove-Item` appropriée.
   - Désinstalle les dépendances inutilisées avec `npm uninstall <package>`.
   - NE SUPPRIME JAMAIS de fonctions ou de variables non appelées automatiquement.
   - Les fonctions non appelées peuvent être des "Work In Progress" (WIP) en attente d'être connectées.
   - Contente-toi de lister ces fonctions à l'utilisateur et demande-lui EXPLICITEMENT ce qu'il veut en faire.

5. **Étape 4 : Rapport**
   - Fournis un résumé exhaustif à l'utilisateur listant tout ce qui a été purgé pour alléger la charge technique du projet.
