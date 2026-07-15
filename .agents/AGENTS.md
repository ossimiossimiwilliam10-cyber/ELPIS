# RÃƒÆ’Ã‚Â¨gles de projet pour ELPIS

- Pour ce projet systÃƒÆ’Ã‚Â©matiquement, ÃƒÆ’Ã‚Â  la fin de chaque tÃƒÆ’Ã‚Â¢che ou de chaque modification importante, il faut **pousser les modifications sur Github** (`git add .`, `git commit -m "..."`, `git push`).
- Ensuite, il faut systÃƒÆ’Ã‚Â©matiquement **compiler les modifications** pour l'application en ligne et locale (par exemple en exÃƒÆ’Ã‚Â©cutant `npm run build` dans le dossier `interface/web`).
- L'objectif est d'assurer que l'utilisateur dispose toujours de la version la plus rÃƒÆ’Ã‚Â©cente et fonctionnelle ÃƒÆ’Ã‚Â  la fois en ligne et en local.
- **CrÃƒÆ’Ã‚Â©ation de tests anti-rÃƒÆ’Ã‚Â©gression** : SystÃƒÆ’Ã‚Â©matiquement, lorsque tu vas repÃƒÆ’Ã‚Â©rer et corriger un bug, **ou dÃƒÆ’Ã‚Â©velopper une nouvelle fonctionnalitÃƒÆ’Ã‚Â© / un nouveau composant**, il faudra au final crÃƒÆ’Ã‚Â©er ou mettre ÃƒÆ’Ã‚Â  jour les tests unitaires (anti-rÃƒÆ’Ã‚Â©gression) pour garantir une couverture de code continue et prÃƒÆ’Ã‚Â©venir la rÃƒÆ’Ã‚Â©apparition de bugs.
- **Performance React & Zustand** : Ne jamais placer d'ÃƒÆ’Ã‚Â©tats ÃƒÆ’Ã‚Â  haute frÃƒÆ’Ã‚Â©quence de mise ÃƒÆ’Ã‚Â  jour (ex: chronomÃƒÆ’Ã‚Â¨tre, compteurs rapides, positionnement souris) dans le store global (`useStore`). Ils doivent impÃƒÆ’Ã‚Â©rativement ÃƒÆ’Ã‚Âªtre isolÃƒÆ’Ã‚Â©s dans leur propre store Zustand dÃƒÆ’Ã‚Â©diÃƒÆ’Ã‚Â© (ex: `useChronoStore`) pour ÃƒÆ’Ã‚Â©viter des re-rendus massifs et non dÃƒÆ’Ã‚Â©sirÃƒÆ’Ã‚Â©s sur l'ensemble de l'application.
- **Time-Awareness (Conscience du Temps RÃƒÆ’Ã‚Â©el)** : Ne jamais utiliser de rÃƒÆ’Ã‚Â©partitions temporelles statiques ou purement sÃƒÆ’Ã‚Â©quentielles pour la planification de tÃƒÆ’Ã‚Â¢ches (ex: "Matin", "AprÃƒÆ’Ã‚Â¨s-midi", "Soir"). Les algorithmes d'orchestration et les interfaces utilisateur doivent impÃƒÆ’Ã‚Â©rativement vÃƒÆ’Ã‚Â©rifier l'heure locale actuelle (`new Date().getHours()`) pour assigner ou filtrer dynamiquement ces ÃƒÆ’Ã‚Â©tiquettes. Si l'utilisateur se connecte ÃƒÆ’Ã‚Â  15h, le systÃƒÆ’Ã‚Â¨me ne doit plus proposer de tÃƒÆ’Ã‚Â¢ches pour le "Matin".
- **Moyenne Universitaire ECTS** : Toujours utiliser une moyenne pondÃƒÆ’Ã‚Â©rÃƒÆ’Ã‚Â©e par les crÃƒÆ’Ã‚Â©dits ECTS pour calculer les moyennes globales (semestres, annÃƒÆ’Ã‚Â©es, ou cycle entier), conformÃƒÆ’Ã‚Â©ment au standard LMD europÃƒÆ’Ã‚Â©en. Ne jamais utiliser de moyenne arithmÃƒÆ’Ã‚Â©tique simple entre les semestres ou les annÃƒÆ’Ã‚Â©es pour un score global.
- **Mise ÃƒÆ’Ã‚Â  jour de la Streak (Gamification)** : La streak (jours consÃƒÆ’Ã‚Â©cutifs d'ÃƒÆ’Ã‚Â©tude) ne doit s'incrÃƒÆ’Ã‚Â©menter QUE lorsqu'une activitÃƒÆ’Ã‚Â© est rÃƒÆ’Ã‚Â©ellement effectuÃƒÆ’Ã‚Â©e et ajoutÃƒÆ’Ã‚Â©e ÃƒÆ’Ã‚Â  l'historique de l'utilisateur. L'ouverture de l'application ne doit jamais incrÃƒÆ’Ã‚Â©menter la streak, mais doit seulement servir ÃƒÆ’Ã‚Â  vÃƒÆ’Ã‚Â©rifier si le joueur l'a perdue (plus d'un jour d'absence) afin de la remettre ÃƒÆ’Ã‚Â  0.
- **Archivage Granulaire & Automatique** : L'historique d'un ÃƒÆ’Ã‚Â©tudiant doit pouvoir ÃƒÆ’Ã‚Âªtre archivÃƒÆ’Ã‚Â© de faÃƒÆ’Ã‚Â§on granulaire (ex: `s.archived` au niveau du semestre, ou `l.archived` au niveau de la licence) pour ne pas fausser le calcul de la Cible IA ni l'Orchestrateur. De plus, chaque semestre peut possÃƒÆ’Ã‚Â©der une date de fin (`s.dateFin`) permettant au systÃƒÆ’Ã‚Â¨me de l'ignorer automatiquement une fois cette date dÃƒÆ’Ã‚Â©passÃƒÆ’Ã‚Â©e, sans intervention manuelle de l'utilisateur.

- **SystÃƒÂ¨me de Toast (Notifications)** : Le hook `useToast()` retourne un objet, pas une fonction. Ne **jamais** appeler `toast("message", "type")` directement. Il faut impÃƒÂ©rativement utiliser ses mÃƒÂ©thodes spÃƒÂ©cifiques : `toast.success("...")`, `toast.error("...")`, `toast.info("...")`, ou `toast.warning("...")`.

- **Validation des chemins de fichiers (Anti-Path-Traversal)** : Ne jamais utiliser directement un chemin de fichier fourni par l'utilisateur (req.body, req.query, etc.) pour des opÃƒÂ©rations fs ou child_process. Toujours utiliser path.resolve() pour obtenir le chemin absolu et vÃƒÂ©rifier strictement qu'il commence par le rÃƒÂ©pertoire de base autorisÃƒÂ© en utilisant resolvedPath.startsWith(allowedDir). Si le chemin sort du pÃƒÂ©rimÃƒÂ¨tre, renvoyer immÃƒÂ©diatement une erreur HTTP 403.

- **Rejet des doublons ÃƒÂ  l'upload** : Ne jamais configurer de systÃƒÂ¨me d'upload de fichiers (ex: via multer) qui ÃƒÂ©crase silencieusement un fichier existant de mÃƒÂªme nom. Avant d'ÃƒÂ©crire le fichier sur le disque, vÃƒÂ©rifier systÃƒÂ©matiquement avec fs.existsSync() si le fichier de destination existe dÃƒÂ©jÃƒÂ . Si le fichier existe, stopper l'opÃƒÂ©ration et renvoyer une erreur explicite au client.

- **Validation dans Multer** : Ne jamais utiliser cb(new Error(...)) ÃƒÂ  l'intÃƒÂ©rieur des fonctions destination ou filename de multer.diskStorage pour des rÃƒÂ¨gles mÃƒÂ©tier (comme "le fichier existe dÃƒÂ©jÃƒÂ "). Laisser multer uploader tous les fichiers dans un dossier temporaire et effectuer les vÃƒÂ©rifications mÃƒÂ©tier dans le contrÃƒÂ´leur de la route.

- **Transparence des erreurs** : Le Global Error Handler du backend doit toujours exposer le message d'erreur rÃƒÂ©el (err.message) au frontend dans le champ principal 'error' renvoyÃƒÂ© en JSON. Ne jamais masquer une erreur mÃƒÂ©tier interceptÃƒÂ©e derriÃƒÂ¨re un message gÃƒÂ©nÃƒÂ©rique statique.

- **Service Worker SPA Caching (Blank Screen Prevention)** : Ne jamais utiliser une stratÃƒÆ’Ã‚Â©gie "Cache-First" (qui retourne toujours la rÃƒÆ’Ã‚Â©ponse du cache en prioritÃƒÆ’Ã‚Â©) pour l'"index.html" d'une Single Page Application (SPA, par exemple React + Vite). Lors du dÃƒÆ’Ã‚Â©ploiement d'une nouvelle version, l'ancien HTML cherchera des bundles JS supprimÃƒÆ’Ã‚Â©s, causant un crash silencieux (ÃƒÆ’Ã‚Â©cran blanc/noir). Utiliser TOUJOURS une stratÃƒÆ’Ã‚Â©gie "Network-First" (avec fallback vers le cache) pour "index.html" afin que l'application reÃƒÆ’Ã‚Â§oive toujours la derniÃƒÆ’Ã‚Â¨re version du build.


- **DÃƒÆ’Ã‚Â©ploiement systÃƒÆ’Ã‚Â©matique (Build & Push)** : AprÃƒÆ’Ã‚Â¨s avoir terminÃƒÆ’Ã‚Â© un bloc logique de modifications sur le projet (surtout pour l'interface web), exÃƒÆ’Ã‚Â©cuter TOUJOURS "npm run build" dans le rÃƒÆ’Ã‚Â©pertoire appropriÃƒÆ’Ã‚Â©, puis crÃƒÆ’Ã‚Â©er un commit ("git commit") clair et le pousser ("git push"). Ne jamais considÃƒÆ’Ã‚Â©rer une tÃƒÆ’Ã‚Â¢che comme achevÃƒÆ’Ã‚Â©e tant que le code n'est pas compilÃƒÆ’Ã‚Â© et sauvegardÃƒÆ’Ã‚Â© sur le dÃƒÆ’Ã‚Â©pÃƒÆ’Ã‚Â´t distant.


<RULE[project_deployment]>
- **DÃƒÆ’Ã‚Â©ploiement SystÃƒÆ’Ã‚Â©matique (Build & Push)** : AprÃƒÆ’Ã‚Â¨s avoir terminÃƒÆ’Ã‚Â© un bloc logique de modifications sur le code source du projet (correction de bug, nouvelle fonctionnalitÃƒÆ’Ã‚Â©, redesign), je dois TOUJOURS :
  1. Compiler le frontend avec
pm run build dans le rÃƒÆ’Ã‚Â©pertoire appropriÃƒÆ’Ã‚Â© (interface/web).
  2. CrÃƒÆ’Ã‚Â©er un commit git descriptif avec git commit.
  3. Pousser les modifications sur le dÃƒÆ’Ã‚Â©pÃƒÆ’Ã‚Â´t avec git push.
  Ne jamais considÃƒÆ’Ã‚Â©rer une tÃƒÆ’Ã‚Â¢che de code comme terminÃƒÆ’Ã‚Â©e sans avoir exÃƒÆ’Ã‚Â©cutÃƒÆ’Ã‚Â© cette sÃƒÆ’Ã‚Â©quence.
</RULE[project_deployment]>

<RULE[project_testing]>
- **Mise ÃƒÆ’Ã‚Â  jour SystÃƒÆ’Ã‚Â©matique des Tests** : Pour chaque nouvelle fonctionnalitÃƒÆ’Ã‚Â© ajoutÃƒÆ’Ã‚Â©e ou chaque bug corrigÃƒÆ’Ã‚Â©, je dois OBLIGATOIREMENT :
  1. VÃƒÆ’Ã‚Â©rifier si un fichier de test correspondant existe (ex: NomDuComposant.test.jsx).
  2. Ajouter les tests unitaires ou d'intÃƒÆ’Ã‚Â©gration nÃƒÆ’Ã‚Â©cessaires pour couvrir la nouvelle logique ou garantir la non-rÃƒÆ’Ã‚Â©gression du bug corrigÃƒÆ’Ã‚Â©.
  3. M'assurer que les tests passent (en exÃƒÆ’Ã‚Â©cutant
pm test ou ÃƒÆ’Ã‚Â©quivalent) AVANT de dÃƒÆ’Ã‚Â©clencher la procÃƒÆ’Ã‚Â©dure de Build & Push.
  Ne jamais considÃƒÆ’Ã‚Â©rer une tÃƒÆ’Ã‚Â¢che comme terminÃƒÆ’Ã‚Â©e si le code de production a ÃƒÆ’Ã‚Â©tÃƒÆ’Ã‚Â© modifiÃƒÆ’Ã‚Â© sans les tests correspondants.
</RULE[project_testing]>

<RULE[project_h24_tasks]>
- **TÃƒÆ’Ã‚Â¢ches d'arriÃƒÆ’Ã‚Â¨re-plan H24 (Uptime)** : Si une fonctionnalitÃƒÆ’Ã‚Â© ou un agent nÃƒÆ’Ã‚Â©cessite de fonctionner 24h/24 et 7j/7 indÃƒÆ’Ã‚Â©pendamment de l'ÃƒÆ’Ã‚Â©tat du PC local (ex: agent d'audit), cette tÃƒÆ’Ã‚Â¢che DOIT ÃƒÆ’Ã‚Âªtre implÃƒÆ’Ã‚Â©mentÃƒÆ’Ã‚Â©e via un workflow CI/CD dans le Cloud (ex: **GitHub Actions** avec dÃƒÆ’Ã‚Â©clencheur cron), et non comme un processus local (Node.js ou script systÃƒÆ’Ã‚Â¨me).
</RULE[project_h24_tasks]>

<RULE[algorithmic_rigor]>
- **Rigueur Algorithmique et Machine Learning** : Lors de la conception ou de la modification de systÃƒÂ¨mes de scoring, de prÃƒÂ©diction ou de classification, privilÃƒÂ©gier SYSTÃƒâ€°MATIQUEMENT des modÃƒÂ¨les mathÃƒÂ©matiques, statistiques ou cognitifs formels (ex: InfÃƒÂ©rence BayÃƒÂ©sienne, K-Means, RÃƒÂ©gression LinÃƒÂ©aire, Z-Score, Bandits Manchots, Courbe d'Ebbinghaus) plutÃƒÂ´t que des heuristiques naÃƒÂ¯ves ("if/else" ou seuils arbitraires). Les coefficients empiriques doivent ÃƒÂªtre explicites et isolÃƒÂ©s pour pouvoir ÃƒÂªtre ajustÃƒÂ©s ultÃƒÂ©rieurement par des donnÃƒÂ©es rÃƒÂ©elles.
</RULE[algorithmic_rigor]>

<RULE[agent_architecture_immune_system]>
- **Architecture Systeme Immunitaire** : Lors de la conception d'agents d'audit ou de correction automatique, TOUJOURS adopter une architecture de type "Immune System". L'agent doit :
  1. Separer l'extraction (Scanners), la logique metier (Engine), les corrections (Fixers) et les validations (Validators).
  2. Implementer un systeme de **Rollback** (annuler la correction si la verification post-fix echoue via les tests ou la syntaxe).
  3. Utiliser un systeme d'**Escalade** formelle pour les anomalies detectees qu'il ne peut pas corriger en toute securite, plutot que de laisser des anomalies orphelines dans les rapports standards.
  4. **Anticipation post-correction (Continuous Learning)** : DÃƒÂ¨s qu'un bug complexe est rÃƒÂ©solu manuellement, le systÃƒÂ¨me immunitaire DOIT ÃƒÂªtre mis ÃƒÂ  jour immÃƒÂ©diatement avec de nouvelles rÃƒÂ¨gles (dans rules.json ou scanners.py) pour dÃƒÂ©tecter automatiquement la rÃƒÂ©gression de ce cas prÃƒÂ©cis, et pour gÃƒÂ©nÃƒÂ©raliser la dÃƒÂ©tection ÃƒÂ  des cas similaires.
  5. **ParamÃƒÂ¨tres de Confiance** : Les `fix_confidence` dans `rules.json` doivent TOUJOURS ÃƒÂªtre des entiers sur 100 (ex: `95` et non `0.95`).
  6. **Validation par les Tests** : Le systÃƒÂ¨me de validation (ex: `validators.py`) doit impÃƒÂ©rativement exÃƒÂ©cuter les tests dans le dossier exact contenant le `package.json` correspondant au fichier modifiÃƒÂ©. Ne jamais supposer que le `package.json` se trouve ÃƒÂ  la racine.
  7. **CompatibilitÃƒÂ© des Test Runners** : PrÃƒÂ©fÃƒÂ©rer les arguments positionnels (`npm test -- nomFichier`) plutÃƒÂ´t que des drapeaux spÃƒÂ©cifiques (`--testPathPattern`) pour garantir la compatibilitÃƒÂ© entre Jest et Vitest.
  8. **Bypass pour les donnÃƒÂ©es** : Les fichiers ne possÃƒÂ©dant pas de tests associÃƒÂ©s (ex: fichiers JSON ou de configuration brute) doivent automatiquement rÃƒÂ©ussir l'ÃƒÂ©tape de validation des tests pour ÃƒÂ©viter des rollbacks inutiles.
</RULE[agent_architecture_immune_system]>

<RULE[daemon_lifecycle_management]>
- **Gestion du Cycle de Vie des Processus (DÃƒÂ©mons)** : Lors de la modification du code source d'un processus s'exÃƒÂ©cutant en arriÃƒÂ¨re-plan (serveur Node.js, agent Python, etc.), il faut SYSTEMATIQUEMENT identifier l'instance en cours d'exÃƒÂ©cution (via `manage_task` ou les outils systÃƒÂ¨me) et la redÃƒÂ©marrer ou la tuer. Cela ÃƒÂ©vite les crashs fatals dus ÃƒÂ  une dÃƒÂ©synchronisation entre le code en mÃƒÂ©moire vive et les nouveaux fichiers de configuration sur le disque.
</RULE[daemon_lifecycle_management]>

<RULE[documentation_double_audience]>
- **Documentation Multi-Niveaux** : Lors de la mise Ã  jour ou de la simplification des fichiers de documentation principaux (comme README.md), il faut TOUJOURS prÃ©server les sections d'architecture technique (diagrammes, API, dÃ©ploiement). Si du contenu pour dÃ©butants ("Guide Rapide") est ajoutÃ©, il doit Ãªtre placÃ© au sommet du document sans pour autant Ã©craser les explications de bas niveau destinÃ©es aux dÃ©veloppeurs.
</RULE[documentation_double_audience]>

<RULE[agent_architecture_linters]>
- **DÃ©lÃ©gation aux Linters Standards** : Lors de la conception de systÃ¨mes d'auto-correction ou d'audit de code, ne jamais utiliser de scripts regex personnalisÃ©s. DÃ©lÃ©guer l'analyse et la correction sÃ»re aux standards de l'industrie (ESLint pour JS, Ruff/Black pour Python). L'agent personnalisÃ© doit servir d'orchestrateur (lancement, parsing de rapport JSON, rollbacks) et non de moteur d'analyse de code.
</RULE[agent_architecture_linters]>


<RULE[project_ci_cd_sync]>
- **Compilation et Push SystÃƒÂ©matique (Sync Local/Remote)** : Ãƒâ‚¬ la fin de chaque tÃƒÂ¢che de modification de code, je dois **TOUJOURS** :
  1. Compiler le code pour m'assurer qu'il ne casse rien (ex: 
pm run build dans le rÃƒÂ©pertoire appropriÃƒÂ© comme interface/web).
  2. Ajouter, commiter et pusher les modifications sur Git (git add ., git commit, git push) pour garder le dÃƒÂ©pÃƒÂ´t distant synchronisÃƒÂ© avec le local.
  3. Utiliser le format **Conventional Commits** pour les messages (ex: eat: ..., ix: ..., docs: ...).
</RULE[project_ci_cd_sync]>

<RULE[project_systematic_docs]>
- **Documentation SystÃƒÂ©matique** : Pour chaque section modifiÃƒÂ©e, ajoutÃƒÂ©e ou supprimÃƒÂ©e, je dois **SYSTÃƒâ€°MATIQUEMENT** mettre ÃƒÂ  jour la documentation du projet.
  1. La prioritÃƒÂ© est de mettre ÃƒÂ  jour les fichiers globaux existants dans le dossier docs/ (ex: rontend.md, ackend.md, devops.md).
  2. Je ne crÃƒÂ©erai de nouveaux fichiers Markdown dans docs/ que pour des trÃƒÂ¨s gros modules justifiant une sÃƒÂ©paration.
</RULE[project_systematic_docs]>

<RULE[agent_audit_backups_ignore]>
- **Exclusion des Backups (Anti Recursive-Loop)** : Tout systÃƒÂ¨me d'auto-correction (comme le SystÃƒÂ¨me Immunitaire) gÃƒÂ©nÃƒÂ©rant des sauvegardes locales (ex: gent_audit/backups/) DOIT impÃƒÂ©rativement avoir ce dossier inscrit dans le .gitignore. Cela ÃƒÂ©vite que les linters (ESLint, Ruff) ne scannent rÃƒÂ©cursivement les anciens fichiers et que l'agent ne commit des milliers de lignes de backups par erreur.
</RULE[agent_audit_backups_ignore]>

<RULE[elpis_new_features]>
- **Ajout de Nouvelles FonctionnalitÃ©s (ELPIS)** : Lors de la crÃ©ation d'un nouvel onglet ou page :
  1. Utilisez toujours `lazy` et `Suspense` dans `App.jsx` pour le Code Splitting.
  2. Enregistrez le composant dans l'arborescence existante (ne pas crÃ©er de routing complexe avec React Router, utilisez le systÃ¨me `activeTab` existant).
  3. L'Ã©tat global DOIT Ãªtre stockÃ© dans `store.js` (via `config` ou `coursConfig`) pour assurer la synchronisation PWA hors-ligne.
  4. Ajoutez le lien correspondant dans `Sidebar.jsx` (dans le groupe appropriÃ©).
  5. Ã‰vitez les bibliothÃ¨ques UI externes ; utilisez le design system de `index.css` (Glassmorphism, animations Framer Motion).
</RULE[elpis_new_features]>

<RULE[ux_full_crud]>
- **ComplÃ©tude CRUD obligatoire** : Lors de la crÃ©ation d'une fonctionnalitÃ© permettant de gÃ©rer une liste d'Ã©lÃ©ments (vidÃ©os, liens, tÃ¢ches, etc.), il est OBLIGATOIRE d'implÃ©menter l'intÃ©gralitÃ© du cycle CRUD (Create, Read, Update, Delete). Ne jamais omettre la fonctionnalitÃ© de modification (Update), mÃªme si elle n'est pas explicitement demandÃ©e par l'utilisateur, afin d'Ã©viter qu'il ne doive supprimer et recrÃ©er un Ã©lÃ©ment pour corriger une faute de frappe. PrivilÃ©gier une Ã©dition "en ligne" (inline) directement sur la carte de l'Ã©lÃ©ment pour une meilleure UX.
</RULE[ux_full_crud]>

<RULE[algo_test_completeness]>
- **Couverture de Test des Algorithmes (Anti-Regression)** : Toute crÃ©ation ou modification d'un fichier liÃ© au cÅ“ur algorithmique de l'application (ex: `store.js`, `useWorkloadEngine.js`, `fsrsEngine.js`, `sm2.js`, `GlobalChrono.jsx`) DOIT obligatoirement s'accompagner de la rÃ©daction ou de la mise Ã  jour des tests unitaires correspondants (`*.test.js(x)`) pour atteindre ou maintenir une couverture >90% sur ces fichiers spÃ©cifiques. Ne jamais laisser de branches (ex: `if (archived)`) non testÃ©es.
- **Mocking de Fetch dans Vitest** : Ne jamais laisser des appels rÃ©seau (`fetch`) natifs s'exÃ©cuter avec des URL relatives dans les tests (ce qui cause l'erreur `TypeError: Failed to parse URL from /api/...`). Assurez-vous toujours que `global.fetch` est mockÃ© dans `setupTests.js` ou dans le fichier de test via `vi.fn()`.
</RULE[algo_test_completeness]>

<RULE[algorithmic_anti_starvation]>
- **Ã‰quitÃ© Algorithmique (Anti-Starvation)** : Lors de la conception ou de la modification de systÃ¨mes d'ordonnancement (Schedulers/Orchestrateurs) qui extraient des tÃ¢ches depuis une liste ordonnÃ©e statique (ex: un fichier JSON) avec un quota ou une limite globale (ex: max tÃ¢ches par jour), ne **JAMAIS** appliquer le quota pendant la boucle d'extraction (ce qui provoque une "famine" systÃ©matique pour les Ã©lÃ©ments en fin de liste). Il faut **TOUJOURS** extraire tous les candidats valides dans un pool global, les trier ou les mÃ©langer, puis appliquer la limite uniquement lors de la phase de sÃ©lection/assignation finale.
</RULE[algorithmic_anti_starvation]>

<RULE[lmd_pils_exclusion]>
- **Exclusion des matiÃ¨res Bonus (PILS, etc.)** : Les notes ou matiÃ¨res dites "Bonus" (comme le programme PILS) ne doivent JAMAIS Ãªtre incluses dans la base de donnÃ©es (`espoir_cours.json`) ni dans les calculs de moyenne de l'application, car elles faussent la moyenne acadÃ©mique souhaitÃ©e par l'utilisateur. Toute mention de "PILS" lors de l'intÃ©gration d'un bulletin doit Ãªtre ignorÃ©e ou supprimÃ©e.
</RULE[lmd_pils_exclusion]>

<RULE[composite_virtual_ranking]>
- **Scoring des Classements Virtuels (Gamification)** : Lors de la conception de tout systÃ¨me de classement, de "leaderboard" ou de comparaison avec des Ã©tudiants virtuels, le systÃ¨me NE DOIT PAS se baser uniquement sur la moyenne acadÃ©mique. Il doit impÃ©rativement utiliser un **Score Composite** incluant : 
  1) Les notes acadÃ©miques (via `espoir_cours.json`).
  2) La constance/rÃ©tention de la mÃ©moire (via `fsrsEngine`).
  3) L'effort et la charge de travail accomplis (via `useWorkloadEngine`). 
