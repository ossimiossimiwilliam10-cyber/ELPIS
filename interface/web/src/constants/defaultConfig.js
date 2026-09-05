/**
 * Configuration d'un premier lancement.
 *
 * Doit rester alignée sur `DEFAULT_CONFIG` de `interface/bridge/moteur/config.js`.
 * Les deux copies avaient divergé : la remise à zéro de l'interface remettait
 * `enableTD` et `enableAnnales` à `false`, ce qui retirait du planning tous les
 * TD et annales saisis — sans que rien ne l'indique.
 */
export const DEFAULT_CONFIG = {
  studyStartDate: '07-09-2026',
  bedtime: '23:00',
  wakeUpTime: '07:00',
  summerStudyHoursCompleted: 0,
  maxSubjectsPerDay: 3,
  studyBlockDurationMinutes: 50,
  activeRecallMinutesPerDay: 30,
  subjects: [],
  fixedCommitments: [],
  theme: 'dark',
  pomoWork: 25,
  pomoBreak: 5,
  lastActiveDate: '',
  currentStreak: 0,
  bestStreak: 0,
  // TD et annales entrent dans le planning dès le premier lancement : les
  // exercices saisis doivent être planifiables sans réglage préalable.
  enableTD: true,
  enableAnnales: true,
};

/** État vierge complet : configuration, cursus, historique et projets. */
export const ETAT_VIERGE = {
  config: DEFAULT_CONFIG,
  coursConfig: { licences: [] },
  historique: [],
  projets: [],
};
