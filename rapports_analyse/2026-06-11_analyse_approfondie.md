# Rapport d'Analyse Approfondie ELPIS — 11 juin 2026 (15h00)

## Note Globale : 3/10

**Le code ne compile pas en l'état. C'est le fait le plus grave.**

---

## 🔴 FAITS GRAVES — Bloquants immédiats

### 1. Le projet ne compile pas (RÉGRESSION)

```cpp
// CerveauConfig.cpp, ligne 4
#include "json.hpp"  // ← Fichier INTROUVABLE à cet emplacement
```

`json.hpp` se trouve dans `lib/`, pas dans `moteur/cerveaux_secondaires/configuration/`. La compilation échoue avec :

```
fatal error: json.hpp: No such file or directory
```

Le précédent `#include "../../../lib/json.hpp"` fonctionnait. Le changement vers `"json.hpp"` a **cassé la compilation**. C'est une régression introduite entre mes deux lectures du code — probablement un nettoyage trop zélé.

**Conséquence :** Aucun nouveau développeur, aucun script de build, aucun cerveau secondaire ajouté ne peut fonctionner aujourd'hui. Le projet est à l'arrêt technique.

> L'exécutable `test_config.exe` qui traîne dans le dossier a été compilé avec l'ANCIEN include path et masque ce problème.

### 2. `getConfig()` détruit toute encapsulation

```cpp
AppConfig& getConfig();  // Retourne une référence mutable non-const
```

Cette unique ligne rend la classe `CerveauConfig` **inutile**. N'importe quel code client peut modifier l'état interne sans passer par `setConfig()` ni `saveConfig()`. Le test lui-même le fait :

```cpp
AppConfig& config = cerveau.getConfig();
config.targetGrade = 18.5f;  // By-pass total de la classe
```

Il n'existe **aucun** accesseur const. Un consommateur légitime (le Cerveau Principal, l'interface Web) n'a aucun moyen de LIRE la configuration sans aussi pouvoir la MODIFIER.

**Ce qu'il faut :**
```cpp
const AppConfig& getConfig() const;  // Lecture seule
AppConfig& getConfig();              // Modification (ou mieux : supprimer)
```

### 3. Zéro validation des données

Pas un seul `if`, pas un seul `assert`, pas un seul `throw`. Rien. Voici ce qui est accepté sans broncher :

| Champ | Valeur acceptée | Problème |
|-------|----------------|----------|
| `maxStudyHoursPerDay` | `-500` | Heures négatives |
| `maxStudyHoursPerDay` | `100` | Plus d'heures que dans une journée |
| `maxSubjectsPerDay` | `0` | Aucune matière, planning vide |
| `targetGrade` | `999.0f` ou `-5.0f` | Notes impossibles |
| `theme` | `"banana"` | Ni "dark" ni "light" |
| `bedtime` | `"midnight"` | Format non parsable |
| `dayOfWeek` | `"Funday"` | Jour inexistant |
| `summerStudyHoursCompleted` | `-1000` | Heures négatives |
| `studyBlockDurationMinutes` | `0` ou `1440` | Blocs absurdes |

Le plan V4 insiste sur l'évitement du burn-out. Avec ces données, l'algorithme de planning va produire du chaos silencieux. **Garbage in, garbage out.**

### 4. Corruption d'état silencieuse en cas d'erreur de parsing

```cpp
// Dans loadConfig() — le try modifie currentConfig DIRECTEMENT :
try {
    file >> j;                          // OK
    currentConfig.studyStartDate = ...; // Mutation 1
    currentConfig.bedtime = ...;        // Mutation 2
    // ... 10 mutations ...
    // Si une exception survient ICI (ex: champ inattendu),
    // currentConfig est à moitié modifié, à moitié par défaut.
} catch (...) {
    return false;  // L'appelant ne sait pas que l'état est corrompu
}
```

**Correction attendue :** Parser dans un `AppConfig temp`, valider TOUT, puis `currentConfig = std::move(temp)`.

---

## 🟠 PROBLÈMES STRUCTURELS — Dette technique immédiate

### 5. Valeurs par défaut dupliquées (2 emplacements)

```cpp
// Constructeur (ligne 10-19)
currentConfig.studyStartDate = "07-09-2026";
currentConfig.bedtime = "23:00";
// ... 9 initialisations

// loadConfig() (lignes 32-41)
currentConfig.studyStartDate = j.value("studyStartDate", "07-09-2026");
currentConfig.bedtime = j.value("bedtime", "23:00");
// ... 9 duplications
```

