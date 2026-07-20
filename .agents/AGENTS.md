# RÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨gles de projet pour ELPIS

- Pour ce projet systÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©matiquement, ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  la fin de chaque tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢che ou de chaque modification importante, il faut **pousser les modifications sur Github** (`git add .`, `git commit -m "..."`, `git push`).
- Ensuite, il faut systÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©matiquement **compiler les modifications** pour l'application en ligne et locale (par exemple en exÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cutant `npm run build` dans le dossier `interface/web`).
- L'objectif est d'assurer que l'utilisateur dispose toujours de la version la plus rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cente et fonctionnelle ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  la fois en ligne et en local.
- **CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ation de tests anti-rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©gression** : SystÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©matiquement, lorsque tu vas repÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rer et corriger un bug, **ou dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©velopper une nouvelle fonctionnalitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© / un nouveau composant**, il faudra au final crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©er ou mettre ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  jour les tests unitaires (anti-rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©gression) pour garantir une couverture de code continue et prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©venir la rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©apparition de bugs.
- **Performance React & Zustand** : Ne jamais placer d'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tats ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  haute frÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©quence de mise ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  jour (ex: chronomÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨tre, compteurs rapides, positionnement souris) dans le store global (`useStore`). Ils doivent impÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rativement ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªtre isolÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s dans leur propre store Zustand dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©diÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© (ex: `useChronoStore`) pour ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©viter des re-rendus massifs et non dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©sirÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s sur l'ensemble de l'application.
- **Time-Awareness (Conscience du Temps RÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©el)** : Ne jamais utiliser de rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©partitions temporelles statiques ou purement sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©quentielles pour la planification de tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ches (ex: "Matin", "AprÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s-midi", "Soir"). Les algorithmes d'orchestration et les interfaces utilisateur doivent impÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rativement vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rifier l'heure locale actuelle (`new Date().getHours()`) pour assigner ou filtrer dynamiquement ces ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tiquettes. Si l'utilisateur se connecte ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  15h, le systÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨me ne doit plus proposer de tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ches pour le "Matin".
- **Moyenne Universitaire ECTS** : Toujours utiliser une moyenne pondÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e par les crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dits ECTS pour calculer les moyennes globales (semestres, annÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es, ou cycle entier), conformÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ment au standard LMD europÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©en. Ne jamais utiliser de moyenne arithmÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tique simple entre les semestres ou les annÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es pour un score global.
- **Mise ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  jour de la Streak (Gamification)** : La streak (jours consÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cutifs d'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tude) ne doit s'incrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©menter QUE lorsqu'une activitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© est rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ellement effectuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e et ajoutÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  l'historique de l'utilisateur. L'ouverture de l'application ne doit jamais incrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©menter la streak, mais doit seulement servir ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rifier si le joueur l'a perdue (plus d'un jour d'absence) afin de la remettre ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  0.
- **Archivage Granulaire & Automatique** : L'historique d'un ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tudiant doit pouvoir ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªtre archivÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© de faÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§on granulaire (ex: `s.archived` au niveau du semestre, ou `l.archived` au niveau de la licence) pour ne pas fausser le calcul de la Cible IA ni l'Orchestrateur. De plus, chaque semestre peut possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©der une date de fin (`s.dateFin`) permettant au systÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨me de l'ignorer automatiquement une fois cette date dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©passÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e, sans intervention manuelle de l'utilisateur.

- **SystÃƒÆ’Ã‚Â¨me de Toast (Notifications)** : Le hook `useToast()` retourne un objet, pas une fonction. Ne **jamais** appeler `toast("message", "type")` directement. Il faut impÃƒÆ’Ã‚Â©rativement utiliser ses mÃƒÆ’Ã‚Â©thodes spÃƒÆ’Ã‚Â©cifiques : `toast.success("...")`, `toast.error("...")`, `toast.info("...")`, ou `toast.warning("...")`.

- **Validation des chemins de fichiers (Anti-Path-Traversal)** : Ne jamais utiliser directement un chemin de fichier fourni par l'utilisateur (req.body, req.query, etc.) pour des opÃƒÆ’Ã‚Â©rations fs ou child_process. Toujours utiliser path.resolve() pour obtenir le chemin absolu et vÃƒÆ’Ã‚Â©rifier strictement qu'il commence par le rÃƒÆ’Ã‚Â©pertoire de base autorisÃƒÆ’Ã‚Â© en utilisant resolvedPath.startsWith(allowedDir). Si le chemin sort du pÃƒÆ’Ã‚Â©rimÃƒÆ’Ã‚Â¨tre, renvoyer immÃƒÆ’Ã‚Â©diatement une erreur HTTP 403.

- **Rejet des doublons ÃƒÆ’Ã‚Â  l'upload** : Ne jamais configurer de systÃƒÆ’Ã‚Â¨me d'upload de fichiers (ex: via multer) qui ÃƒÆ’Ã‚Â©crase silencieusement un fichier existant de mÃƒÆ’Ã‚Âªme nom. Avant d'ÃƒÆ’Ã‚Â©crire le fichier sur le disque, vÃƒÆ’Ã‚Â©rifier systÃƒÆ’Ã‚Â©matiquement avec fs.existsSync() si le fichier de destination existe dÃƒÆ’Ã‚Â©jÃƒÆ’Ã‚Â . Si le fichier existe, stopper l'opÃƒÆ’Ã‚Â©ration et renvoyer une erreur explicite au client.

- **Validation dans Multer** : Ne jamais utiliser cb(new Error(...)) ÃƒÆ’Ã‚Â  l'intÃƒÆ’Ã‚Â©rieur des fonctions destination ou filename de multer.diskStorage pour des rÃƒÆ’Ã‚Â¨gles mÃƒÆ’Ã‚Â©tier (comme "le fichier existe dÃƒÆ’Ã‚Â©jÃƒÆ’Ã‚Â "). Laisser multer uploader tous les fichiers dans un dossier temporaire et effectuer les vÃƒÆ’Ã‚Â©rifications mÃƒÆ’Ã‚Â©tier dans le contrÃƒÆ’Ã‚Â´leur de la route.

- **Transparence des erreurs** : Le Global Error Handler du backend doit toujours exposer le message d'erreur rÃƒÆ’Ã‚Â©el (err.message) au frontend dans le champ principal 'error' renvoyÃƒÆ’Ã‚Â© en JSON. Ne jamais masquer une erreur mÃƒÆ’Ã‚Â©tier interceptÃƒÆ’Ã‚Â©e derriÃƒÆ’Ã‚Â¨re un message gÃƒÆ’Ã‚Â©nÃƒÆ’Ã‚Â©rique statique.

- **Service Worker SPA Caching (Blank Screen Prevention)** : Ne jamais utiliser une stratÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©gie "Cache-First" (qui retourne toujours la rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ponse du cache en prioritÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©) pour l'"index.html" d'une Single Page Application (SPA, par exemple React + Vite). Lors du dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ploiement d'une nouvelle version, l'ancien HTML cherchera des bundles JS supprimÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s, causant un crash silencieux (ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cran blanc/noir). Utiliser TOUJOURS une stratÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©gie "Network-First" (avec fallback vers le cache) pour "index.html" afin que l'application reÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§oive toujours la derniÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨re version du build.


- **DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ploiement systÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©matique (Build & Push)** : AprÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s avoir terminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© un bloc logique de modifications sur le projet (surtout pour l'interface web), exÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cuter TOUJOURS "npm run build" dans le rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©pertoire appropriÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©, puis crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©er un commit ("git commit") clair et le pousser ("git push"). Ne jamais considÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rer une tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢che comme achevÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e tant que le code n'est pas compilÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© et sauvegardÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© sur le dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´t distant.


<RULE[project_deployment]>
- **DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ploiement SystÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©matique (Build & Push)** : AprÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨s avoir terminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© un bloc logique de modifications sur le code source du projet (correction de bug, nouvelle fonctionnalitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©, redesign), je dois TOUJOURS :
  1. Compiler le frontend avec
pm run build dans le rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©pertoire appropriÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© (interface/web).
  2. CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©er un commit git descriptif avec git commit.
  3. Pousser les modifications sur le dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´t avec git push.
  Ne jamais considÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rer une tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢che de code comme terminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e sans avoir exÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cutÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© cette sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©quence.
</RULE[project_deployment]>

<RULE[project_testing]>
- **Mise ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  jour SystÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©matique des Tests** : Pour chaque nouvelle fonctionnalitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© ajoutÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e ou chaque bug corrigÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©, je dois OBLIGATOIREMENT :
  1. VÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rifier si un fichier de test correspondant existe (ex: NomDuComposant.test.jsx).
  2. Ajouter les tests unitaires ou d'intÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©gration nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cessaires pour couvrir la nouvelle logique ou garantir la non-rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©gression du bug corrigÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©.
  3. M'assurer que les tests passent (en exÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cutant
pm test ou ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©quivalent) AVANT de dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©clencher la procÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dure de Build & Push.
  Ne jamais considÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rer une tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢che comme terminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e si le code de production a ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© modifiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© sans les tests correspondants.
</RULE[project_testing]>

<RULE[project_h24_tasks]>
- **TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ches d'arriÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨re-plan H24 (Uptime)** : Si une fonctionnalitÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© ou un agent nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cessite de fonctionner 24h/24 et 7j/7 indÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©pendamment de l'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tat du PC local (ex: agent d'audit), cette tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢che DOIT ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªtre implÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©mentÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e via un workflow CI/CD dans le Cloud (ex: **GitHub Actions** avec dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©clencheur cron), et non comme un processus local (Node.js ou script systÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨me).
</RULE[project_h24_tasks]>

<RULE[algorithmic_rigor]>
- **Rigueur Algorithmique et Machine Learning** : Lors de la conception ou de la modification de systÃƒÆ’Ã‚Â¨mes de scoring, de prÃƒÆ’Ã‚Â©diction ou de classification, privilÃƒÆ’Ã‚Â©gier SYSTÃƒÆ’Ã¢â‚¬Â°MATIQUEMENT des modÃƒÆ’Ã‚Â¨les mathÃƒÆ’Ã‚Â©matiques, statistiques ou cognitifs formels (ex: InfÃƒÆ’Ã‚Â©rence BayÃƒÆ’Ã‚Â©sienne, K-Means, RÃƒÆ’Ã‚Â©gression LinÃƒÆ’Ã‚Â©aire, Z-Score, Bandits Manchots, Courbe d'Ebbinghaus) plutÃƒÆ’Ã‚Â´t que des heuristiques naÃƒÆ’Ã‚Â¯ves ("if/else" ou seuils arbitraires). Les coefficients empiriques doivent ÃƒÆ’Ã‚Âªtre explicites et isolÃƒÆ’Ã‚Â©s pour pouvoir ÃƒÆ’Ã‚Âªtre ajustÃƒÆ’Ã‚Â©s ultÃƒÆ’Ã‚Â©rieurement par des donnÃƒÆ’Ã‚Â©es rÃƒÆ’Ã‚Â©elles.
</RULE[algorithmic_rigor]>

<RULE[agent_architecture_immune_system]>
- **Architecture Systeme Immunitaire** : Lors de la conception d'agents d'audit ou de correction automatique, TOUJOURS adopter une architecture de type "Immune System". L'agent doit :
  1. Separer l'extraction (Scanners), la logique metier (Engine), les corrections (Fixers) et les validations (Validators).
  2. Implementer un systeme de **Rollback** (annuler la correction si la verification post-fix echoue via les tests ou la syntaxe).
  3. Utiliser un systeme d'**Escalade** formelle pour les anomalies detectees qu'il ne peut pas corriger en toute securite, plutot que de laisser des anomalies orphelines dans les rapports standards.
  4. **Anticipation post-correction (Continuous Learning)** : DÃƒÆ’Ã‚Â¨s qu'un bug complexe est rÃƒÆ’Ã‚Â©solu manuellement, le systÃƒÆ’Ã‚Â¨me immunitaire DOIT ÃƒÆ’Ã‚Âªtre mis ÃƒÆ’Ã‚Â  jour immÃƒÆ’Ã‚Â©diatement avec de nouvelles rÃƒÆ’Ã‚Â¨gles (dans rules.json ou scanners.py) pour dÃƒÆ’Ã‚Â©tecter automatiquement la rÃƒÆ’Ã‚Â©gression de ce cas prÃƒÆ’Ã‚Â©cis, et pour gÃƒÆ’Ã‚Â©nÃƒÆ’Ã‚Â©raliser la dÃƒÆ’Ã‚Â©tection ÃƒÆ’Ã‚Â  des cas similaires.
  5. **ParamÃƒÆ’Ã‚Â¨tres de Confiance** : Les `fix_confidence` dans `rules.json` doivent TOUJOURS ÃƒÆ’Ã‚Âªtre des entiers sur 100 (ex: `95` et non `0.95`).
  6. **Validation par les Tests** : Le systÃƒÆ’Ã‚Â¨me de validation (ex: `validators.py`) doit impÃƒÆ’Ã‚Â©rativement exÃƒÆ’Ã‚Â©cuter les tests dans le dossier exact contenant le `package.json` correspondant au fichier modifiÃƒÆ’Ã‚Â©. Ne jamais supposer que le `package.json` se trouve ÃƒÆ’Ã‚Â  la racine.
  7. **CompatibilitÃƒÆ’Ã‚Â© des Test Runners** : PrÃƒÆ’Ã‚Â©fÃƒÆ’Ã‚Â©rer les arguments positionnels (`npm test -- nomFichier`) plutÃƒÆ’Ã‚Â´t que des drapeaux spÃƒÆ’Ã‚Â©cifiques (`--testPathPattern`) pour garantir la compatibilitÃƒÆ’Ã‚Â© entre Jest et Vitest.
  8. **Bypass pour les donnÃƒÆ’Ã‚Â©es** : Les fichiers ne possÃƒÆ’Ã‚Â©dant pas de tests associÃƒÆ’Ã‚Â©s (ex: fichiers JSON ou de configuration brute) doivent automatiquement rÃƒÆ’Ã‚Â©ussir l'ÃƒÆ’Ã‚Â©tape de validation des tests pour ÃƒÆ’Ã‚Â©viter des rollbacks inutiles.
</RULE[agent_architecture_immune_system]>

<RULE[daemon_lifecycle_management]>
- **Gestion du Cycle de Vie des Processus (DÃƒÆ’Ã‚Â©mons)** : Lors de la modification du code source d'un processus s'exÃƒÆ’Ã‚Â©cutant en arriÃƒÆ’Ã‚Â¨re-plan (serveur Node.js, agent Python, etc.), il faut SYSTEMATIQUEMENT identifier l'instance en cours d'exÃƒÆ’Ã‚Â©cution (via `manage_task` ou les outils systÃƒÆ’Ã‚Â¨me) et la redÃƒÆ’Ã‚Â©marrer ou la tuer. Cela ÃƒÆ’Ã‚Â©vite les crashs fatals dus ÃƒÆ’Ã‚Â  une dÃƒÆ’Ã‚Â©synchronisation entre le code en mÃƒÆ’Ã‚Â©moire vive et les nouveaux fichiers de configuration sur le disque.
</RULE[daemon_lifecycle_management]>

<RULE[documentation_double_audience]>
- **Documentation Multi-Niveaux** : Lors de la mise ÃƒÂ  jour ou de la simplification des fichiers de documentation principaux (comme README.md), il faut TOUJOURS prÃƒÂ©server les sections d'architecture technique (diagrammes, API, dÃƒÂ©ploiement). Si du contenu pour dÃƒÂ©butants ("Guide Rapide") est ajoutÃƒÂ©, il doit ÃƒÂªtre placÃƒÂ© au sommet du document sans pour autant ÃƒÂ©craser les explications de bas niveau destinÃƒÂ©es aux dÃƒÂ©veloppeurs.
</RULE[documentation_double_audience]>

<RULE[agent_architecture_linters]>
- **DÃƒÂ©lÃƒÂ©gation aux Linters Standards** : Lors de la conception de systÃƒÂ¨mes d'auto-correction ou d'audit de code, ne jamais utiliser de scripts regex personnalisÃƒÂ©s. DÃƒÂ©lÃƒÂ©guer l'analyse et la correction sÃƒÂ»re aux standards de l'industrie (ESLint pour JS, Ruff/Black pour Python). L'agent personnalisÃƒÂ© doit servir d'orchestrateur (lancement, parsing de rapport JSON, rollbacks) et non de moteur d'analyse de code.
</RULE[agent_architecture_linters]>


<RULE[project_ci_cd_sync]>
- **Compilation et Push SystÃƒÆ’Ã‚Â©matique (Sync Local/Remote)** : ÃƒÆ’Ã¢â€šÂ¬ la fin de chaque tÃƒÆ’Ã‚Â¢che de modification de code, je dois **TOUJOURS** :
  1. Compiler le code pour m'assurer qu'il ne casse rien (ex: 
pm run build dans le rÃƒÆ’Ã‚Â©pertoire appropriÃƒÆ’Ã‚Â© comme interface/web).
  2. Ajouter, commiter et pusher les modifications sur Git (git add ., git commit, git push) pour garder le dÃƒÆ’Ã‚Â©pÃƒÆ’Ã‚Â´t distant synchronisÃƒÆ’Ã‚Â© avec le local.
  3. Utiliser le format **Conventional Commits** pour les messages (ex: eat: ..., ix: ..., docs: ...).
</RULE[project_ci_cd_sync]>

<RULE[project_systematic_docs]>
- **Documentation SystÃƒÆ’Ã‚Â©matique** : Pour chaque section modifiÃƒÆ’Ã‚Â©e, ajoutÃƒÆ’Ã‚Â©e ou supprimÃƒÆ’Ã‚Â©e, je dois **SYSTÃƒÆ’Ã¢â‚¬Â°MATIQUEMENT** mettre ÃƒÆ’Ã‚Â  jour la documentation du projet.
  1. La prioritÃƒÆ’Ã‚Â© est de mettre ÃƒÆ’Ã‚Â  jour les fichiers globaux existants dans le dossier docs/ (ex: rontend.md, ackend.md, devops.md).
  2. Je ne crÃƒÆ’Ã‚Â©erai de nouveaux fichiers Markdown dans docs/ que pour des trÃƒÆ’Ã‚Â¨s gros modules justifiant une sÃƒÆ’Ã‚Â©paration.
</RULE[project_systematic_docs]>

<RULE[agent_audit_backups_ignore]>
- **Exclusion des Backups (Anti Recursive-Loop)** : Tout systÃƒÆ’Ã‚Â¨me d'auto-correction (comme le SystÃƒÆ’Ã‚Â¨me Immunitaire) gÃƒÆ’Ã‚Â©nÃƒÆ’Ã‚Â©rant des sauvegardes locales (ex: gent_audit/backups/) DOIT impÃƒÆ’Ã‚Â©rativement avoir ce dossier inscrit dans le .gitignore. Cela ÃƒÆ’Ã‚Â©vite que les linters (ESLint, Ruff) ne scannent rÃƒÆ’Ã‚Â©cursivement les anciens fichiers et que l'agent ne commit des milliers de lignes de backups par erreur.
</RULE[agent_audit_backups_ignore]>

<RULE[elpis_new_features]>
- **Ajout de Nouvelles FonctionnalitÃƒÂ©s (ELPIS)** : Lors de la crÃƒÂ©ation d'un nouvel onglet ou page :
  1. Utilisez toujours `lazy` et `Suspense` dans `App.jsx` pour le Code Splitting.
  2. Enregistrez le composant dans l'arborescence existante (ne pas crÃƒÂ©er de routing complexe avec React Router, utilisez le systÃƒÂ¨me `activeTab` existant).
  3. L'ÃƒÂ©tat global DOIT ÃƒÂªtre stockÃƒÂ© dans `store.js` (via `config` ou `coursConfig`) pour assurer la synchronisation PWA hors-ligne.
  4. Ajoutez le lien correspondant dans `Sidebar.jsx` (dans le groupe appropriÃƒÂ©).
  5. Ãƒâ€°vitez les bibliothÃƒÂ¨ques UI externes ; utilisez le design system de `index.css` (Glassmorphism, animations Framer Motion).
</RULE[elpis_new_features]>

<RULE[ux_full_crud]>
- **ComplÃƒÂ©tude CRUD obligatoire** : Lors de la crÃƒÂ©ation d'une fonctionnalitÃƒÂ© permettant de gÃƒÂ©rer une liste d'ÃƒÂ©lÃƒÂ©ments (vidÃƒÂ©os, liens, tÃƒÂ¢ches, etc.), il est OBLIGATOIRE d'implÃƒÂ©menter l'intÃƒÂ©gralitÃƒÂ© du cycle CRUD (Create, Read, Update, Delete). Ne jamais omettre la fonctionnalitÃƒÂ© de modification (Update), mÃƒÂªme si elle n'est pas explicitement demandÃƒÂ©e par l'utilisateur, afin d'ÃƒÂ©viter qu'il ne doive supprimer et recrÃƒÂ©er un ÃƒÂ©lÃƒÂ©ment pour corriger une faute de frappe. PrivilÃƒÂ©gier une ÃƒÂ©dition "en ligne" (inline) directement sur la carte de l'ÃƒÂ©lÃƒÂ©ment pour une meilleure UX.
</RULE[ux_full_crud]>

<RULE[algo_test_completeness]>
- **Couverture de Test des Algorithmes (Anti-Regression)** : Toute crÃƒÂ©ation ou modification d'un fichier liÃƒÂ© au cÃ…â€œur algorithmique de l'application (ex: `store.js`, `useWorkloadEngine.js`, `fsrsEngine.js`, `sm2.js`, `GlobalChrono.jsx`) DOIT obligatoirement s'accompagner de la rÃƒÂ©daction ou de la mise ÃƒÂ  jour des tests unitaires correspondants (`*.test.js(x)`) pour atteindre ou maintenir une couverture >90% sur ces fichiers spÃƒÂ©cifiques. Ne jamais laisser de branches (ex: `if (archived)`) non testÃƒÂ©es.
- **Mocking de Fetch dans Vitest** : Ne jamais laisser des appels rÃƒÂ©seau (`fetch`) natifs s'exÃƒÂ©cuter avec des URL relatives dans les tests (ce qui cause l'erreur `TypeError: Failed to parse URL from /api/...`). Assurez-vous toujours que `global.fetch` est mockÃƒÂ© dans `setupTests.js` ou dans le fichier de test via `vi.fn()`.
</RULE[algo_test_completeness]>

<RULE[algorithmic_anti_starvation]>
- **Ãƒâ€°quitÃƒÂ© Algorithmique (Anti-Starvation)** : Lors de la conception ou de la modification de systÃƒÂ¨mes d'ordonnancement (Schedulers/Orchestrateurs) qui extraient des tÃƒÂ¢ches depuis une liste ordonnÃƒÂ©e statique (ex: un fichier JSON) avec un quota ou une limite globale (ex: max tÃƒÂ¢ches par jour), ne **JAMAIS** appliquer le quota pendant la boucle d'extraction (ce qui provoque une "famine" systÃƒÂ©matique pour les ÃƒÂ©lÃƒÂ©ments en fin de liste). Il faut **TOUJOURS** extraire tous les candidats valides dans un pool global, les trier ou les mÃƒÂ©langer, puis appliquer la limite uniquement lors de la phase de sÃƒÂ©lection/assignation finale.
</RULE[algorithmic_anti_starvation]>

<RULE[lmd_pils_exclusion]>
- **Exclusion des matiÃƒÂ¨res Bonus (PILS, etc.)** : Les notes ou matiÃƒÂ¨res dites "Bonus" (comme le programme PILS) ne doivent JAMAIS ÃƒÂªtre incluses dans la base de donnÃƒÂ©es (`espoir_cours.json`) ni dans les calculs de moyenne de l'application, car elles faussent la moyenne acadÃƒÂ©mique souhaitÃƒÂ©e par l'utilisateur. Toute mention de "PILS" lors de l'intÃƒÂ©gration d'un bulletin doit ÃƒÂªtre ignorÃƒÂ©e ou supprimÃƒÂ©e.
</RULE[lmd_pils_exclusion]>

<RULE[composite_virtual_ranking]>
- **Scoring des Classements Virtuels (Gamification)** : Lors de la conception de tout systÃƒÂ¨me de classement, de "leaderboard" ou de comparaison avec des ÃƒÂ©tudiants virtuels, le systÃƒÂ¨me NE DOIT PAS se baser uniquement sur la moyenne acadÃƒÂ©mique. Il doit impÃƒÂ©rativement utiliser un **Score Composite** incluant : 
  1) Les notes acadÃƒÂ©miques (via `espoir_cours.json`).
  2) La constance/rÃƒÂ©tention de la mÃƒÂ©moire (via `fsrsEngine`).
  3) L'effort et la charge de travail accomplis (via `useWorkloadEngine`). 
