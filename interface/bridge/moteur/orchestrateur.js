/**
 * ORCHESTRATEUR v3 — Générateur de rapport quotidien (Scheduler).
 * Importe l'intelligence (maps d'analyse) et le scoring (priorités).
 * Orchestre le tout pour produire le planning du jour.
 *
 * v3 ajoute :
 *   - Carte de projection détaillée (intervalles de confiance, tendances, anomalies)
 *   - Carte de synergie inter-matières par chevauchement de concepts
 *   - Détection du chronotype pour l'ordonnancement horaire
 *   - Prévision de charge de travail sur 7 jours
 */


const MAGIC_CONSTANTS = {
  PRIO_MAX_ANKI: 9999,
  PRIO_MAX_RETARD: 999,
  PRIO_WEEKEND_TP: 500,
  BOOST_CRISE_NOTE: 2.0,
  BOOST_PREP_TD: 1.5,
  BOOST_ANNALE_URGENT: 5.0,
  BOOST_ANNALE_NORMAL: 3.0,
  BOOST_INACTIVITE_MAX: 3.0,
};
const { loadConfig } = require('./config');
const { loadCours } = require('./cours');
const {
  getTodayString,
  getDayOfWeekString,
  buildCompensationMap,
  buildRemainingWeightMap,
  buildVelocityMap,
  detectBurnoutRisk,
  buildProjectedScoreMap,
  buildProjectedScoreDetailMap,
  buildCognitiveLoadMap,
  buildExamUrgencyMap,
  buildTimeOptimizationMap,
  buildSynergyMap,
  buildWorkloadForecast
} = require('./intelligence');
const { getDifficultyMultiplier, getPrioScore, getSubjectExamBoost, getCapitalisedUEs, fuzzyLookupExamUrgency } = require('./scoring');
const { calculerPriorite, contexteDepuisExercice } = require('./priorite');
const { etatObjectifs } = require('./objectifs');
const { synthetiserVitesse } = require('./vitesse');
const { planifierTP, dureeEtape, motifLisible } = require('./tp');
const { synthetiserCouverture } = require('./couverture');
const { autoriseTD, autoriseAnnales } = require('./prerequis');
const { tachesLangues } = require('./langues');

/**
 * Part maximale de la journée que le matériau neuf peut consommer tant que des
 * révisions sont dues.
 *
 * Un chapitre jamais ouvert reçoit d'office le retard maximal (PRIO_MAX_RETARD),
 * donc la priorité plafond, en permanence. Une révision due n'atteint ce plafond
 * qu'après dix jours de retard : au mieux elle égalise, jamais elle ne dépasse. À
 * quoi s'ajoutait le coût — 120 minutes pour un CM neuf contre 30 pour une
 * révision. Le neuf gagnait la priorité et mangeait le temps.
 *
 * Conséquence mesurée sur un cursus réel : 15 CM neufs programmés sur sept jours,
 * et pas une seule révision, alors que le rapport annonçait chaque jour 25 heures
 * de révisions dues. Un système de répétition espacée qui ne programme jamais de
 * répétition ne fait pas son travail.
 *
 * La moitié de la journée est donc réservée aux révisions dès qu'il en existe.
 * L'autre moitié reste au neuf, qui n'est jamais bloqué : la découverte continue,
 * simplement à un rythme qui laisse la place au réapprentissage.
 */
const PART_MAX_NOUVEAU = 0.5;

/** Points ajoutés à un cours dont le TD figure au programme du jour. */
const BONUS_PREPA_TD = 8;

const { loadRLState } = require('./rlEngine');

const { normalizeDateStr, parseDateLocal } = require('./utils');

/**
 * Identifiant stable d'une tâche : `type::matiere::titre`.
 * Stable d'une génération de rapport à l'autre (contrairement à un UUID), ce qui
 * permet à l'interface de dédoublonner, de persister l'ordre du drag & drop et de
 * retirer précisément une tâche validée sans toucher à ses homonymes.
 */
function buildTaskId(t) {
  const norm = (v) => String(v || '').toLowerCase().trim();
  return `${norm(t.type)}::${norm(t.matiere)}::${norm(t.titre)}`;
}

/**
 * Attache à une tâche sa priorité explicable.
 *
 * `prio` reste le score historique, propre à chaque catégorie et d'amplitude
 * libre. `priorite` est borné entre 0 et 100 et comparable d'une catégorie à
 * l'autre, ce qui permet de classer les matières entre elles sans que le
 * produit d'une douzaine de facteurs ne fasse tout basculer.
 */
function attacherPriorite(tache, exercice, matiere, options = {}) {
  const contexte = contexteDepuisExercice(exercice, matiere, options);
  const { score, composantes, modificateurs, raisons } = calculerPriorite(contexte);

  tache.priorite = score;
  tache.explication = { composantes, modificateurs, raisons };
  return tache;
}

/**
 * Ordre de traitement d'un pool.
 *
 * `priorite` tranche en premier : c'est la seule échelle bornée et comparable,
 * construite sur des critères explicites. `prio`, le score historique, ne sert
 * plus qu'à départager — il reste utile pour cela, mais son amplitude libre
 * (un produit d'une douzaine de facteurs) ne doit plus décider seule : un
 * exercice cumulant deux multiplicateurs extrêmes écrasait tous les autres,
 * quel que soit leur retard réel.
 */
function parPriorite(a, b) {
  const pa = Number.isFinite(a.priorite) ? a.priorite : 0;
  const pb = Number.isFinite(b.priorite) ? b.priorite : 0;
  if (pb !== pa) return pb - pa;
  return (b.prio || 0) - (a.prio || 0);
}

/** Jours restants avant l'examen d'une matière, ou undefined. */
function joursAvantExamenDe(examUrgencyMap, nomMatiere) {
  if (!nomMatiere) return undefined;
  const donnees = fuzzyLookupExamUrgency(examUrgencyMap, String(nomMatiere).toLowerCase().trim());
  // Une date deduite de la fin du semestre ne vaut pas une epreuve declaree :
  // la rendre ici ferait ecrire « Examen a venir » sous une matiere dont aucune
  // epreuve n'est datee.
  if (donnees && donnees.estimee) return undefined;
  const jours = donnees && donnees.daysToExam;
  return Number.isFinite(jours) ? jours : undefined;
}

