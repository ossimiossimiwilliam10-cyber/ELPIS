# Règles de projet pour ELPIS

- Pour ce projet systématiquement, à la fin de chaque tâche ou de chaque modification importante, il faut **pousser les modifications sur Github** (`git add .`, `git commit -m "..."`, `git push`).
- Ensuite, il faut systématiquement **compiler les modifications** pour l'application en ligne et locale (par exemple en exécutant `npm run build` dans le dossier `interface/web`).
- L'objectif est d'assurer que l'utilisateur dispose toujours de la version la plus récente et fonctionnelle à la fois en ligne et en local.
- **Création de tests anti-régression** : Systématiquement, lorsque tu vas repérer et corriger un bug, **ou développer une nouvelle fonctionnalité / un nouveau composant**, il faudra au final créer ou mettre à jour les tests unitaires (anti-régression) pour garantir une couverture de code continue et prévenir la réapparition de bugs.
- **Performance React & Zustand** : Ne jamais placer d'états à haute fréquence de mise à jour (ex: chronomètre, compteurs rapides, positionnement souris) dans le store global (`useStore`). Ils doivent impérativement être isolés dans leur propre store Zustand dédié (ex: `useChronoStore`) pour éviter des re-rendus massifs et non désirés sur l'ensemble de l'application.
- **Time-Awareness (Conscience du Temps Réel)** : Ne jamais utiliser de répartitions temporelles statiques ou purement séquentielles pour la planification de tâches (ex: "Matin", "Après-midi", "Soir"). Les algorithmes d'orchestration et les interfaces utilisateur doivent impérativement vérifier l'heure locale actuelle (`new Date().getHours()`) pour assigner ou filtrer dynamiquement ces étiquettes. Si l'utilisateur se connecte à 15h, le système ne doit plus proposer de tâches pour le "Matin".
- **Moyenne Universitaire ECTS** : Toujours utiliser une moyenne pondérée par les crédits ECTS pour calculer les moyennes globales (semestres, années, ou cycle entier), conformément au standard LMD européen. Ne jamais utiliser de moyenne arithmétique simple entre les semestres ou les années pour un score global.
- **Mise à jour de la Streak (Gamification)** : La streak (jours consécutifs d'étude) ne doit s'incrémenter QUE lorsqu'une activité est réellement effectuée et ajoutée à l'historique de l'utilisateur. L'ouverture de l'application ne doit jamais incrémenter la streak, mais doit seulement servir à vérifier si le joueur l'a perdue (plus d'un jour d'absence) afin de la remettre à 0.
- **Archivage Granulaire & Automatique** : L'historique d'un étudiant doit pouvoir être archivé de façon granulaire (ex: `s.archived` au niveau du semestre, ou `l.archived` au niveau de la licence) pour ne pas fausser le calcul de la Cible IA ni l'Orchestrateur. De plus, chaque semestre peut posséder une date de fin (`s.dateFin`) permettant au système de l'ignorer automatiquement une fois cette date dépassée, sans intervention manuelle de l'utilisateur.

- **Syst�me de Toast (Notifications)** : Le hook `useToast()` retourne un objet, pas une fonction. Ne **jamais** appeler `toast("message", "type")` directement. Il faut imp�rativement utiliser ses m�thodes sp�cifiques : `toast.success("...")`, `toast.error("...")`, `toast.info("...")`, ou `toast.warning("...")`.

- **Validation des chemins de fichiers (Anti-Path-Traversal)** : Ne jamais utiliser directement un chemin de fichier fourni par l'utilisateur (req.body, req.query, etc.) pour des op�rations fs ou child_process. Toujours utiliser path.resolve() pour obtenir le chemin absolu et v�rifier strictement qu'il commence par le r�pertoire de base autoris� en utilisant resolvedPath.startsWith(allowedDir). Si le chemin sort du p�rim�tre, renvoyer imm�diatement une erreur HTTP 403.

- **Rejet des doublons � l'upload** : Ne jamais configurer de syst�me d'upload de fichiers (ex: via multer) qui �crase silencieusement un fichier existant de m�me nom. Avant d'�crire le fichier sur le disque, v�rifier syst�matiquement avec fs.existsSync() si le fichier de destination existe d�j�. Si le fichier existe, stopper l'op�ration et renvoyer une erreur explicite au client.

- **Validation dans Multer** : Ne jamais utiliser cb(new Error(...)) � l'int�rieur des fonctions destination ou filename de multer.diskStorage pour des r�gles m�tier (comme "le fichier existe d�j�"). Laisser multer uploader tous les fichiers dans un dossier temporaire et effectuer les v�rifications m�tier dans le contr�leur de la route.

- **Transparence des erreurs** : Le Global Error Handler du backend doit toujours exposer le message d'erreur r�el (err.message) au frontend dans le champ principal 'error' renvoy� en JSON. Ne jamais masquer une erreur m�tier intercept�e derri�re un message g�n�rique statique.

- **Service Worker SPA Caching (Blank Screen Prevention)** : Ne jamais utiliser une stratégie "Cache-First" (qui retourne toujours la réponse du cache en priorité) pour l'"index.html" d'une Single Page Application (SPA, par exemple React + Vite). Lors du déploiement d'une nouvelle version, l'ancien HTML cherchera des bundles JS supprimés, causant un crash silencieux (écran blanc/noir). Utiliser TOUJOURS une stratégie "Network-First" (avec fallback vers le cache) pour "index.html" afin que l'application reçoive toujours la dernière version du build.


- **Déploiement systématique (Build & Push)** : Après avoir terminé un bloc logique de modifications sur le projet (surtout pour l'interface web), exécuter TOUJOURS "npm run build" dans le répertoire approprié, puis créer un commit ("git commit") clair et le pousser ("git push"). Ne jamais considérer une tâche comme achevée tant que le code n'est pas compilé et sauvegardé sur le dépôt distant.


<RULE[project_deployment]>
- **Déploiement Systématique (Build & Push)** : Après avoir terminé un bloc logique de modifications sur le code source du projet (correction de bug, nouvelle fonctionnalité, redesign), je dois TOUJOURS :
  1. Compiler le frontend avec 
pm run build dans le répertoire approprié (interface/web).
  2. Créer un commit git descriptif avec git commit.
  3. Pousser les modifications sur le dépôt avec git push.
  Ne jamais considérer une tâche de code comme terminée sans avoir exécuté cette séquence.
</RULE[project_deployment]>

<RULE[project_testing]>
- **Mise à jour Systématique des Tests** : Pour chaque nouvelle fonctionnalité ajoutée ou chaque bug corrigé, je dois OBLIGATOIREMENT :
  1. Vérifier si un fichier de test correspondant existe (ex: NomDuComposant.test.jsx).
  2. Ajouter les tests unitaires ou d'intégration nécessaires pour couvrir la nouvelle logique ou garantir la non-régression du bug corrigé.
  3. M'assurer que les tests passent (en exécutant 
pm test ou équivalent) AVANT de déclencher la procédure de Build & Push.
  Ne jamais considérer une tâche comme terminée si le code de production a été modifié sans les tests correspondants.
</RULE[project_testing]>