Cela permet de rÃƒÂ©compenser la rigueur quotidienne et pas seulement la performance aux examens finaux.
</RULE[composite_virtual_ranking]>

<RULE[grade_parsing_nan_prevention]>
- **PrÃƒÂ©vention des crashs mathÃƒÂ©matiques (NaN)** : Lors du calcul de moyennes ou de scores basÃƒÂ©s sur la liste des `evaluations` dans les fichiers JSON, le systÃƒÂ¨me ne doit JAMAIS supposer que les champs `note` et `sur` sont valides. Les ÃƒÂ©valuations non passÃƒÂ©es ont une `note` ÃƒÂ  `null`, et le champ `sur` est souvent absent.
  Il faut **SYSTÃƒâ€°MATIQUEMENT** :
  1. Filtrer les ÃƒÂ©valuations valides : `evals.filter(ev => typeof ev.note === 'number')`
  2. Fournir une valeur par dÃƒÂ©faut de 20 au dÃƒÂ©nominateur : `(ev.sur || 20)`
  Cela empÃƒÂªchera la gÃƒÂ©nÃƒÂ©ration et la propagation de valeurs `NaN` ou `Infinity` dans l'interface.
</RULE[grade_parsing_nan_prevention]>

<RULE[fallback_note_estimee]>
- **Utilisation des Notes EstimÃƒÂ©es (Fallback IA)** : Lors du calcul de moyennes globales, de classements virtuels ou de statistiques avancÃƒÂ©es (ex: `ClassementPage.jsx`), si une matiÃƒÂ¨re ne possÃƒÂ¨de aucune note officielle valide (ÃƒÂ©valuations absentes ou ÃƒÂ  `null`), le systÃƒÂ¨me **DOIT TOUJOURS** tenter d'utiliser en solution de repli (fallback) la note projetÃƒÂ©e par l'IA prÃƒÂ©sente dans le store : `intelligence.projectedScoreMap[matiere.nom]`. 
  Cela permet ÃƒÂ  l'ÃƒÂ©tudiant de suivre ses progrÃƒÂ¨s et son rang potentiel mÃƒÂªme en dÃƒÂ©but de semestre. L'interface devra idÃƒÂ©alement prÃƒÂ©ciser visuellement que la note utilisÃƒÂ©e est "EstimÃƒÂ©e par IA".
