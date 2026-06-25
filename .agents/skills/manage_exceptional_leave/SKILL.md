---
name: manage_exceptional_leave
description: Gérer les demandes de congés exceptionnels ou arrêts maladie en contournant la limite UI d'un jour par semaine.
---

# Protocole de Gestion des Congés Exceptionnels

Lorsqu'un utilisateur déclare une impossibilité de travailler sur plusieurs jours pour cause de force majeure (maladie, urgence, canicule, etc.) et demande un report ou des jours de repos consécutifs :

1. **Calculer les dates** : Identifier la date actuelle et la date de fin demandée par l'utilisateur. Générer toutes les dates incluses dans cet intervalle au format `YYYY-MM-DD`.
2. **Modifier la configuration** : L'interface utilisateur limite artificiellement le bouton "Jour de Repos" à 1 fois par semaine pour empêcher la procrastination. Vous DEVEZ passer outre cette limitation logicielle en modifiant directement le fichier de configuration principal (`espoir_config.json`).
3. **Action** : Insérer la liste générée de dates dans le tableau `"restDays"` du fichier `espoir_config.json`.
4. **Vérification** : S'assurer que le fichier reste un JSON valide. L'Orchestrateur reconnaîtra alors ces dates, mettra le statut en "REPOS", préservera la Streak de l'utilisateur, et évitera de générer de la charge de travail pendant l'absence.