function buildTaskPools({
  crs, cfg, todayStr, tomorrowStr, isWeekend, examUrgencyMap, remainingWeightMap,
  compensationMap, velocityMap, projectedScoreMap, projectedScoreDetail, matieresSatureesToday, fillGap, now, parityJour,
  matieresDejaTravaillees = new Set(), nouvellesMatieres = new Set(),
  bypassInterleaving = false, rlState = null
}) {
  const poolCM = [];
  const poolTD = [];
  const poolTP = [];
  const poolAnnales = [];

  const maxNewCMPerSubject = cfg.maxNewCMPerSubjectPerDay !== undefined ? cfg.maxNewCMPerSubjectPerDay : 1;
  const maxNewCMPerSemester = cfg.maxNewCMPerSemesterPerDay !== undefined ? cfg.maxNewCMPerSemesterPerDay : 3;

  let licenceIdx = 0;
  for (const l of (crs.licences || [])) {
    if (l.archived) { licenceIdx++; continue; }
    
    const capitalisedUEs = getCapitalisedUEs(l);

    let semestreIdx = 0;
    for (const s of (l.semestres || [])) {
      if (s.archived) { semestreIdx++; continue; }
      if (s.dateFin) {
        const df = parseDateLocal(normalizeDateStr(s.dateFin));
        if (df && df < now) { semestreIdx++; continue; }
      }
      let matiereIndexDansSemestre = 0;
      for (const ue of (s.ues || [])) {
        if (capitalisedUEs.has(ue.nom)) continue;

        const ueMatiereNames = (ue.matieres || []).map(m => (m.nom || '').toLowerCase().trim()).filter(Boolean);
        for (const m of (ue.matieres || [])) {
          m._ueMatieres = ueMatiereNames;
          if (m.dispense) {
            matiereIndexDansSemestre++;
            continue;
          }
          const examData = getSubjectExamBoost(m, examUrgencyMap);
          const examBoostOriginal = examData.boost;
          const daysToExam = examData.daysToExam;

          // Bouclier Anti-Décrochage
          let lastPratiqueMs = 0;
          const checkDate = (dStr) => {
            const norm = normalizeDateStr(dStr);
            if (norm) {
              const d = parseDateLocal(norm).getTime();
              if (d > lastPratiqueMs) lastPratiqueMs = d;
            }
          };
          (m.listeCM || []).forEach(x => checkDate(x.derniereRevision));
          (m.listeTD || []).forEach(x => checkDate(x.dernierePratique));
          (m.listeTP || []).forEach(x => checkDate(x.dernierePratique));
          (m.listeAnnales || []).forEach(x => checkDate(x.dernierePratique));

          let discoveryBoost = 1.0;
          let inactivityBoost = 1.0;
          if (lastPratiqueMs > 0) {
            const daysInactive = (now.getTime() - lastPratiqueMs) / (1000 * 60 * 60 * 24);
            if (daysInactive > 7) {
              inactivityBoost = Math.min(MAGIC_CONSTANTS.BOOST_INACTIVITE_MAX, 1.0 + (daysInactive - 7) / 7);
            }
          } else {
            // BOOST DE DÉCOUVERTE : la matière n'a jamais été pratiquée.
            discoveryBoost = 2.0;
            if (nouvellesMatieres) nouvellesMatieres.add(m.nom);
          }

          let intraDayPenalty = matieresDejaTravaillees.has(m.nom) ? 0.5 : 1.0;

          /*
           * Une crise de note suppose une note.
           *
           * La projection fusionne trois sources — notes, maîtrise du programme,
           * rétention Anki — et sait très bien dire laquelle a parlé : elle porte
           * son échantillon et son intervalle de confiance. On n'en lisait ici que
           * le point. Or une matière sans aucune note, dont aucun chapitre n'est
           * encore maîtrisé, se projette à 0 sur 20 — avec un intervalle immense,
           * précisément parce que rien ne l'appuie.
           *
           * Le programme du jour en tirait « URGENCE_NOTE » et un boost de 2×.
           * Au premier jour d'une année, où aucune matière n'a de note et aucun
           * chapitre n'est maîtrisé, les dix-neuf matières auraient toutes été
           * déclarées en crise en même temps : un signal que tout le monde porte
           * n'en est plus un, et il annonçait à l'étudiant une note en danger
           * qu'il n'avait pas. Le fait d'être neuf est déjà dit par DECOUVERTE.
           */
          let crisisBoost = 1.0;
          const cleProjection = m.nom.toLowerCase().trim();
          const projete = projectedScoreMap ? projectedScoreMap[cleProjection] : undefined;
          const detailProjete = projectedScoreDetail ? projectedScoreDetail[cleProjection] : null;
          const reposeSurDesNotes = Boolean(detailProjete && detailProjete.sampleSize > 0);
          if (projete !== undefined && projete < 5.0 && reposeSurDesNotes) {
            crisisBoost = MAGIC_CONSTANTS.BOOST_CRISE_NOTE;
          }

          const examBoost = examBoostOriginal * inactivityBoost * crisisBoost;
          const baseRaisons = [];
          if (discoveryBoost > 1.0) baseRaisons.push("DECOUVERTE");
          if (inactivityBoost > 1.0) baseRaisons.push("REPRISE_EN_MAIN");
          if (crisisBoost > 1.0) baseRaisons.push("URGENCE_NOTE");

          if (daysToExam < 60 && !examData.estimee) baseRaisons.push("EXAMEN_PROCHE");
          else if (examBoostOriginal > 1.0) baseRaisons.push("COEF_ELEVE");

          // --- CM ---
          let newCMCountPerMatiere = 0;
          for (const cm of (m.listeCM || [])) {
            // AXE DATE CM : Ne pas planifier un CM qui n'a pas encore eu lieu
            if (cm.dateCM) {
              const dateCM = parseDateLocal(cm.dateCM);
              const nowDate = parseDateLocal(todayStr);
              if (nowDate < dateCM) continue; 
            }

            let doitReviser = false;
            let joursEnRetard = 0;
            if (!cm.derniereRevision) {
              if (matieresSatureesToday.has(m.nom)) continue;
              if (!fillGap && (newCMCountPerMatiere >= maxNewCMPerSubject)) continue;

              doitReviser = true;
              joursEnRetard = MAGIC_CONSTANTS.PRIO_MAX_RETARD;
              newCMCountPerMatiere++;
            } else {
              const targetDateStr = normalizeDateStr(cm.prochaineRevisionDate);
              if (targetDateStr) {
                const targetDate = parseDateLocal(targetDateStr);
                const nowDate = parseDateLocal(todayStr);
                const joursEcoules = Math.floor((nowDate - targetDate) / (1000 * 60 * 60 * 24));
                if (joursEcoules >= (fillGap ? -3 : 0)) {
                  doitReviser = true;
                  joursEnRetard = joursEcoules;
                }
              } else {
                const normRev = normalizeDateStr(cm.derniereRevision);
                const revDate = parseDateLocal(normRev);
                const nowDate = parseDateLocal(todayStr);
                if (isNaN(revDate.getTime())) {
                  doitReviser = true;
                  joursEnRetard = MAGIC_CONSTANTS.PRIO_MAX_RETARD;
                } else {
                  const joursEcoules = Math.floor((nowDate - revDate) / (1000 * 60 * 60 * 24));
                  if (cm.jActuel > 0 && joursEcoules >= cm.jActuel) {
                    doitReviser = true;
                    joursEnRetard = joursEcoules - cm.jActuel;
                  } else if (cm.jActuel === 0 && joursEcoules > 0) {
                    doitReviser = true;
                    joursEnRetard = joursEcoules;
                  }
                }
              }
            }

            if (doitReviser) {
              const retardPondere = Math.min(joursEnRetard, 10) * 0.5;
              const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
              const rotateBonus = ((dayOfYear + matiereIndexDansSemestre) % 11) * 0.001;
              const prioCM = ((1 + retardPondere) * examBoost * discoveryBoost + rotateBonus) * intraDayPenalty;
              const dureeBase = (cm.jActuel === 0) ? (cfg.defaultDurationNewCM || 120) : (cfg.defaultDurationRevCM || 30);
              const dureeEstimee = (cm.tempsMoyen != null && cm.tempsMoyen > 0) ? cm.tempsMoyen : dureeBase;

              poolCM.push(attacherPriorite({
                _semestreId: `L${licenceIdx}-S${semestreIdx}`,
                matiere: m.nom,
                type: "CM",
                titre: cm.titre,
                dureeMinutes: Math.round(dureeEstimee),
                fichePdfPath: cm.fichePdfPath || "",
                pdfPath: cm.pdfPath || "",
                pdfPaths: cm.pdfPaths || [],
                prio: prioCM,
                isNew: !cm.derniereRevision,
                // Retard réel et intervalle prévu : ce qui distingue une révision
                // due aujourd'hui d'une abandonnée depuis trois semaines. Le
                // statut du jour en dépend.
                joursEnRetard: cm.derniereRevision ? joursEnRetard : 0,
                jActuel: cm.jActuel || 0,
                raisons: [...baseRaisons]
              }, cm, m, { joursAvantExamen: joursAvantExamenDe(examUrgencyMap, m.nom) }));
            }
          }

          // Interleaving Intelligent (Parité dynamique)
          let activePourExercices = bypassInterleaving || ((matiereIndexDansSemestre % 2) === parityJour);
          if (examBoost >= 2.0) activePourExercices = true;
          matiereIndexDansSemestre++;

          if (!activePourExercices) continue;

          // --- Théorie avant pratique, sans bloquer le semestre ---
          // Un seuil unique à 70 % interdisait tout exercice pendant les
          // premières semaines — celles où la pratique ancre le mieux les
          // notions fraîches — et bloquait jusqu'aux TP, dont la date est
          // pourtant imposée. La contrainte porte désormais sur chaque type
          // d'activité, au plus près de ce qu'il exige réellement.
          const totalCM = m.listeCM?.length || 0;
          const cmRevises = (m.listeCM || []).filter(cm => cm.derniereRevision).length;
          const cmCompletionRatio = totalCM > 0 ? cmRevises / totalCM : 1;
          const feuVertTD = autoriseTD(m);

          // --- TD ---
          if (cfg.enableTD && feuVertTD.autorise) {
            for (const ex of (m.listeTD || []).filter(e => e.dernierePratique !== todayStr)) {
              // AXE DATE : Ne pas planifier un TD qui n'a pas encore eu lieu
              if (ex.datePrevue) {
                const datePr = parseDateLocal(ex.datePrevue);
                const nowDate = parseDateLocal(todayStr);
                if (nowDate < datePr) continue; 
              }

              if (!ex.dernierePratique && matieresSatureesToday.has(m.nom)) continue;

              const dureeBase = cfg.defaultDurationTD || 20;
              const dureeEstimee = (ex.tempsMoyen != null && ex.tempsMoyen > 0) ? ex.tempsMoyen : (dureeBase * getDifficultyMultiplier(ex.difficulte));
              poolTD.push(attacherPriorite({
                _semestreId: `L${licenceIdx}-S${semestreIdx}`,
                matiere: m.nom,
                type: "TD",
                titre: ex.titre,
                dureeMinutes: Math.round(dureeEstimee),
                pdfPath: ex.pdfPath || "",
                pdfPaths: ex.pdfPaths || [],
                page: ex.page || 1,
                difficulte: ex.difficulte || "",
                prio: getPrioScore(ex, examUrgencyMap, m, remainingWeightMap, compensationMap, velocityMap, projectedScoreDetail, rlState) * inactivityBoost * discoveryBoost * intraDayPenalty,
                raisons: [...baseRaisons]
              }, ex, m, { joursAvantExamen: joursAvantExamenDe(examUrgencyMap, m.nom) }));
            }
          }

          // --- TP ---
          // Le rétro-planning part de la date de séance : préparation le
          // week-end qui précède, vérification le lendemain à tête reposée,
          // révision la veille, séance et rendu le jour même.
          for (const ex of (m.listeTP || [])) {
            const plan = planifierTP(ex, now.getTime());
            if (!plan) continue;

            const dureeEstimee = dureeEtape(plan.etape.rang, cfg, ex);

            let tpPrio = getPrioScore(ex, examUrgencyMap, m, remainingWeightMap, compensationMap, velocityMap, projectedScoreDetail, rlState);
            if (plan.urgence === 'immediate') tpPrio = MAGIC_CONSTANTS.PRIO_MAX_RETARD * 2;
            else if (plan.urgence === 'haute') tpPrio = MAGIC_CONSTANTS.PRIO_MAX_RETARD;
            else if (isWeekend) tpPrio += MAGIC_CONSTANTS.PRIO_WEEKEND_TP;

            const raisonsTP = [...baseRaisons, plan.motif];
            const explication = motifLisible(plan);

            const tache = attacherPriorite({
              _semestreId: `L${licenceIdx}-S${semestreIdx}`,
              matiere: m.nom,
              type: "TP",
              titre: ex.titre,
              dureeMinutes: Math.round(dureeEstimee),
              tempsMoyen: (ex.tempsMoyenEtapes || [])[plan.etape.rang - 1] || null,
              pdfPath: ex.pdfPath || "",
              pdfPaths: ex.pdfPaths || [],
              page: ex.page || 1,
              difficulte: ex.difficulte || "",
              prio: tpPrio * inactivityBoost * discoveryBoost * intraDayPenalty,
              etape: plan.etape.rang,
              etapeNom: plan.etape.nom,
              etapeIntention: plan.etape.intention,
              joursAvantTP: plan.joursAvant,
              raisons: raisonsTP
            }, ex, m, { joursAvantExamen: joursAvantExamenDe(examUrgencyMap, m.nom) });

            /*
             * Une séance imminente prime sur tout le reste : elle a lieu que le
             * travail soit prêt ou non.
             *
             * La priorité calculée est ici écrasée, et il faut le dire : sans
             * cette mention, l'écran affichait 100 sous une explication dont
             * les composantes donnaient tout autre chose. Le bonus de
             * préparation TD, plus bas, inscrit déjà sa raison ; celui-ci ne
             * le faisait pas.
             */
            const noterSurcharge = (motif) => {
              if (tache.explication && Array.isArray(tache.explication.raisons)) {
                tache.explication.raisons.unshift(motif);
              }
            };
            if (plan.urgence === 'immediate') {
              tache.priorite = 100;
              noterSurcharge('Séance imminente : priorité portée au maximum.');
            } else if (plan.urgence === 'haute') {
              const avant = tache.priorite || 0;
              tache.priorite = Math.max(avant, 90);
              if (tache.priorite !== avant) noterSurcharge('Séance proche : priorité relevée à 90.');
            }
            if (explication) tache.explication.raisons.unshift(explication);

            poolTP.push(tache);
          }

          // --- Annales ---
          const cmCompletion = cmCompletionRatio;

          const totalTD = m.listeTD?.length || 0;
          const tdFaits = (m.listeTD || []).filter(td => td.dernierePratique).length;
          const tdCompletion = totalTD > 0 ? (tdFaits / totalTD) : 1;
          const tpFaits = (m.listeTP || []).reduce((acc, tp) => acc + (tp.nombrePratiques || 0), 0);

          /*
           * Trois affirmations qui se tiraient de l'absence de données.
           *
           * `cmCompletion` et `tdCompletion` valent 1 quand la liste est vide :
           * lisible comme « rien à faire » pour l'ordonnancement, mais lu ici
           * comme « tout est fait ». Une matière où aucun chapitre ni aucun TD
           * n'est encore saisi — les dix-neuf, aujourd'hui — se déclarait donc
           * maîtrisée, et le programme ouvrait ses annales en conséquence. On
           * exige désormais qu'il y ait quelque chose à maîtriser.
           *
           * `isUrgent`, lui, répète le défaut déjà corrigé plus haut pour
           * EXAMEN_PROCHE : faute d'épreuve datée, `daysToExam` retombe sur la
           * fin du semestre. À trois semaines de celle-ci, toutes les matières
           * criaient « EXAMEN_IMMINENT » ensemble, sans qu'aucun examen ne soit
           * déclaré nulle part.
           */
          const isEarlyReady = tdFaits >= 2 || tpFaits >= 1;
          const aDuContenu = totalCM > 0 || totalTD > 0;
          const isMastered = (aDuContenu && cmCompletion >= 0.70 && tdCompletion >= 0.50) || isEarlyReady;
          const isUrgent = daysToExam <= 21 && !examData.estimee;
          const hasStartedAnnales = (m.listeAnnales || []).some(a => (a.nombrePratiques || 0) > 0 || a.dernierePratique);

          const annalesRaisons = [...baseRaisons];
          if (isUrgent) annalesRaisons.push("EXAMEN_IMMINENT");
          else if (isEarlyReady && !isMastered) annalesRaisons.push("DEFI_PRECOCE");
          else if (isMastered) annalesRaisons.push("MAITRISE_ATTEINTE");

          const feuVertAnnales = autoriseAnnales(m, {
            urgent: isUrgent,
            dejaCommencees: hasStartedAnnales,
          });
          if (feuVertAnnales.autorise && (isMastered || isUrgent || hasStartedAnnales) && cfg.enableAnnales) {
            for (const ex of (m.listeAnnales || []).filter(e => e.dernierePratique !== todayStr)) {
              // AXE DATE : Ne pas planifier une Annale qui n'a pas encore eu lieu
              if (ex.datePrevue) {
                const datePr = parseDateLocal(ex.datePrevue);
                const nowDate = parseDateLocal(todayStr);
                if (nowDate < datePr) continue;
              }

              if (!ex.dernierePratique && matieresSatureesToday.has(m.nom)) continue;
              if ((ex.nombrePratiques || 0) >= 3 && !isUrgent) continue;

              // Cooldown de 7 jours (Espacement)
              if (ex.dernierePratique && !isUrgent) {
                const lastDate = parseDateLocal(normalizeDateStr(ex.dernierePratique));
                if (!isNaN(lastDate.getTime())) {
                  const daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
                  if (daysSince < 7) continue;
                }
              }
              const dureeBase = cfg.defaultDurationAnnales || 60;
              const dureeEstimee = (ex.tempsMoyen != null && ex.tempsMoyen > 0) ? ex.tempsMoyen : (dureeBase * getDifficultyMultiplier(ex.difficulte));
              let basePrio = getPrioScore(ex, examUrgencyMap, m, remainingWeightMap, compensationMap, velocityMap, projectedScoreDetail, rlState);
              const annaleBoost = isUrgent ? MAGIC_CONSTANTS.BOOST_ANNALE_URGENT : MAGIC_CONSTANTS.BOOST_ANNALE_NORMAL;

              poolAnnales.push(attacherPriorite({
                _semestreId: `L${licenceIdx}-S${semestreIdx}`,
                matiere: m.nom,
                type: "ANNALE",
                titre: ex.titre,
                dureeMinutes: Math.round(dureeEstimee),
                pdfPath: ex.pdfPath || "",
                pdfPaths: ex.pdfPaths || [],
                page: ex.page || 1,
                difficulte: ex.difficulte || "",
                prio: basePrio * annaleBoost * intraDayPenalty,
                raisons: [...annalesRaisons]
              }, ex, m, { joursAvantExamen: joursAvantExamenDe(examUrgencyMap, m.nom) }));
            }
          }
        }
      }
      semestreIdx++;
    }
    licenceIdx++;
  }
  return { poolCM, poolTD, poolTP, poolAnnales };
}