</RULE[fallback_note_estimee]>

<RULE[cours_json_structure]>
- **Structure JSON des Cours** : Le fichier "espoir_cours.json" (ou Ã©quivalent) possÃ¨de toujours un nÅ“ud racine "licences", qui contient les "semestres". Ne jamais tenter d'itÃ©rer directement sur "coursData.semestres" ou "coursData.ues" sans passer par la hiÃ©rarchie complÃ¨te : "licences -> semestres -> ues -> matieres".
</RULE[cours_json_structure]>

- **Boost de DÃ©couverte (Discovery Boost)** : Ne laissez jamais les nouvelles matiÃ¨res s'enterrer sous le poids des matiÃ¨res en retard. Si une matiÃ¨re n'a jamais Ã©tÃ© pratiquÃ©e, elle doit recevoir un multiplicateur de prioritÃ© (ex: x2.0) pour garantir son apparition dans les plannings et forcer l'utilisateur Ã  l'initier.

- **UnicitÃ© des TÃ¢ches (Frontend)** : Lors de la correspondance entre le rÃ©sultat de l'Orchestrateur et la liste d'exercices affichÃ©e, le front-end ne doit jamais se fier uniquement au titre pour autoriser des doublons. Une tÃ¢che de l'orchestrateur ne doit correspondre qu'Ã  une seule carte dans la Session d'Ã‰tude, mÃªme si les titres sont gÃ©nÃ©riques.
- **Isolation du Boost de DÃ©couverte** : Le bonus accordÃ© aux nouvelles matiÃ¨res (discoveryBoost) doit Ãªtre strictement mathÃ©matique pour le score de prioritÃ© final, et ne doit pas polluer les modificateurs d'urgence (comme examBoost). Cela Ã©vite que les nouvelles matiÃ¨res ne contournent le filtre de paritÃ©.

