/**
 * Calculs de moyennes universitaires.
 *
 * Ces règles étaient recopiées à quatre endroits de la page Bulletin, avec des
 * divergences : deux copies oubliaient le cas « défaillant », produisant un NaN
 * qui se propageait jusqu'au décompte d'ECTS et faisait basculer le statut de
 * l'année en « Ajourné ». Une seule implémentation, testée, sert désormais
 * partout.
 *
 * Convention de retour : un nombre, `DEFAILLANT` si une note manque pour cause
 * de défaillance, ou `null` quand rien n'est encore noté.
 */

export const DEFAILLANT = 'DEF';

/** Coefficient d'un élément, 1 par défaut. */
const coefficientDe = (element) =>
  (element?.coefficient !== undefined ? Number(element.coefficient) : 1);

/**
 * Moyenne d'une matière à partir de ses évaluations.
 * Une évaluation « excusée » est ignorée ; une évaluation « défaillante »
 * rend toute la matière défaillante.
 */
export function moyenneMatiere(evaluations) {
  if (!Array.isArray(evaluations)) return null;

  let defaillant = false;
  let totalScore = 0;
  let totalCoef = 0;

  for (const ev of evaluations) {
    if (ev?.statut === 'defaillant') {
      defaillant = true;
    } else if (ev?.statut !== 'excuse' && ev?.note !== null && ev?.note !== undefined && !isNaN(ev.note)) {
      const c = coefficientDe(ev);
      totalScore += ev.note * c;
      totalCoef += c;
    }
  }

  if (defaillant) return DEFAILLANT;
  return totalCoef > 0 ? totalScore / totalCoef : null;
}

/**
 * Moyenne d'une UE, pondérée par les coefficients de ses matières.
 * Une matière dispensée ne compte pas ; une matière de coefficient 0 non plus.
 *
 * Le coefficient 0 était traité en « bonus additif » : la moyenne entière de la
 * matière s'ajoutait à celle de l'UE. Une UE à 11 accompagnée d'une matière
 * bonus notée 12 affichait donc **23/20**, deux bonus la portaient à 37, et un
 * bonus raté à 2/20 la faisait quand même monter à 13. Aucune de ces trois
 * conséquences n'est défendable.
 *
 * Le règlement des études de la licence ne prévoit aucun mécanisme de bonus :
 * les notes se compensent « affectées de leurs coefficients ». Un coefficient
 * nul se lit donc littéralement — poids nul, la matière n'entre pas dans le
 * calcul. Inventer un barème de bonus reviendrait à ajouter une règle que
 * l'université n'a pas.
 */
export function moyenneUE(ue) {
  let sommePonderee = 0;
  let sommeCoefs = 0;
  let defaillant = false;
  let toutDispense = true;
  let aDesMatieres = false;

  (ue?.matieres || []).forEach(m => {
    aDesMatieres = true;
    if (!m.dispense) toutDispense = false;
    if (m.dispense) return;

    const avg = moyenneMatiere(m.evaluations);
    if (avg === DEFAILLANT) {
      defaillant = true;
      return;
    }
    if (avg === null) return;

    const coef = coefficientDe(m);
    // Un coefficient nul, négatif ou illisible ne pondère rien.
    if (!Number.isFinite(coef) || coef <= 0) return;

    sommeCoefs += coef;
    sommePonderee += avg * coef;
  });

  const dispense = aDesMatieres && toutDispense;
  const moyenne = defaillant
    ? DEFAILLANT
    : (sommeCoefs > 0 ? sommePonderee / sommeCoefs : null);

  return {
    moyenne,
    defaillant,
    dispense,
    ects: ue?.ects || 0,
    // Une UE est acquise si elle atteint 10, ou si toutes ses matières sont dispensées.
    validee: (typeof moyenne === 'number' && moyenne >= 10) || dispense,
  };
}

/**
 * Moyenne d'un semestre, pondérée par les ECTS de ses UE.
 * Une UE défaillante rend tout le semestre défaillant.
 */
