# Session 01 : Initialisation du Projet et Première Fenêtre PyQt6

**Date :** 13 Juillet 2026
**Auteur :** William (Guidé par Sensei IA)
**Objectif :** Créer la base d'une application bureau (Desktop) en utilisant la bibliothèque graphique PyQt6.

---

## 1. Choix Technique : Pourquoi PyQt6 ?
Pour le projet ELPIS V2, nous avons besoin d'une interface graphique (GUI) robuste. Python propose plusieurs outils, mais **PyQt6** a été choisi pour sa puissance, son architecture orientée objet très propre, et sa documentation professionnelle. C'est l'outil parfait pour créer une application lourde performante.

## 2. L'Environnement de Travail (Virtual Environment)
Lors de cette session, nous avons utilisé un **environnement virtuel** (`.venv`).
*   **Pourquoi ?** Un environnement virtuel est une "bulle" isolée. Si on installe `PyQt6` sur l'ordinateur entier (Global), cela peut créer des conflits avec d'autres projets. En utilisant un `.venv`, on s'assure que notre projet ELPIS V2 possède sa propre "boîte à outils" fermée.
*   **La leçon apprise :** L'éditeur de code (comme VS Code) lance souvent le code *à l'intérieur* de cette bulle. Si un paquet (ex: `PyQt6`) n'est pas installé dans cette bulle spécifique, le programme plantera avec une erreur `ModuleNotFoundError`, même si le paquet est installé ailleurs sur l'ordinateur.

## 3. Analyse du Code : `main.py`

Voici le code exact écrit pour générer notre première fenêtre :

```python
import sys 
from PyQt6.QtWidgets import QApplication, QWidget 

app = QApplication(sys.argv)
fenetre = QWidget() 
fenetre.setWindowTitle("Bonjour")
fenetre.show() 
app.exec() 
```

### Explication ligne par ligne (Pour William Novice) :

*   **`import sys`** : Importe un module de base de Python. `sys` permet de communiquer avec le "système" (ton ordinateur).
*   **`from PyQt6.QtWidgets import ...`** : On va chercher nos outils de construction dans la grande bibliothèque PyQt6. On prend le moteur de l'application (`QApplication`) et le modèle de base pour créer des fenêtres (`QWidget`).
*   **`app = QApplication(sys.argv)`** : **C'est le moteur de la voiture.** Toute application PyQt6 doit avoir exactement UN objet `QApplication` qui gère le programme en arrière-plan. On lui passe `sys.argv` (les arguments du système) pour qu'il puisse démarrer correctement.
*   **`fenetre = QWidget()`** : **C'est la carrosserie.** On crée une nouvelle fenêtre vide (un "Widget").
*   **`fenetre.setWindowTitle("Bonjour")`** : On donne un ordre à notre fenêtre. On lui dit de changer son titre.
*   **`fenetre.show()`** : Par défaut, les fenêtres sont invisibles (pour pouvoir les construire sans que l'utilisateur ne voie le processus). Cette commande la rend visible à l'écran.
*   **`app.exec()`** : **C'est la boucle infinie (Event Loop).** C'est la ligne la plus importante. Elle bloque le programme et l'empêche de s'arrêter. Elle dit à Python : *"Reste ici et écoute ce que fait l'utilisateur (clics, clavier, etc.) jusqu'à ce qu'il ferme la fenêtre."*

---

## 4. Pièges classiques évités lors de cette session
1.  **La Sensibilité à la casse (Case Sensitivity)** : Écrire `Qwidget()` au lieu de `QWidget()` fait planter le programme. Python est intraitable sur les majuscules.
2.  **L'oubli de sauvegarde (Ctrl + S)** : Modifier du code dans l'éditeur ne modifie pas le fichier sur le disque dur tant qu'il n'est pas sauvegardé. Le terminal lira toujours l'ancienne version non sauvegardée.
3.  **L'Event Loop Bloquante** : Placer `fenetre.setWindowTitle("Bonjour")` *après* la ligne `app.exec()` ne fonctionnera jamais. Le code après la boucle ne s'exécute que lorsque la fenêtre est fermée ! L'ordre (Création -> Configuration -> Boucle) est vital.
