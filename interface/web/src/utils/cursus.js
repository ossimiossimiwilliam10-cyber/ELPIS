/**
 * Lecture du cursus : parcours, comptages et recherche.
 *
 * Ces fonctions étaient auparavant recopiées dans chaque page sous forme de
 * quadruples boucles imbriquées (licences → semestres → UE → matières), avec
 * des variantes subtiles d'une page à l'autre.
 */

import { moyenneMatiere } from './bulletin';

/** Chemin d'accès d'une matière dans l'arborescence. */
const cheminDe = (l, s, u, m) => ({ lIndex: l, sIndex: s, uIndex: u, mIndex: m });

/**
 * Parcourt toutes les matières du cursus.
 * @param {object} coursConfig
 * @returns {Array<{matiere, ue, semestre, licence, chemin}>}
 */
export function parcourirMatieres(coursConfig) {
  const resultat = [];
  (coursConfig?.licences || []).forEach((licence, lIndex) => {
    (licence.semestres || []).forEach((semestre, sIndex) => {
      (semestre.ues || []).forEach((ue, uIndex) => {
        (ue.matieres || []).forEach((matiere, mIndex) => {
          resultat.push({ matiere, ue, semestre, licence, chemin: cheminDe(lIndex, sIndex, uIndex, mIndex) });
        });
      });
    });
  });
  return resultat;
}

/** Noms de matières, dédoublonnés et classés. */
export function nomsDesMatieres(coursConfig) {
  const noms = new Set();
  parcourirMatieres(coursConfig).forEach(({ matiere }) => {
    if (matiere.nom) noms.add(matiere.nom);
  });
  return Array.from(noms).sort((a, b) => a.localeCompare(b, 'fr'));
}

/** Listes d'exercices d'une matière, dans l'ordre d'affichage. */
export const listesDe = (matiere) => [
  { cle: 'listeCM', type: 'CM', libelle: 'Cours', items: matiere?.listeCM || [] },
  { cle: 'listeTD', type: 'TD', libelle: 'TD', items: matiere?.listeTD || [] },
  { cle: 'listeTP', type: 'TP', libelle: 'TP', items: matiere?.listeTP || [] },
  { cle: 'listeAnnales', type: 'ANNALE', libelle: 'Annales', items: matiere?.listeAnnales || [] },
];

/**
 * État d'avancement d'une matière.
 *
 * `avancement` rapporte ce qui a été travaillé au moins une fois à l'ensemble :
 * c'est la seule mesure lisible d'un coup d'œil sur une carte.
 */
export function resumerMatiere(matiere) {
  const listes = listesDe(matiere);

  const total = listes.reduce((n, l) => n + l.items.length, 0);
  const travailles = listes.reduce((n, l) => n + l.items.filter(estTravaille).length, 0);

  const moyenne = moyenneMatiere(matiere?.evaluations);

  return {
    total,
    travailles,
    avancement: total > 0 ? Math.round((travailles / total) * 100) : null,
    parType: Object.fromEntries(listes.map(l => [l.type, l.items.length])),
    moyenne: typeof moyenne === 'number' ? moyenne : null,
    defaillante: moyenne === 'DEF',
    dispensee: Boolean(matiere?.dispense),
    dette: Boolean(matiere?.dette),
    nbEvaluations: (matiere?.evaluations || []).length,
    prochaineRevision: prochaineRevision(matiere),
  };
}

/** Un cours est « travaillé » dès sa première révision, un exercice dès sa première pratique. */
function estTravaille(item) {
  return Boolean(item?.derniereRevision) || (item?.nombrePratiques || 0) > 0;
}

/** Date de révision la plus proche parmi les cours de la matière, ou null. */
function prochaineRevision(matiere) {
  const dates = (matiere?.listeCM || [])
    .map(cm => cm.prochaineRevisionDate)
    .filter(Boolean)
    .sort();
  return dates[0] || null;
}

/** Agrège l'avancement des matières d'une UE. */
export function resumerUE(ue) {
  const matieres = ue?.matieres || [];
  const resumes = matieres.map(resumerMatiere);

  const total = resumes.reduce((n, r) => n + r.total, 0);
  const travailles = resumes.reduce((n, r) => n + r.travailles, 0);
  const notees = resumes.filter(r => r.moyenne !== null);

  return {
    nbMatieres: matieres.length,
    total,
    travailles,
    avancement: total > 0 ? Math.round((travailles / total) * 100) : null,
    // Moyenne indicative de l'UE : le calcul officiel, pondéré, vit dans le bulletin.
    moyenne: notees.length > 0 ? notees.reduce((s, r) => s + r.moyenne, 0) / notees.length : null,
    ects: ue?.ects || 0,
  };
}

/** Comptages d'ensemble, affichés en tête de la Bibliothèque. */
export function resumerCursus(coursConfig) {
  const matieres = parcourirMatieres(coursConfig);
  const compte = { CM: 0, TD: 0, TP: 0, ANNALE: 0 };

  matieres.forEach(({ matiere }) => {
    listesDe(matiere).forEach(l => { compte[l.type] += l.items.length; });
  });

  return {
    nbLicences: (coursConfig?.licences || []).length,
    nbMatieres: matieres.length,
    nbCours: compte.CM,
    nbExercices: compte.TD + compte.TP + compte.ANNALE,
    parType: compte,
  };
}

/** Normalise une chaîne pour comparer sans tenir compte des accents ni de la casse. */
const normaliser = (texte) =>
  String(texte || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Recherche dans tout le cursus : matières, cours et exercices.
 *
 * Insensible aux accents — chercher « algebre » doit trouver « Algèbre », faute
 * de quoi la recherche paraît défaillante sur la moitié des intitulés.
 *
 * @returns {Array<{type, titre, matiere, chemin, ue, semestre, licence}>}
 */
export function chercherDansCursus(coursConfig, terme, limite = 40) {
  const recherche = normaliser(terme).trim();
  if (!recherche) return [];

  const resultats = [];

  for (const { matiere, ue, semestre, licence, chemin } of parcourirMatieres(coursConfig)) {
    if (resultats.length >= limite) break;

    if (normaliser(matiere.nom).includes(recherche)) {
      resultats.push({ type: 'MATIERE', titre: matiere.nom, matiere, ue, semestre, licence, chemin });
    }

    for (const liste of listesDe(matiere)) {
      for (const item of liste.items) {
        if (resultats.length >= limite) break;
        const correspond = normaliser(item.titre).includes(recherche) || normaliser(item.notes).includes(recherche);
        if (correspond) {
          resultats.push({
            type: liste.type, titre: item.titre || 'Sans titre',
            matiere, ue, semestre, licence, chemin,
          });
        }
      }
    }
  }

  return resultats;
}

/** Ramène un index dans les bornes d'une liste, pour ne jamais pointer dans le vide. */
export const indexSur = (index, liste) => Math.min(Math.max(0, index || 0), Math.max(0, (liste?.length || 1) - 1));