Cela permet de rÃ©compenser la rigueur quotidienne et pas seulement la performance aux examens finaux.
</RULE[composite_virtual_ranking]>

<RULE[grade_parsing_nan_prevention]>
- **PrÃ©vention des crashs mathÃ©matiques (NaN)** : Lors du calcul de moyennes ou de scores basÃ©s sur la liste des `evaluations` dans les fichiers JSON, le systÃ¨me ne doit JAMAIS supposer que les champs `note` et `sur` sont valides. Les Ã©valuations non passÃ©es ont une `note` Ã  `null`, et le champ `sur` est souvent absent.
  Il faut **SYSTÃ‰MATIQUEMENT** :
  1. Filtrer les Ã©valuations valides : `evals.filter(ev => typeof ev.note === 'number')`
  2. Fournir une valeur par dÃ©faut de 20 au dÃ©nominateur : `(ev.sur || 20)`
  Cela empÃªchera la gÃ©nÃ©ration et la propagation de valeurs `NaN` ou `Infinity` dans l'interface.
</RULE[grade_parsing_nan_prevention]>

<RULE[fallback_note_estimee]>
- **Utilisation des Notes EstimÃ©es (Fallback IA)** : Lors du calcul de moyennes globales, de classements virtuels ou de statistiques avancÃ©es (ex: `ClassementPage.jsx`), si une matiÃ¨re ne possÃ¨de aucune note officielle valide (Ã©valuations absentes ou Ã  `null`), le systÃ¨me **DOIT TOUJOURS** tenter d'utiliser en solution de repli (fallback) la note projetÃ©e par l'IA prÃ©sente dans le store : `intelligence.projectedScoreMap[matiere.nom]`. 
  Cela permet Ã  l'Ã©tudiant de suivre ses progrÃ¨s et son rang potentiel mÃªme en dÃ©but de semestre. L'interface devra idÃ©alement prÃ©ciser visuellement que la note utilisÃ©e est "EstimÃ©e par IA".
