# Plan d'Architecture ELPIS (Python Desktop)

L'objectif de cette première phase est de poser les bases de la nouvelle application ELPIS en Python, en utilisant le framework PyQt6 et une architecture Modèle-Vue-Contrôleur (MVC).

## Proposed Changes

Voici la structure de dossiers et de fichiers que tu devras créer à l'intérieur de `apprentissage_elpis` :

### Structure MVC PyQt6

- **`main.py`** : Le point d'entrée de ton programme. C'est ici que l'application PyQt (`QApplication`) sera initialisée.
- **`models/`** : Dossier contenant la logique métier. (Ex: Un fichier `user_model.py` pour gérer les données de l'utilisateur).
- **`views/`** : Dossier pour ton code d'interface graphique "fait main". (Ex: Un fichier `main_window.py` qui contiendra ta fenêtre principale).
- **`controllers/`** : Dossier faisant le pont. Le contrôleur écoutera les clics de la vue et mettra à jour le modèle.
- **`traces/`** : (Déjà existant) Contient nos mindmaps et ce plan.

## Verification Plan

### Manual Verification
1. Une fois le plan validé, tu créeras ces dossiers.
2. Tu écriras ton premier code dans `main.py` et `views/main_window.py`.
3. Tu exécuteras `python main.py` dans ton terminal pour afficher ta toute première fenêtre ELPIS. Je serai là pour corriger ton code si la fenêtre ne s'affiche pas !