/**
 * Fonction principale (sans persistance).
 * Retourne le rapport d'orchestration
 */
function genererRapportQuotidien(extraTimeMin = 0, fillGap = false, ankiStats = null) {
  const cfg = loadConfig();
  const crs = loadCours();
  const rapport = {};

  const todayStr = getTodayString();
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));

  const tomorrowDate = new Date(now);
  tomorrowDate.setHours(tomorrowDate.getHours() - 4);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.getFullYear() + '-' + String(tomorrowDate.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrowDate.getDate()).padStart(2, '0');
  const dayOfWeek = now.getDay();
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

  let historique = [];
  try {
    const { loadHistorique } = require('./historique');
    historique = loadHistorique();
  } catch (e) {
    console.error("Erreur lecture historique:", e);
  }

  // --- Cartes d'intelligence v3 ---
  const compensationMap = buildCompensationMap(crs);
  const remainingWeightMap = buildRemainingWeightMap(crs);
  const velocityMap = buildVelocityMap(crs, historique, cfg);
  const cognitiveLoadMap = buildCognitiveLoadMap(crs);
  const burnoutRisk = detectBurnoutRisk(cfg, historique);
  const projectedScoreMap = buildProjectedScoreMap(crs, velocityMap, ankiStats);
  const projectedScoreDetail = buildProjectedScoreDetailMap(crs, velocityMap, ankiStats);
  const timeOptimizationMap = buildTimeOptimizationMap(historique, cfg);
  const synergyMap = buildSynergyMap(crs);
  const workloadForecast = buildWorkloadForecast(historique, cfg);
  const rlState = loadRLState();

  rapport.intelligence = {
    compensationMap,
    remainingWeightMap,
    velocityMap,
    cognitiveLoadMap,
    burnoutRisk,
    projectedScoreMap,
    projectedScoreDetail,
    timeOptimizationMap,
    synergyMap,
    workloadForecast
  };

  // Régime de travail, engagements de la semaine et paliers franchis.
  // La charge quotidienne découle désormais de la capacité déclarée par
  // l'étudiant, et non plus d'une note visée : viser haut change la
  // répartition du temps, pas le nombre d'heures exigées.
  rapport.objectifs = etatObjectifs(cfg, historique, crs);

  // Vitesse de résolution rapportée à la durée réelle des épreuves. Savoir
  // qu'on ne finira pas le sujet est une information qu'aucun enseignant ne
  // donne, et qu'on découvre sinon le jour de l'examen.
  rapport.vitesse = synthetiserVitesse(crs);

  // Reste-t-il assez de jours pour ouvrir les chapitres jamais abordés ? Une
  // matière peut être bien travaillée et rester perdue d'avance ; le savoir en
  // octobre laisse encore le temps d'agir.
  rapport.couverture = synthetiserCouverture(crs, cfg);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');
  
  // A 'rest' day means very little to no work was done. Let's say < 10 mins is a rest.
  const workYesterdayMin = historique
    .filter(h => h.timestamp.startsWith(yesterdayStr))
    .reduce((sum, h) => sum + (h.dureeMinutes || 0), 0);
  const restedYesterday = workYesterdayMin < 10;

  // Anti-Burnout
  if (burnoutRisk.shouldForceRest) {
    if (restedYesterday) {
      if (!cfg.skippedRestDays.includes(todayStr)) {
        rapport.statut = "REPOS_OPTIONNEL";
        rapport.tachesDuJour = [];
        rapport.tempsRequisMin = 0;
        rapport.tempsDispoMin = 0;
        rapport.message = `🛡️ Anti-Burnout : C'est votre 2ème jour de repos. Ressentez-vous le besoin de prolonger ?`;
        return rapport;
      }
    } else {
      rapport.statut = "REPOS";
      rapport.tachesDuJour = [];
      rapport.tempsRequisMin = 0;
      rapport.tempsDispoMin = 0;
      rapport.message = `🛡️ Anti-Burnout activé : ${burnoutRisk.reason}`;
      return rapport;
    }
  }

  // Mode repos
  const todayIsRest = cfg.restDays && cfg.restDays.includes(todayStr);
  const yesterdayWasRest = cfg.restDays && cfg.restDays.includes(yesterdayStr);

  const studyStartStr = normalizeDateStr(cfg.studyStartDate);
  const studyStart = parseDateLocal(studyStartStr);
  const isPreparationPhase = (!isNaN(studyStart.getTime()) && now < studyStart);

  // Règle d'anticipation : Week-ends en repos optionnel durant la phase de préparation
  if (isPreparationPhase && isWeekend && !todayIsRest) {
    if (!cfg.skippedRestDays.includes(todayStr)) {
      rapport.statut = "REPOS_OPTIONNEL";
      rapport.tachesDuJour = [];
      rapport.tempsRequisMin = 0;
      rapport.tempsDispoMin = 0;
      rapport.message = "Phase de préparation : C'est le week-end ! Prends le temps de te reposer, ou choisis tes tâches manuellement.";
      return rapport;
    }
  }

  if (todayIsRest || yesterdayWasRest) {
    if (yesterdayWasRest && !todayIsRest) {
      if (!cfg.skippedRestDays.includes(todayStr)) {
        rapport.statut = "REPOS_OPTIONNEL";
        rapport.tachesDuJour = [];
        rapport.tempsRequisMin = 0;
        rapport.tempsDispoMin = 0;
        rapport.message = "Hier était un jour de repos. As-tu besoin d'un 2ème jour de récupération aujourd'hui ?";
        return rapport;
      }
    } else if (todayIsRest) {
      if (yesterdayWasRest || restedYesterday) {
        if (!cfg.skippedRestDays.includes(todayStr)) {
          rapport.statut = "REPOS_OPTIONNEL";
          rapport.tachesDuJour = [];
          rapport.tempsRequisMin = 0;
          rapport.tempsDispoMin = 0;
          rapport.message = "C'est votre 2ème jour de repos. Voulez-vous prolonger la récupération ?";
          return rapport;
        }
      } else {
        rapport.statut = "REPOS";
        rapport.tachesDuJour = [];
        rapport.tempsRequisMin = 0;
        rapport.tempsDispoMin = 0;
        rapport.message = "Jour de repos imposé. Recharge tes batteries !";
        return rapport;
      }
    }
  }

  const examUrgencyMap = buildExamUrgencyMap(crs);

  // 1. Calculate available time
  const heuresTravailJour = Math.max(1, cfg.maxStudyHoursPerDay || 8);
  const maxSubjectsPerDay = cfg.maxSubjectsPerDay || 4;
  let tempsLibreMin = heuresTravailJour * 60;

  const todayName = getDayOfWeekString();
  let fixedCommitmentsMin = 0;
  let matieresSatureesToday = new Set();
  if (Array.isArray(cfg.fixedCommitments)) {
    cfg.fixedCommitments.forEach(c => {
      if (c.day === todayName || c.day === 'Tous les jours') {
        if (c.matiereLinked) {
          matieresSatureesToday.add(c.matiereLinked);
        }
        if (c.start && c.end) {
          const [h1, m1] = c.start.split(':').map(Number);
          const [h2, m2] = c.end.split(':').map(Number);
          if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
            let startMin = h1 * 60 + m1;
            let endMin = h2 * 60 + m2;
            if (endMin >= startMin) {
              fixedCommitmentsMin += (endMin - startMin);
            } else {
              fixedCommitmentsMin += (24 * 60 - startMin) + endMin;
            }
          }
        }
      }
    });
  }

  tempsLibreMin -= fixedCommitmentsMin;
  if (tempsLibreMin < 0) tempsLibreMin = 0;

  tempsLibreMin += extraTimeMin;
  /*
   * `tempsDispoMin` est le budget de la journée entière, avant déduction de ce
   * qui a déjà été fait — et c'est voulu. Le tableau de bord l'affiche comme
   * objectif et compare `tempsDejaTravailleMin` à lui pour remplir sa barre ;
   * en retrancher le travail accompli ferait fuir l'objectif à mesure qu'on
   * l'atteint. Seule la variable locale `tempsLibreMin` continue de décroître,
   * plus bas, pour dimensionner le programme restant.
   */
  rapport.tempsDispoMin = tempsLibreMin;
  rapport.fixedCommitmentsMin = fixedCommitmentsMin;

  // 2. Temps déjà travaillé aujourd'hui
  let tempsDejaTravailleMin = 0;
  let tempsMesureMin = 0;
  let tempsEstimeMin = 0;
  let seancesSansDuree = 0;
  let matieresDejaTravaillees = new Set();
  if (historique && Array.isArray(historique)) {
    const todayEntries = historique.filter(h => {
      if (!h.timestamp) return false;
      const d = new Date(h.timestamp);
      d.setHours(d.getHours() - 4);
      const dStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      return dStr === todayStr;
    });

    matieresDejaTravaillees = new Set(todayEntries.map(h => h.matiere));

    /*
     * Mesuré et estimé comptaient ensemble, sous un seul nom.
     *
     * Le tableau de bord affiche deux chiffres à quelques centimètres l'un de
     * l'autre : la tuile « Travaillé » de la carte d'accueil, qui somme les
     * seules durées enregistrées, et la barre « travaillées / objectif », qui
     * lisait ce total-ci, replis par type compris. Une journée de cinq séances
     * dont quatre sans durée affichait 0,8 h à un endroit et 2 h 55 juste en
     * dessous — un facteur près de quatre, sur le même écran, pour la même
     * journée. Le Répétiteur, qui ne compte que le mesuré, en donnait un
     * troisième.
     *
     * Les deux quantités existent légitimement : le budget de la journée doit
     * tenir compte du temps réellement passé, même non enregistré, tandis
     * qu'un chiffre montré à l'étudiant comme une mesure doit être une mesure.
     * Elles sont donc séparées et publiées toutes les deux, la seconde nommée
     * pour ce qu'elle est.
     */
    for (const h of todayEntries) {
      const mins = Number(h.dureeMinutes);
      if (Number.isFinite(mins) && mins > 0) {
        tempsMesureMin += mins;
        continue;
      }
      seancesSansDuree++;
      if (h.type === 'ANKI') tempsEstimeMin += cfg.defaultDurationAnki || 30;
      else if (h.type === 'CM') tempsEstimeMin += cfg.defaultDurationRevCM || 30;
      else if (h.type === 'TD') tempsEstimeMin += cfg.defaultDurationTD || 20;
      else if (h.type === 'TP') tempsEstimeMin += cfg.defaultDurationTP_Etape1 || 45;
      else if (h.type === 'ANNALE') tempsEstimeMin += cfg.defaultDurationAnnales || 60;
      else tempsEstimeMin += 30;
    }
    tempsDejaTravailleMin = tempsMesureMin + tempsEstimeMin;
  }

  // Ce que l'étudiant lit comme « travaillé » : uniquement ce qui a été mesuré,
  // comme le fait la carte d'accueil et comme le fait le Répétiteur.
  rapport.tempsDejaTravailleMin = tempsMesureMin;
  rapport.tempsEstimeSansDureeMin = tempsEstimeMin;
  rapport.seancesSansDuree = seancesSansDuree;

  // Le budget, lui, retranche tout le temps passé : une séance sans durée a
  // quand même occupé la journée.
  tempsLibreMin -= tempsDejaTravailleMin;
  if (tempsLibreMin < 0) tempsLibreMin = 0;

  // Base de parité — réutilisation de studyStart déclaré plus haut
  const parityBase = (!isNaN(studyStart.getTime()) && studyStart <= now) ? studyStart : new Date(now.getFullYear(), 0, 1);
  const parityJour = Math.floor((now - parityBase) / (1000 * 60 * 60 * 24)) % 2;

  const nouvellesMatieres = new Set();
  const { poolCM, poolTD, poolTP, poolAnnales } = buildTaskPools({
    crs, cfg, todayStr, tomorrowStr, isWeekend, examUrgencyMap, remainingWeightMap,
    compensationMap, velocityMap, projectedScoreMap, projectedScoreDetail, matieresSatureesToday, fillGap, now, parityJour,
    matieresDejaTravaillees, nouvellesMatieres, bypassInterleaving: false, rlState
  });

  // 3. Tri par priorité décroissante
  poolAnnales.sort(parPriorite);
  poolCM.sort(parPriorite);
  poolTD.sort(parPriorite);
  poolTP.sort(parPriorite);

  // AXE 14 : un cours dont le TD est au programme du jour passe devant.
  // Le boost porte sur les deux échelles : appliqué au seul score historique,
  // il n'avait plus aucun effet une fois le tri passé sur la priorité bornée.
  const matieresAvecTD = new Set(poolTD.map(td => td.matiere));
  for (const cm of poolCM) {
    if (!matieresAvecTD.has(cm.matiere)) continue;
    cm.prio *= MAGIC_CONSTANTS.BOOST_PREP_TD;
    cm.priorite = Math.min(100, (Number.isFinite(cm.priorite) ? cm.priorite : 0) + BONUS_PREPA_TD);
    if (!cm.raisons.includes("PREPA_TD")) {
      cm.raisons.unshift("PREPA_TD");
    }
  }
  poolCM.sort(parPriorite);

  // 4. Ordonnancement Adaptatif
  const taches = [];
  let tempsRequisMin = 0;

  /*
   * Révisions en souffrance : celles dont l'attente dépasse leur propre
   * intervalle, autrement dit pour lesquelles on a laissé filer plus du double
   * du délai prévu. Un chapitre jamais ouvert n’en fait pas partie : il n’est
   * pas en retard, il est à venir.
   */
  const revisionsDues = poolCM.filter(t => !t.isNew);
  const enSouffranceOrdonnee = revisionsDues
    .filter(t => {
      const intervalle = Number(t.jActuel) || 0;
      const retard = Number(t.joursEnRetard) || 0;
      return intervalle > 0 && retard > intervalle;
    })
    .sort((a, b) => (b.joursEnRetard || 0) - (a.joursEnRetard || 0));

  /*
   * Réserve pour les révisions dues : on ne prélève que ce dont elles ont
   * réellement besoin, dans la limite de la moitié de la journée. Un arriéré de
   * 25 heures ne confisque donc pas tout le temps, et une journée sans révision
   * due laisse le neuf disposer de la journée entière.
   */
  const tempsRevisionsDues = poolCM.reduce((acc, t) => acc + (t.isNew ? 0 : t.dureeMinutes), 0);
  const reserveRevisions = Math.min(tempsRevisionsDues, Math.floor(tempsLibreMin * PART_MAX_NOUVEAU));
  /*
   * Ce budget couvre tout ce qui ne se périme pas : la découverte, mais aussi
   * les annales. Elles étaient servies avant tout le reste, et deux d'entre
   * elles suffisaient à consommer 120 des 300 minutes d’une journée — devant
   * des révisions abandonnées depuis quatre mois. Le code disait pourtant
   * lui-même qu'une annale « ne se périme pas » : elle ne doit donc pas passer
   * devant ce qui se périme.
   */
  /*
   * La reprise du jour a sa place réservée, pas les miettes. Sans réservation,
   * elle ne se produisait pas les journées pleines — précisément celles où le
   * retard s'installe — ou bien elle faisait déborder la journée déclarée.
   */
  const repriseDuJour = enSouffranceOrdonnee[0] || null;
  const reserveReprise = repriseDuJour ? repriseDuJour.dureeMinutes : 0;
  const budgetHorsRevisionMin = Math.max(0, tempsLibreMin - reserveRevisions - reserveReprise);
  let tempsHorsRevisionMin = 0;

  /*
   * La routine Anki n'a de sens que si un paquet existe. Elle était proposée
   * sans condition : au premier lancement, avec un cursus encore vide, elle
   * était la seule tâche de la journée — et elle ne menait nulle part, aucune
   * matière n’ayant de paquet rattaché. Le jour de la rentrée est le pire
   * moment pour donner à une application l’air de tourner à vide.
   */
  const auMoinsUnPaquetAnki = (crs?.licences || []).some(l =>
    (l.semestres || []).some(sem =>
      (sem.ues || []).some(ue =>
        (ue.matieres || []).some(m =>
          Boolean(m.ankiDeckName) || (m.listeCM || []).some(cm => Boolean(cm.ankiDeck))))));

  if (auMoinsUnPaquetAnki && (!cfg.dernierePratiqueAnki || cfg.dernierePratiqueAnki !== todayStr)) {
    taches.push({
      matiere: "Routine",
      type: "ANKI",
      titre: "Révision Flashcards",
      dureeMinutes: cfg.defaultDurationAnki || 30,
      prio: MAGIC_CONSTANTS.PRIO_MAX_ANKI,
      priorite: 95,
      explication: { composantes: [], modificateurs: [], raisons: ['Routine quotidienne'] }
    });
    tempsRequisMin += (cfg.defaultDurationAnki || 30);
  }

  const subjectAnnaleCount = {};
  const subjectTDCount = {};
  const subjectTPCount = {};
  const subjectCMCount = {};

  const subjectMaxPrio = {};
  for (const t of [...poolAnnales, ...poolCM, ...poolTD, ...poolTP]) {
    // Le classement des matières compare des tâches de catégories différentes :
    // seule l'échelle bornée est comparable. Les scores historiques, propres à
    // chaque catégorie et d'amplitude libre, laissaient un simple TD bien noté
    // devancer un cours dû depuis trois semaines.
    const valeur = Number.isFinite(t.priorite) ? t.priorite : 0;
    if (!subjectMaxPrio[t.matiere] || valeur > subjectMaxPrio[t.matiere]) {
      subjectMaxPrio[t.matiere] = valeur;
    }
  }

  const sortedSubjects = Object.keys(subjectMaxPrio).sort((a, b) => subjectMaxPrio[b] - subjectMaxPrio[a]);
  const topSubjectsList = [];
  
  // Guaranteed Discovery
  const newSubjects = sortedSubjects.filter(s => nouvellesMatieres.has(s));
  let guaranteedSubject = null;
  if (newSubjects.length > 0) {
    guaranteedSubject = newSubjects[0];
    topSubjectsList.push(guaranteedSubject);
  }

  /*
   * Rattrapage garanti : une place pour la matière la plus délaissée.
   *
   * Les points d'oubli saturent à deux fois l'intervalle prévu — et c'est
   * juste : au-delà, l'oubli est complet, il ne peut pas l'être davantage. Mais
   * le classement des matières ne distingue alors plus un chapitre en retard de
   * deux jours d’un chapitre abandonné depuis quatre mois : les deux plafonnent.
   * Les mêmes matières gagnaient donc tous les jours, départagées par le
   * coefficient et la proximité des examens, et les autres n'étaient jamais
   * reprogrammées. Mesuré sur le cursus réel : quatre matières sur treize sans
   * une seule séance en deux mois, avec des retards atteignant 136 jours.
   *
   * Plutôt que de fausser un score qui a raison, on réserve une place — comme
   * la découverte garantie juste au-dessus. Le jour où rien ne traîne, cette
   * place ne coûte rien.
   */
  let rattrapageSubject = null;
  const plusDelaissee = enSouffranceOrdonnee[0]?.matiere;
  if (plusDelaissee && !topSubjectsList.includes(plusDelaissee)) {
    rattrapageSubject = plusDelaissee;
    topSubjectsList.push(rattrapageSubject);
  }

  for (const s of sortedSubjects) {
    if (topSubjectsList.length >= maxSubjectsPerDay) break;
    if (!topSubjectsList.includes(s)) topSubjectsList.push(s);
  }

  const selectedMatieres = new Set(topSubjectsList);
  /*
   * Le quota de matières par jour existe pour éviter l'éparpillement, pas pour
   * laisser une journée vide : il se relâche en dernier recours, plus bas.
   */
  let quotaRelache = false;
  const canAddMatiere = (matiere) => quotaRelache || selectedMatieres.has(matiere);

  /*
   * Ce qui a été écarté, et pourquoi.
   *
   * La sélection refusait des candidats par une demi-douzaine de `continue`
   * muets, et le rapport ne gardait que les retenus. Avec dix-neuf matières et
   * un quota de trois par jour, seize sont écartées chaque matin sans qu'il en
   * reste trace. À la question « pourquoi tu ne me proposes pas Optique ? », le
   * Répétiteur ne pouvait qu'avouer son ignorance — alors que la cause est
   * parfaitement déterministe, et souvent un simple réglage.
   *
   * L'enjeu n'est pas cosmétique : « Optique est à jour », « le quota l'a
   * sortie » et « un prérequis la bloque » appellent trois conduites opposées —
   * attendre, insister, ou aller lire le cours d'abord.
   *
   * Un même candidat peut être refusé par un passage puis retenu par le
   * suivant : on note le dernier motif, et les retenus sont retirés à la fin.
   */
  const motifsEcart = new Map();
  const noterEcart = (item, motif) => { motifsEcart.set(item, motif); };

  // Annales : un entraînement choisi, pas une échéance subie.
  for (const annale of poolAnnales) {
    if (tempsRequisMin + annale.dureeMinutes > tempsLibreMin) { noterEcart(annale, 'BUDGET_JOURNEE'); continue; }
    if (!fillGap && !canAddMatiere(annale.matiere)) { noterEcart(annale, 'QUOTA_MATIERES_PAR_JOUR'); continue; }
    if (!fillGap && tempsHorsRevisionMin + annale.dureeMinutes > budgetHorsRevisionMin) { noterEcart(annale, 'BUDGET_DECOUVERTE'); continue; }
    const count = subjectAnnaleCount[annale.matiere] || 0;
    if (count >= 1) { noterEcart(annale, 'LIMITE_PAR_MATIERE'); continue; }
    taches.push(annale);
    tempsRequisMin += annale.dureeMinutes;
    tempsHorsRevisionMin += annale.dureeMinutes;
    subjectAnnaleCount[annale.matiere] = count + 1;
    selectedMatieres.add(annale.matiere);
  }

  const maxNewCMPerSemester = cfg.maxNewCMPerSemesterPerDay !== undefined ? cfg.maxNewCMPerSemesterPerDay : 3;
  const newCMPerSemestre = {};
  const appendFromPool = (pool, subjectCountMap, limitPerSubject) => {
    for (const item of pool) {
      if (item.isNew && !fillGap) {
        const semKey = item._semestreId || '__global';
        if ((newCMPerSemestre[semKey] || 0) >= maxNewCMPerSemester && item.matiere !== guaranteedSubject) {
          noterEcart(item, 'PLAFOND_NOUVEAUX_CHAPITRES'); continue;
        }
        // Le neuf ne déborde pas sur le temps réservé aux révisions dues.
        if (tempsHorsRevisionMin + item.dureeMinutes > budgetHorsRevisionMin) {
          noterEcart(item, 'BUDGET_DECOUVERTE'); continue;
        }
      }
      if (tempsRequisMin + item.dureeMinutes > tempsLibreMin) { noterEcart(item, 'BUDGET_JOURNEE'); continue; }
      if (!fillGap && !canAddMatiere(item.matiere)) { noterEcart(item, 'QUOTA_MATIERES_PAR_JOUR'); continue; }
      const count = subjectCountMap ? (subjectCountMap[item.matiere] || 0) : 0;
      if (limitPerSubject && count >= limitPerSubject) { noterEcart(item, 'LIMITE_PAR_MATIERE'); continue; }

      taches.push(item);
      tempsRequisMin += item.dureeMinutes;
      if (subjectCountMap) subjectCountMap[item.matiere] = count + 1;
      selectedMatieres.add(item.matiere);
      if (item.isNew) {
        const semKey = item._semestreId || '__global';
        newCMPerSemestre[semKey] = (newCMPerSemestre[semKey] || 0) + 1;
        tempsHorsRevisionMin += item.dureeMinutes;
      }
    }
  };

  /*
   * La découverte garantie n'était garantie qu'à moitié.
   *
   * Une place lui est réservée parmi les matières du jour, et son chapitre
   * échappe au plafond de nouveaux chapitres par semestre — mais pas au budget
   * réservé au matériau neuf. Comme le vivier est parcouru par priorité
   * décroissante et que tous les chapitres jamais ouverts ont exactement la
   * même priorité, l'ordre entre eux se décidait sur leur rang d'insertion :
   * les premières matières du cursus consommaient le budget, et le chapitre de
   * la matière dont c'était le tour était écarté.
   *
   * Répétition sur le cursus réel — dix-neuf matières, dix chapitres chacune,
   * un mois de journées enchaînées. À cinq heures par jour la place ne manque
   * pas et le défaut ne se voit pas : dix-neuf matières touchées dans les deux
   * cas. Il apparaît dès que le budget serre. À trois heures par jour, avec des
   * chapitres à deux heures :
   *
   *     sans ce passage prioritaire :  4 matières touchées sur 19 en un mois
   *     avec :                        11 matières touchées sur 19
   *
   * Quinze matières laissées de côté pendant un mois, ce n'est pas un défaut
   * d'équilibre : ce sont quinze examens qu'on ne prépare pas. La contrepartie
   * est réelle — étaler coûte du débit, et la simulation montre moins de
   * chapitres bouclés — mais un semestre se joue sur toutes ses UE.
   *
   * On ne lui accorde pas de budget supplémentaire, ce qui affamerait les
   * révisions : on lui donne le premier passage. Son chapitre est servi avant
   * les autres nouveautés, à budget inchangé.
   */
  if (!fillGap && guaranteedSubject) {
    const rang = poolCM.findIndex(cm => cm.matiere === guaranteedSubject && cm.isNew);
    if (rang > 0) {
      const [chapitre] = poolCM.splice(rang, 1);
      poolCM.unshift(chapitre);
    }
  }

  if (fillGap) {
    appendFromPool(poolTD, subjectTDCount, 1);
    appendFromPool(poolTP, subjectTPCount, 1);
    appendFromPool(poolCM, subjectCMCount, 1);
  } else {
    appendFromPool(poolCM, null, null);
    appendFromPool(poolTD, subjectTDCount, 3);
    appendFromPool(poolTP, subjectTPCount, 1);
  }

  /*
   * --- 4.4. Rattrapage forcé : un chapitre abandonné par jour ---
   *
   * Réserver une place à la matière la plus délaissée ne suffit pas : encore
   * faut-il que son chapitre soit atteint dans la liste. Or le classement lui
   * est structurellement défavorable. Un TD jamais fait cumule les points
   * d'oubli (« pas encore abordé », 20) et de couverture (« jamais travaillé »,
   * 15) : 35 points. Un chapitre travaillé six fois puis abandonné depuis
   * quatre mois obtient les mêmes 20 points d’oubli, mais seulement 2 de
   * couverture, puisque justement il a été travaillé. Le neuf gagne deux fois,
   * l'abandonné une seule — et n'était jamais reprogrammé.
   *
   * Mesuré sur le cursus réel : des chapitres à 133 jours de retard, jamais
   * repris en deux mois de simulation, pendant que le programme du jour se
   * remplissait normalement.
   *
   * Plutôt que de refondre la pondération — qui a ses raisons ailleurs — on
   * garantit une reprise par jour : le chapitre le plus délaissé passe, quoi
   * qu'il arrive. Un par jour suffit à résorber un arriéré, et ne coûte rien
   * les jours où il n’y en a pas.
   */
  if (!fillGap && enSouffranceOrdonnee.length > 0) {
    const dejaPlanifie = new Set(taches.map(t => `${t.type}::${t.matiere}::${t.titre}`));
    const cle = (t) => `${t.type}::${t.matiere}::${t.titre}`;
    const reprise = (repriseDuJour && !dejaPlanifie.has(cle(repriseDuJour)))
      ? repriseDuJour
      : enSouffranceOrdonnee.find(t => !dejaPlanifie.has(cle(t)));
    // La reprise reste dans la journée déclarée : la réserve de révisions lui
    // laisse la place, et une journée qui déborde n'est plus une journée tenable.
    if (reprise && tempsRequisMin + reprise.dureeMinutes <= tempsLibreMin) {
      taches.push({ ...reprise, raisons: [...(reprise.raisons || []), 'RATTRAPAGE'] });
      tempsRequisMin += reprise.dureeMinutes;
      selectedMatieres.add(reprise.matiere);
    }
  }

  // --- 4.5. Injection Tâche Obligatoire : Stage Interrompu ---
  if (cfg.stages && Array.isArray(cfg.stages)) {
    for (const stage of cfg.stages) {
      if (stage.interrompu && !stage.memoireRendu) {
        taches.push({
          matiere: "Stages & Apprentissage",
          type: "PROJET",
          titre: "Mémoire de substitution : " + stage.titre,
          dureeMinutes: 120,
          prio: 10000, // Priorité absolue
          priorite: 100,
          explication: { composantes: [], modificateurs: [], raisons: ['Obligatoire : mémoire de substitution'] },
          raisons: ["INTERRUPTION_STAGE", "OBLIGATOIRE"]
        });
        tempsRequisMin += 120;
      }
    }
  }

  // --- 4.6. Injection Langues : régularité, hors calendrier d'examens ---
  //
  // Ces tâches arrivent après le remplissage des pools parce qu'elles se
  // servent du temps qui *reste* : une langue ne doit jamais évincer un cours
  // dû. Elles échappent en revanche à la limite de matières par jour — une
  // séance de vingt minutes n'occupe pas le même terrain qu'une matière du
  // cursus, et la lui faire disputer reviendrait à ne jamais la planifier.
  // Les jours de repos et le mode anti-burnout sortent plus haut, sans passer
  // par ici : la régularité ne s'impose pas contre la récupération.
  for (const tache of tachesLangues(cfg, todayStr, tempsLibreMin - tempsRequisMin, historique)) {
    taches.push(tache);
    tempsRequisMin += tache.dureeMinutes;
  }

  // --- 5. Chronobiologie v3 : Ordonnancement par charge cognitive + chronotype ---
  const heavyTasks = [];
  const mediumTasks = [];
  const lightTasks = [];

  for (const t of taches) {
    if (t.type === 'ANKI') {
      heavyTasks.unshift(t);
      continue;
    }
    // Une séance de langue est courte et peu coûteuse : elle a sa place dans
    // les creux de la journée. La classer par défaut en charge moyenne la
    // ferait concurrencer le travail de fond dans les fenêtres où celui-ci est
    // le plus rentable.
    if (t.type === 'LANGUE') {
      lightTasks.push(t);
      continue;
    }
    const cogData = cognitiveLoadMap[t.matiere.toLowerCase().trim()];
    if (cogData && cogData.cognitiveLoad === 'heavy') heavyTasks.push(t);
    else if (cogData && cogData.cognitiveLoad === 'light') lightTasks.push(t);
    else mediumTasks.push(t);
  }

  taches.length = 0;

  // Ordonnancement sensible au chronotype
  const chrono = timeOptimizationMap;
  const currentHour = new Date().getHours();
  const heavyWindow = chrono.optimalWindows.heavy;
  const mediumWindow = chrono.optimalWindows.medium;

  // Si on est dans la fenêtre "heavy" (ex: 8h-12h), on priorise les tâches lourdes
  const inHeavyWindow = currentHour >= heavyWindow.start && currentHour < heavyWindow.end;
  const inMediumWindow = currentHour >= mediumWindow.start && currentHour < mediumWindow.end;

  if (inHeavyWindow) {
    taches.push(...heavyTasks, ...mediumTasks, ...lightTasks);
  } else if (inMediumWindow) {
    taches.push(...mediumTasks, ...heavyTasks, ...lightTasks);
  } else {
    // Soir ou matin très tôt : tâches légères d'abord
    taches.push(...lightTasks, ...mediumTasks, ...heavyTasks);
  }

  // Assignation des moments (rétrocompatible avec l'heure courante)
  let accumulatedTime = 0;
  for (const t of taches) {
    let percentBefore = accumulatedTime / (tempsRequisMin || 1);
    accumulatedTime += t.dureeMinutes;
    let percentAfter = accumulatedTime / (tempsRequisMin || 1);
    let midPercent = (percentBefore + percentAfter) / 2.0;

    // Seuils adaptés à l'heure et au chronotype
    if (currentHour < 12) {
      if (midPercent <= 0.35) t.moment = 'matin';
      else if (midPercent <= 0.70) t.moment = 'aprem';
      else t.moment = 'soir';
    } else if (currentHour < 18) {
      if (midPercent <= 0.50) t.moment = 'aprem';
      else t.moment = 'soir';
    } else {
      t.moment = 'soir';
    }

    // Tagguer les synergies détectées
    if (synergyMap[t.matiere.toLowerCase().trim()] && synergyMap[t.matiere.toLowerCase().trim()].length > 0) {
      t.synergies = synergyMap[t.matiere.toLowerCase().trim()].slice(0, 3);
    }
  }

  for (const t of taches) {
    t.id = buildTaskId(t);
  }

  rapport.tempsRequisMin = tempsRequisMin;
  /*
   * Une journée vide alors que du travail était dû.
   *
   * Les places de matières du jour se distribuent au score, et un chapitre
   * jamais ouvert score plus haut qu'une révision en retard de deux jours —
   * c'est voulu. Mais un chapitre neuf coûte deux heures, et le neuf ne peut
   * prendre que ce que les révisions dues lui laissent. Sur une journée courte,
   * les trois places partaient donc à des matières dont le seul candidat était
   * un chapitre trop cher pour le budget restant, pendant que les révisions
   * réservées appartenaient à des matières écartées par le quota.
   *
   * Mesuré : journée de 3 h, chapitres à 2 h, trois révisions en retard —
   * 180 minutes disponibles, 90 réservées aux révisions, et un programme
   * totalement vide, onze candidats écartés. L'étudiant ouvrait l'application
   * un jour chargé et n'y trouvait rien à faire.
   *
   * Le quota ne se relâche donc que sur une journée entièrement vide : le
   * nombre de matières par jour est un réglage de l'étudiant, pas un accident,
   * et le contourner dès qu'une journée est peu remplie reviendrait à le
   * supprimer. Un programme vide, en revanche, ne se défend pas — mieux vaut
   * une matière de plus que rien du tout. Le budget de la journée ne bouge pas,
   * et la découverte garde sa limite : ce sont les révisions dues qui sont
   * repêchées, pas du matériau neuf.
   */
  if (!fillGap && taches.length === 0 && tempsLibreMin > 0) {
    const bloquesParQuota = [...motifsEcart.values()].includes('QUOTA_MATIERES_PAR_JOUR');
    if (bloquesParQuota) {
      quotaRelache = true;
      appendFromPool(poolCM, subjectCMCount, 2);
      appendFromPool(poolTD, subjectTDCount, 3);
      appendFromPool(poolTP, subjectTPCount, 1);
      quotaRelache = false;
    }
  }

  // Le repechage ajoute du travail : le temps requis doit le refleter, sinon
  // l ecran annoncerait une journee vide sous une liste de taches.
  rapport.tempsRequisMin = tempsRequisMin;

  rapport.tachesDuJour = taches;

  /*
   * Ce que la sélection a laissé de côté : un candidat finalement retenu ne
   * figure pas ici, même s'il a été refusé par un passage antérieur.
   *
   * Le rapprochement se fait sur l'identifiant de tâche, pas sur l'identité de
   * l'objet : le rattrapage forcé empile une copie (`{ ...reprise }`) et non
   * l'élément du vivier. Comparer les objets laissait donc le chapitre repris
   * dans les deux listes à la fois — le Répétiteur aurait annoncé comme écarté
   * un chapitre figurant au programme du jour.
   */
  const retenues = new Set(taches.map(buildTaskId));
  for (const [item] of [...motifsEcart]) {
    if (retenues.has(buildTaskId(item))) motifsEcart.delete(item);
  }
  rapport.candidatsEcartes = [...motifsEcart.entries()].map(([item, motif]) => ({
    matiere: item.matiere,
    type: item.type,
    titre: item.titre,
    priorite: item.priorite,
    dureeMinutes: item.dureeMinutes,
    motif,
  }));

  /*
   * Surcharge : le retard est-il en train de te dépasser ?
   *
   * Deux définitions ont déjà échoué. La première sommait tout le catalogue,
   * découverte comprise : avec 78 cours dont 49 jamais ouverts, le total
   * dépassait forcément une journée. La seconde, restreinte aux révisions
   * dues, restait rouge elle aussi — mesuré sur le cursus réel, ce stock ne
   * descend jamais sous 23 h et grossit même à mesure que du contenu entre en
   * circulation. Un voyant allumé en permanence ne dit rien.
   *
   * L'erreur commune était de mesurer un volume. Avec 78 chapitres, avoir
   * beaucoup de révisions dues est normal, pas inquiétant. Ce qui compte est le
   * retard relatif : une révision prévue tous les deux jours et repoussée de
   * trois est en souffrance ; la même attente sur un chapitre à trente jours ne
   * prête pas à conséquence. On retient donc les révisions dont l'attente
   * dépasse leur propre intervalle — celles pour lesquelles on a laissé filer
   * plus du double du délai prévu. Contrairement à un stock, cet ensemble se
   * vide à mesure qu'on le traite, et le voyant peut redevenir vert.
   *
   * Un cours jamais ouvert n'en fait pas partie : c'est du programme à venir,
   * dont on choisit le rythme. Les annales non plus, elles ne se périment pas.
   */
  const tempsDuAujourdhui = revisionsDues.reduce((acc, t) => acc + t.dureeMinutes, 0);
  const tempsEnSouffrance = enSouffranceOrdonnee.reduce((acc, t) => acc + t.dureeMinutes, 0);

  // Informatif : tout ce qui est arrivé à échéance, sans jugement.
  rapport.tempsDuAujourdhuiMin = tempsDuAujourdhui;
  // Actionnable : ce qui a vraiment décroché, et de combien.
  rapport.tempsEnSouffranceMin = tempsEnSouffrance;
  rapport.nbEnSouffrance = enSouffranceOrdonnee.length;
  rapport.retardMaxJours = enSouffranceOrdonnee.reduce((m, t) => Math.max(m, Number(t.joursEnRetard) || 0), 0);

  rapport.statut = (tempsEnSouffrance > tempsLibreMin) ? "SURCHARGE" : "OK";

  return rapport;
}