</RULE[fallback_note_estimee]>

<RULE[cours_json_structure]>
- **Structure JSON des Cours** : Le fichier "espoir_cours.json" (ou équivalent) possède toujours un nœud racine "licences", qui contient les "semestres". Ne jamais tenter d'itérer directement sur "coursData.semestres" ou "coursData.ues" sans passer par la hiérarchie complète : "licences -> semestres -> ues -> matieres".
</RULE[cours_json_structure]>

- **Boost de Découverte (Discovery Boost)** : Ne laissez jamais les nouvelles matières s'enterrer sous le poids des matières en retard. Si une matière n'a jamais été pratiquée, elle doit recevoir un multiplicateur de priorité (ex: x2.0) pour garantir son apparition dans les plannings et forcer l'utilisateur à l'initier.

- **Unicité des Tâches (Frontend)** : Lors de la correspondance entre le résultat de l'Orchestrateur et la liste d'exercices affichée, le front-end ne doit jamais se fier uniquement au titre pour autoriser des doublons. Une tâche de l'orchestrateur ne doit correspondre qu'à une seule carte dans la Session d'Étude, même si les titres sont génériques.
- **Isolation du Boost de Découverte** : Le bonus accordé aux nouvelles matières (discoveryBoost) doit être strictement mathématique pour le score de priorité final, et ne doit pas polluer les modificateurs d'urgence (comme examBoost). Cela évite que les nouvelles matières ne contournent le filtre de parité.