<RULE[prerequisite_theory_first]>
- **ThÃ©orie avant Pratique (PrÃ©requis CM)** : Ne jamais planifier d'exercices pratiques (TD, TP, Annales) si les fondations thÃ©oriques (CM) de la matiÃ¨re n'ont pas Ã©tÃ© vues au moins une fois dans leur intÃ©gralitÃ©. Le moteur d'ordonnancement doit bloquer l'assignation pratique (skip global) si le nombre de CM rÃ©visÃ©s est infÃ©rieur au nombre total de CM dÃ©finis pour la matiÃ¨re. Si la matiÃ¨re ne possÃ¨de aucun CM (0), la pratique est autorisÃ©e.
</RULE[prerequisite_theory_first]>

<RULE[intra_day_deprioritization]>
- **DiversitÃ© Intra-JournaliÃ¨re** : Si une matiÃ¨re a dÃ©jÃ  Ã©tÃ© pratiquÃ©e le jour mÃªme (prÃ©sente dans l'historique du jour), sa prioritÃ© pour le reste de la journÃ©e DOIT Ãªtre drastiquement rÃ©duite (ex: multipliÃ©e par 0.1). Elle ne doit pas Ãªtre bloquÃ©e Ã  100% afin de permettre du rattrapage si l'utilisateur a beaucoup de temps libre, mais elle doit laisser sa place aux autres matiÃ¨res dans le Top 4 quotidien.
</RULE[intra_day_deprioritization]>

<RULE[guaranteed_discovery]>
- **Garantie de DÃ©couverte (Anti-Starvation)** : Le simple multiplicateur de "DÃ©couverte" (x2.0) est souvent Ã©crasÃ© par l'urgence des examens (Annales). Pour garantir qu'aucune matiÃ¨re ne soit laissÃ©e de cÃ´tÃ© indÃ©finiment, le systÃ¨me de sÃ©lection des matiÃ¨res (Top N subjects) DOIT systÃ©matiquement forcer l'inclusion d'au moins 1 matiÃ¨re "Nouvelle" (jamais pratiquÃ©e) si elle est disponible dans le pool d'exercices, et ce, peu importe son score de prioritÃ© par rapport aux autres.
</RULE[guaranteed_discovery]>

<RULE[annales_practice_limit]>
- **Plafond de MaÃ®trise des Annales** : Les Annales sont des exercices cruciaux, mais leur rÃ©pÃ©tition ne doit pas Ãªtre infinie. Si une Annale a Ã©tÃ© pratiquÃ©e 3 fois ou plus (`nombrePratiques >= 3`), elle DOIT Ãªtre considÃ©rÃ©e comme "totalement acquise" et retirÃ©e dÃ©finitivement du pool des propositions, sauf si une urgence absolue l'exige. Cela permet de forcer la rotation vers d'autres exercices ou de nouvelles matiÃ¨res.
</RULE[annales_practice_limit]>

<RULE[annales_weekly_cooldown]>
- **Espacement des Annales (Cooldown de 7 jours)** : Une fois qu'une Annale a Ã©tÃ© pratiquÃ©e, elle entre dans une pÃ©riode de "repos" stricte de 7 jours glissants. Durant cette fenÃªtre, elle ne doit **pas** Ãªtre reproposÃ©e (sauf urgence d'examen, ex: examen dans moins de 21 jours). Cela permet d'Ã©taler la charge de travail et d'Ã©viter qu'une mÃªme annale sature le planning de la semaine.
</RULE[annales_weekly_cooldown]>
</RULE[annales_weekly_cooldown]>

