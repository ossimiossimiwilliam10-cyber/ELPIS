# Guide débutant pour ELPIS

Bienvenue dans ELPIS. Si tu découvres ce projet pour la première fois, ce guide te permet de comprendre rapidement :
- ce qu’est ELPIS,
- comment le lancer,
- où regarder si tu te perds,
- et quels fichiers sont les plus utiles.

## 1. Qu’est-ce qu’ELPIS ?

ELPIS est un assistant d’étude personnel. Son but est d’aider à organiser les révisions, les matières, le planning de travail et les priorités.

En pratique, il peut :
- afficher un planning quotidien,
- gérer des cours et des matières,
- enregistrer ce qui a été fait,
- proposer une aide par chat IA,
- utiliser des fichiers PDF et de la musique pour faciliter l’apprentissage.

Tu n’as pas besoin de comprendre tout le code pour commencer à l’utiliser.

## 2. Ce qu’il faut avant de commencer

Sur Windows, il faut surtout :
- Node.js installé,
- Python installé,
- un navigateur web,
- Visual Studio Code si tu veux ouvrir le projet proprement.

Vérifie dans un terminal :
- `node --version`
- `npm --version`
- `python --version`

Si une commande ne fonctionne pas, il faut installer le logiciel correspondant.

## 3. Démarrer ELPIS en 2 minutes

### Option la plus simple
Dans la racine du projet, double-clique sur :
- [start_elpis.bat](../start_elpis.bat) pour lancer ELPIS sous Windows.

Le programme démarre ensuite le serveur et ouvre l’interface dans le navigateur.

### Option manuelle
Si tu préfères le faire toi-même :

1. Ouvre un terminal.
2. Va dans le dossier du backend :
   - `cd interface/bridge`
3. Installe les dépendances :
   - `npm install`
4. Démarre le serveur :
   - `npm start`
5. Ouvre ensuite ton navigateur à l’adresse :
   - `http://localhost:3001`

## 4. Comprendre le projet sans se perdre

Le projet a 4 grandes parties :

- [interface/web](../interface/web) : l’interface que tu vois dans le navigateur.
- [interface/bridge](../interface/bridge) : le serveur, l’API et la logique métier.
- [data](../data) : les fichiers où sont stockées les données.
- [docs](.) : la documentation.

Une façon simple de penser le projet :
- la partie web = ce que tu vois,
- la partie bridge = le « traducteur » entre l’interface et les données,
- les fichiers JSON dans [data](../data) = les informations importantes du projet.

## 5. Les fichiers à connaître en priorité

Si tu débutes, commence par ceux-ci :

- [README.md](../README.md) : présentation générale du projet.
- [interface/bridge/server.js](../interface/bridge/server.js) : point central du backend.
- [interface/bridge/moteur](../interface/bridge/moteur) : logique d’ordonnancement et d’intelligence.
- [data/espoir_config.json](../data/espoir_config.json) : configuration principale.
- [data/espoir_cours.json](../data/espoir_cours.json) : cours et matières.
- [data/espoir_historique.json](../data/espoir_historique.json) : historique d’étude.
- [start_elpis.bat](../start_elpis.bat) : lanceur Windows.

## 6. Ce que tu verras quand l’application démarre

Quand l’interface s’ouvre, tu peux généralement :
- voir un planning ou un tableau de bord,
- consulter ou modifier la configuration,
- ajouter des cours ou matières,
- suivre la progression,
- utiliser la partie IA si elle est disponible.

Si tu veux tester le projet sans te perdre, fais ceci dans l’ordre :
1. Ouvre l’interface.
2. Vérifie que les données chargent.
3. Regarde la configuration.
4. Regarde les cours déjà présents.

## 7. Les mots qui reviennent souvent

- Backend : la partie serveur du projet.
- Frontend : la partie visible dans le navigateur.
- API : le langage utilisé par le navigateur et le serveur pour échanger des informations.
- Données : les fichiers qui stockent les cours, l’historique et la configuration.
- Moteur : la logique qui construit les plans et les priorités.

## 8. Si quelque chose ne marche pas

### Le site ne s’ouvre pas
Vérifie :
- que le serveur a bien démarré,
- que le port 3001 n’est pas déjà utilisé,
- que Node.js est installé.

### Une erreur apparaît dans le terminal
Lis le message complet. Il donne souvent un indice clair :
- `Error: Cannot find module` : dépendance manquante (il faut faire `npm install`).
- `SyntaxError: Unexpected token` : un fichier JSON est probablement mal formaté.
- `EADDRINUSE: address already in use :::3001` : le port 3001 est bloqué (un autre serveur tourne déjà).

> **💡 Astuce pour les logs** :
> - Les logs en **vert** `[INFO]` indiquent que tout va bien.
> - Les logs en **jaune** `[WARN]` sont des avertissements.
> - Les logs en **rouge** `[ERROR]` nécessitent ton attention immédiate.

### Les données ne semblent pas charger
Vérifie que les fichiers dans [data](../data) existent bien et ne sont pas corrompus (pas de virgule en trop).

## 8.1. La différence entre le mode "Dev" et "Prod"

Quand tu développes le projet ou que tu le modifies, tu utilises généralement deux terminaux :
- **Terminal 1** : `npm start` (dans `interface/bridge`) pour lancer l'API.
- **Terminal 2** : `npm run dev` (dans `interface/web`) pour lancer l'interface avec le "Hot Reload" (tes modifications s'affichent instantanément sans rafraîchir).

Quand le projet est terminé et déployé (Mode "Production") :
- On compile le frontend avec `npm run build`. Cela crée un dossier `dist/`.
- Le backend (`interface/bridge/server.js`) sert directement ce dossier `dist/`. Il n'y a plus besoin du Terminal 2.

## 9. Où aller ensuite

Pour continuer, tu peux lire :
- [README.md](../README.md) pour la vue d’ensemble,
- [docs/backend.md](backend.md) pour la partie serveur,
- [docs/frontend.md](frontend.md) pour la partie interface,
- [agent_audit/README.md](../agent_audit/README.md) pour l’outil d’audit automatique.

## 10. Petit conseil de débutant

Ne cherche pas à comprendre tout le code d’un coup. Le plus simple est :
1. lancer l’application,
2. regarder les dossiers principaux,
3. lire les fichiers de données,
4. découvrir l’interface,
5. ensuite seulement regarder le code.

C’est souvent la meilleure façon d’apprendre un projet de cette taille.