<RULE[prerequisite_theory_first]>
- **Théorie avant Pratique (Prérequis CM)** : Ne jamais planifier d'exercices pratiques (TD, TP, Annales) si les fondations théoriques (CM) de la matière n'ont pas été vues au moins une fois dans leur intégralité. Le moteur d'ordonnancement doit bloquer l'assignation pratique (skip global) si le nombre de CM révisés est inférieur au nombre total de CM définis pour la matière. Si la matière ne possède aucun CM (0), la pratique est autorisée.
</RULE[prerequisite_theory_first]>

<RULE[intra_day_deprioritization]>
- **Diversité Intra-Journalière** : Si une matière a déjà été pratiquée le jour même (présente dans l'historique du jour), sa priorité pour le reste de la journée DOIT être drastiquement réduite (ex: multipliée par 0.1). Elle ne doit pas être bloquée à 100% afin de permettre du rattrapage si l'utilisateur a beaucoup de temps libre, mais elle doit laisser sa place aux autres matières dans le Top 4 quotidien.
</RULE[intra_day_deprioritization]>

<RULE[guaranteed_discovery]>
- **Garantie de Découverte (Anti-Starvation)** : Le simple multiplicateur de "Découverte" (x2.0) est souvent écrasé par l'urgence des examens (Annales). Pour garantir qu'aucune matière ne soit laissée de côté indéfiniment, le système de sélection des matières (Top N subjects) DOIT systématiquement forcer l'inclusion d'au moins 1 matière "Nouvelle" (jamais pratiquée) si elle est disponible dans le pool d'exercices, et ce, peu importe son score de priorité par rapport aux autres.
</RULE[guaranteed_discovery]>

<RULE[annales_practice_limit]>
- **Plafond de Maîtrise des Annales** : Les Annales sont des exercices cruciaux, mais leur répétition ne doit pas être infinie. Si une Annale a été pratiquée 3 fois ou plus (`nombrePratiques >= 3`), elle DOIT être considérée comme "totalement acquise" et retirée définitivement du pool des propositions, sauf si une urgence absolue l'exige. Cela permet de forcer la rotation vers d'autres exercices ou de nouvelles matières.
</RULE[annales_practice_limit]>

<RULE[annales_weekly_cooldown]>
- **Espacement des Annales (Cooldown de 7 jours)** : Une fois qu'une Annale a été pratiquée, elle entre dans une période de "repos" stricte de 7 jours glissants. Durant cette fenêtre, elle ne doit **pas** être reproposée (sauf urgence d'examen, ex: examen dans moins de 21 jours). Cela permet d'étaler la charge de travail et d'éviter qu'une même annale sature le planning de la semaine.
</RULE[annales_weekly_cooldown]>
</RULE[annales_weekly_cooldown]>

