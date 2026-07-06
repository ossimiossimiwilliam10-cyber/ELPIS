# Architecture Globale d'ELPIS

ELPIS est un projet structuré autour d'une interface frontend React réactive, couplée à un système d'entraînement intelligent et un agent d'audit "Système Immunitaire" autonome.

## Diagramme d'Architecture

```mermaid
graph TD
    subgraph Frontend [Frontend React (UI)]
        D[Dashboard] --> S[Store / State]
        T[Training Module] --> S
        M[Music Player] --> S
    end

    subgraph Backend [Backend Local]
        A[API / Server] --> DB[(JSON Data Store)]
    end

    subgraph ImmuneSystem [ELPIS Immune System (Agent)]
        E[Engine] --> Sc[Scanners]
        Sc --> F[Fixers]
        F --> V[Validators]
        V --> Esc[Escalation Log]
    end

    Frontend <-->|Requêtes HTTP| Backend
    ImmuneSystem -.->|Scan & Auto-Fix| Frontend
    ImmuneSystem -.->|Scan & Auto-Fix| Backend
```

## Composants Clés

1. **Frontend (React)** : Gère l'interface utilisateur, le dashboard, et l'orchestration des entraînements.
2. **Backend (JSON Data Store)** : Stocke la configuration (`espoir_config.json`), l'historique (`espoir_historique.json`), et les données de cours.
3. **Agent d'Audit (Immune System)** : Un daemon autonome (`agent_audit/main.py`) qui tourne en arrière-plan (ou via GitHub Actions) pour garantir la qualité du code (Linting, refactoring, détection de dépendances circulaires).
