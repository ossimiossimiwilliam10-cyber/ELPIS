# Règles de projet pour ELPIS

- Pour ce projet systématiquement, à la fin de chaque tâche ou de chaque modification importante, il faut **pousser les modifications sur Github** (`git add .`, `git commit -m "..."`, `git push`).
- Ensuite, il faut systématiquement **compiler les modifications** pour l'application en ligne et locale (par exemple en exécutant `npm run build` dans le dossier `interface/web`).
- L'objectif est d'assurer que l'utilisateur dispose toujours de la version la plus récente et fonctionnelle à la fois en ligne et en local.
- **Création de tests anti-régression** : Systématiquement, lorsque tu vas repérer et corriger un bug, il faudra au final créer un test unitaire (anti-régression) pour prévenir la réapparition de ce bug plus tard dans l'avenir.
- **Performance React & Zustand** : Ne jamais placer d'états à haute fréquence de mise à jour (ex: chronomètre, compteurs rapides, positionnement souris) dans le store global (`useStore`). Ils doivent impérativement être isolés dans leur propre store Zustand dédié (ex: `useChronoStore`) pour éviter des re-rendus massifs et non désirés sur l'ensemble de l'application.
