import { useEffect, useRef } from 'react';
import useStore from './store';
import { parseDateLocal } from './parseDateLocal';

/**
 * Charge de travail quotidienne.
 *
 * L'ancien calcul partait de la note visée et du rang visé : chaque matière
 * réclamait `coefficient × 15 h × multiplicateur d'ambition`, et l'effort
 * restant était divisé par les jours restants avant l'examen. Deux conséquences
 * en découlaient, toutes deux nuisibles :
 *
 *   - viser 18 plutôt que 14 exigeait 40 % de temps en plus, comme si l'écart
 *     entre ces deux notes était une affaire de volume horaire — alors qu'il se
 *     joue sur la nature du travail : entraînement, annales, récupération
 *     active plutôt que relecture ;
 *   - tout retard augmentait mécaniquement l'exigence quotidienne, jusqu'au
 *     plafond de dix heures. Une semaine manquée rendait donc la semaine
 *     suivante plus lourde, et le rattrapage toujours plus improbable. C'est
 *     exactement la spirale qu'un outil d'accompagnement doit désamorcer.
 *
 * Le rapport de force est désormais inversé : l'étudiant déclare le temps qu'il
 * peut donner, ce hook le respecte, et le programme s'ajuste à cette contrainte.
 * Lorsque le programme n'y tient pas, c'est le périmètre qui doit se réduire —
 * jamais la journée qui doit s'allonger.
 */

/** Capacité retenue quand rien n'est déclaré, en heures par jour. */
const CAPACITE_DEFAUT = 2.5;
const CAPACITE_MIN = 0.5;
const CAPACITE_MAX = 8;

/**
 * Heures de travail personnel pour une heure d'enseignement encadré.
 *
 * La maquette donne les volumes horaires de chaque matière — tu les as saisis,
 * et ELPIS ne les utilisait nulle part : ils étaient enregistrés, relus, puis
 * ignorés. La charge se déduisait du seul coefficient, à 15 h par point. Deux
 * matières de coefficient 1 recevaient donc la même estimation, que la première
 * compte 60 heures d'enseignement et la seconde 25 — un écart de 2,4 fois.
 *
 * Le facteur retenu se déduit de la convention ECTS : un semestre de 30 crédits
 * représente 750 à 900 heures de travail total. Ton semestre 3 compte 289 heures
 * encadrées, ce qui laisse 461 à 611 heures de travail personnel, soit 1,6 à 2,1
 * fois le volume encadré. On prend la borne basse : mieux vaut une estimation
 * prudente qu’un objectif décourageant.
 */
const HEURES_PERSO_PAR_HEURE_ENCADREE = 1.6;

/** Repli quand la maquette n'est pas renseignée : l'ancien proxy par coefficient. */
const HEURES_PAR_COEFFICIENT = 15;

/** Heures de travail personnel attendues pour une matière, sur le semestre. */
export function heuresAttendues(matiere) {
  const encadrees = ["cm_h", "td_h", "tp_h"]
    .reduce((total, cle) => total + (Number(matiere?.[cle]) || 0), 0);
  if (encadrees > 0) return encadrees * HEURES_PERSO_PAR_HEURE_ENCADREE;
  return (Number(matiere?.coefficient) || 1) * HEURES_PAR_COEFFICIENT;
}

/** Intervalle minimal entre deux écritures de configuration. */
const DELAI_ECRITURE_MS = 60000;

const JOUR = 86400000;

/** Capacité déclarée, ramenée à ce qu'un humain peut tenir. */
function capaciteQuotidienne(config) {
  const declaree = Number(config?.capaciteQuotidienneH);
  if (!Number.isFinite(declaree)) return CAPACITE_DEFAUT;
  return Math.max(CAPACITE_MIN, Math.min(CAPACITE_MAX, declaree));
}

/**
 * Heures que le programme réclame d'ici la fin du semestre.
 *
 * Sert uniquement à diagnostiquer un écart avec la capacité disponible : ce
 * total ne remonte jamais la charge quotidienne, il alimente un avertissement.
 */
function chargeRestante(coursConfig, historique, config, maintenant = Date.now()) {
  const aujourdHui = new Date(maintenant);
  aujourdHui.setHours(0, 0, 0, 0);

  let heuresRequises = 0;
  let heuresFaites = 0;
  let echeanceLaPlusLointaine = null;

  for (const licence of coursConfig?.licences || []) {
    if (licence.archived) continue;
    for (const semestre of licence.semestres || []) {
      if (semestre.archived) continue;

      const finSemestre = semestre.dateFin ? parseDateLocal(semestre.dateFin) : null;
      if (finSemestre && finSemestre < aujourdHui) continue;
      if (finSemestre && (!echeanceLaPlusLointaine || finSemestre > echeanceLaPlusLointaine)) {
        echeanceLaPlusLointaine = finSemestre;
      }

      for (const ue of semestre.ues || []) {
        for (const matiere of ue.matieres || []) {
          heuresRequises += heuresAttendues(matiere);

          for (const entree of historique || []) {
            if (entree.matiere !== matiere.nom || !entree.timestamp) continue;
            const minutes = Number(entree.dureeMinutes);
            heuresFaites += (Number.isFinite(minutes) && minutes > 0 ? minutes : 30) / 60;
          }
        }
      }
    }
  }

  const restantes = Math.max(0, heuresRequises - heuresFaites);
  const joursRestants = echeanceLaPlusLointaine
    ? Math.max(1, Math.ceil((echeanceLaPlusLointaine - aujourdHui) / JOUR))
    : null;

  return { heuresRequises, heuresFaites, restantes, joursRestants };
}

/**
 * Applique la capacité déclarée et renvoie le diagnostic de charge.
 *
 * @returns {{capacite: number, restantes: number, parJourNecessaire: number|null,
 *            tientDansLeTemps: boolean}}
 */
export function useWorkloadEngine() {
  const { config, coursConfig, historique, setConfig } = useStore();
  const derniereEcriture = useRef(0);
  const configRef = useRef(config);
  configRef.current = config;

  const capacite = capaciteQuotidienne(config);

  useEffect(() => {
    const courante = configRef.current;
    if (!courante || !coursConfig) return;

    // La capacité déclarée fait foi. L'orchestrateur lit `maxStudyHoursPerDay` :
    // on l'y recopie, sans jamais la recalculer à partir d'une ambition.
    const derniere = useStore.getState().config;
    const maintenant = Date.now();
    if (
      derniere
      && derniere.maxStudyHoursPerDay !== capacite
      && maintenant - derniereEcriture.current > DELAI_ECRITURE_MS
    ) {
      derniereEcriture.current = maintenant;
      setConfig({ ...derniere, maxStudyHoursPerDay: capacite });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacite, coursConfig, historique]);

  const charge = chargeRestante(coursConfig, historique, config);
  const parJourNecessaire = charge.joursRestants ? charge.restantes / charge.joursRestants : null;

  return {
    capacite,
    restantes: charge.restantes,
    joursRestants: charge.joursRestants,
    parJourNecessaire,
    // Un programme qui déborde ne doit pas allonger les journées : il signale
    // qu'il faut resserrer le périmètre, revoir l'ambition, ou accepter de
    // laisser une matière de côté. C'est une décision, pas un automatisme.
    tientDansLeTemps: parJourNecessaire === null || parJourNecessaire <= capacite,
  };
}

export { capaciteQuotidienne, chargeRestante, CAPACITE_DEFAUT, CAPACITE_MIN, CAPACITE_MAX };