Si demain tu changes l'heure de coucher de `"23:00"` à `"22:30"`, il faut modifier **deux** endroits. C'est le pattern classique qui mène à des valeurs divergentes. La solution : `constexpr` ou `static const` en un seul endroit.

### 6. Pas de système de build

Pour compiler UN cerveau, il faut retenir cette commande :
```
g++ -std=c++17 -I "../../../lib" -o test_config.exe test_cerveau_config.cpp CerveauConfig.cpp
```

Avec 6 cerveaux secondaires + le cerveau principal + les tests + le bridge Node.js, ça devient ingérable. Il faut un `Makefile` ou `CMakeLists.txt` **maintenant**, avant que le projet grossisse.

### 7. Pas de Git

Pas de `git init`, pas de `.gitignore`, pas d'historique. Le projet a déjà subi une régression (include path cassé) sans aucun moyen de revenir en arrière. Les `.exe` et `test_config.json` polluent le workspace.

### 8. `saveConfig()` n'a pas de stratégie atomique

```cpp
std::ofstream file(configFilePath);  // Truncation immédiate du fichier existant
// ... construction du JSON ...
file << j.dump(4);
```

Si le programme crashe entre l'ouverture du fichier et le `j.dump()`, le fichier de configuration est **détruit** (fichier vide ou corrompu). Pattern standard : écrire dans un fichier temporaire, puis `rename()`.

### 9. AppConfig peut être instancié sans CerveauConfig

```cpp
AppConfig c;  // Compile. maxStudyHoursPerDay est indéterminé.
```

Les `int` et `float` de `AppConfig` n'ont pas d'initialiseurs par défaut dans la struct. Si quelqu'un crée un `AppConfig{}` sans passer par le constructeur de `CerveauConfig`, les valeurs sont indéterminées (comportement indéfini pour `int`, potentiellement NaN pour `float`). Ajouter des initialiseurs dans la struct elle-même :

```cpp
struct AppConfig {
    int maxStudyHoursPerDay = 8;
    float targetGrade = 14.0f;
    // ...
};
```

### 10. Constructeur non-explicit permet conversion implicite

```cpp
CerveauConfig(const std::string& path = "espoir_config.json");
```

Ceci compile sans avertissement :
```cpp
CerveauConfig c = "test.json";  // Conversion implicite string → CerveauConfig
void foo(CerveauConfig c);
foo("truc.json");  // Accepté, crée un objet temporaire
```

Ajouter `explicit`.

---

## 🟡 PROBLÈMES MODÉRÉS — Fragilité et maintenabilité

### 11. `using json = nlohmann::json` en portée fichier

Si un futur `#include` expose aussi un symbole `json`, collision. Mieux : utiliser `nlohmann::json` directement ou scoper le `using` dans chaque fonction.

### 12. `#include <cassert>` au lieu d'un framework de test

`assert` arrête le programme au premier échec. Avec 20 assertions, tu ne verras jamais les échecs 2 à 20. Un vrai framework (Catch2, doctest) te donne un rapport complet.

### 13. Test unique — couverture pathologique

Un seul scénario testé : "je sauvegarde, je recharge, tout est identique". Zéro test pour :

- Fichier inexistant → est-ce que les valeurs par défaut sont préservées ?
- Fichier vide → crash ou retour propre ?
- JSON mal formé → corruption d'état ?
- Champ manquant → la valeur par défaut est-elle bien utilisée ?
- Type incorrect (ex: `"maxStudyHoursPerDay": "huit"`) → exception gérée ?
- `setConfig()` → jamais appelé dans les tests
- Deux sauvegardes successives → le fichier est-il cohérent ?
- Sujets sans examDates → géré ?
- `fixedCommitments` vide → géré ?
- Plusieurs sujets avec des couleurs identiques → accepté ?

### 14. `saveConfig()` ne flushe pas et ne check pas l'erreur d'écriture

```cpp
file << j.dump(4);
return true;  // Aucune vérification que l'écriture a réussi
```

`operator<<` peut échouer (disque plein, quota). Il faut vérifier `file.good()` ou `file.fail()`.

### 15. Pas de `#include <string>` explicite dans le .cpp

`CerveauConfig.cpp` utilise `std::string` et `std::cerr` mais n'inclut que `<fstream>` et `<iostream>`. Ça compile par transitivité (le .h inclut `<string>`), mais c'est fragile : si le .h change, le .cpp casse.

---

## 📊 ADÉQUATION SPÉCIFICATION vs CODE

