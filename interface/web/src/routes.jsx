import { lazy } from 'react';
import Dashboard from './Dashboard';

/**
 * Table de routage : identifiant d'onglet → composant de page.
 *
 * Remplace la quinzaine de blocs `activeTab === '...' && (...)` qui se répétaient
 * dans App.jsx. Le Dashboard est chargé d'emblée (c'est la page d'entrée) ; tout le
 * reste est chargé à la demande.
 */
const CoursPage = lazy(() => import('./CoursPage'));
const EntrainementPage = lazy(() => import('./EntrainementPage'));
const StatistiquesPage = lazy(() => import('./StatistiquesPage'));
const BulletinPage = lazy(() => import('./BulletinPage'));
const PreparationHebdoPage = lazy(() => import('./PreparationHebdoPage'));
const RevisionsAvanceesPage = lazy(() => import('./RevisionsAvanceesPage'));
const ProjetsPage = lazy(() => import('./ProjetsPage'));
const LanguesPage = lazy(() => import('./LanguesPage'));
const MesVideosPage = lazy(() => import('./MesVideosPage'));
const ClassementPage = lazy(() => import('./ClassementPage'));
const GraphPage = lazy(() => import('./GraphPage'));
const AbsencesPage = lazy(() => import('./AbsencesPage'));
const StagesPage = lazy(() => import('./StagesPage'));
const ConfigPage = lazy(() => import('./ConfigPage'));
const PlanningPage = lazy(() => import('./PlanningPage'));
const MusicSettingsModal = lazy(() => import('./components/MusicSettingsModal'));

/**
 * `fullHeight` : la page occupe toute la hauteur disponible (graphe 3D).
 * `props`      : fabrique de props dépendant du contexte de l'application.
 */
export const ROUTES = {
  dashboard: { component: Dashboard, lazy: false },
  entrainement: { component: EntrainementPage },
  revisions_avancees: { component: RevisionsAvanceesPage },
  cours: { component: CoursPage },
  mes_videos: { component: MesVideosPage },
  prep_hebdo: { component: PreparationHebdoPage },
  bulletin: { component: BulletinPage },
  projets: { component: ProjetsPage },
  langues: { component: LanguesPage },
  stages: { component: StagesPage },
  absences: { component: AbsencesPage },
  planning: { component: PlanningPage },
  statistiques: { component: StatistiquesPage },
  classement: { component: ClassementPage },
  graph: { component: GraphPage, fullHeight: true },
  config: { component: ConfigPage },
  musique: {
    component: MusicSettingsModal,
    props: ({ setActiveTab }) => ({ onClose: () => setActiveTab('dashboard') }),
  },
};
