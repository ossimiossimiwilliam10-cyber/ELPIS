/**
 * Clé stable d'une tâche — miroir exact de `buildTaskId` dans
 * interface/bridge/moteur/orchestrateur.js.
 *
 * L'orchestrateur estampille chaque tâche avec `id = type::matiere::titre`. Les
 * entrées d'historique, elles, ne portent pas d'identifiant : cette fonction permet
 * de reconstruire la même clé à partir de n'importe quel objet exposant
 * `{type, matiere, titre}`, et donc de rapprocher une tâche du jour d'une entrée
 * d'historique déjà validée.
 *
 * @param {{type?: string, matiere?: string, titre?: string}} t
 * @returns {string}
 */
export function buildTaskKey(t) {
  const norm = (v) => String(v || '').toLowerCase().trim();
  return `${norm(t?.type)}::${norm(t?.matiere)}::${norm(t?.titre)}`;
}

/**
 * Vrai si deux tâches désignent la même unité de travail.
 * Compare les identifiants quand ils existent, sinon retombe sur la clé composite.
 */
export function isSameTask(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id) return a.id === b.id;
  return buildTaskKey(a) === buildTaskKey(b);
}
