# Projet Espoir - Compagnon d'Étude L2 Sciences pour l'Ingénieur

Ce document détaille le plan de création de **Espoir**, l'application compagnon.

## Historique des plans
Les anciennes versions sont dans le dossier `plans_historique`.
- **V1 :** Moteur Python.
- **V2 :** Moteur C/C++.
- **V3 (Actuel) :** Architecture modulaire "Multi-Cerveaux" et focus sur le menu Configuration.

## Architecture : Le Système Multi-Cerveaux

Pour répondre à votre vision, voici comment l'application sera structurée, menu par menu :

1. **Le Cerveau Principal (Le chef d'orchestre en C/C++) :**
   - Il reçoit les données de tous les autres cerveaux.
   - Il utilise ces données combinées pour générer le planning général final.

2. **Les Cerveaux Secondaires (Les experts en C/C++) :**
   - Chaque menu (Configuration, Cours, Examens, etc.) possède son propre petit cerveau autonome.
   - Par exemple, le *Cerveau Configuration* ne gère que les paramètres de l'utilisateur (horaires préférés, mode sombre/clair, etc.) et transmet ses résumés au Cerveau Principal.

3. **L'Interface Web (React) :**
   - Chaque menu visuel est connecté à son Cerveau Secondaire respectif.

## Notre Toute Première Étape (Hyper Lentement)

Nous allons commencer exclusivement par le **Menu Configuration**.

### 1. Structure des dossiers
Créer la base du projet :
- `ELPIS/moteur/cerveau_principal/`
- `ELPIS/moteur/cerveaux_secondaires/configuration/`
- `ELPIS/interface/`

### 2. Le Cerveau Configuration (C/C++)
Nous allons coder un petit programme C/C++ (`cerveau_config.cpp`) qui :
- Est capable de lire et de sauvegarder vos paramètres (par exemple dans un simple fichier `config.json` ou `.txt`).
- Ces paramètres pourraient être : date de rentrée (7 septembre), heures de sommeil souhaitées, etc.

### 3. L'Interface Configuration (Web)
Nous allons créer une belle page de paramètres où vous pourrez visuellement entrer ces informations.