<RULE[documentation_systematique_v2]>
- **Documentation SystÃƒÂ©matique (Projet ELPIS V2)** : Pour ÃƒÂ©viter l'ÃƒÂ©cueil du projet ELPIS V1 (80k lignes non documentÃƒÂ©es), une rigueur absolue est exigÃƒÂ©e pour la documentation d'ELPIS V2. L'agent DOIT maintenir un dossier documentation ÃƒÂ  la racine du projet ELPIS_V2. Ãƒâ‚¬ la fin de chaque session de travail ou de chaque implÃƒÂ©mentation de fonctionnalitÃƒÂ© importante, l'agent DOIT rÃƒÂ©diger ou mettre ÃƒÂ  jour un fichier de documentation. La documentation doit ÃƒÂªtre hyper-prÃƒÂ©cise et vulgarisÃƒÂ©e de maniÃƒÂ¨re ÃƒÂ  ce qu'un dÃƒÂ©veloppeur novice puisse comprendre l'architecture, les choix techniques et reproduire le fonctionnement sans ÃƒÂªtre perdu. Chaque modification doit ÃƒÂªtre tracÃƒÂ©e, expliquÃƒÂ©e et documentÃƒÂ©e.
</RULE[documentation_systematique_v2]>

<RULE[compilation_check_frontend]>
- **VÃƒÂ©rification de la Compilation (Frontend)** : Lors de la modification de code frontend (particuliÃƒÂ¨rement dans un environnement React / Vite), ne considÃƒÂ©rez jamais une tÃƒÂ¢che comme achevÃƒÂ©e uniquement parce que les tests unitaires passent. Vous DEVEZ impÃƒÂ©rativement lancer la commande de compilation pour la production (ex: npm run build) afin de vÃƒÂ©rifier qu'aucune erreur de bundling ou d'import dynamique n'a ÃƒÂ©tÃƒÂ© introduite.
</RULE[compilation_check_frontend]>

