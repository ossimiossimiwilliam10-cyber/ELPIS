# 🛡️ Agent Audit — Documentation

## Qu'est-ce que c'est ?

L'Agent Audit est un programme Python **autonome** qui surveille en permanence
la qualité du code source d'ELPIS. Il s'exécute en arrière-plan toutes les
**4 heures** et analyse chaque fichier `.js` et `.jsx` du projet pour y
détecter des anomalies (erreurs de logique, mauvaises pratiques, code non
conforme à l'architecture).

Les résultats sont enregistrés dans un fichier JSON et consultables
directement depuis l'interface web d'ELPIS via le bouton **🛡️ Code Health**
sur le tableau de bord principal.

---

## 📂 Structure des fichiers

```
agent_audit/
├── main.py        # Le programme principal de l'agent
├── rules.json     # Les règles d'audit (modifiables sans toucher au code)
└── README.md      # Ce fichier
```

**Fichier de sortie :** `data/espoir_audit.json` (généré automatiquement)

---

## ▶️ Comment lancer l'agent

### Lancement automatique (recommandé)
L'agent se lance **automatiquement** quand tu démarres ELPIS avec le
fichier `Lancer ELPIS.vbs` ou `start_elpis.bat`. Le serveur Node.js
s'occupe de lancer le script Python en arrière-plan.

### Lancement manuel
Si tu veux lancer l'agent manuellement :

```bash
# Lancer un audit unique (résultat immédiat)
python agent_audit/main.py --once

# Lancer l'agent en mode continu (toutes les 4 heures)
python agent_audit/main.py
```

### Pré-requis
- Python 3 doit être installé et accessible via la commande `python`.

---

## 📜 Les règles d'audit

Les règles sont définies dans le fichier `rules.json`. Tu peux en ajouter,
modifier ou supprimer sans toucher au code Python.

### Format d'une règle

```json
{
  "id": "NOM_UNIQUE_DE_LA_REGLE",
  "description": "Message affiché quand la règle est enfreinte.",
  "pattern": "expression_regex_a_rechercher",
  "severity": "critical | warning | info",
  "file_pattern": "regex_pour_filtrer_les_fichiers",
  "exclude_pattern": "regex_pour_exclure_certains_fichiers"
}
```

### Champs détaillés

| Champ             | Obligatoire | Description                                                              |
|-------------------|:-----------:|--------------------------------------------------------------------------|
| `id`              | ✅          | Identifiant unique de la règle (ex: `NO_CONSOLE_LOG`).                   |
| `description`     | ✅          | Message humain expliquant pourquoi c'est un problème.                    |
| `pattern`         | ✅          | Expression régulière Python recherchée dans chaque ligne du code.        |
| `severity`        | ✅          | Niveau de gravité : `critical` (rouge), `warning` (orange), `info` (bleu). |
| `file_pattern`    | ✅          | Regex pour cibler certains types de fichiers (ex: `\\.(jsx)$`).          |
| `exclude_pattern` | ❌          | Regex pour exclure certains fichiers (ex: les fichiers de test).         |

### Règles incluses par défaut

| ID                       | Sévérité  | Détecte...                                                 |
|--------------------------|-----------|-------------------------------------------------------------|
| `NO_HARDCODED_LOCALHOST` | 🔴 Critique | Les URLs `http://localhost:XXXX` codées en dur.             |
| `NO_CONSOLE_LOG_IN_PROD` | 🟠 Warning  | Les `console.log()` oubliés dans le code de production.     |
| `AVOID_INLINE_STYLES`    | 🟠 Warning  | L'utilisation de `style={{...}}` au lieu de classes CSS.    |

### Exemple : Ajouter une nouvelle règle

Pour interdire l'utilisation de `var` (au profit de `const`/`let`),
ajoute ceci dans `rules.json` :

```json
{
  "id": "NO_VAR_KEYWORD",
  "description": "Utiliser 'const' ou 'let' au lieu de 'var'.",
  "pattern": "\\bvar\\s+",
  "severity": "warning",
  "file_pattern": "\\.(js|jsx)$",
  "exclude_pattern": "\\.test\\.(js|jsx)$"
}
```

---

## 📊 Le rapport d'audit

Après chaque exécution, l'agent génère le fichier `data/espoir_audit.json`
avec la structure suivante :

```json
{
    "last_scan": "2026-07-06T14:05:35.861560",
    "files_scanned": 90,
    "total_anomalies": 12,
    "anomalies": [
        {
            "rule_id": "NO_CONSOLE_LOG_IN_PROD",
            "severity": "warning",
            "description": "Des console.log() ont été laissés...",
            "file": "\\interface\\web\\src\\Dashboard.jsx",
            "line": 42,
            "code_snippet": "console.log('debug value:', x);"
        }
    ]
}
```

Ce fichier est lu par l'API backend (`GET /api/audit`) et affiché sur
l'interface web dans le composant **AuditDashboard** accessible via le
bouton **🛡️ Code Health**.

---

## ⚙️ Configuration avancée

### Modifier l'intervalle de scan

Dans `main.py`, modifie la constante en haut du fichier :

```python
SCAN_INTERVAL_SECONDS = 14400  # 4 heures (par défaut)
# Exemples :
# 3600   = 1 heure
# 7200   = 2 heures
# 28800  = 8 heures
```

### Ajouter un dossier à scanner

Dans `main.py`, ajoute le chemin dans la liste `DIRECTORIES_TO_SCAN` :

```python
DIRECTORIES_TO_SCAN = [
    os.path.join(PROJECT_ROOT, 'interface', 'web', 'src'),
    os.path.join(PROJECT_ROOT, 'interface', 'bridge'),
    # Ajouter ici :
    os.path.join(PROJECT_ROOT, 'scripts'),
]
```

### Dossiers automatiquement ignorés

L'agent ignore automatiquement les dossiers suivants lors du scan :
- `node_modules/`
- `.git/`
