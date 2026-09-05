/**
 * Source unique de vérité de la navigation.
 *
 * Sidebar y lit les entrées de menu, App y lit les pages à rendre et le routage
 * d'URL y lit la liste des onglets valides. Ajouter une page se fait ici et dans
 * `routes.jsx`, nulle part ailleurs.
 *
 * `icon` peut être une chaîne ou une fonction `(ctx) => string` quand l'icône dépend
 * de l'état courant ; `badge` est une fonction `(ctx) => number` optionnelle.
 * ctx = { pendingTasksCount }
 */
export const NAV_GROUPS = [
  {
    title: 'Quotidien',
    tabs: [
      { id: 'dashboard', label: 'Accueil', icon: '🏠', badge: (ctx) => ctx.pendingTasksCount },
      { id: 'entrainement', label: 'Session du Jour', icon: '🎯' },
      {
        id: 'revisions_avancees',
        label: 'Avance & Bonus',
        icon: (ctx) => (ctx.pendingTasksCount > 0 ? '🔒' : '🚀'),
      },
    ],
  },
  {
    title: 'Scolarité',
    tabs: [
      { id: 'cours', label: 'Bibliothèque', icon: '📚' },
      { id: 'mes_videos', label: 'Mes Vidéos', icon: '🎥' },
      { id: 'prep_hebdo', label: 'Préparation Hebdo', icon: '📅' },
      { id: 'bulletin', label: 'Bulletin & Notes', icon: '📝' },
      { id: 'projets', label: 'Projets Personnels', icon: '💡' },
      { id: 'langues', label: 'Langues', icon: '🗣️' },
      { id: 'stages', label: 'Stages & Pro', icon: '💼' },
      { id: 'absences', label: 'Assiduité', icon: '🚨' },
    ],
  },
  {
    title: 'Système',
    tabs: [
      { id: 'planning', label: 'Planning Annuel', icon: '🔭' },
      { id: 'statistiques', label: 'Statistiques', icon: '📈' },
      { id: 'classement', label: 'Classement', icon: '🏆' },
      { id: 'graph', label: 'Graphe de Connaissances', icon: '🌌' },
      { id: 'config', label: 'Configuration', icon: '⚙️' },
      { id: 'musique', label: 'Musique', icon: '🎵' },
    ],
  },
];

/** Identifiants d'onglets valides, à plat. */
export const TAB_IDS = NAV_GROUPS.flatMap(g => g.tabs.map(t => t.id));

/** Onglet affiché au premier lancement et en cas d'URL inconnue. */
export const DEFAULT_TAB = 'dashboard';

/** Libellé lisible d'un onglet (titre de document, fil d'ariane). */
export function getTabLabel(id) {
  for (const group of NAV_GROUPS) {
    const tab = group.tabs.find(t => t.id === id);
    if (tab) return tab.label;
  }
  return null;
}