<RULE[long_task_intermediate_states]>
- **TÃ¢ches Longues et Ã‰tats IntermÃ©diaires** : Lors de l'ajout ou modification de fonctionnalitÃ©s liÃ©es aux tÃ¢ches dans ELPIS, prÃ©voir systÃ©matiquement un Ã©tat "suspendu/en cours" pour les tÃ¢ches qui peuvent dÃ©passer 30 minutes. Toujours enregistrer le temps de travail partiel dans l'historique, mÃªme en cas de suspension. Utiliser `prochaineRevisionDate` pour forcer la replanification d'une tÃ¢che suspendue au lendemain. Ne jamais modifier l'Ã©tat FSRS d'un CM qui n'a pas Ã©tÃ© entiÃ¨rement rÃ©visÃ©.
</RULE[long_task_intermediate_states]>

<RULE[singleton_db_hmr]>
- **Singleton Database HMR (PrÃ©vention DB9)** : Lors de l'initialisation de bases de donnÃ©es locales ou de singletons lourds (comme RxDB, Prisma, Dexie) dans un environnement Vite ou React, il faut TOUJOURS mettre en cache l'instance globale sur l'objet `window` ou `globalThis` (ex: `window.__myDbPromise = dbPromise`). Cela empÃªche le Hot Module Replacement (HMR) de recrÃ©er de multiples instances concurrentes lors de la sauvegarde d'un fichier, ce qui provoque des crashs (ex: RxDB Error DB9) et des pertes temporaires de donnÃ©es.
</RULE[singleton_db_hmr]>

