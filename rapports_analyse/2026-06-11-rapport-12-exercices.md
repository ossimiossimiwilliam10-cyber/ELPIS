# Rapport d'Analyse ELPIS #12 — 11 juin 2026 (16h55)

## Note Globale Projet : 8/10
## CerveauConfig : 9/10 ✅ | CerveauCours : 7.5/10 🆕 | CMake : 8/10

---

## 🆕 `Exercice` + `listeTD`/`listeTP`

```cpp
struct Exercice {                     // 🆕 Nouveau
    std::string titre;
    int page = 1;
    std::string pdfSource = "";
    std::string dernierePratique = "";  // "YYYY-MM-DD"
    int nombrePratiques = 0;
};

struct Matiere {
    // ...
    std::vector<CoursMagistral> listeCM;
    std::vector<Exercice> listeTD;      // 🆕
    std::vector<Exercice> listeTP;      // 🆕
};
```

Sérialisation/désérialisation JSON complète pour les deux nouveaux vecteurs. Le modèle s'étoffe correctement — CM (théorie), TD (exercices dirigés), TP (travaux pratiques), chacun avec leur suivi de progression.

---

## 🔴 DUPLICATION DE CODE — `listeTD`/`listeTP`

### `loadConfig()` — 24 lignes copiées

```cpp
// listeTD (lignes 68-78)
if (itemM.contains("listeTD")) {
    for (const auto& itemEx : itemM["listeTD"]) {
        Exercice ex;
        ex.titre = itemEx.value("titre", "");
        ex.page = itemEx.value("page", 1);
        ex.pdfSource = itemEx.value("pdfSource", "");
        ex.dernierePratique = itemEx.value("dernierePratique", "");
        ex.nombrePratiques = itemEx.value("nombrePratiques", 0);
        m.listeTD.push_back(ex);
    }
}

// listeTP (lignes 80-90) — IDENTIQUE, seul "listeTD" → "listeTP"
if (itemM.contains("listeTP")) { ... }
```

### `saveConfig()` — 22 lignes copiées (lignes 145-167)

Même pattern : deux blocs identiques pour `listeTD` et `listeTP`.

**Impact :** 46 lignes redondantes. Si demain on ajoute un champ à `Exercice`, il faudra le modifier à **4 endroits** (lecture TD, lecture TP, écriture TD, écriture TP).

**Correction recommandée :** Extraire deux helpers privés :
```cpp
static Exercice parseExercice(const nlohmann::json& j);
static nlohmann::json serializeExercice(const Exercice& ex);
```

Ceci éliminerait 30+ lignes et garantirait la cohérence TD/TP.

---

## 🟡 `sanitize()` n'a pas suivi

La nouvelle structure `Exercice` et les vecteurs `listeTD`/`listeTP` sont absents de `sanitize()`. Aucune validation de :

| Champ | Risque |
|-------|--------|
| `Exercice.page` | Négatif, zéro, 99999 |
| `Exercice.nombrePratiques` | Négatif |
| `Exercice.pdfSource` | Chaîne vide ou corrompue |
| `Exercice.dernierePratique` | Format non "YYYY-MM-DD" |

Le `sanitize()` actuel ne valide que `listeCM` (via `jActuel`). Dès que `listeTD`/`listeTP` sont ajoutés, la validation devrait suivre.

---

## 📊 ÉTAT ACTUEL

| Fichier | Lignes | Statut | Note |
|---------|--------|:---:|------|
| `CerveauConfig.h` | 73 | ✅ | Stable |
| `CerveauConfig.cpp` | 162 | ✅ | Stable |
| `CerveauCours.h` | 69 | 🆕 | +`Exercice`, +`listeTD`, +`listeTP` |
| `CerveauCours.cpp` | 210 | 🆕 | +48 lignes, dupliquées |
| `CMakeLists.txt` | 21 | ✅ | Inchangé depuis #11 |

---

## 📈 PROGRESSION (12 RAPPORTS)

| # | Heure | Note | Clé |
|---|-------|------|-----|
| 1-9 | 14h44-16h10 | 5→8.5 | CerveauConfig : bug → livrable |
| 10 | 16h25 | 7.5 | CMake + CerveauCours v1 |
| 11 | 16h45 | 8.0 | 4/5 reco appliquées |
| **12** | **16h55** | **8.0** | **Exercice/TD/TP ajoutés, duplication** |

---

## 🔧 RECOMMANDATIONS

| # | Action | Effort |
|---|--------|--------|
| 1 | Extraire `parseExercice()` / `serializeExercice()` | 10 min |
| 2 | Ajouter validation `Exercice` dans `sanitize()` | 5 min |
| 3 | Tests unitaires CerveauCours | 20 min |

---

*Rapport #12 généré le 11 juin 2026 à 16h55 par Deep Code — Analyste ELPIS*
*Extension modèle : Exercice, listeTD, listeTP*