<RULE[documentation_systematique_v2]>
- **Documentation SystÃ©matique (Projet ELPIS V2)** : Pour Ã©viter l'Ã©cueil du projet ELPIS V1 (80k lignes non documentÃ©es), une rigueur absolue est exigÃ©e pour la documentation d'ELPIS V2. L'agent DOIT maintenir un dossier documentation Ã  la racine du projet ELPIS_V2. Ã€ la fin de chaque session de travail ou de chaque implÃ©mentation de fonctionnalitÃ© importante, l'agent DOIT rÃ©diger ou mettre Ã  jour un fichier de documentation. La documentation doit Ãªtre hyper-prÃ©cise et vulgarisÃ©e de maniÃ¨re Ã  ce qu'un dÃ©veloppeur novice puisse comprendre l'architecture, les choix techniques et reproduire le fonctionnement sans Ãªtre perdu. Chaque modification doit Ãªtre tracÃ©e, expliquÃ©e et documentÃ©e.
</RULE[documentation_systematique_v2]>

<RULE[compilation_check_frontend]>
- **VÃ©rification de la Compilation (Frontend)** : Lors de la modification de code frontend (particuliÃ¨rement dans un environnement React / Vite), ne considÃ©rez jamais une tÃ¢che comme achevÃ©e uniquement parce que les tests unitaires passent. Vous DEVEZ impÃ©rativement lancer la commande de compilation pour la production (ex: npm run build) afin de vÃ©rifier qu'aucune erreur de bundling ou d'import dynamique n'a Ã©tÃ© introduite.
</RULE[compilation_check_frontend]>

