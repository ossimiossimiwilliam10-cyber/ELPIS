# Rapport d'Analyse Approfondie ELPIS — 11 juin 2026 (15h15)

## Note Globale : 4.5/10 (+1.5 pts depuis le rapport de 15h00)

**8 des 10 problèmes critiques du précédent rapport ont été corrigés. Mais le code ne compile toujours pas, et 2 nouveaux bugs sont apparus dans les corrections.**

---

## 📈 CE QUI A ÉTÉ CORRIGÉ (reconnaissance obligatoire)

Améliorations réelles et significatives depuis le rapport de 15h00 :

| # | Problème | Correction | Qualité |
|---|---------|-----------|---------|
| 1 | `getConfig()` mutable | Devient `const AppConfig& getConfig() const` | ✅ Parfaite |
| 2 | Constructeur non-explicit | Devient `explicit CerveauConfig(...)` | ✅ Parfaite |
| 3 | Pas d'initialiseurs dans AppConfig | Ajout d'in-class initializers (`= "23:00"`, `= 8`, etc.) | ✅ Parfaite |
| 4 | Corruption d'état dans loadConfig | Parse dans `tempConfig`, swap uniquement si succès | ✅ Parfaite |
| 5 | Zéro validation | Clamping sur bornes (0-24, 0-20, etc.), validation enum theme | ✅ Correcte |
| 6 | Écriture non atomique | Fichier `.tmp` + rename | 🟡 Presque (voir bug ci-dessous) |
| 7 | Pas de vérification d'écriture | `file.good()` vérifié après `j.dump()` | ✅ Parfaite |
| 8 | Test mutait via getConfig() | Passe maintenant par `setConfig()` | ✅ Parfaite |

Le code a gagné en robustesse. C'est un vrai bond qualitatif.

---

## 🔴 PROBLÈMES PERSISTANTS (non corrigés)

### 1. Le code ne compile toujours pas

```cpp
// CerveauConfig.cpp, ligne 7
#include "json.hpp"  // ← json.hpp est dans lib/, pas ici
```

```
fatal error: json.hpp: No such file or directory
```

Le `test_config.exe` présent dans le dossier date de **14h42** — il a été compilé AVANT les modifications. Il est stale. Il masque le problème.

**Ce problème est signalé pour la DEUXIÈME fois consécutive.**

### 2. Valeurs par défaut divergentes entre .h et .cpp

```cpp
// CerveauConfig.h, ligne 35
int activeRecallMinutesPerDay = 30;

// CerveauConfig.cpp, ligne 40
tempConfig.activeRecallMinutesPerDay = std::max(0, j.value("activeRecallMinutesPerDay", 60));
//                                                                                   ^^
//                                                                          PAS 30 !!
```

Si un fichier JSON omet le champ `activeRecallMinutesPerDay`, `j.value()` injectera **60** alors que le reste du système attend **30**. Aujourd'hui invisible car `saveConfig()` écrit toujours tous les champs, mais un JSON édité main ou migré depuis une ancienne version déclenchera le bug.

Recensement complet des divergences :

| Champ | AppConfig (.h) | j.value() (.cpp) | Cohérent ? |
|-------|---------------|------------------|:---:|
| `studyStartDate` | `"07-09-2026"` | `"07-09-2026"` | ✅ |
| `bedtime` | `"23:00"` | `"23:00"` | ✅ |
| `wakeUpTime` | `"07:00"` | `"07:00"` | ✅ |
| `maxStudyHoursPerDay` | `8` | `8` | ✅ |
| `targetGrade` | `14.0f` | `14.0f` | ✅ |
| `summerStudyHoursCompleted` | `0` | `0` | ✅ |
| `maxSubjectsPerDay` | `3` | `3` | ✅ |
| `studyBlockDurationMinutes` | `50` | `50` | ✅ |
| `activeRecallMinutesPerDay` | **30** | **60** | ❌ |
| `theme` | `"dark"` | `"dark"` | ✅ |

**1 divergence sur 10 champs.** C'est exactement le scénario que j'avais prédit : la duplication mène à la divergence.

---

## 🟠 NOUVEAUX PROBLÈMES (introduits par les corrections)

### 3. `saveConfig()` : trou dans l'atomicité

```cpp
// Lignes 146-150
std::remove(configFilePath.c_str());  // ← LE FICHIER N'EXISTE PLUS
if (std::rename(tempFilePath.c_str(), configFilePath.c_str()) != 0) {
    // ERREUR → ni le .tmp ni l'original n'existent.
```

Le commentaire dit « Nécessaire sur Windows si le fichier cible existe déjà ». C'est **faux**. `std::rename` sur Windows écrase déjà le fichier cible s'il existe. Sur POSIX, le comportement est indéfini si la cible existe, mais sous Windows (MSYS2/MinGW), `rename` écrase.

En supprimant AVANT de renommer, vous créez une fenêtre où :
- Crash entre `remove` et `rename` → **fichier définitivement perdu**
- Un autre processus lit le fichier entre les deux → **fichier vide**
- `rename` échoue → **ni l'ancien ni le nouveau n'existent**

**Correction :** Supprimer le `std::remove`. Le `std::rename` suffit.

### 4. Logique de validation dupliquée

