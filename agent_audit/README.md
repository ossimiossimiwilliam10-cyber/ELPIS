# Agent Audit Autonome v2.0 — Documentation

## Qu'est-ce que c'est ?

L'Agent Audit est un programme Python **autonome** qui surveille en permanence
la qualite du code source d'ELPIS. Il s'execute en arriere-plan toutes les
**4 heures**, analyse **l'integralite** du projet (tous les fichiers texte)
et **corrige automatiquement** les erreurs qu'il detecte.

Les resultats et les corrections appliquees sont enregistres dans un fichier
JSON et consultables depuis l'interface web via le bouton **Code Health**
sur le tableau de bord principal.

---

## Structure des fichiers

```
agent_audit/
|-- main.py        # Le programme principal de l'agent
|-- rules.json     # Les regles d'audit (modifiables sans toucher au code)
|-- backups/       # Backups automatiques avant chaque correction
|   |-- 20260706_142231/   # Dossier horodate par session
|   |   |-- interface/web/src/store.js   # Copie du fichier avant correction
|   |   |-- ...
|-- README.md      # Ce fichier
```

**Fichier de sortie :** `data/espoir_audit.json` (genere automatiquement)

---

## Comment lancer l'agent

### Lancement automatique (recommande)
L'agent se lance **automatiquement** quand tu demarres ELPIS avec le
fichier `Lancer ELPIS.vbs` ou `start_elpis.bat`. Le serveur Node.js
s'occupe de lancer le script Python en arriere-plan.

### Lancement manuel

```bash
# Lancer un audit + correction unique (resultat immediat)
python agent_audit/main.py --once

# Lancer en mode rapport uniquement (ne modifie rien)
python agent_audit/main.py --once --dry-run

# Lancer l'agent en mode continu (toutes les 4 heures)
python agent_audit/main.py

# Mode continu sans correction (surveillance passive)
python agent_audit/main.py --dry-run
```

### Pre-requis
- Python 3 doit etre installe et accessible via la commande `python`.

---

## Que scanne l'agent ?

L'agent parcourt **l'integralite du projet** en analysant tous les fichiers
texte. Voici ce qu'il inclut et exclut :

### Fichiers scannes
Tous les fichiers avec ces extensions :
`.js`, `.jsx`, `.ts`, `.tsx`, `.css`, `.scss`, `.json`, `.md`, `.py`,
`.html`, `.bat`, `.vbs`, `.sh`, `.yaml`, `.yml`, `.txt`, `.env`, etc.

### Dossiers ignores
`node_modules/`, `.git/`, `dist/`, `build/`, `backups/`,
`__pycache__/`, `.venv/`, `.cache/`

### Fichiers binaires ignores
Images, audio, video, polices, archives, executables, etc.

---

## Les regles d'audit

Les regles sont definies dans le fichier `rules.json`. Tu peux en ajouter,
modifier ou supprimer sans toucher au code Python.

### Format d'une regle

```json
{
  "id": "NOM_UNIQUE_DE_LA_REGLE",
  "description": "Message affiche quand la regle est enfreinte.",
  "pattern": "expression_regex_a_rechercher",
  "severity": "critical | warning | info",
  "file_pattern": "regex_pour_filtrer_les_fichiers",
  "exclude_pattern": "regex_pour_exclure_certains_fichiers",
  "fix": {
    "action": "delete_line | replace | replace_regex | comment_out",
    "search": "regex_a_remplacer (optionnel, defaut = pattern)",
    "replacement": "texte_de_remplacement",
    "comment_prefix": "commentaire a ajouter (pour comment_out)"
  }
}
```

### Champs detailles

| Champ             | Obligatoire | Description                                                              |
|-------------------|:-----------:|--------------------------------------------------------------------------|
| `id`              | Oui         | Identifiant unique de la regle (ex: `NO_CONSOLE_LOG`).                   |
| `description`     | Oui         | Message humain expliquant pourquoi c'est un probleme.                    |
| `pattern`         | Oui         | Expression reguliere Python recherchee dans chaque ligne du code.        |
| `severity`        | Oui         | Niveau de gravite : `critical` (rouge), `warning` (orange), `info` (bleu). |
| `file_pattern`    | Oui         | Regex pour cibler certains types de fichiers (ex: `\\.(jsx)$`).          |
| `exclude_pattern` | Non         | Regex pour exclure certains fichiers (ex: les fichiers de test).         |
| `fix`             | Non         | Si present, l'agent corrige automatiquement. Sinon, il signale seulement.|

### Actions de correction disponibles