<RULE[long_task_intermediate_states]>
- **Tâches Longues et États Intermédiaires** : Lors de l'ajout ou modification de fonctionnalités liées aux tâches dans ELPIS, prévoir systématiquement un état "suspendu/en cours" pour les tâches qui peuvent dépasser 30 minutes. Toujours enregistrer le temps de travail partiel dans l'historique, même en cas de suspension. Utiliser `prochaineRevisionDate` pour forcer la replanification d'une tâche suspendue au lendemain. Ne jamais modifier l'état FSRS d'un CM qui n'a pas été entièrement révisé.
</RULE[long_task_intermediate_states]>

<RULE[singleton_db_hmr]>
- **Singleton Database HMR (Prévention DB9)** : Lors de l'initialisation de bases de données locales ou de singletons lourds (comme RxDB, Prisma, Dexie) dans un environnement Vite ou React, il faut TOUJOURS mettre en cache l'instance globale sur l'objet `window` ou `globalThis` (ex: `window.__myDbPromise = dbPromise`). Cela empêche le Hot Module Replacement (HMR) de recréer de multiples instances concurrentes lors de la sauvegarde d'un fichier, ce qui provoque des crashs (ex: RxDB Error DB9) et des pertes temporaires de données.
</RULE[singleton_db_hmr]>