export function moyenneSemestre(semestre) {
  let sommePonderee = 0;
  let sommeECTS = 0;
  let defaillant = false;
  const ues = [];

  (semestre?.ues || []).forEach(ue => {
    const detail = moyenneUE(ue);
    ues.push({ nom: ue?.nom, ...detail });

    if (detail.moyenne === DEFAILLANT) {
      defaillant = true;
    } else if (detail.moyenne !== null) {
      sommePonderee += detail.moyenne * detail.ects;
      sommeECTS += detail.ects;
    }
  });

  const moyenne = defaillant
    ? DEFAILLANT
    : (sommeECTS > 0 ? sommePonderee / sommeECTS : null);

  return {
    moyenne,
    defaillant,
    ues,
    ectsTotal: ues.reduce((acc, u) => acc + u.ects, 0),
    // La compensation semestrielle rattrape les UE sous la moyenne.
    compense: typeof moyenne === 'number' && moyenne >= 10,
  };
}

/** Nombre de notes attendu par UE (règlement des études). */
export const MIN_NOTES_PAR_UE = 3;

/** Part maximale qu'une seule note peut représenter dans la moyenne d'une UE. */
export const PART_MAX_PAR_NOTE = 0.5;

/**
 * Conformité d'une UE au régime d'évaluation continue intégrale.
 *
 * Le règlement impose « un minimum de trois notes par UE » et « aucune note ne
 * peut contribuer pour plus de 50 % de la moyenne de l'UE ». Ces deux règles
 * contraignent l'université, pas le calcul : si une épreuve pèse 60 %, la
 * moyenne officielle reste celle du jury. ELPIS ne repondère donc rien — il
 * signale seulement que la moyenne affichée repose sur trop peu de notes pour
 * être représentative.
 *
 * C'est le cas de toute UE en début de semestre : une UE qui n'a qu'une note
 * la voit peser 100 %, et la projection qui en découle ne vaut presque rien.
 *
 * Poids réel d'une évaluation dans la moyenne de l'UE :
 *   (coef. de sa matière / somme des coef. de matières)
 * × (coef. de l'évaluation / somme des coef. d'évaluations de la matière)
 */
export function conformiteUE(ue) {
  const matieres = (ue?.matieres || []).filter(m => !m.dispense);
  let sommeCoefsMatieres = 0;
  const retenues = [];

  for (const m of matieres) {
    const coefM = coefficientDe(m);
    if (!Number.isFinite(coefM) || coefM <= 0) continue;

    // Une épreuve de coefficient nul ne compte pas non plus parmi les trois
    // notes attendues : elle ne pèse rien dans la moyenne qu'elle prétendrait
    // rendre représentative.
    const notes = (m.evaluations || []).filter(
      e => e?.statut !== 'excuse' && e?.statut !== 'defaillant'
        && e?.note !== null && e?.note !== undefined && !Number.isNaN(Number(e.note))
        && coefficientDe(e) > 0
    );
    const sommeCoefsNotes = notes.reduce((acc, e) => acc + coefficientDe(e), 0);
    if (sommeCoefsNotes <= 0) continue;

    sommeCoefsMatieres += coefM;
    for (const e of notes) {
      retenues.push({ coefM, partDansMatiere: coefficientDe(e) / sommeCoefsNotes });
    }
  }

  if (sommeCoefsMatieres <= 0 || retenues.length === 0) {
    return { nbNotes: 0, partMax: 0, sousLeMinimum: false, noteTropLourde: false, conforme: true };
  }

  const partMax = retenues.reduce(
    (max, r) => Math.max(max, (r.coefM / sommeCoefsMatieres) * r.partDansMatiere), 0);
  const sousLeMinimum = retenues.length < MIN_NOTES_PAR_UE;
  // Tolérance d'arrondi : trois notes de poids égal font exactement 1/3.
  const noteTropLourde = partMax > PART_MAX_PAR_NOTE + 1e-9;

  return {
    nbNotes: retenues.length,
    partMax,
    sousLeMinimum,
    noteTropLourde,
    conforme: !sousLeMinimum && !noteTropLourde,
  };
}

/** Affichage d'une moyenne : « 12.50 », « DEF » ou « -- ». */
export function formaterMoyenne(valeur, decimales = 2) {
  if (valeur === DEFAILLANT) return 'DEF';
  if (valeur === null || valeur === undefined || Number.isNaN(valeur)) return '--';
  return Number(valeur).toFixed(decimales);
}

/** Mention attribuée à une moyenne générale sur 20. */
export function mentionPour(moyenne) {
  if (typeof moyenne !== 'number' || Number.isNaN(moyenne)) return '';
  if (moyenne >= 16) return 'Très Bien';
  if (moyenne >= 14) return 'Bien';
  if (moyenne >= 12) return 'Assez Bien';
  if (moyenne >= 10) return 'Passable';
  return 'Ajourné';
}