| Élément du plan V4 | Présent dans le code | Statut |
|-------------------|---------------------|--------|
| Date de rentrée | `studyStartDate` ✅ | OK |
| Horaires sommeil | `bedtime`, `wakeUpTime` ✅ | OK |
| Capacité max/jour | `maxStudyHoursPerDay` ✅ | OK |
| Créneaux incompressibles | `fixedCommitments` ✅ | OK (bug fixed) |
| Interleaving (max matières/jour) | `maxSubjectsPerDay` ✅ | OK |
| Durée des blocs | `studyBlockDurationMinutes` ✅ | OK |
| Temps Rappel Actif | `activeRecallMinutesPerDay` ✅ | OK |
| Thème visuel | `theme` ✅ | OK |
| Couleurs des catégories | `Subject.color` ✅ | OK |
| **Date du concours (globale)** | ❌ **ABSENT** | Écart spec |
| `targetGrade` | ✅ Présent | **Pas dans la spec** |
| `summerStudyHoursCompleted` | ✅ Présent | **Pas dans la spec** |

Deux champs ont été ajoutés sans figurer dans le plan V4, et un champ du plan V4 (date du concours) n'a pas été implémenté. Ce n'est pas dramatique, mais cela montre que le plan n'est plus la référence unique.

---

## 🗂️ AVANCEMENT GLOBAL

```
ELPIS/
├── interface/                          ← VIDE (malgré 4 plans qui en parlent)
├── lib/
│   └── json.hpp                        ← OK
├── moteur/
│   ├── cerveau_principal/              ← VIDE
│   └── cerveaux_secondaires/
│       └── configuration/
│           ├── CerveauConfig.h         ← OK (mais getConfig() casse l'encapsulation)
│           ├── CerveauConfig.cpp       ← OK (mais ne compile pas, pas de validation)
│           ├── test_cerveau_config.cpp ← 1 test, 1 scénario
│           ├── test_config.exe         ← ARTEFACT (devrait être ignoré)
│           └── test_config.json        ← ARTEFACT
├── plans_historique/
│   ├── 01_plan_v1_python.md
│   ├── 02_plan_v2_cpp.md
│   ├── 03_plan_v3_modular_brains.md
│   └── 04_plan_v4_config_parameters.md
└── rapports_analyse/
    └── 2026-06-11_etat_des_lieux.md    ← Premier rapport (déjà obsolète sur fixedCommitments)
```

**Ratio :** 1 cerveau partiellement fonctionnel sur ~7 prévus. L'interface web et le cerveau principal sont inexistants.

---

## 🔧 PLAN DE REMÉDIATION (par ordre de priorité)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | **Réparer l'include path** de `json.hpp` | 30 secondes | Le projet recompile |
| 2 | **`git init` + `.gitignore`** | 2 minutes | Sécurité, traçabilité |
| 3 | **Remplacer `getConfig()` par un accesseur const** + ajouter `setConfig()` comme seule voie de mutation | 5 minutes | Encapsulation restaurée |
| 4 | **Parser dans un temporaire** dans `loadConfig()`, swap uniquement si succès | 10 minutes | Plus de corruption d'état |
| 5 | **Extraire les valeurs par défaut** en constantes (une seule source de vérité) | 10 minutes | Maintenabilité |
| 6 | **Ajouter validation** (bornes, enum pour theme, format HH:MM pour heures) | 30 minutes | Fin du garbage in |
| 7 | **Écriture atomique** (fichier temporaire + rename) | 10 minutes | Fini les configs détruites |
| 8 | **CMakeLists.txt ou Makefile** | 15 minutes | Build reproductible |
| 9 | **Ajouter `explicit`**, initialiseurs dans `AppConfig`, vérification `file.good()` | 10 minutes | Robustesse C++ |
| 10 | **5-10 tests supplémentaires** couvrant les cas d'erreur | 45 minutes | Confiance dans le code |

**Temps total estimé :** ~2h30 pour amener ce module à un état "production-ready".

---

## 💬 VERDICT

Le code montre une **compréhension correcte du C++** et une **structure de données bien pensée**. Mais il est dans un état **non industriel** : pas de validation, encapsulation brisée, pas de build system, pas de versioning, et — pire — **il ne compile pas en l'état**.

L'architecture "Multi-Cerveaux" est une excellente intuition de design. Mais à ce rythme, avec des régressions introduites à chaque modification et aucun filet de sécurité (git, tests, validation), le projet accumulera une dette technique exponentielle dès le 2e ou 3e cerveau.

La priorité absolue est de **stabiliser la fondation** avant d'ajouter quoi que ce soit d'autre.

---

*Rapport généré le 11 juin 2026 à 15h00 par Deep Code — Analyste ELPIS*
*Seconde analyse — mode intransigeant*
