# ELPIS Immune System v3.0 — Documentation

## Qu'est-ce que c'est ?

L'Agent Audit v3.0 est le **systeme immunitaire** du projet ELPIS. Comme un
systeme immunitaire biologique, il :

- **Detecte** les menaces (anomalies de code) via 6 strategies de scanning
- **Neutralise** les menaces corrigibles automatiquement (avec backup + rollback)
- **Signale** les menaces qu'il ne peut pas neutraliser (escalade)
- **Apprend** de ses echecs (detection de faux positifs, suggestions d'amelioration)
- **S'auto-diagnostique** (health check de l'agent lui-meme)

**Philosophie** : "Le systeme immunitaire ne negocie pas. Il corrige."

---

## Architecture (7 modules)

```
agent_audit/
|-- main.py          # Point d'entree CLI + orchestrateur
|-- engine.py        # Coeur decisionnel (score de confiance, priorisation)
|-- scanners.py      # 6 strategies de detection
|-- fixers.py        # 8 strategies de correction avec validation gates
|-- validators.py    # Pre-fix / Post-fix : syntaxe, tests, lint
|-- escalation.py    # Diagnostic + recommandations quand l'agent ne peut pas corriger
|-- health.py        # Auto-diagnostic de l'agent
|-- rules.json       # 42 regles sur 10 categories
|-- README.md        # Ce fichier
|-- backups/         # Backups automatiques avant correction
```

### Flux d'execution

```
1. CHARGEMENT    → rules.json (42 regles)
2. COLLECTE      → Lecture de tous les fichiers, extraction des imports
3. SCAN GLOBAL   → Graphe d'imports, frontieres architecturales, couverture de tests
4. SCAN FICHIER  → 6 strategies par fichier (regex, multi-ligne, structurel...)
5. DECISION      → Pour chaque anomalie : fixable ? (confiance >= 70% ?)
6. CORRECTION    → Backup → Fix → Validation syntaxe → Tests → OK/KO
7. ROLLBACK      → Si echec, restauration automatique depuis le backup
8. ESCALADE      → Anomalies non-corrigibles → diagnostic + recommandation
9. RAPPORT       → JSON + Health Score projet (0-100)
10. AUTO-DIAG    → L'agent verifie sa propre sante
```

---

## Les 6 strategies de detection

| Strategie        | Description                                                    |
|------------------|----------------------------------------------------------------|
| `regex`          | Patterns ligne par ligne (compatible v2, 35 regles)            |
| `multi_line`     | Patterns qui traversent les lignes (ex: useEffect sans deps)   |
| `import_graph`   | Detection d'imports circulaires par DFS                        |
| `function_boundaries` | Detection de fonctions trop longues (>50 lignes)          |
| `nesting_analysis`    | Detection de nesting profond (>4 niveaux)                 |
| `test_pairing`        | Verification que chaque source a un fichier de test       |

---

## Les 10 categories de regles (42 regles)

| Categorie            | Regles | Description                                         |
|----------------------|--------|-----------------------------------------------------|
| SECURITY             | 8      | Secrets, eval, XSS, CORS, injections SQL, HTTP      |
| CODE_QUALITY         | 7      | var, magic numbers, empty catch, double semicolons   |
| PERFORMANCE          | 5      | Imports lourds, IO synchrone, React.memo             |
| REACT_BEST_PRACTICES | 5      | Keys, useEffect deps, index-as-key, prop spreading   |
| ARCHITECTURE         | 4      | Imports circulaires, taille de fichier, layers       |
| TESTING              | 4      | .only(), .skip(), tests async sans await, missing tests |
| ACCESSIBILITY        | 3      | alt, aria-label, tabIndex                             |
| PYTHON_SPECIFIC      | 3      | bare except, print(), type hints                      |
| DOCUMENTATION        | 2      | JSDoc sur exports, TODOs sans ticket                  |
| CSS_SPECIFIC         | 1      | !important                                           |

---

## Les 8 strategies de correction

| Action                    | Description                                    | Exemple                    |
|---------------------------|------------------------------------------------|----------------------------|
| `delete_line`             | Supprime la ligne defectueuse                  | console.log()              |
| `replace`                 | Remplace le pattern par une chaine fixe        | var → const                |
| `replace_regex`           | Remplacement regex avec groupes de capture     | http:// → https://         |
| `comment_out`             | Commente la ligne avec un TODO                 | Code a reviser             |
| `delete_line_or_comment`  | Supprime si confiance >= 90%, sinon commente   | Decision contextuelle      |

---

## Le Score de Confiance

Chaque regle a un `fix_confidence` (0-100) :
- **>= 70%** : Correction automatique (apres validation)
- **< 70%** : Signale uniquement, pas de correction automatique
- **0%** : Intervention humaine obligatoire (`requires_human: true`)

Exemples :
- `NO_DOUBLE_SEMICOLONS` : confiance 100% (correction triviale)
- `NO_CONSOLE_LOG_IN_PROD` : confiance 70% (parfois intentionnel)
- `NO_HARDCODED_SECRETS` : confiance 0% (trop risqué, escalade critique)

---

## Le Systeme d'Escalade

Quand l'agent ne peut pas corriger, il produit un diagnostic structure :

