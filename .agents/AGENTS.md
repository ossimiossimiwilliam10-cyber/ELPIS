# RÃ¨gles de projet pour ELPIS

- Pour ce projet systÃ©matiquement, Ã  la fin de chaque tÃ¢che ou de chaque modification importante, il faut **pousser les modifications sur Github** (`git add .`, `git commit -m "..."`, `git push`).
- Ensuite, il faut systÃ©matiquement **compiler les modifications** pour l'application en ligne et locale (par exemple en exÃ©cutant `npm run build` dans le dossier `interface/web`).
- L'objectif est d'assurer que l'utilisateur dispose toujours de la version la plus rÃ©cente et fonctionnelle Ã  la fois en ligne et en local.
- **CrÃ©ation de tests anti-rÃ©gression** : SystÃ©matiquement, lorsque tu vas repÃ©rer et corriger un bug, **ou dÃ©velopper une nouvelle fonctionnalitÃ© / un nouveau composant**, il faudra au final crÃ©er ou mettre Ã  jour les tests unitaires (anti-rÃ©gression) pour garantir une couverture de code continue et prÃ©venir la rÃ©apparition de bugs.
- **Performance React & Zustand** : Ne jamais placer d'Ã©tats Ã  haute frÃ©quence de mise Ã  jour (ex: chronomÃ¨tre, compteurs rapides, positionnement souris) dans le store global (`useStore`). Ils doivent impÃ©rativement Ãªtre isolÃ©s dans leur propre store Zustand dÃ©diÃ© (ex: `useChronoStore`) pour Ã©viter des re-rendus massifs et non dÃ©sirÃ©s sur l'ensemble de l'application.
- **Time-Awareness (Conscience du Temps RÃ©el)** : Ne jamais utiliser de rÃ©partitions temporelles statiques ou purement sÃ©quentielles pour la planification de tÃ¢ches (ex: "Matin", "AprÃ¨s-midi", "Soir"). Les algorithmes d'orchestration et les interfaces utilisateur doivent impÃ©rativement vÃ©rifier l'heure locale actuelle (`new Date().getHours()`) pour assigner ou filtrer dynamiquement ces Ã©tiquettes. Si l'utilisateur se connecte Ã  15h, le systÃ¨me ne doit plus proposer de tÃ¢ches pour le "Matin".
- **Moyenne Universitaire ECTS** : Toujours utiliser une moyenne pondÃ©rÃ©e par les crÃ©dits ECTS pour calculer les moyennes globales (semestres, annÃ©es, ou cycle entier), conformÃ©ment au standard LMD europÃ©en. Ne jamais utiliser de moyenne arithmÃ©tique simple entre les semestres ou les annÃ©es pour un score global.
- **Mise Ã  jour de la Streak (Gamification)** : La streak (jours consÃ©cutifs d'Ã©tude) ne doit s'incrÃ©menter QUE lorsqu'une activitÃ© est rÃ©ellement effectuÃ©e et ajoutÃ©e Ã  l'historique de l'utilisateur. L'ouverture de l'application ne doit jamais incrÃ©menter la streak, mais doit seulement servir Ã  vÃ©rifier si le joueur l'a perdue (plus d'un jour d'absence) afin de la remettre Ã  0.
- **Archivage Granulaire & Automatique** : L'historique d'un Ã©tudiant doit pouvoir Ãªtre archivÃ© de faÃ§on granulaire (ex: `s.archived` au niveau du semestre, ou `l.archived` au niveau de la licence) pour ne pas fausser le calcul de la Cible IA ni l'Orchestrateur. De plus, chaque semestre peut possÃ©der une date de fin (`s.dateFin`) permettant au systÃ¨me de l'ignorer automatiquement une fois cette date dÃ©passÃ©e, sans intervention manuelle de l'utilisateur.

- **Système de Toast (Notifications)** : Le hook `useToast()` retourne un objet, pas une fonction. Ne **jamais** appeler `toast("message", "type")` directement. Il faut impérativement utiliser ses méthodes spécifiques : `toast.success("...")`, `toast.error("...")`, `toast.info("...")`, ou `toast.warning("...")`.

- **Validation des chemins de fichiers (Anti-Path-Traversal)** : Ne jamais utiliser directement un chemin de fichier fourni par l'utilisateur (req.body, req.query, etc.) pour des opérations fs ou child_process. Toujours utiliser path.resolve() pour obtenir le chemin absolu et vérifier strictement qu'il commence par le répertoire de base autorisé en utilisant resolvedPath.startsWith(allowedDir). Si le chemin sort du périmètre, renvoyer immédiatement une erreur HTTP 403.

- **Rejet des doublons à l'upload** : Ne jamais configurer de système d'upload de fichiers (ex: via multer) qui écrase silencieusement un fichier existant de même nom. Avant d'écrire le fichier sur le disque, vérifier systématiquement avec fs.existsSync() si le fichier de destination existe déjà. Si le fichier existe, stopper l'opération et renvoyer une erreur explicite au client.

- **Validation dans Multer** : Ne jamais utiliser cb(new Error(...)) à l'intérieur des fonctions destination ou filename de multer.diskStorage pour des règles métier (comme "le fichier existe déjà"). Laisser multer uploader tous les fichiers dans un dossier temporaire et effectuer les vérifications métier dans le contrôleur de la route.

- **Transparence des erreurs** : Le Global Error Handler du backend doit toujours exposer le message d'erreur réel (err.message) au frontend dans le champ principal 'error' renvoyé en JSON. Ne jamais masquer une erreur métier interceptée derrière un message générique statique.

- **Service Worker SPA Caching (Blank Screen Prevention)** : Ne jamais utiliser une stratÃ©gie "Cache-First" (qui retourne toujours la rÃ©ponse du cache en prioritÃ©) pour l'"index.html" d'une Single Page Application (SPA, par exemple React + Vite). Lors du dÃ©ploiement d'une nouvelle version, l'ancien HTML cherchera des bundles JS supprimÃ©s, causant un crash silencieux (Ã©cran blanc/noir). Utiliser TOUJOURS une stratÃ©gie "Network-First" (avec fallback vers le cache) pour "index.html" afin que l'application reÃ§oive toujours la derniÃ¨re version du build.


- **DÃ©ploiement systÃ©matique (Build & Push)** : AprÃ¨s avoir terminÃ© un bloc logique de modifications sur le projet (surtout pour l'interface web), exÃ©cuter TOUJOURS "npm run build" dans le rÃ©pertoire appropriÃ©, puis crÃ©er un commit ("git commit") clair et le pousser ("git push"). Ne jamais considÃ©rer une tÃ¢che comme achevÃ©e tant que le code n'est pas compilÃ© et sauvegardÃ© sur le dÃ©pÃ´t distant.


<RULE[project_deployment]>
- **DÃ©ploiement SystÃ©matique (Build & Push)** : AprÃ¨s avoir terminÃ© un bloc logique de modifications sur le code source du projet (correction de bug, nouvelle fonctionnalitÃ©, redesign), je dois TOUJOURS :
  1. Compiler le frontend avec
pm run build dans le rÃ©pertoire appropriÃ© (interface/web).
  2. CrÃ©er un commit git descriptif avec git commit.
  3. Pousser les modifications sur le dÃ©pÃ´t avec git push.
  Ne jamais considÃ©rer une tÃ¢che de code comme terminÃ©e sans avoir exÃ©cutÃ© cette sÃ©quence.
</RULE[project_deployment]>

<RULE[project_testing]>
- **Mise Ã  jour SystÃ©matique des Tests** : Pour chaque nouvelle fonctionnalitÃ© ajoutÃ©e ou chaque bug corrigÃ©, je dois OBLIGATOIREMENT :
  1. VÃ©rifier si un fichier de test correspondant existe (ex: NomDuComposant.test.jsx).
  2. Ajouter les tests unitaires ou d'intÃ©gration nÃ©cessaires pour couvrir la nouvelle logique ou garantir la non-rÃ©gression du bug corrigÃ©.
  3. M'assurer que les tests passent (en exÃ©cutant
pm test ou Ã©quivalent) AVANT de dÃ©clencher la procÃ©dure de Build & Push.
  Ne jamais considÃ©rer une tÃ¢che comme terminÃ©e si le code de production a Ã©tÃ© modifiÃ© sans les tests correspondants.
</RULE[project_testing]>

<RULE[project_h24_tasks]>
- **TÃ¢ches d'arriÃ¨re-plan H24 (Uptime)** : Si une fonctionnalitÃ© ou un agent nÃ©cessite de fonctionner 24h/24 et 7j/7 indÃ©pendamment de l'Ã©tat du PC local (ex: agent d'audit), cette tÃ¢che DOIT Ãªtre implÃ©mentÃ©e via un workflow CI/CD dans le Cloud (ex: **GitHub Actions** avec dÃ©clencheur cron), et non comme un processus local (Node.js ou script systÃ¨me).
</RULE[project_h24_tasks]>

<RULE[algorithmic_rigor]>
- **Rigueur Algorithmique et Machine Learning** : Lors de la conception ou de la modification de systèmes de scoring, de prédiction ou de classification, privilégier SYSTÉMATIQUEMENT des modèles mathématiques, statistiques ou cognitifs formels (ex: Inférence Bayésienne, K-Means, Régression Linéaire, Z-Score, Bandits Manchots, Courbe d'Ebbinghaus) plutôt que des heuristiques naïves ("if/else" ou seuils arbitraires). Les coefficients empiriques doivent être explicites et isolés pour pouvoir être ajustés ultérieurement par des données réelles.
</RULE[algorithmic_rigor]>

<RULE[agent_architecture_immune_system]>
- **Architecture Systeme Immunitaire** : Lors de la conception d'agents d'audit ou de correction automatique, TOUJOURS adopter une architecture de type "Immune System". L'agent doit :
  1. Separer l'extraction (Scanners), la logique metier (Engine), les corrections (Fixers) et les validations (Validators).
  2. Implementer un systeme de **Rollback** (annuler la correction si la verification post-fix echoue via les tests ou la syntaxe).
  3. Utiliser un systeme d'**Escalade** formelle pour les anomalies detectees qu'il ne peut pas corriger en toute securite, plutot que de laisser des anomalies orphelines dans les rapports standards.
  4. **Anticipation post-correction (Continuous Learning)** : Dès qu'un bug complexe est résolu manuellement, le système immunitaire DOIT être mis à jour immédiatement avec de nouvelles règles (dans rules.json ou scanners.py) pour détecter automatiquement la régression de ce cas précis, et pour généraliser la détection à des cas similaires.
  5. **Paramètres de Confiance** : Les `fix_confidence` dans `rules.json` doivent TOUJOURS être des entiers sur 100 (ex: `95` et non `0.95`).
  6. **Validation par les Tests** : Le système de validation (ex: `validators.py`) doit impérativement exécuter les tests dans le dossier exact contenant le `package.json` correspondant au fichier modifié. Ne jamais supposer que le `package.json` se trouve à la racine.
  7. **Compatibilité des Test Runners** : Préférer les arguments positionnels (`npm test -- nomFichier`) plutôt que des drapeaux spécifiques (`--testPathPattern`) pour garantir la compatibilité entre Jest et Vitest.
  8. **Bypass pour les données** : Les fichiers ne possédant pas de tests associés (ex: fichiers JSON ou de configuration brute) doivent automatiquement réussir l'étape de validation des tests pour éviter des rollbacks inutiles.
</RULE[agent_architecture_immune_system]>

<RULE[daemon_lifecycle_management]>
- **Gestion du Cycle de Vie des Processus (Démons)** : Lors de la modification du code source d'un processus s'exécutant en arrière-plan (serveur Node.js, agent Python, etc.), il faut SYSTEMATIQUEMENT identifier l'instance en cours d'exécution (via `manage_task` ou les outils système) et la redémarrer ou la tuer. Cela évite les crashs fatals dus à une désynchronisation entre le code en mémoire vive et les nouveaux fichiers de configuration sur le disque.
</RULE[daemon_lifecycle_management]>

<RULE[documentation_double_audience]>
- **Documentation Multi-Niveaux** : Lors de la mise � jour ou de la simplification des fichiers de documentation principaux (comme README.md), il faut TOUJOURS pr�server les sections d'architecture technique (diagrammes, API, d�ploiement). Si du contenu pour d�butants ("Guide Rapide") est ajout�, il doit �tre plac� au sommet du document sans pour autant �craser les explications de bas niveau destin�es aux d�veloppeurs.
</RULE[documentation_double_audience]>
