import { moyenneMatiere, DEFAILLANT } from './bulletin';

/**
 * Score de performance et positionnement par rapport à des moyennes de référence.
 *
 * Le calcul vivait dans le composant, ce qui rendait ses trois composantes
 * invérifiables. Deux d'entre elles étaient d'ailleurs fausses : la moyenne
 * ignorait les coefficients, et le taux de rétention filtrait sur un type
 * d'historique (« revision ») qui n'existe nulle part.
 */

/** Types d'historique correspondant à une révision espacée. */
const TYPES_REVISION = ['CM', 'ANKI'];

/** Pondération des trois composantes du score global. */
export const POIDS = { notes: 0.4, retention: 0.4, regularite: 0.2 };

/** Sessions attendues par jour pour un effort jugé constant. */
const SESSIONS_PAR_JOUR = 2;
const FENETRE_MAX_JOURS = 30;

/** Fonction d'erreur (approximation d'Abramowitz & Stegun, 7.1.26). */
function erf(x) {
  const signe = x >= 0 ? 1 : -1;
  const v = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * v);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-v * v);
  return signe * y;
}

/** Part de la population située sous `valeur`, en pourcentage. */
export function percentile(valeur, moyenne, ecartType) {
  if (!Number.isFinite(ecartType) || ecartType <= 0) return null;
  // Un écart de plus de trois sigmas ne se distingue plus statistiquement :
  // sans bornes, une note isolée produisait un « Top 0.0 % » trompeur.
  const z = Math.max(-3, Math.min(3, (valeur - moyenne) / ecartType));
  return 0.5 * (1 + erf(z / Math.SQRT2)) * 100;
}

/** Position dans le haut du classement : 10 signifie « dans les 10 % de tête ». */
export function rangDepuisPercentile(p) {
  if (p === null) return null;
  return Math.max(100 - p, 0.1);
}

/**
 * Rang affiché : « 0,1 % » plutôt que « 0 % ».
 *
 * `rangDepuisPercentile` pose un plancher à 0,1 pour ne jamais prétendre à un
 * rang nul — mais l’affichage à zéro décimale le ramenait à « 0 % de tête »,
 * ce qui ne veut rien dire. Le garde-fou existait, la mise en forme l’annulait.
 */
export function formaterRang(rang) {
  if (!Number.isFinite(rang)) return '—';
  return rang < 1 ? rang.toFixed(1).replace('.', ',') : rang.toFixed(0);
}

/**
 * Vrai si l'entrée traduit une révision menée à son terme.
 * Les actions réellement écrites sont « Terminé », « Terminé (Note: …) »,
 * « Révisé (J7) », « Suspendu (séance partielle) » et « Temps investi ».
 */
export function estRevisionReussie(entree) {
  const action = String(entree?.action || '');
  if (action.startsWith('Suspendu')) return false;
  return action.startsWith('Révisé') || action.startsWith('Terminé');
}

/** Note retenue pour une matière : réelle si elle existe, sinon projetée. */
export function noteRetenue(matiere, intelligence) {
  const moyenne = moyenneMatiere(matiere?.evaluations);
  if (typeof moyenne === 'number') return { note: moyenne, estimee: false };
  // Une défaillance ne se compare à aucune moyenne de promotion.
  if (moyenne === DEFAILLANT) return { note: null, estimee: false };

  const projetee = intelligence?.projectedScoreMap?.[(matiere?.nom || '').toLowerCase().trim()];
  if (typeof projetee === 'number') return { note: projetee, estimee: true };
  return { note: null, estimee: false };
}

/** Score sur 100 tiré de la moyenne générale pondérée par les coefficients. */
export function scoreNotes(coursConfig, intelligence) {
  let sommeNotes = 0;
  let sommeCoefficients = 0;
  const matieres = [];

  const licence = coursConfig?.licences?.find(l => !l.archived);
  licence?.semestres?.filter(s => !s.archived).forEach(semestre => {
    semestre.ues?.forEach(ue => {
      ue.matieres?.forEach(m => {
        const { note, estimee } = noteRetenue(m, intelligence);
        if (note === null) return;

        const coefficient = m.coefficient !== undefined ? Number(m.coefficient) : (ue.ects || 1);
        if (coefficient > 0) {
          sommeNotes += note * coefficient;
          sommeCoefficients += coefficient;
        }
        matieres.push({ nom: m.nom, note, estimee });
      });
    });
  });

  const moyenne = sommeCoefficients > 0 ? sommeNotes / sommeCoefficients : null;
  return {
    moyenne,
    score: moyenne === null ? null : Math.min((moyenne / 20) * 100, 100),
    matieres,
  };
}

