---
name: run_immune_system
description: Lance manuellement le Système Immunitaire (agent_audit) pour scanner et corriger le code.
---

# Lancement de l'Audit Manuel

Lorsqu'on te demande de lancer le système immunitaire, l'audit, ou de déclencher une passe de correction manuelle, tu dois effectuer les actions suivantes :

1. Utilise l'outil `run_command` avec la commande `python agent_audit/main.py --once`.
2. Le répertoire de travail (Cwd) doit être la racine du projet (`c:\Users\User\Desktop\ELPIS`).
3. Attends que la commande se termine, puis analyse les logs générés (dans la console ou dans `agent_audit/audit.log`) pour voir ce qui a été détecté et corrigé.
4. Fais un résumé clair et direct à l'utilisateur des erreurs qui ont été trouvées et de celles qui ont été automatiquement réparées.