<RULE[singleton_lazy_loading]>
- **Singletons & Vite Lazy Loading (Race Condition)** : Lors de la crÃ©ation de promesses ou d'instances uniques globales (comme `dbPromise` pour RxDB) exposÃ©es via un module, ne jamais se contenter d'initialiser la variable au niveau du module (`let dbPromise = window.myPromise`). Il faut IMPÃ‰RATIVEMENT vÃ©rifier la prÃ©sence de l'instance dans le scope global (`window`) Ã  l'intÃ©rieur de la fonction getter elle-mÃªme (`getDb()`). Cela empÃªche les instanciations parallÃ¨les lors du Lazy Loading ou du HMR de Vite, qui peuvent dupliquer temporairement l'Ã©tat des modules.
</RULE[singleton_lazy_loading]>
 
 < R U L E [ r x d b _ d b 9 _ p r e v e n t i o n ] >  
 -   * * P r é v e n t i o n   R x D B   D B 9   ( P r o d u c t i o n ) * *   :   D a n s   R x D B   ( s p é c i a l e m e n t   v 1 5 + ) ,   n e   J A M A I S   f o r c e r   \ i g n o r e D u p l i c a t e :   t r u e \   d a n s   l ' e n v i r o n n e m e n t   d e   p r o d u c t i o n .   S i   c e   p a r a m è t r e   e s t   a c t i v é   a l o r s   q u e   l e   p l u g i n   D e v M o d e   d e   R x D B   n ' e s t   p a s   c h a r g é ,   R x D B   l a n c e r a   v o l o n t a i r e m e n t   u n e   e x c e p t i o n   f a t a l e   \ R x E r r o r   ( D B 9 ) \   b l o q u a n t   l ' i n i t i a l i s a t i o n   d e   l a   b a s e   d e   d o n n é e s .   I l   f a u t   t o u j o u r s   u t i l i s e r   \ i g n o r e D u p l i c a t e :   f a l s e \   e n   p r o d u c t i o n   e t   g é r e r   l ' u n i c i t é   d e   l ' i n s t a n c e   ( e x :   v i a   \ w i n d o w . _ _ e l p i s D b P r o m i s e \ ) .  
 < / R U L E [ r x d b _ d b 9 _ p r e v e n t i o n ] >  
  
 < R U L E [ c l o u d _ s y n c _ s a f e t y ] >  
 -   * * S é c u r i t é   d e   S y n c h r o n i s a t i o n   C l o u d   ( A n t i - W i p e ) * *   :   L o r s   d e   l a   s y n c h r o n i s a t i o n   d e s c e n d a n t e   d e p u i s   l e   C l o u d   ( M o n g o D B )   v e r s   l e s   f i c h i e r s   l o c a u x   d e   s a u v e g a r d e   ( \ e s p o i r _ c o n f i g . j s o n \ ,   e t c . ) ,   i l   f a u t   S Y S T É M A T I Q U E M E N T   v é r i f i e r   q u e   l e   d o c u m e n t   r é c u p é r é   n ' e s t   p a s   v i d e   ( e x :   \ O b j e c t . k e y s ( d o c . d a t a ) . l e n g t h   >   0 \   o u   \ A r r a y . i s A r r a y ( d o c . d a t a )   & &   d o c . d a t a . l e n g t h   >   0 \ )   A V A N T   d ' é c r a s e r   l e   f i c h i e r   l o c a l .   C e l a   é v i t e   q u ' u n e   b a s e   d e   d o n n é e s   C l o u d   c o r r o m p u e   o u   r é i n i t i a l i s é e   n ' é c r a s e   s i l e n c i e u s e m e n t   l a   p r o g r e s s i o n   l o c a l e   d e   l ' é t u d i a n t .  
 < / R U L E [ c l o u d _ s y n c _ s a f e t y ] >  
 
<RULE[backend_sqlite_persistence]>
- **Backend Data Persistence (SQLite First)** : Le backend ELPIS repose strictement sur une base de donnÃ©es relationnelle SQLite (data/elpis.sqlite) pour toutes les donnÃ©es mÃ©tier (Licences, Semestres, UEs, MatiÃ¨res, Cours, Exercices, Config, Historique). Il est STRICTEMENT INTERDIT d'Ã©crire directement dans les fichiers JSON locaux (espoir_cours.json, etc.) pour persister les donnÃ©es. Lors de la communication avec le frontend (ex: GET /api/cours), le backend doit reconstruire l'arbre JSON imbriquÃ© dynamiquement Ã  partir des tables relationnelles. Lors des sauvegardes (POST /api/cours), le backend doit dÃ©composer le JSON et l'insÃ©rer dans les tables via des transactions SQLite atomiques avec etter-sqlite3.
</RULE[backend_sqlite_persistence]>

<RULE[modular_express_architecture]>
- **Règle d'Architecture Backend : Modularité et Express 5 (Robustesse Asynchrone)** : 
  1. **Zéro Logique Métier dans `server.js`** : Le fichier `server.js` doit EXCLUSIVEMENT servir de point d'entrée. Il configure les middlewares, monte les routeurs, et démarre le serveur. 
  2. **Découpage en Routeurs** : Tous les endpoints `/api/*` doivent être scindés par domaine dans un dossier `routes/`.
  3. **Services Indépendants** : Les tâches de fond (comme le lancement de scripts Python) doivent être encapsulées dans des modules dédiés (ex: `services/auditAgent.js`).
  4. **Gestion des Erreurs Asynchrones (Express 5)** : Exploiter le support natif d'Express 5 pour les promesses. Ne JAMAIS "silencer" une erreur avec un `.catch(console.error)` vide. L'erreur doit toujours être passée via `next(err)` pour être interceptée par un middleware global de gestion d'erreurs (`middleware/errorHandler.js`) qui structure la réponse et log l'incident sans faire crasher l'application.
