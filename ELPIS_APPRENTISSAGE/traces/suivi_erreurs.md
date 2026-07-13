# Suivi des Erreurs et de la Progression

Ce document, demandé par l'étudiant, sert à garder une trace des erreurs rencontrées lors de l'apprentissage. L'objectif est d'évaluer la progression au fil du temps. En programmation, l'erreur est le meilleur des professeurs !

## Erreurs de Syntaxe et Concepts de Base

### 1. La Casse (Sensibilité aux majuscules/minuscules)
- **Date** : [Date de la première session]
- **Erreur** : Écriture de `Qtwidgets` au lieu de `QtWidgets`, `Qapplication` au lieu de `QApplication`.
- **Concept** : Python est *case-sensitive* (sensible à la casse). `Variable` et `variable` sont deux choses totalement différentes en Python.
- **Statut** : ✅ Corrigé et compris !

### 2. L'Assignation vs L'Appel de Méthode (Notions d'Objets)
- **Date** : [Date de la première session]
- **Erreur** : Mélange entre l'assignation d'une variable et l'appel d'une méthode : `app.exec = QApplication()`.
- **Concept** : En Python, on crée d'abord un objet en l'assignant à une variable simple (ex: `app = QApplication()`). C'est seulement ensuite, sur des lignes séparées, qu'on donne des ordres à cet objet en appelant ses méthodes avec un point (ex: `app.exec()`).
- **Statut** : ✅ Corrigé et compris ! L'ordre logique (Création -> Action) est respecté.

## Erreurs d'Architecture et d'Organisation

### 1. Placement des fichiers source
- **Date** : [Date de la première session]
- **Erreur** : Le fichier `main.py` a été placé dans `traces/ELPIS V2/` au lieu de la racine du projet ou d'un dossier source dédié, hors des traces documentaires.
- **Concept** : Séparation entre le code source (l'application) et la documentation (les traces).
- **Statut** : ✅ Corrigé et compris ! (Dossier déplacé dans ELPIS - APPRENTISSAGE)

## Erreurs Système et Terminal (OS)

### 1. Espaces dans les chemins de fichiers (Terminal)
- **Date** : [Date de la première session]
- **Erreur** : `Set-Location: A positional parameter cannot be found that accepts argument...` lors de la navigation avec `cd`.
- **Concept** : Le terminal (PowerShell, Bash) sépare les arguments par des **espaces**. Si un nom de dossier contient un espace (ex: `ELPIS V2`), le terminal pense que `V2` est une nouvelle commande. Pour lui dire "ceci est un seul nom", il faut entourer le chemin de guillemets : `cd "chemin\avec espace"` ou remplacer les espaces par des tirets bas `_`.
- **Statut** : ✅ Corrigé et compris ! (Dossier renommé avec un underscore)

### 2. Le fichier non sauvegardé (Ctrl+S)
- **Date** : [Date de la première session]
- **Erreur** : Lancer `python main.py` en s'attendant à voir les dernières modifications, mais obtenir une erreur liée à l'ancien code.
- **Concept** : Le terminal lit le fichier qui est physiquement enregistré sur le disque dur. L'éditeur de texte affiche une version en mémoire de travail. Tant qu'on n'appuie pas sur `Ctrl + S` (Sauvegarder), le terminal n'a pas accès au nouveau code !
- **Statut** : ✅ Corrigé et compris ! L'erreur a disparu après sauvegarde.

## Erreurs d'Environnement et Dépendances

### 1. Modules externes manquants (ModuleNotFoundError)
- **Date** : [Date de la première session]
- **Erreur** : `ModuleNotFoundError: No module named 'PyQt6'`
- **Concept** : Python possède des outils de base natifs (comme `sys`), mais n'inclut pas tout par défaut pour rester léger. Pour utiliser des bibliothèques tierces comme `PyQt6`, il faut d'abord les télécharger et les installer via l'installateur de paquets de Python : **pip**.
- **Statut** : ✅ Corrigé et compris !
### 3. Les Environnements Virtuels (.venv)
- **Date** : [Date de la première session]
- **Erreur** : `ModuleNotFoundError` réapparaît en cliquant sur le bouton "Play" (Run Python File) alors que le paquet a été installé juste avant.
- **Concept** : Python permet de créer des "bulles isolées" appelées Environnements Virtuels (`.venv`). Cela évite que les projets ne mélangent leurs dépendances. Si tu installes `PyQt6` dans l'environnement global de ton ordinateur, mais que l'éditeur exécute le code dans la bulle `.venv` du projet ELPIS, le paquet sera introuvable. Chaque bulle a sa propre boîte à outils indépendante !
- **Statut** : 🚧 En cours d'assimilation.
### 2. Noms de Paquets vs Noms de Sous-modules (pip)
- **Date** : [Date de la première session]
- **Erreur** : Essayer d'installer un sous-module spécifique avec `pip install PyQt6.QtWidgets`.
- **Concept** : Sur `pip`, on télécharge le paquet parent global (ex: `PyQt6`, qui est la grande boîte à outils). On ne peut pas télécharger un sous-module précis (le tiroir `QtWidgets`). L'erreur `ModuleNotFoundError` affiche ce qui manque dans l'import, mais l'installation se fait toujours via le nom du paquet principal.
- **Statut** : ✅ Corrigé et compris !

## Erreurs de Logique et d'Exécution

### 1. La Boucle d'Événements (Event Loop) Bloquante
- **Date** : [Date de la première session]
- **Erreur** : Placer du code de configuration (ex: `fenetre.setWindowTitle()`) **après** l'appel de `app.exec()`.
- **Concept** : `app.exec()` est une boucle infinie qui maintient l'application ouverte. Le programme Python se "bloque" sur cette ligne tant que la fenêtre graphique n'est pas fermée par l'utilisateur. Tout code placé après `app.exec()` ne s'exécutera qu'au moment où l'application se terminera. L'ordre d'exécution de haut en bas est donc suspendu à cette ligne.
- **Statut** : ✅ Corrigé et compris ! Le code de configuration est désormais placé avant le blocage de la boucle.