/**
 * Score de rétention sur 100.
 *
 * La rétention mesurée par Anki, quand elle est disponible, est la vraie donnée :
 * elle remplace l'estimation tirée de l'historique au lieu de la multiplier —
 * ce produit faisait chuter le score sans raison dès qu'Anki était branché.
 */
export function scoreRetention(historique, intelligence) {
  if (typeof intelligence?.fsrs_real_retention === 'number') {
    return { score: Math.min(100, Math.max(0, intelligence.fsrs_real_retention)), source: 'anki' };
  }

  const revisions = (historique || []).filter(h => TYPES_REVISION.includes(h.type));
  if (revisions.length === 0) return { score: null, source: 'aucune' };

  const reussies = revisions.filter(estRevisionReussie).length;
  return { score: (reussies / revisions.length) * 100, source: 'historique' };
}

/**
 * Score de régularité sur 100.
 *
 * La fenêtre s'adapte à l'ancienneté du compte : sur une semaine d'utilisation,
 * comparer à trente jours d'objectif condamnait le score à rester bas.
 */
export function scoreRegularite(historique, config, maintenant = Date.now()) {
  const horodatages = (historique || [])
    .map(h => new Date(h.timestamp || h.date).getTime())
    .filter(Number.isFinite);

  const debutFenetre = maintenant - FENETRE_MAX_JOURS * 86400000;
  const recentes = horodatages.filter(t => t > debutFenetre).length;

  const premiere = horodatages.length > 0 ? Math.min(...horodatages) : maintenant;
  const debutCompte = config?.userStartDate ? new Date(config.userStartDate).getTime() : premiere;
  const joursDepuisDebut = Math.ceil((maintenant - debutCompte) / 86400000);
  const fenetre = Math.max(1, Math.min(Number.isFinite(joursDepuisDebut) ? joursDepuisDebut : 1, FENETRE_MAX_JOURS));

  const attendues = fenetre * SESSIONS_PAR_JOUR;
  return {
    // Aucune séance enregistrée, jamais : il n'y a rien à mesurer, et un zéro
    // se lirait comme un relâchement plutôt que comme une absence de données.
    score: horodatages.length === 0 ? null : Math.min((recentes / attendues) * 100, 100),
    sessions: recentes,
    attendues,
    fenetre,
  };
}

/** Classement d'une matière face à la moyenne de sa promotion. */
export function rangMatiere(matiere, reference, intelligence) {
  if (!reference) return null;
  const p = percentile(matiere.note, reference.mean, reference.sd);
  if (p === null) return null;

  const retentionAnki = intelligence?.fsrs_retention_by_subject?.[matiere.nom];
  return {
    ...matiere,
    moyennePromo: reference.mean,
    ecartType: reference.sd,
    retention: typeof retentionAnki === 'number' ? retentionAnki : null,
    rang: rangDepuisPercentile(p),
  };
}

/**
 * Synthèse complète.
 *
 * `rang` vaut `null` tant qu'aucune moyenne de référence n'est disponible : la
 * page affichait jusqu'ici « Top 50 % » — la valeur par défaut du calcul — comme
 * s'il s'agissait d'un résultat mesuré.
 */
export function synthetiserClassement({ coursConfig, historique, config, rankingBaseline, intelligence }, maintenant = Date.now()) {
  const notes = scoreNotes(coursConfig, intelligence);
  const retention = scoreRetention(historique, intelligence);
  const regularite = scoreRegularite(historique, config, maintenant);

  // Une composante absente ne vaut pas zéro : on répartit son poids sur les autres.
  const composantes = [
    { cle: 'notes', valeur: notes.score, poids: POIDS.notes },
    { cle: 'retention', valeur: retention.score, poids: POIDS.retention },
    { cle: 'regularite', valeur: regularite.score, poids: POIDS.regularite },
  ].filter(c => c.valeur !== null);

  const poidsTotal = composantes.reduce((s, c) => s + c.poids, 0);
  const scoreGlobal = poidsTotal > 0
    ? composantes.reduce((s, c) => s + c.valeur * c.poids, 0) / poidsTotal
    : null;

  let rang = null;
  if (scoreGlobal !== null && rankingBaseline?.globalMean != null && rankingBaseline?.globalSD > 0) {
    rang = rangDepuisPercentile(percentile(scoreGlobal, rankingBaseline.globalMean, rankingBaseline.globalSD));
  }

  const parMatiere = notes.matieres
    .map(m => rangMatiere(m, rankingBaseline?.subjects?.[m.nom], intelligence))
    .filter(Boolean)
    .sort((a, b) => a.rang - b.rang);

  return {
    notes,
    retention,
    regularite,
    scoreGlobal,
    rang,
    parMatiere,
    composantesManquantes: 3 - composantes.length,
  };
}