```json
{
  "type": "UNFIXABLE",
  "level": "elevated",
  "rule_id": "NO_SQL_INJECTION_PATTERNS",
  "diagnosis": "La correction automatique est desactivee...",
  "recommendation": "1. Ouvrir le fichier... 2. Corriger manuellement...",
  "rule_improvement_suggestion": null
}
```

Types d'escalade :
- `UNFIXABLE` : requires_human=true
- `LOW_CONFIDENCE` : fix_confidence < 70%
- `FIX_BROKE_TESTS` : rollback applique (les tests ont echoue apres correction)
- `PATTERN_TOO_BROAD` : la regle produit trop de hits (faux positifs probables)
- `EMERGENCY` : alerte critique immediate (secrets, eval, XSS...)
- `RULE_SUGGESTION` : suggestion d'amelioration de la regle

---

## Le Mode Urgence

Certaines regles sont marquees `emergency_mode: true`. Quand elles declenchent :
- Une alerte critique est emise immediatement
- Le fichier `data/espoir_emergency_alerts.json` est mis a jour
- Aucune correction automatique n'est tentee (trop risquee)
- Le dashboard ELPIS peut afficher ces alertes en rouge clignotant

Regles en mode urgence :
- `NO_HARDCODED_SECRETS` : credentials, tokens, clefs API
- `NO_EVAL_OR_FUNCTION_CONSTRUCTOR` : eval(), new Function()

---

## L'Auto-Diagnostic

L'agent verifie sa propre sante a chaque execution :

| Verification          | Ce qui est controle                                   |
|-----------------------|-------------------------------------------------------|
| Regles                | Champs obligatoires, patterns compilables, IDs uniques|
| Performance           | Fichiers/seconde, temps d'execution                   |
| Faux positifs         | Regles qui declenchent trop souvent                   |
| Escalades             | Nombre d'escalades critiques en attente               |
| Activite des regles   | Regles qui n'ont jamais declenche (inutiles ?)        |
| Fichier de sortie     | Integrite du JSON, champs requis                      |

Resultat : `HEALTHY`, `WARNING`, ou `CRITICAL`

---

## Health Score Projet (0-100)

Calcule a chaque audit :
- 100 = 0 anomaly critique + 0 escalade
- -15 par anomalie critique
- -3 par warning
- -0.5 par info
- +2 par correction appliquee (max +20)
- -10 par escalade

---

## Utilisation

```bash
# Audit complet + correction (one-shot)
python agent_audit/main.py --once

# Audit complet, rapport seulement (ne modifie rien)
python agent_audit/main.py --once --dry-run

# Mode continu (toutes les heures)
python agent_audit/main.py

# Mode continu sans correction
python agent_audit/main.py --dry-run

# Verification urgence uniquement (secrets, eval, etc.)
python agent_audit/main.py --emergency-check

# Auto-diagnostic de l'agent
python agent_audit/main.py --health
```

---

## Fichiers generes

| Fichier                            | Contenu                                              |
|------------------------------------|------------------------------------------------------|
| `data/espoir_audit.json`           | Rapport d'audit complet (anomalies, corrections)      |
| `data/espoir_audit_health.json`    | Rapport de sante de l'agent                          |
| `data/espoir_emergency_alerts.json`| Alertes d'urgence actives                            |
| `agent_audit/audit.log`            | Logs d'execution                                     |
| `agent_audit/escalations.log`      | Historique des escalades (JSON lines)                 |

---

## Ajouter une nouvelle regle

Editer `rules.json` et ajouter un bloc dans le tableau `rules` :

```json
{
  "id": "MA_REGLE",
  "category": "CODE_QUALITY",
  "severity": "warning",
  "description": "Description du probleme detecte.",
  "patterns": ["mon_pattern_regex"],
  "multi_line": false,
  "file_pattern": "\\.(js|jsx)$",
  "exclude_pattern": "(test|spec)\\.(js|jsx)$",
  "auto_fix_strategy": "replace_regex",
  "fix_confidence": 85,
  "false_positive_risk": "low",
  "fix": {
    "action": "replace",
    "search": "mon_pattern_regex",
    "replacement": "correction"
  },
  "escalation_message": "Message si l'agent ne peut pas corriger.",
  "suppression_comment": "AUDIT_SUPPRESS:MA_REGLE"
}
```

### Supprimer un faux positif localement

Ajouter le commentaire de suppression sur la ligne **precedente** :

```js
// AUDIT_SUPPRESS:NO_HARDCODED_LOCALHOST
const apiUrl = 'http://localhost:3000/api'; // Ceci est intentionnel
```

---

## Restauration apres correction

Si une correction automatique a casse quelque chose :

```bash
# Lister les backups
dir agent_audit\backups

# Restaurer un fichier specifique
copy agent_audit\backups\20260706_153349\interface\web\src\store.js interface\web\src\store.js
```

L'agent conserve les 10 dernieres sessions de backup.

---

## Roadmap

- [ ] Integration npm audit (scan de vulnerabilites des dependances)
- [ ] Detection de code duplique (similarite structurelle)
- [ ] Analyse de complexite cyclomatique
- [ ] Integration avec git hooks (pre-commit, pre-push)
- [ ] Dashboard web temps reel
- [ ] Notifications Slack/Discord pour les escalades critiques
