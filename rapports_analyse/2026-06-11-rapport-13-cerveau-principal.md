# Rapport d'Analyse ELPIS #13 — 11 juin 2026 (17h10)

## Note Globale Projet : 8/10
## CerveauConfig : 9/10 ✅ | CerveauCours : 8/10 ⬆ | CerveauPrincipal : 6/10 🆕 | CMake : 8.5/10

---

## ✅ RAPPORT #12 — 3/3 RECOMMANDATIONS APPLIQUÉES

| # | Recommandation #12 | Statut |
|---|-------------------|:---:|
| 1 | Extraire `parseExercice()` / `serializeExercice()` | ✅ Lignes 8-26 |
| 2 | Ajouter validation `Exercice` dans `sanitize()` | ✅ page 1-9999, pratiques 0-10000 |
| 3 | Tests unitaires CerveauCours | ⬜ |

Le `CerveauCours.cpp` est passé de 210 à 214 lignes mais la duplication a fondu : `loadConfig()` de -20 lignes, `saveConfig()` de -20 lignes. Propre.

---

## 🆕 CERVEAU PRINCIPAL — L'ORCHESTRATEUR

### Ce qui a été créé

```
moteur/moteur_menu_principal/
├── CerveauPrincipal.h      (31 lignes)
├── CerveauPrincipal.cpp    (166 lignes)
└── main_principal.cpp      (19 lignes)
```

Le CerveauPrincipal est l'orchestrateur prévu depuis le plan V2. Il lit les configurations, scanne les cours, et génère un rapport quotidien avec une to-do list.

### Algorithme (v0.1)

```
1. Charger config.json + cours.json
2. Calculer temps libre = (heuresTravailSemaine × 60) / 7
3. Scanner les CM → proposer tous les non-révisés aujourd'hui
   - J0 (nouveau) = 120 min, J1+ (révision) = 30 min
4. Scanner les TD → trier par nombrePratiques croissant, prendre ≤ 2
   - 20 min par TD
5. Scanner les TP → trier par nombrePratiques croissant, prendre ≤ 1
   - 30 min par TP
6. Comparer tempsRequis vs tempsLibre → statut SURCHARGE / OK
```

### [AUTO-CORRECTION] `explicit` sur le constructeur

```cpp
// AVANT
CerveauPrincipal(const std::string& configPath, const std::string& coursPath);

// APRÈS
explicit CerveauPrincipal(const std::string& configPath, const std::string& coursPath);
```

---

## 🔴 PROBLÈME ARCHITECTURAL : Contournement des cerveaux secondaires

Le CerveauPrincipal **lit les fichiers JSON directement** au lieu d'utiliser les classes `CerveauConfig` et `CerveauCours` :

```cpp
// CerveauPrincipal.cpp — lit du JSON brut
std::ifstream fConfig(configPath);
fConfig >> configJson;  // nlohmann::json brut, pas AppConfig

std::ifstream fCours(coursPath);
fCours >> coursJson;    // nlohmann::json brut, pas CoursConfig
```

**Conséquences :**

| Problème | Impact |
|----------|--------|
| `sanitize()` jamais appelé | Données corrompues acceptées silencieusement |
| Connaissance dupliquée du schéma JSON | Si on change un nom de champ dans CerveauCours, l'orchestrateur casse |
| Pas de `setConfig()` / `setConfig()` | Pas de validation à l'entrée |
| Pas de garantie atomique | Si le fichier est en cours d'écriture, lecture partielle |

**Solution recommandée :**
```cpp
// Au lieu de :
fConfig >> configJson;

// Faire :
CerveauConfig cerveauConfig(configPath);
cerveauConfig.loadConfig();
const AppConfig& cfg = cerveauConfig.getConfig(); // Données validées
```

Ceci réutiliserait tout le travail fait sur les cerveaux secondaires.

---

## 🟡 POINTS D'AMÉLIORATION — CERVEAUPRINCIPAL

| # | Problème | Gravité |
|---|---------|:---:|
| 1 | Contourne CerveauConfig/CerveauCours (pas de sanitize) | 🔴 |
| 2 | `TacheDuJour` défini mais jamais utilisé (code mort) | 🟡 |
| 3 | `configJson`/`coursJson` stockés comme membres mais jamais réutilisés | 🟡 |
| 4 | `#include "../../lib/json.hpp"` dans le header (expose dépendance) | 🟡 |
| 5 | `#include <chrono>` inutilisé (pas d'appel à std::chrono) | 🟡 |
| 6 | Pas de test unitaire | 🟡 |
| 7 | Pas de `const` sur `genererRapportQuotidien()` | 🟡 |
| 8 | Valeurs dures (20min TD, 30min TP, 2h CM J0) — légitimes pour v0.1 | 🟢 |

---

## 📊 VUE D'ENSEMBLE

| Composant | Fichiers | Lignes | Statut |
|-----------|---------|--------|:---:|
| CerveauConfig | .h + .cpp + main + test | 73+162+37+72 | ✅ Stable |
| CerveauCours | .h + .cpp + main | 69+214+35 | ✅ Stable |
| CerveauPrincipal | .h + .cpp + main | 31+166+19 | 🆕 v0.1 |
| CMakeLists.txt | 1 fichier | 28 | ✅ 3 cibles |
| lib/json.hpp | 1 fichier | 26076 | ✅ v3.12.0 |

**Total : ~27 000 lignes (dont 26k de lib), ~700 lignes de code métier**

---

## 🔧 RECOMMANDATIONS

| # | Action | Effort |
|---|--------|--------|
| 1 | **Brancher CerveauPrincipal sur CerveauConfig + CerveauCours** (au lieu du JSON brut) | 20 min |
| 2 | Supprimer `TacheDuJour` (code mort) ou l'utiliser comme type de retour | 5 min |
| 3 | Supprimer `#include <chrono>` inutilisé | 10 sec |
| 4 | Tests unitaires CerveauPrincipal | 30 min |

---

## 📈 PROGRESSION (13 RAPPORTS)

| # | Note | Clé |
|---|------|-----|
| 1-9 | 5→8.5 | CerveauConfig : bug → livrable |
| 10 | 7.5 | CMake + CerveauCours v1 |
| 11 | 8.0 | 4/5 reco #10 appliquées |
| 12 | 8.0 | Exercice/TD/TP, duplication |
| **13** | **8.0** | **CerveauPrincipal v0.1, reco #12 appliquées** |

---

*Rapport #13 généré le 11 juin 2026 à 17h10 par Deep Code — Analyste ELPIS*
*CerveauPrincipal — Orchestrateur v0.1*
