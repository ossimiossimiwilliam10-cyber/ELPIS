# DevOps & Maintenance

Cette section documente les scripts d'automatisation, les pipelines CI/CD, et la sécurité du projet.

## 1. Intégration Continue (CI)

Le projet utilise GitHub Actions pour garantir la qualité du code.
- Fichier : `.github/workflows/ci.yml`
- **Déclencheur** : À chaque `push` ou `pull_request` sur la branche `main`.
- **Action** : Installe les dépendances Node.js et lance la suite de tests (`npm test`). Empêche de fusionner du code cassé.

## 2. Agent Autonome (Cloud & Local)

### Sur GitHub Actions (Cloud)
- Fichier : `.github/workflows/agent_audit.yml`
- **Déclencheur** : Exécution par *cron* toutes les heures (`0 * * * *`).
- **Action** : Lance le Système Immunitaire (`python agent_audit/main.py --once`), qui scanne le dépôt, corrige les bugs, fait un `git commit` et push les corrections directement sur GitHub.

### En Local (Windows)
- Le développeur peut lancer le script `start_elpis.bat` ou `Lancer ELPIS.vbs` pour démarrer simultanément le frontend (Vite) et l'agent d'audit en arrière-plan.
- L'agent local fait des vérifications régulières. S'il corrige un fichier, il s'assure d'ajouter uniquement ce fichier, de commiter, et de pusher sans perturber le travail en cours du développeur.

## 3. Backups et File System
Avant d'appliquer la moindre correction automatique, l'agent copie le fichier original dans `agent_audit/backups/<TIMESTAMP>/`.
Le système maintient automatiquement les 10 dernières sessions de backups et purge les plus anciennes pour économiser de l'espace disque.

## 4. Politique Gitignore
Règle globale : le cache de compilation (`__pycache__/`, `*.pyc`, `*.pyo`) et les dossiers de dépendances lourdes (`node_modules/`) ne doivent **jamais** être versionnés. Le `.gitignore` à la racine est configuré pour nettoyer et protéger le dépôt de ces fichiers inutiles.