<RULE[singleton_lazy_loading]>
- **Singletons & Vite Lazy Loading (Race Condition)** : Lors de la création de promesses ou d'instances uniques globales (comme `dbPromise` pour RxDB) exposées via un module, ne jamais se contenter d'initialiser la variable au niveau du module (`let dbPromise = window.myPromise`). Il faut IMPÉRATIVEMENT vérifier la présence de l'instance dans le scope global (`window`) à l'intérieur de la fonction getter elle-même (`getDb()`). Cela empêche les instanciations parallèles lors du Lazy Loading ou du HMR de Vite, qui peuvent dupliquer temporairement l'état des modules.
</RULE[singleton_lazy_loading]>
 
 < R U L E [ r x d b _ d b 9 _ p r e v e n t i o n ] >  
 -   * * P r � v e n t i o n   R x D B   D B 9   ( P r o d u c t i o n ) * *   :   D a n s   R x D B   ( s p � c i a l e m e n t   v 1 5 + ) ,   n e   J A M A I S   f o r c e r   \ i g n o r e D u p l i c a t e :   t r u e \   d a n s   l ' e n v i r o n n e m e n t   d e   p r o d u c t i o n .   S i   c e   p a r a m � t r e   e s t   a c t i v �   a l o r s   q u e   l e   p l u g i n   D e v M o d e   d e   R x D B   n ' e s t   p a s   c h a r g � ,   R x D B   l a n c e r a   v o l o n t a i r e m e n t   u n e   e x c e p t i o n   f a t a l e   \ R x E r r o r   ( D B 9 ) \   b l o q u a n t   l ' i n i t i a l i s a t i o n   d e   l a   b a s e   d e   d o n n � e s .   I l   f a u t   t o u j o u r s   u t i l i s e r   \ i g n o r e D u p l i c a t e :   f a l s e \   e n   p r o d u c t i o n   e t   g � r e r   l ' u n i c i t �   d e   l ' i n s t a n c e   ( e x :   v i a   \ w i n d o w . _ _ e l p i s D b P r o m i s e \ ) .  
 < / R U L E [ r x d b _ d b 9 _ p r e v e n t i o n ] >  
  
 < R U L E [ c l o u d _ s y n c _ s a f e t y ] >  
 -   * * S � c u r i t �   d e   S y n c h r o n i s a t i o n   C l o u d   ( A n t i - W i p e ) * *   :   L o r s   d e   l a   s y n c h r o n i s a t i o n   d e s c e n d a n t e   d e p u i s   l e   C l o u d   ( M o n g o D B )   v e r s   l e s   f i c h i e r s   l o c a u x   d e   s a u v e g a r d e   ( \ e s p o i r _ c o n f i g . j s o n \ ,   e t c . ) ,   i l   f a u t   S Y S T � M A T I Q U E M E N T   v � r i f i e r   q u e   l e   d o c u m e n t   r � c u p � r �   n ' e s t   p a s   v i d e   ( e x :   \ O b j e c t . k e y s ( d o c . d a t a ) . l e n g t h   >   0 \   o u   \ A r r a y . i s A r r a y ( d o c . d a t a )   & &   d o c . d a t a . l e n g t h   >   0 \ )   A V A N T   d ' � c r a s e r   l e   f i c h i e r   l o c a l .   C e l a   � v i t e   q u ' u n e   b a s e   d e   d o n n � e s   C l o u d   c o r r o m p u e   o u   r � i n i t i a l i s � e   n ' � c r a s e   s i l e n c i e u s e m e n t   l a   p r o g r e s s i o n   l o c a l e   d e   l ' � t u d i a n t .  
 < / R U L E [ c l o u d _ s y n c _ s a f e t y ] >  
 