| Action          | Description                                  | Exemple                              |
|-----------------|----------------------------------------------|--------------------------------------|
| `delete_line`   | Supprime la ligne entiere                    | Supprimer un `console.log()`         |
| `replace`       | Remplace le match par un texte fixe          | `var ` -> `const `                   |
| `replace_regex` | Remplacement Regex avec groupes de capture   | Refactoring complexe                 |
| `comment_out`   | Ajoute un commentaire TODO au-dessus         | Marquer pour revision manuelle       |

### Regles incluses par defaut

| ID                       | Severite     | Detecte...                                  | Correction          |
|--------------------------|-------------|----------------------------------------------|----------------------|
| `NO_HARDCODED_LOCALHOST` | Critique    | Les URLs `http://localhost:XXXX` en dur      | Remplace par `/api`  |
| `NO_CONSOLE_LOG_IN_PROD` | Warning     | Les `console.log()` oublies                 | Supprime la ligne    |
| `NO_VAR_KEYWORD`         | Warning     | L'utilisation de `var` au lieu de `const`    | Remplace par `const` |
| `NO_DOUBLE_SEMICOLONS`   | Warning     | Les `;;` (typos)                            | Remplace par `;`     |
| `AVOID_INLINE_STYLES`    | Info        | Les `style={{...}}` inline                  | Rapport seulement    |
| `NO_TRAILING_WHITESPACE` | Info        | Espaces en fin de ligne                     | Rapport seulement    |

### Exemple : Ajouter une nouvelle regle avec correction

Pour interdire `alert()` et le supprimer automatiquement :

```json
{
  "id": "NO_ALERT",
  "description": "alert() ne doit pas etre utilise en production.",
  "pattern": "^\\s*alert\\(.*\\);?\\s*$",
  "severity": "warning",
  "file_pattern": "\\.(js|jsx)$",
  "fix": {
    "action": "delete_line"
  }
}
```

---

## Systeme de backup (filet de securite)

Avant de modifier un fichier, l'agent **cree automatiquement une copie
de securite** dans `agent_audit/backups/`.

### Organisation des backups

Chaque session de correction genere un dossier horodate :
```
agent_audit/backups/
|-- 20260706_142231/           # Session du 6 juillet a 14:22:31
|   |-- interface/
|   |   |-- web/
|   |   |   |-- src/
|   |   |       |-- store.js   # Copie du fichier AVANT correction
|   |   |-- bridge/
|   |       |-- server.js
|-- 20260706_182231/           # Session suivante (4h plus tard)
```

### Restaurer un fichier

Si une correction a casse quelque chose :
```bash
# Copier le backup vers l'original
copy agent_audit\backups\20260706_142231\interface\web\src\store.js interface\web\src\store.js
```

### Nettoyage automatique
L'agent conserve les **10 dernieres sessions** de backup et supprime
automatiquement les plus anciennes.

---

## Le rapport d'audit

Apres chaque execution, l'agent genere `data/espoir_audit.json` :

```json
{
    "last_scan": "2026-07-06T14:22:32.123456",
    "mode": "SCAN + CORRECTION",
    "files_scanned": 174,
    "total_anomalies": 1439,
    "total_corrections": 79,
    "files_corrected": 14,
    "anomalies": [ ... ],
    "corrections_applied": [
        {
            "rule_id": "NO_CONSOLE_LOG_IN_PROD",
            "file": "\\interface\\web\\src\\Dashboard.jsx",
            "line": 42,
            "before": "    console.log('debug');",
            "after": "[LIGNE SUPPRIMEE]",
            "action": "delete_line"
        }
    ]
}
```

---

## Configuration avancee

### Modifier l'intervalle de scan

Dans `main.py`, modifie la constante en haut du fichier :

```python
SCAN_INTERVAL_SECONDS = 14400  # 4 heures (par defaut)
# Exemples :
# 3600   = 1 heure
# 7200   = 2 heures
# 28800  = 8 heures
```

### Ajouter un type de fichier a scanner

Dans `main.py`, ajoute l'extension dans `TEXT_EXTENSIONS` :

```python
TEXT_EXTENSIONS = {
    '.js', '.jsx', '.ts', '.tsx', '.css', '.scss',
    # Ajouter ici :
    '.graphql', '.sql',
}
```

### Ajouter un dossier a ignorer

Dans `main.py`, ajoute le nom dans `IGNORED_DIRS` :

```python
IGNORED_DIRS = {
    'node_modules', '.git', 'dist', 'build',
    # Ajouter ici :
    'temp_files',
}
```
