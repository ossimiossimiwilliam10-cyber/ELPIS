# Documentation Backend & Data

Le backend d'ELPIS est délibérément léger (Serverless / Fichiers statiques ou API Node.js locale) avec une persistance basée sur des fichiers JSON locaux. Cette architecture garantit la portabilité et permet au système de tourner sans base de données lourde.

## 1. Schémas de Données (Data Store JSON)

La persistance repose principalement sur le dossier `data/` et la racine du projet.

### `espoir_config.json`
Stocke les réglages de l'application (préférences utilisateur, configurations des agents).
```json
{
  "theme": "dark",
  "notifications": true,
  "scan_interval": 3600,
  "music_volume": 0.5
}
```

### `espoir_historique.json`
Consigne les résultats d'entraînement, le temps passé et les scores.
```json
{
  "sessions": [
    {
      "id": "uuid-1234",
      "date": "2026-07-06T14:30:00Z",
      "duration_minutes": 45,
      "score": 92
    }
  ]
}
```

### `espoir_audit.json` & `espoir_audit_health.json`
Générés par le *Système Immunitaire*.
- `espoir_audit.json` : Résultat du dernier scan (Anomalies, Corrections, Fichiers scannés).
- `espoir_audit_health.json` : Auto-diagnostic de l'agent (Règles actives, Score de santé).

## 2. Flux de Données et Sécurité

1. **Lecture** : Au démarrage de l'app, le backend sert les fichiers JSON à l'interface React.
2. **Écriture** : L'interface soumet des requêtes HTTP (ou appels I/O locaux si implémenté en desktop app/Electron) pour mettre à jour les JSON.
3. **Backups** : Le Système Immunitaire et les scripts DevOps effectuent des copies de sécurité avant toute opération critique, notamment dans le dossier `agent_audit/backups/`.

## 3. Gestion des Fichiers Médias
- **Dossier `music/`** : Contient les pistes audio. Non versionné (géré via `.gitignore` pour éviter d'alourdir le repo).
- **Dossier `fiches_revision/`** : Contient les PDFs générés ou uploadés par l'utilisateur (ignorés par Git).
