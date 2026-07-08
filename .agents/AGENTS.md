# RÃƒÂ¨gles de projet pour ELPIS

- Pour ce projet systÃƒÂ©matiquement, ÃƒÂ  la fin de chaque tÃƒÂ¢che ou de chaque modification importante, il faut **pousser les modifications sur Github** (`git add .`, `git commit -m "..."`, `git push`).
- Ensuite, il faut systÃƒÂ©matiquement **compiler les modifications** pour l'application en ligne et locale (par exemple en exÃƒÂ©cutant `npm run build` dans le dossier `interface/web`).
- L'objectif est d'assurer que l'utilisateur dispose toujours de la version la plus rÃƒÂ©cente et fonctionnelle ÃƒÂ  la fois en ligne et en local.
- **CrÃƒÂ©ation de tests anti-rÃƒÂ©gression** : SystÃƒÂ©matiquement, lorsque tu vas repÃƒÂ©rer et corriger un bug, **ou dÃƒÂ©velopper une nouvelle fonctionnalitÃƒÂ© / un nouveau composant**, il faudra au final crÃƒÂ©er ou mettre ÃƒÂ  jour les tests unitaires (anti-rÃƒÂ©gression) pour garantir une couverture de code continue et prÃƒÂ©venir la rÃƒÂ©apparition de bugs.
- **Performance React & Zustand** : Ne jamais placer d'ÃƒÂ©tats ÃƒÂ  haute frÃƒÂ©quence de mise ÃƒÂ  jour (ex: chronomÃƒÂ¨tre, compteurs rapides, positionnement souris) dans le store global (`useStore`). Ils doivent impÃƒÂ©rativement ÃƒÂªtre isolÃƒÂ©s dans leur propre store Zustand dÃƒÂ©diÃƒÂ© (ex: `useChronoStore`) pour ÃƒÂ©viter des re-rendus massifs et non dÃƒÂ©sirÃƒÂ©s sur l'ensemble de l'application.
- **Time-Awareness (Conscience du Temps RÃƒÂ©el)** : Ne jamais utiliser de rÃƒÂ©partitions temporelles statiques ou purement sÃƒÂ©quentielles pour la planification de tÃƒÂ¢ches (ex: "Matin", "AprÃƒÂ¨s-midi", "Soir"). Les algorithmes d'orchestration et les interfaces utilisateur doivent impÃƒÂ©rativement vÃƒÂ©rifier l'heure locale actuelle (`new Date().getHours()`) pour assigner ou filtrer dynamiquement ces ÃƒÂ©tiquettes. Si l'utilisateur se connecte ÃƒÂ  15h, le systÃƒÂ¨me ne doit plus proposer de tÃƒÂ¢ches pour le "Matin".
- **Moyenne Universitaire ECTS** : Toujours utiliser une moyenne pondÃƒÂ©rÃƒÂ©e par les crÃƒÂ©dits ECTS pour calculer les moyennes globales (semestres, annÃƒÂ©es, ou cycle entier), conformÃƒÂ©ment au standard LMD europÃƒÂ©en. Ne jamais utiliser de moyenne arithmÃƒÂ©tique simple entre les semestres ou les annÃƒÂ©es pour un score global.
- **Mise ÃƒÂ  jour de la Streak (Gamification)** : La streak (jours consÃƒÂ©cutifs d'ÃƒÂ©tude) ne doit s'incrÃƒÂ©menter QUE lorsqu'une activitÃƒÂ© est rÃƒÂ©ellement effectuÃƒÂ©e et ajoutÃƒÂ©e ÃƒÂ  l'historique de l'utilisateur. L'ouverture de l'application ne doit jamais incrÃƒÂ©menter la streak, mais doit seulement servir ÃƒÂ  vÃƒÂ©rifier si le joueur l'a perdue (plus d'un jour d'absence) afin de la remettre ÃƒÂ  0.
- **Archivage Granulaire & Automatique** : L'historique d'un ÃƒÂ©tudiant doit pouvoir ÃƒÂªtre archivÃƒÂ© de faÃƒÂ§on granulaire (ex: `s.archived` au niveau du semestre, ou `l.archived` au niveau de la licence) pour ne pas fausser le calcul de la Cible IA ni l'Orchestrateur. De plus, chaque semestre peut possÃƒÂ©der une date de fin (`s.dateFin`) permettant au systÃƒÂ¨me de l'ignorer automatiquement une fois cette date dÃƒÂ©passÃƒÂ©e, sans intervention manuelle de l'utilisateur.

- **SystÃ¨me de Toast (Notifications)** : Le hook `useToast()` retourne un objet, pas une fonction. Ne **jamais** appeler `toast("message", "type")` directement. Il faut impÃ©rativement utiliser ses mÃ©thodes spÃ©cifiques : `toast.success("...")`, `toast.error("...")`, `toast.info("...")`, ou `toast.warning("...")`.

- **Validation des chemins de fichiers (Anti-Path-Traversal)** : Ne jamais utiliser directement un chemin de fichier fourni par l'utilisateur (req.body, req.query, etc.) pour des opÃ©rations fs ou child_process. Toujours utiliser path.resolve() pour obtenir le chemin absolu et vÃ©rifier strictement qu'il commence par le rÃ©pertoire de base autorisÃ© en utilisant resolvedPath.startsWith(allowedDir). Si le chemin sort du pÃ©rimÃ¨tre, renvoyer immÃ©diatement une erreur HTTP 403.

- **Rejet des doublons Ã  l'upload** : Ne jamais configurer de systÃ¨me d'upload de fichiers (ex: via multer) qui Ã©crase silencieusement un fichier existant de mÃªme nom. Avant d'Ã©crire le fichier sur le disque, vÃ©rifier systÃ©matiquement avec fs.existsSync() si le fichier de destination existe dÃ©jÃ . Si le fichier existe, stopper l'opÃ©ration et renvoyer une erreur explicite au client.

- **Validation dans Multer** : Ne jamais utiliser cb(new Error(...)) Ã  l'intÃ©rieur des fonctions destination ou filename de multer.diskStorage pour des rÃ¨gles mÃ©tier (comme "le fichier existe dÃ©jÃ "). Laisser multer uploader tous les fichiers dans un dossier temporaire et effectuer les vÃ©rifications mÃ©tier dans le contrÃ´leur de la route.

- **Transparence des erreurs** : Le Global Error Handler du backend doit toujours exposer le message d'erreur rÃ©el (err.message) au frontend dans le champ principal 'error' renvoyÃ© en JSON. Ne jamais masquer une erreur mÃ©tier interceptÃ©e derriÃ¨re un message gÃ©nÃ©rique statique.

- **Service Worker SPA Caching (Blank Screen Prevention)** : Ne jamais utiliser une stratÃƒÂ©gie "Cache-First" (qui retourne toujours la rÃƒÂ©ponse du cache en prioritÃƒÂ©) pour l'"index.html" d'une Single Page Application (SPA, par exemple React + Vite). Lors du dÃƒÂ©ploiement d'une nouvelle version, l'ancien HTML cherchera des bundles JS supprimÃƒÂ©s, causant un crash silencieux (ÃƒÂ©cran blanc/noir). Utiliser TOUJOURS une stratÃƒÂ©gie "Network-First" (avec fallback vers le cache) pour "index.html" afin que l'application reÃƒÂ§oive toujours la derniÃƒÂ¨re version du build.


- **DÃƒÂ©ploiement systÃƒÂ©matique (Build & Push)** : AprÃƒÂ¨s avoir terminÃƒÂ© un bloc logique de modifications sur le projet (surtout pour l'interface web), exÃƒÂ©cuter TOUJOURS "npm run build" dans le rÃƒÂ©pertoire appropriÃƒÂ©, puis crÃƒÂ©er un commit ("git commit") clair et le pousser ("git push"). Ne jamais considÃƒÂ©rer une tÃƒÂ¢che comme achevÃƒÂ©e tant que le code n'est pas compilÃƒÂ© et sauvegardÃƒÂ© sur le dÃƒÂ©pÃƒÂ´t distant.


<RULE[project_deployment]>
- **DÃƒÂ©ploiement SystÃƒÂ©matique (Build & Push)** : AprÃƒÂ¨s avoir terminÃƒÂ© un bloc logique de modifications sur le code source du projet (correction de bug, nouvelle fonctionnalitÃƒÂ©, redesign), je dois TOUJOURS :
  1. Compiler le frontend avec
pm run build dans le rÃƒÂ©pertoire appropriÃƒÂ© (interface/web).
  2. CrÃƒÂ©er un commit git descriptif avec git commit.
  3. Pousser les modifications sur le dÃƒÂ©pÃƒÂ´t avec git push.
  Ne jamais considÃƒÂ©rer une tÃƒÂ¢che de code comme terminÃƒÂ©e sans avoir exÃƒÂ©cutÃƒÂ© cette sÃƒÂ©quence.
</RULE[project_deployment]>

<RULE[project_testing]>
- **Mise ÃƒÂ  jour SystÃƒÂ©matique des Tests** : Pour chaque nouvelle fonctionnalitÃƒÂ© ajoutÃƒÂ©e ou chaque bug corrigÃƒÂ©, je dois OBLIGATOIREMENT :
  1. VÃƒÂ©rifier si un fichier de test correspondant existe (ex: NomDuComposant.test.jsx).
  2. Ajouter les tests unitaires ou d'intÃƒÂ©gration nÃƒÂ©cessaires pour couvrir la nouvelle logique ou garantir la non-rÃƒÂ©gression du bug corrigÃƒÂ©.
  3. M'assurer que les tests passent (en exÃƒÂ©cutant
pm test ou ÃƒÂ©quivalent) AVANT de dÃƒÂ©clencher la procÃƒÂ©dure de Build & Push.
  Ne jamais considÃƒÂ©rer une tÃƒÂ¢che comme terminÃƒÂ©e si le code de production a ÃƒÂ©tÃƒÂ© modifiÃƒÂ© sans les tests correspondants.
</RULE[project_testing]>

<RULE[project_h24_tasks]>
- **TÃƒÂ¢ches d'arriÃƒÂ¨re-plan H24 (Uptime)** : Si une fonctionnalitÃƒÂ© ou un agent nÃƒÂ©cessite de fonctionner 24h/24 et 7j/7 indÃƒÂ©pendamment de l'ÃƒÂ©tat du PC local (ex: agent d'audit), cette tÃƒÂ¢che DOIT ÃƒÂªtre implÃƒÂ©mentÃƒÂ©e via un workflow CI/CD dans le Cloud (ex: **GitHub Actions** avec dÃƒÂ©clencheur cron), et non comme un processus local (Node.js ou script systÃƒÂ¨me).
</RULE[project_h24_tasks]>

<RULE[algorithmic_rigor]>
- **Rigueur Algorithmique et Machine Learning** : Lors de la conception ou de la modification de systÃ¨mes de scoring, de prÃ©diction ou de classification, privilÃ©gier SYSTÃ‰MATIQUEMENT des modÃ¨les mathÃ©matiques, statistiques ou cognitifs formels (ex: InfÃ©rence BayÃ©sienne, K-Means, RÃ©gression LinÃ©aire, Z-Score, Bandits Manchots, Courbe d'Ebbinghaus) plutÃ´t que des heuristiques naÃ¯ves ("if/else" ou seuils arbitraires). Les coefficients empiriques doivent Ãªtre explicites et isolÃ©s pour pouvoir Ãªtre ajustÃ©s ultÃ©rieurement par des donnÃ©es rÃ©elles.
</RULE[algorithmic_rigor]>

<RULE[agent_architecture_immune_system]>
- **Architecture Systeme Immunitaire** : Lors de la conception d'agents d'audit ou de correction automatique, TOUJOURS adopter une architecture de type "Immune System". L'agent doit :
  1. Separer l'extraction (Scanners), la logique metier (Engine), les corrections (Fixers) et les validations (Validators).
  2. Implementer un systeme de **Rollback** (annuler la correction si la verification post-fix echoue via les tests ou la syntaxe).
  3. Utiliser un systeme d'**Escalade** formelle pour les anomalies detectees qu'il ne peut pas corriger en toute securite, plutot que de laisser des anomalies orphelines dans les rapports standards.
  4. **Anticipation post-correction (Continuous Learning)** : DÃ¨s qu'un bug complexe est rÃ©solu manuellement, le systÃ¨me immunitaire DOIT Ãªtre mis Ã  jour immÃ©diatement avec de nouvelles rÃ¨gles (dans rules.json ou scanners.py) pour dÃ©tecter automatiquement la rÃ©gression de ce cas prÃ©cis, et pour gÃ©nÃ©raliser la dÃ©tection Ã  des cas similaires.
  5. **ParamÃ¨tres de Confiance** : Les `fix_confidence` dans `rules.json` doivent TOUJOURS Ãªtre des entiers sur 100 (ex: `95` et non `0.95`).
  6. **Validation par les Tests** : Le systÃ¨me de validation (ex: `validators.py`) doit impÃ©rativement exÃ©cuter les tests dans le dossier exact contenant le `package.json` correspondant au fichier modifiÃ©. Ne jamais supposer que le `package.json` se trouve Ã  la racine.
  7. **CompatibilitÃ© des Test Runners** : PrÃ©fÃ©rer les arguments positionnels (`npm test -- nomFichier`) plutÃ´t que des drapeaux spÃ©cifiques (`--testPathPattern`) pour garantir la compatibilitÃ© entre Jest et Vitest.
  8. **Bypass pour les donnÃ©es** : Les fichiers ne possÃ©dant pas de tests associÃ©s (ex: fichiers JSON ou de configuration brute) doivent automatiquement rÃ©ussir l'Ã©tape de validation des tests pour Ã©viter des rollbacks inutiles.
</RULE[agent_architecture_immune_system]>

<RULE[daemon_lifecycle_management]>
- **Gestion du Cycle de Vie des Processus (DÃ©mons)** : Lors de la modification du code source d'un processus s'exÃ©cutant en arriÃ¨re-plan (serveur Node.js, agent Python, etc.), il faut SYSTEMATIQUEMENT identifier l'instance en cours d'exÃ©cution (via `manage_task` ou les outils systÃ¨me) et la redÃ©marrer ou la tuer. Cela Ã©vite les crashs fatals dus Ã  une dÃ©synchronisation entre le code en mÃ©moire vive et les nouveaux fichiers de configuration sur le disque.
</RULE[daemon_lifecycle_management]>

<RULE[documentation_double_audience]>
- **Documentation Multi-Niveaux** : Lors de la mise à jour ou de la simplification des fichiers de documentation principaux (comme README.md), il faut TOUJOURS préserver les sections d'architecture technique (diagrammes, API, déploiement). Si du contenu pour débutants ("Guide Rapide") est ajouté, il doit être placé au sommet du document sans pour autant écraser les explications de bas niveau destinées aux développeurs.
</RULE[documentation_double_audience]>

<RULE[agent_architecture_linters]>
- **Délégation aux Linters Standards** : Lors de la conception de systèmes d'auto-correction ou d'audit de code, ne jamais utiliser de scripts regex personnalisés. Déléguer l'analyse et la correction sûre aux standards de l'industrie (ESLint pour JS, Ruff/Black pour Python). L'agent personnalisé doit servir d'orchestrateur (lancement, parsing de rapport JSON, rollbacks) et non de moteur d'analyse de code.
</RULE[agent_architecture_linters]>


<RULE[project_ci_cd_sync]>
- **Compilation et Push SystÃ©matique (Sync Local/Remote)** : Ã€ la fin de chaque tÃ¢che de modification de code, je dois **TOUJOURS** :
  1. Compiler le code pour m'assurer qu'il ne casse rien (ex: 
pm run build dans le rÃ©pertoire appropriÃ© comme interface/web).
  2. Ajouter, commiter et pusher les modifications sur Git (git add ., git commit, git push) pour garder le dÃ©pÃ´t distant synchronisÃ© avec le local.
  3. Utiliser le format **Conventional Commits** pour les messages (ex: eat: ..., ix: ..., docs: ...).
</RULE[project_ci_cd_sync]>

<RULE[project_systematic_docs]>
- **Documentation SystÃ©matique** : Pour chaque section modifiÃ©e, ajoutÃ©e ou supprimÃ©e, je dois **SYSTÃ‰MATIQUEMENT** mettre Ã  jour la documentation du projet.
  1. La prioritÃ© est de mettre Ã  jour les fichiers globaux existants dans le dossier docs/ (ex: rontend.md, ackend.md, devops.md).
  2. Je ne crÃ©erai de nouveaux fichiers Markdown dans docs/ que pour des trÃ¨s gros modules justifiant une sÃ©paration.
</RULE[project_systematic_docs]>

<RULE[agent_audit_backups_ignore]>
- **Exclusion des Backups (Anti Recursive-Loop)** : Tout systÃ¨me d'auto-correction (comme le SystÃ¨me Immunitaire) gÃ©nÃ©rant des sauvegardes locales (ex: gent_audit/backups/) DOIT impÃ©rativement avoir ce dossier inscrit dans le .gitignore. Cela Ã©vite que les linters (ESLint, Ruff) ne scannent rÃ©cursivement les anciens fichiers et que l'agent ne commit des milliers de lignes de backups par erreur.
</RULE[agent_audit_backups_ignore]>

<RULE[elpis_new_features]>
- **Ajout de Nouvelles Fonctionnalités (ELPIS)** : Lors de la création d'un nouvel onglet ou page :
  1. Utilisez toujours `lazy` et `Suspense` dans `App.jsx` pour le Code Splitting.
  2. Enregistrez le composant dans l'arborescence existante (ne pas créer de routing complexe avec React Router, utilisez le système `activeTab` existant).
  3. L'état global DOIT être stocké dans `store.js` (via `config` ou `coursConfig`) pour assurer la synchronisation PWA hors-ligne.
  4. Ajoutez le lien correspondant dans `Sidebar.jsx` (dans le groupe approprié).
  5. Évitez les bibliothèques UI externes ; utilisez le design system de `index.css` (Glassmorphism, animations Framer Motion).
</RULE[elpis_new_features]>

<RULE[ux_full_crud]>
- **Complétude CRUD obligatoire** : Lors de la création d'une fonctionnalité permettant de gérer une liste d'éléments (vidéos, liens, tâches, etc.), il est OBLIGATOIRE d'implémenter l'intégralité du cycle CRUD (Create, Read, Update, Delete). Ne jamais omettre la fonctionnalité de modification (Update), même si elle n'est pas explicitement demandée par l'utilisateur, afin d'éviter qu'il ne doive supprimer et recréer un élément pour corriger une faute de frappe. Privilégier une édition "en ligne" (inline) directement sur la carte de l'élément pour une meilleure UX.
</RULE[ux_full_crud]>

<RULE[algo_test_completeness]>
- **Couverture de Test des Algorithmes (Anti-Regression)** : Toute création ou modification d'un fichier lié au cœur algorithmique de l'application (ex: `store.js`, `useWorkloadEngine.js`, `fsrsEngine.js`, `sm2.js`, `GlobalChrono.jsx`) DOIT obligatoirement s'accompagner de la rédaction ou de la mise à jour des tests unitaires correspondants (`*.test.js(x)`) pour atteindre ou maintenir une couverture >90% sur ces fichiers spécifiques. Ne jamais laisser de branches (ex: `if (archived)`) non testées.
- **Mocking de Fetch dans Vitest** : Ne jamais laisser des appels réseau (`fetch`) natifs s'exécuter avec des URL relatives dans les tests (ce qui cause l'erreur `TypeError: Failed to parse URL from /api/...`). Assurez-vous toujours que `global.fetch` est mocké dans `setupTests.js` ou dans le fichier de test via `vi.fn()`.
</RULE[algo_test_completeness]>

<RULE[algorithmic_anti_starvation]>
- **Équité Algorithmique (Anti-Starvation)** : Lors de la conception ou de la modification de systèmes d'ordonnancement (Schedulers/Orchestrateurs) qui extraient des tâches depuis une liste ordonnée statique (ex: un fichier JSON) avec un quota ou une limite globale (ex: max tâches par jour), ne **JAMAIS** appliquer le quota pendant la boucle d'extraction (ce qui provoque une "famine" systématique pour les éléments en fin de liste). Il faut **TOUJOURS** extraire tous les candidats valides dans un pool global, les trier ou les mélanger, puis appliquer la limite uniquement lors de la phase de sélection/assignation finale.
</RULE[algorithmic_anti_starvation]>
 
 < R U L E [ l m d _ b o n u s _ c o e f f i c i e n t s ] >  
 -   * * G e s t i o n   d e s   p o i n t s   b o n u s   u n i v e r s i t a i r e s   ( P I L S ,   e t c . ) * *   :   L o r s   d e   l ' i n t � � g r a t i o n   o u   d u   t r a i t e m e n t   d e s   n o t e s   d a n s   l e   s y s t � � m e   L M D ,   l e s   m a t i � � r e s   o u   � � p r e u v e s   d � � f i n i e s   c o m m e   " b o n u s "   ( e x :   P I L S )   d o i v e n t   T O U J O U R S   a v o i r   u n   ` c o e f f i c i e n t :   0 `   d a n s   l a   b a s e   d e   d o n n � � e s   ( ` e s p o i r _ c o u r s . j s o n ` ) .   L e s   m o t e u r s   d e   c a l c u l   d e   m o y e n n e   ( e x :   ` B u l l e t i n P a g e . j s x ` )   d o i v e n t   a j o u t e r   l a   m o y e n n e   d e   c e s   m a t i � � r e s   d i r e c t e m e n t   a u   t o t a l   d e   l ' U E   f i n a l e   a p r � � s   d i v i s i o n ,   s a n s   i n c r � � m e n t e r   l e   p o i d s   t o t a l .  
 < / R U L E [ l m d _ b o n u s _ c o e f f i c i e n t s ] >  
 