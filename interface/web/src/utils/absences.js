/**
 * Règles d'assiduité : délai de justification et synthèse.
 */

/** Délai réglementaire pour déposer un justificatif, en jours. */
export const DELAI_JUSTIFICATIF_JOURS = 7;

/** Types d'enseignement exigeant un justificatif. */
export const TYPES_AVEC_JUSTIFICATIF = ['TP', 'CM', 'Langue'];

/**
 * Nombre de jours restants pour justifier une absence.
 *
 * Les deux dates sont ramenées à minuit local avant comparaison. Sans cela,
 * `new Date('2026-09-15')` était lu en UTC tandis que `new Date()` restait
 * local : la comparaison mélangeait deux repères et le jour même de l'absence
 * affichait déjà « 6 jours restants ».
 *
 * @returns {number|null} jours restants (négatif si le délai est dépassé),
 *                        ou null si la date est inexploitable.
 */
export function joursRestantsPourJustifier(dateStr, maintenant = new Date()) {
  if (!dateStr) return null;

  const [annee, mois, jour] = String(dateStr).split('-').map(Number);
  if (!Number.isFinite(annee) || !Number.isFinite(mois) || !Number.isFinite(jour)) return null;

  const debutAbsence = new Date(annee, mois - 1, jour);
  if (Number.isNaN(debutAbsence.getTime())) return null;

  const aujourdHui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const joursEcoules = Math.round((aujourdHui - debutAbsence) / 86400000);

  return DELAI_JUSTIFICATIF_JOURS - joursEcoules;
}

/**
 * État d'une absence, quelle que soit la forme sous laquelle elle a été saisie.
 *
 * Deux formes coexistent en base : `statut`, écrit par cette page, et
 * `justifiee`, un booléen laissé par des saisies plus anciennes. Ne lire que la
 * première rangeait les secondes dans aucune catégorie : elles comptaient dans
 * le total et nulle part ailleurs, si bien qu'une absence non justifiée
 * n'apparaissait ni « à justifier » ni « hors délai ».
 */
export function etatAbsence(absence) {
  const statut = String(absence?.statut || '').trim();
  if (statut) return statut;
  if (absence?.justifiee === true) return 'Justifié';
  if (absence?.justifiee === false) return 'Non Justifié';
  return '';
}

/** Vrai si l'absence exige un justificatif et que le délai est écoulé. */
export function estHorsDelai(absence, maintenant = new Date()) {
  if (!absence || etatAbsence(absence) !== 'Non Justifié') return false;
  if (!TYPES_AVEC_JUSTIFICATIF.includes(absence.type)) return false;

  const restants = joursRestantsPourJustifier(absence.date, maintenant);
  return restants !== null && restants < 0;
}

/** Vrai si un justificatif est attendu pour ce type d'enseignement. */
export function exigeJustificatif(type) {
  return TYPES_AVEC_JUSTIFICATIF.includes(type);
}

/** Compte les absences par état, pour la synthèse de la page. */
export function synthetiser(absences, maintenant = new Date()) {
  const liste = Array.isArray(absences) ? absences : [];

  return {
    total: liste.length,
    justifiees: liste.filter(a => ['Justifié', 'Dispensé'].includes(etatAbsence(a))).length,
    enAttente: liste.filter(a => etatAbsence(a) === 'En Attente').length,
    aJustifier: liste.filter(a => etatAbsence(a) === 'Non Justifié' && exigeJustificatif(a.type) && !estHorsDelai(a, maintenant)).length,
    horsDelai: liste.filter(a => estHorsDelai(a, maintenant)).length,
  };
}

/** Absences classées de la plus récente à la plus ancienne. */
export function trierParDate(absences) {
  return [...(absences || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}