/**
 * Génère UNE seule tâche spécifique selon les critères demandés par l'utilisateur (matière, type).
 */
function genererTacheSpecifique(matiere = 'all', type = 'all', dureeMin = 30) {
  const cfg = loadConfig();
  const crs = loadCours();

  const todayStr = getTodayString();
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const tomorrowDate = new Date(now);
  tomorrowDate.setHours(tomorrowDate.getHours() - 4);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.getFullYear() + '-' + String(tomorrowDate.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrowDate.getDate()).padStart(2, '0');
  const dayOfWeek = now.getDay();
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

  const { loadHistorique } = require('./historique');
  const historique = loadHistorique();

  const compensationMap = buildCompensationMap(crs);
  const remainingWeightMap = buildRemainingWeightMap(crs);
  const velocityMap = buildVelocityMap(crs, historique, cfg);
  const examUrgencyMap = buildExamUrgencyMap(crs);
  const projectedScoreDetail = buildProjectedScoreDetailMap(crs, velocityMap);

  const projectedScoreMap = {};
  for (const [key, val] of Object.entries(projectedScoreDetail)) {
    projectedScoreMap[key] = val.projected;
  }

  const candidates = [];

  if (type === 'all' || type === 'ANKI') {
    // Si l'utilisateur force ANKI, on l'autorise même s'il l'a déjà fait aujourd'hui
    const alreadyDone = (cfg.dernierePratiqueAnki === todayStr);
    if (!alreadyDone || type === 'ANKI') {
      candidates.push({
        matiere: "Routine",
        type: "ANKI",
        titre: "Révision Flashcards",
        dureeMinutes: cfg.defaultDurationAnki || 30,
        prio: type === 'ANKI' ? 9999 : MAGIC_CONSTANTS.PRIO_MAX_ANKI,
        raisons: [alreadyDone ? "ESPACEE_GLOBALE_BONUS" : "ESPACEE_GLOBALE"]
      });
    }
  }

  const rlState = loadRLState();
  const { poolCM, poolTD, poolTP, poolAnnales } = buildTaskPools({
    crs, cfg, todayStr, tomorrowStr, isWeekend, examUrgencyMap, remainingWeightMap,
    compensationMap, velocityMap, projectedScoreMap, projectedScoreDetail, matieresSatureesToday: new Set(), fillGap: false, now, parityJour: new Date().getDay() % 2, bypassInterleaving: true, rlState
  });

  const allPools = [...poolCM, ...poolTD, ...poolTP, ...poolAnnales];
  for (const task of allPools) {
    if (matiere !== 'all' && task.matiere !== matiere) continue;
    if (type !== 'all' && task.type !== type) continue;
    candidates.push(task);
  }

  if (candidates.length === 0) return null;

  if (dureeMin > 0 && type !== 'ANKI') {
    candidates.forEach(c => {
      const diff = Math.abs(c.dureeMinutes - dureeMin);
      if (diff > 15) {
         c.prio -= (diff - 15) * 0.5;
      }
    });
  }

  candidates.sort((a, b) => b.prio - a.prio);

  const bestTask = candidates[0];
  bestTask.moment = 'sur-mesure';
  bestTask.id = buildTaskId(bestTask);
  return bestTask;
}

module.exports = {
  genererRapportQuotidien,
  genererTacheSpecifique,
  buildTaskId
};