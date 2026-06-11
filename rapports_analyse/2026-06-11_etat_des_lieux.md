# Rapport d'Analyse ELPIS — 11 juin 2026

## Résumé exécutif

**Projet :** ELPIS — Compagnon d'étude pour L2 Sciences pour l'Ingénieur (Option Santé)
**Objectif :** Préparer le concours de médecine via une application de planification intelligente
**Stade actuel :** Prototypage très précoce
**Note globale :** 5/10 — Fondations prometteuses mais trous critiques

---

## 1. Ce qui a été fait

### Architecture conceptuelle (validée sur 4 itérations)
Le projet a connu une évolution de pensée saine et documentée :

| Version | Technologie moteur | Apport clé |
|---------|-------------------|------------|
| V1 | Python + FastAPI | Stack web classique |
| V2 | C/C++ + React | Puissance native + belle UI |
| V3 | Multi-Cerveaux C++ | Architecture modulaire menu par menu |
| **V4** | C++ orienté objet | Paramètres exhaustifs du Menu Configuration |

Ce cheminement montre une vraie réflexion. Passer de Python à C++ pour un profil ingénieur est pertinent. L'architecture "Multi-Cerveaux" est une bonne idée de découplage.

### Code implémenté
- **`CerveauConfig.h`** : Structures `Subject`, `FixedCommitment`, `AppConfig` + classe `CerveauConfig` — bien conçu
- **`CerveauConfig.cpp`** : Lecture/écriture JSON fonctionnelle via nlohmann/json v3.12.0
- **`test_cerveau_config.cpp`** : Test unitaire avec assertions — compilé et exécuté avec succès ✅
- **`lib/json.hpp`** : Librairie JSON for Modern C++ v3.12.0 intégrée

### Test unitaire : SUCCÈS ✅
```
[OK] Configuration sauvegardee sur le disque.
[OK] Configuration rechargee depuis le disque.
[OK] Toutes les donnees (dont les dates d'examens) correspondent parfaitement !
--- Test Unitaire REUSSI ---
```

---

## 2. Problèmes identifiés

### 🔴 Bug critique : `fixedCommitments` ignorés dans la sérialisation

Le fichier `CerveauConfig.cpp` **n'écrit jamais** les `fixedCommitments` dans `saveConfig()` et **ne les lit jamais** dans `loadConfig()`.

Conséquence : tous les créneaux incompressibles (CM/TD/TP, trajets) seront perdus entre deux sessions. C'est une fonctionnalité pourtant détaillée dans le plan V4. Le test unitaire ne couvre pas ce cas — ce qui masque le bug.

### 🟠 Dossier `interface/` : strictement vide

L'interface React/Vite décrite dans les 4 plans historiques n'a pas une seule ligne de code. Le dossier existe mais est vide. C'est un retard significatif sur la timeline.

### 🟠 Dossier `cerveau_principal/` : strictement vide

Le chef d'orchestre prévu n'a pas de code. La communication entre cerveaux n'est ni implémentée ni prototypée.

### 🟡 Absence de repo Git

Pas de `git init`, pas de `.gitignore`, pas d'historique de version. Pour un projet de cette envergure qui doit durer plusieurs mois, c'est risqué.

### 🟡 Absence de système de build

Pas de `Makefile`, `CMakeLists.txt`, ni script de build. Chaque compilation nécessite une commande `g++` manuelle. Ça ne passera pas à l'échelle avec 5-6 cerveaux.

### 🟡 Chemin d'inclusion fragile

`#include "../../../lib/json.hpp"` est un chemin relatif à 3 niveaux. Si un fichier source est déplacé, l'inclusion casse.

---

## 3. Évaluation par axe

| Axe | Note | Commentaire |
|-----|------|-------------|
| **Qualité du code C++** | 7/10 | Propre, lisible, orienté objet. Les valeurs par défaut sont sensées. |
| **Couverture de test** | 4/10 | Un seul test, un seul scénario. Ne teste pas les `fixedCommitments`, les cas d'erreur, les fichiers vides, les valeurs aberrantes. |
| **Complétude fonctionnelle** | 2/10 | Seul 1 cerveau sur N est implémenté, et encore partiellement (bug fixedCommitments). Interface inexistante. |
| **Infrastructure** | 2/10 | Pas de build system, pas de git, pas de CI, pas de découpage lib/src/tests. |
| **Documentation / Traçabilité** | 8/10 | Les 4 plans historiques sont bien écrits, l'évolution est claire. Manque un README principal. |

---

## 4. Recommandations prioritaires

1. **Corriger le bug `fixedCommitments`** — 10 minutes, critique pour la suite
2. **Initialiser Git** — `git init` + `.gitignore` (build artifacts, `*.exe`, `test_config.json`)
3. **Ajouter un Makefile/CMake minimal** — évitera la dérive des commandes de build
4. **Commencer l'interface React** — ne serait-ce qu'une page squelette qui ping le moteur
5. **Ajouter des tests pour les `fixedCommitments`** — le bug actuel aurait dû être détecté

---

## 5. Points positifs à souligner

- L'architecture Multi-Cerveaux est une vraie bonne idée de design
- La boucle charge → modifie → sauvegarde → recharge fonctionne (pour ce qui est couvert)
- Les valeurs par défaut sont bien choisies (23:00-07:00, 8h max/jour, 50min blocs, thème dark)
- La réflexion itérative en 4 plans montre qu'il n'y a pas eu de précipitation à coder

---

*Rapport généré le 11 juin 2026 à 14h44 par Deep Code — Analyste ELPIS*