```cpp
// Dans loadConfig() — 6 lignes
tempConfig.maxStudyHoursPerDay = std::max(0, std::min(24, j.value(...)));
tempConfig.targetGrade = std::max(0.0f, std::min(20.0f, j.value(...)));
// ... 4 autres ...

// Dans setConfig() — 6 lignes IDENTIQUES
currentConfig.maxStudyHoursPerDay = std::max(0, std::min(24, currentConfig.maxStudyHoursPerDay));
currentConfig.targetGrade = std::max(0.0f, std::min(20.0f, currentConfig.targetGrade));
// ... 4 autres ...
```

12 lignes copiées-collées. Si demain on décide que `maxStudyHoursPerDay` ne doit pas dépasser 16 au lieu de 24, il faut modifier **deux** endroits. C'est le même pattern que les valeurs par défaut dupliquées, mais pour la validation.

**Correction :** Extraire une méthode privée `static void sanitize(AppConfig& c)`.

---

## 🟡 PROBLÈMES MODÉRÉS (préexistants, non corrigés)

### 5. Pas de Git, pas de Makefile, pas de .gitignore

Inchangé depuis le rapport précédent. Aucun filet de sécurité.

### 6. `using json = nlohmann::json` en portée fichier

Ligne 9 de CerveauConfig.cpp. Risque de collision si un futur include expose aussi un symbole `json`.

### 7. `#include <cassert>` — framework de test inexistant

1 seul test, 1 seul scénario heureux. Aucun test pour :
- Fichier JSON vide
- JSON malformé
- Champs manquants (dont le bug `activeRecallMinutesPerDay = 60`)
- Valeurs hors bornes (est-ce que le clamping fonctionne ?)
- Thème invalide (est-ce que le fallback "dark" fonctionne ?)
- `setConfig()` avec valeurs aberrantes
- Fichier en lecture seule (échec de `saveConfig`)
- Deux sauvegardes successives

### 8. `setConfig()` copie inutilement

```cpp
void CerveauConfig::setConfig(const AppConfig& newConfig) {
    currentConfig = newConfig;  // Copie complète (vecteurs inclus)
    // ... validation ...
}
```

Pattern optimal : prendre par valeur et move.
```cpp
void setConfig(AppConfig newConfig) {  // Par valeur
    sanitize(newConfig);
    currentConfig = std::move(newConfig);
}
```

### 9. `Subject::color` sans validation

Le plan V4 spécifie des couleurs pour les catégories. Le test utilise `"#FF0000"`. Rien n'empêche `"bleu"`, `"rgb(0,0,255)"`, `""`, ou une chaîne de 10000 caractères. Le futur renderer React va recevoir n'importe quoi.

### 10. `saveConfig()` ne vide pas le `.tmp` résiduel

Si un crash précédent a laissé `espoir_config.json.tmp`, le nouveau `saveConfig()` l'écrase — c'est acceptable. Mais si le `.tmp` appartient à un autre utilisateur ou est en lecture seule, `saveConfig()` échoue mystérieusement. Une suppression préalable avec `std::remove` (ou un nom unique avec PID/timestamp) serait plus robuste.

### 11. `#include <cstdio>` au lieu de `<filesystem>`

On compile en C++17 (`-std=c++17`). `std::filesystem::rename` + `std::filesystem::remove` sont plus portables, plus expressifs, et gèrent mieux les chemins Unicode sur Windows.

---

## 📊 AVANCEMENT DEPUIS LE RAPPORT PRÉCÉDENT

```
Corrections appliquées :  8 / 10  ✅
Nouveaux bugs introduits : 2      🔴
Bugs persistants :        2      🔴
Problèmes modérés :       7      🟡
```

Le rythme de correction est excellent. Mais les corrections introduisent de nouveaux problèmes — c'est le symptôme classique de l'absence de tests de régression.

---

## 🔧 PLAN DE REMÉDIATION PRIORITAIRE (v2)

| # | Action | Effort |
|---|--------|--------|
| 1 | **Réparer `#include "json.hpp"`** → `#include "../../../lib/json.hpp"` | 30 sec |
| 2 | **Supprimer le `std::remove` parasite** dans `saveConfig()` | 30 sec |
| 3 | **Extraire `sanitize()`** pour éliminer la duplication loadConfig/setConfig | 5 min |
| 4 | **Aligner `activeRecallMinutesPerDay`** dans `j.value()` : 60 → 30 | 10 sec |
| 5 | **Remplacer `j.value()` par des références aux constantes** de AppConfig | 10 min |
| 6 | `git init` + `.gitignore` | 2 min |
| 7 | `setConfig()` par valeur + move | 2 min |
| 8 | Remplacer `<cstdio>` par `<filesystem>` | 5 min |

**Temps total :** ~25 minutes pour un module réellement stable.

---

## 💬 VERDICT

Le code a fait un bond qualitatif réel : encapsulation restaurée, parsing sécurisé, validation basique, écriture quasi-atomique. La structure est saine.

Mais il reste **4 bugs factuels** (include cassé, divergence de défaut 30/60, trou d'atomicité remove+rename, duplication validation) dont 2 introduits par les corrections. C'est le signe qu'il faut **figer ce module** avec des tests avant de passer au suivant.

À ce stade, la fondation est assez solide pour construire dessus — **une fois les 4 bugs corrigés**. Ne pas passer au Cerveau Principal avant.

---

*Rapport généré le 11 juin 2026 à 15h15 par Deep Code — Analyste ELPIS*
*Troisième analyse — suivi de correction*