</RULE[modular_express_architecture]>

<RULE[optional_rest_day_chaining]>
- **Système de Repos Dynamique** : Lors de la modification des systèmes de repos ou de planification, il faut respecter la règle du "2ème jour optionnel offert". Si l'utilisateur active manuellement un jour de repos (ce qui incrémente son quota et ajoute le jour dans `restDays`), l'application doit **automatiquement** lui proposer de prolonger sa récupération le lendemain (si `yesterdayStr` est un jour de repos, mais pas `todayStr`). S'il accepte, la journée en cours bascule en repos (statut `REPOS_OPTIONNEL`), l'UI masque les boutons d'action, et cela ne décrémente **pas** de nouveau quota (le 2ème jour consécutif ne doit pas être ajouté à `restDays`). L'orchestrateur reprendra naturellement le planning normal le 3ème jour. S'il refuse, l'API `/api/skip-rest` est appelée pour annuler l'option.
</RULE[optional_rest_day_chaining]>

<RULE[safe_data_migrations]>
- **Migrations JSON vers SQL (Zero Data Loss)** : Lors de la conception ou de la modification d'un schéma de base de données relationnelle (ex: SQLite) destiné à remplacer un stockage JSON/NoSQL :
  1. L'agent DOIT obligatoirement écrire un script de comparaison profonde (deep-compare) entre les clés de l'ancien objet JSON et les clés de l'objet reconstruit depuis SQL.
  2. Aucun champ dynamique du JSON (même optionnel comme `targetGrade`, `coefficient`, `ects`) ne doit être silencieusement ignoré ou renommé sans être re-mappé à l'identique lors de l'extraction (`SELECT`).
  3. Les tableaux JSON (Arrays) doivent être explicitement stringifiés (`JSON.stringify()`) lors de l'insertion et parsés (`JSON.parse()`) lors de l'extraction.
</RULE[safe_data_migrations]>

<RULE[centralized_schema_imports]>
- **Centralisation des Schémas de Validation** : Lors de l'utilisation de bibliothèques de validation (comme Zod) sur le backend, les schémas DOIVENT toujours être importés depuis leur fichier de définition centralisé (ex: `moteur/schemas.js`). Ne jamais importer un schéma depuis un fichier de service métier (ex: `moteur/historique.js`) pour éviter les importations `undefined` liées aux dépendances circulaires, qui causeraient des crashs (Erreur 500) lors de l'exécution de `safeParse`.
</RULE[centralized_schema_imports]>

<RULE[pwa_anti_wipe_sync]>
- **Sécurité de Synchronisation PWA (Anti-Wipe)** : Lors de la synchronisation initiale de données depuis le backend vers une base de données locale (ex: RxDB, IndexedDB), il faut TOUJOURS s'assurer que les données reçues de l'API sont structurellement valides et non vides (ex: `Array.isArray(data) && data.length > 0`) AVANT d'effectuer un `upsert` ou un écrasement (`replace`). Cela empêche l'application frontend d'effacer accidentellement les données hors-ligne de l'utilisateur en cas de panne de la base distante.
</RULE[pwa_anti_wipe_sync]>


<RULE[workload_summer_study_awareness]>
- **Prise en compte du travail en avance (Summer Study)** : Lors de l'impl�mentation de filtres d'historique bas�s sur une date de rentr�e (studyStartDate), l'agent DOIT toujours inclure une condition pour comptabiliser le travail effectu� en avance (ex: si la date d'entr�e est inf�rieure � la date de rentr�e officielle ET r�cente). Ne jamais �carter aveugl�ment l'historique sous pr�texte que la rentr�e n'a pas encore eu lieu.
</RULE[workload_summer_study_awareness]>


<RULE[anki_dynamic_workload_split]>
- **R�partition Intelligente du Temps Anki** : Lors de la compl�tion d'une t�che de type ANKI (Routine), le syst�me DOIT interroger AnkiConnect en arri�re-plan (/api/anki/today-stats) pour d�terminer le volume de cartes r�vis�es par mati�re le jour m�me. Le temps total allou� � la t�che (ex: 30 minutes) DOIT ensuite �tre proportionnellement divis� et ajout� � l'historique sous le nom exact des mati�res travaill�es. Si AnkiConnect est inaccessible ou si aucune carte n'a �t� r�vis�e, le syst�me DOIT basculer sur l'enregistrement "Routine" par d�faut (fallback).
</RULE[anki_dynamic_workload_split]>


<RULE[phased_learning_progression]>
- **Apprentissage par Phases (Th�orie vs Pratique)** : Lors de la conception ou de la modification de planificateurs de t�ches acad�miques, l'agent DOIT toujours pr�voir des options permettant d'isoler la th�orie de la pratique. Ne jamais imposer un m�lange simultan� de CM (Cours Magistraux), TD (Travaux Dirig�s) et Annales. L'interface DOIT permettre � l'utilisateur de d�sactiver/activer ces modules de pratique afin de respecter une progression d'apprentissage logique (Phase 1: Th�orie -> Phase 2: Pratique).
</RULE[phased_learning_progression]>

<RULE[preparation_phase_weekends]>
- **Repos automatique avant la rentrée** : Lors de la modification de l'orchestrateur (ou de tout algorithme de planification), si la date actuelle est antérieure à la date de rentrée (studyStartDate), l'algorithme DOIT automatiquement proposer le mode REPOS_OPTIONNEL les week-ends (samedi et dimanche). L'utilisateur doit pouvoir décliner ce repos s'il le souhaite.
</RULE[preparation_phase_weekends]>
