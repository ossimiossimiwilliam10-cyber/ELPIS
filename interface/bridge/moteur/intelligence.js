/**
 * INTELLIGENCE MODULE v3 — Fonctions d'analyse avancée
 * Extraites de l'orchestrateur pour modularité et testabilité.
 *
 * v3 ajoute :
 *   - Intervalles de confiance (95%) & détection de tendance sur les projections
 *   - Courbe d'oubli d'Ebbinghaus & forecast de maîtrise
 *   - Détection automatique du chronotype pour l'ordonnancement horaire
 *   - Carte de synergies inter-matières par chevauchement de mots-clés
 *   - Prévision de charge de travail sur 7 jours (lissage exponentiel)
 *   - Détection d'anomalies intégrée aux scores projetés
 *   - Pondération Bayésienne adaptative
 */

const DAYS_OF_WEEK = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function getTodayString() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  d.setHours(d.getHours() - 4);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getDayOfWeekString() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  d.setHours(d.getHours() - 4);
  return DAYS_OF_WEEK[d.getDay()];
}

const { normalizeDateStr, parseDateLocal } = require('./utils');
const { construireProjections, construireCarteProjections } = require('./projection');
const { construireVelocites } = require('./velocite');
const { construireChargeCognitive } = require('./chargeCognitive');
const { evaluerFatigue } = require('./burnout');
function isSemesterArchived(s) {
  if (s.archived) return true;
  if (s.dateFin) {
    const df = parseDateLocal(normalizeDateStr(s.dateFin));
    const now = new Date();
    now.setHours(now.getHours() - 4); // Night Owl shift (cohérent avec l'orchestrateur)
    if (df && df < now) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Helpers mathématiques partagés
// ---------------------------------------------------------------------------

/** Régression linéaire simple : retourne { slope, intercept, rSquared } */
function linearRegression(xs, ys) {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, rSquared: 0 };
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den > 0 ? num / den : 0;
  const intercept = meanY - slope * meanX;
  // R²
  const yPred = xs.map(x => intercept + slope * x);
  const ssRes = ys.reduce((a, y, i) => a + (y - yPred[i]) ** 2, 0);
  const ssTot = ys.reduce((a, y) => a + (y - meanY) ** 2, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { slope, intercept, rSquared };
}

/** Moyenne pondérée avec décroissance exponentielle (recency bias) */
function recencyWeightedMean(values, timestamps, halfLifeDays = 60) {
  if (values.length === 0) return { mean: null, totalWeight: 0 };
  const now = Date.now();
  const lambda = Math.log(2) / (halfLifeDays * 24 * 3600 * 1000);
  let wSum = 0, vSum = 0;
  for (let i = 0; i < values.length; i++) {
    const age = now - (timestamps[i] || now);
    const w = Math.exp(-lambda * age);
    wSum += w;
    vSum += values[i] * w;
  }
  return { mean: wSum > 0 ? vSum / wSum : null, totalWeight: wSum };
}

/** Écart-type d'un échantillon (ddl = n-1) */
function sampleStdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// AXE 0 : getMatiereAverage (utilitaire partagé)
// ---------------------------------------------------------------------------

/*
 * Le statut de l'épreuve était ignoré ici, alors que le bulletin s'en sert.
 * Deux matières identiques donnaient donc deux moyennes différentes selon
 * l'écran consulté : une absence justifiée ayant gardé sa note comptait dans
 * le moteur (14 devenait 9) et pas dans le bulletin ; une défaillance passait
 * pour une simple épreuve à venir, quand le bulletin affichait DEF.
 *
 * Le moteur rend un nombre — il alimente des calculs de priorité — et ne peut
 * donc pas porter le sentinel DEF du bulletin. Il applique la même règle de
 * comptage et signale la défaillance à part, à charge des appelants d'en tirer
 * les conséquences. Deux autres endroits filtraient déjà ainsi
 * (`couverture.js` et `buildProjectedScoreDetailMap`) : c'est cette
 * fonction-ci qui était l'exception.
 */
function getMatiereAverage(matiere) {
  if (!matiere || !matiere.evaluations || !Array.isArray(matiere.evaluations)) return null;
  let totalScore = 0;
  let totalCoef = 0;
  let defaillant = false;
  matiere.evaluations.forEach(ev => {
    // Neutralisée : elle ne compte pas, même si une note y traîne encore.
    if (ev.statut === 'excuse') return;
    if (ev.statut === 'defaillant') { defaillant = true; return; }
    if (ev.note !== null && ev.note !== undefined && !isNaN(ev.note)) {
      const c = ev.coefficient || 1;
      totalScore += ev.note * c;
      totalCoef += c;
    }
  });
  // Pas de moyenne calculable : on rend `null` comme avant. Attribuer un 0 à
  // une matière uniquement défaillante ferait entrer un chiffre inventé dans
  // les calculs de priorité ; la défaillance se lit avec `matiereDefaillante`.
  if (totalCoef <= 0) return null;
  return { avg: totalScore / totalCoef, evaluatedCoef: totalCoef, defaillant };
}

/** Une matière est défaillante dès qu'une de ses épreuves l'est (règlement, art. « défaillance »). */
function matiereDefaillante(matiere) {
  if (!matiere || !Array.isArray(matiere.evaluations)) return false;
  return matiere.evaluations.some(ev => ev?.statut === 'defaillant');
}

// ---------------------------------------------------------------------------
// AXE 8 : Compensation Inter-UE
// ---------------------------------------------------------------------------

function buildCompensationMap(crs) {
  const map = {};
  if (!crs || !crs.licences) return map;

  for (const l of (crs.licences || [])) {
    if (l.archived) continue;
    for (const s of (l.semestres || [])) {
      if (isSemesterArchived(s)) continue;
      const ueData = [];
      for (const ue of (s.ues || [])) {
        let ueSumWeight = 0;
        let ueSumNotes = 0;
        let ueDefaillante = false;
        for (const m of (ue.matieres || [])) {
          if (m.dispense) continue;
          if (matiereDefaillante(m)) ueDefaillante = true;
          const result = getMatiereAverage(m);
          if (result) {
            // `m.coefficient || 1` transformait un coefficient 0 en 1 : une
            // matière explicitement hors barème pesait autant qu'une autre.
            const coef = m.coefficient !== undefined ? Number(m.coefficient) : 1;
            if (!Number.isFinite(coef) || coef <= 0) continue;
            ueSumWeight += coef;
            ueSumNotes += result.avg * coef;
          }
        }
        const ueAvg = ueSumWeight > 0 ? ueSumNotes / ueSumWeight : null;
        const ects = Number(ue.ects) > 0 ? Number(ue.ects) : 0;
        ueData.push({ ue, ueAvg, ueSumWeight, ueSumNotes, ects, defaillante: ueDefaillante });
      }

      /*
       * Le semestre se pondérait par la somme des coefficients de matières de
       * chaque UE, ce qui n'est pas la règle : le règlement pondère les UE par
       * des coefficients « proportionnels à leur valeur en ECTS ». Une UE à 3
       * ECTS composée de deux matières pesait ainsi autant que la totalité
       * d'une UE à 9 ECTS, et la compensation calculée ici s'écartait de celle
       * qu'affiche le bulletin.
       *
       * On repasse donc aux ECTS, avec repli sur la pondération précédente si
       * aucune UE du semestre n'a d'ECTS renseignés — un cursus incomplet ne
       * doit pas perdre sa compensation.
       */
      const totalECTS = ueData.reduce(
        (acc, ud) => acc + (ud.ueAvg !== null && !ud.ue.dispense ? ud.ects : 0), 0);
      let semSumWeight = 0;
      let semSumNotes = 0;
      ueData.forEach(ud => {
        if (ud.ueAvg === null || ud.ue.dispense) return;
        const poids = totalECTS > 0 ? ud.ects : ud.ueSumWeight;
        semSumWeight += poids;
        semSumNotes += ud.ueAvg * poids;
      });
      const semAvg = semSumWeight > 0 ? semSumNotes / semSumWeight : null;

      ueData.forEach(ud => {
        for (const m of (ud.ue.matieres || [])) {
          if (ud.ueAvg !== null && semAvg !== null) {
            map[m.nom.toLowerCase().trim()] = {
              // NOTE: Compensation vérifiée au niveau semestriel (UE < 10 compensée si sem >= 10).
              // La compensation annuelle (S1+S2)/2 est gérée par getCapitalisedUEs dans scoring.js.
              // Une défaillance bloque la compensation « quels que soient les
              // autres résultats » (règlement des études) : annoncer une UE
              // rattrapée alors qu'elle ne l'est pas ferait déprioriser à tort.
              compensable: !ud.defaillante && ud.ueAvg < 10 && semAvg >= 10,
              defaillante: ud.defaillante,
              ueAvg: ud.ueAvg,
              semestreAvg: semAvg,
              deficit: ud.ueAvg < 10 ? 10 - ud.ueAvg : 0
            };
          }
        }
      });
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// AXE 5 : Remaining Weight Factor
// ---------------------------------------------------------------------------

function buildRemainingWeightMap(crs) {
  const map = {};
  if (!crs || !crs.licences) return map;

  for (const l of (crs.licences || [])) {
    if (l.archived) continue;
    for (const s of (l.semestres || [])) {
      if (isSemesterArchived(s)) continue;
      for (const ue of (s.ues || [])) {
        for (const m of (ue.matieres || [])) {
          if (!m.evaluations || !Array.isArray(m.evaluations)) continue;
          let totalCoef = 0;
          let evaluatedCoef = 0;
          m.evaluations.forEach(ev => {
            const c = ev.coefficient || 1;
            totalCoef += c;
            if (ev.note !== null && ev.note !== undefined && !isNaN(ev.note)) {
              evaluatedCoef += c;
            }
          });
          const remainingRatio = totalCoef > 0 ? (totalCoef - evaluatedCoef) / totalCoef : 1;
          map[m.nom.toLowerCase().trim()] = { remainingRatio, totalCoef, evaluatedCoef };
        }
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// AXE 10 : Study Velocity (EMA + Ebbinghaus + Forecast)
// ---------------------------------------------------------------------------

/**
 * Vitesse d'apprentissage par matière — délègue au module `velocite`.
 *
 * L'implémentation d'origine tenait sur cent quarante lignes et jugeait la
 * maîtrise sur `easeFactor`, un vestige de SM-2, tout en ré-estimant par
 * heuristique une stabilité que les cartes FSRS fournissent exactement. Le
 * calcul est désormais isolé et testé pour lui-même.
 */
function buildVelocityMap(crs, historique, cfg = {}) {
  return construireVelocites(crs, historique, cfg);
}

// ---------------------------------------------------------------------------
// AXE 12 : Anti-Burnout Guardian
// ---------------------------------------------------------------------------

/**
 * Veille anti-épuisement — délègue au module `burnout`.
 *
 * L'implémentation d'origine divisait toujours la charge par sept jours, même
 * pour un compte ouvert la veille, et ses signaux s'excluaient mutuellement :
 * une série longue masquait des séances nocturnes pourtant plus faciles à
 * corriger.
 */
function detectBurnoutRisk(cfg, historique) {
  return evaluerFatigue(cfg, historique);
}

// ---------------------------------------------------------------------------
// AXE 11 : Projected Score Map (compatibilité ascendante — retourne un nombre)
// ---------------------------------------------------------------------------

/**
 * Projection de note par matière — délègue au module `projection`.
 *
 * L'implémentation d'origine vivait ici sur cent cinquante lignes et enchaînait
 * trois mélanges successifs des mêmes grandeurs. Le calcul est désormais isolé
 * et testé pour lui-même ; ces deux fonctions ne gardent que la signature
 * attendue par l'orchestrateur et par le front.
 */
function buildProjectedScoreMap(crs, velocityMap, ankiStats = null) {
  return construireCarteProjections(crs, velocityMap, ankiStats);
}

/** Projection détaillée : valeur, intervalle de confiance, tendance, anomalies. */
function buildProjectedScoreDetailMap(crs, velocityMap, ankiStats = null) {
  return construireProjections(crs, velocityMap, ankiStats);
}

// ---------------------------------------------------------------------------
// AXE 6 : Cognitive Load Map (K-Means 1D)
// ---------------------------------------------------------------------------

/**
 * Charge cognitive par matière — délègue au module `chargeCognitive`.
 *
 * L'implémentation d'origine triait ses valeurs numériques par ordre
 * alphabétique — le comportement de `sort` sans comparateur — et s'appuyait sur
 * le facteur de facilité SM-2 plutôt que sur la difficulté FSRS.
 */
function buildCognitiveLoadMap(crs) {
  return construireChargeCognitive(crs);
}

// ---------------------------------------------------------------------------
// AXE 1 : Exam Urgency Map
// ---------------------------------------------------------------------------

function buildExamUrgencyMap(crs) {
  const map = {};
  if (!crs || !crs.licences) return map;

  const today = new Date();
  today.setHours(today.getHours() - 4); // Night Owl shift
  today.setHours(0, 0, 0, 0);

  for (const l of (crs.licences || [])) {
    if (l.archived) continue;
    for (const s of (l.semestres || [])) {
      if (isSemesterArchived(s)) continue;
      for (const ue of (s.ues || [])) {
        for (const subj of (ue.matieres || [])) {
          if (!subj.nom) continue;

          let minDays = Infinity;



          if (subj.evaluations && Array.isArray(subj.evaluations)) {
            for (const ev of subj.evaluations) {
              if (!ev.date) continue;
              // Une épreuve déjà notée n'est plus une échéance : sa date
              // continuait pourtant de rendre la matière urgente, au détriment
              // des matières dont l'examen approche vraiment.
              if (ev.note !== undefined && ev.note !== null && ev.note !== ''
                  && !isNaN(parseFloat(ev.note))) continue;
              // Une absence déclarée clôt l'épreuve, avec ou sans note.
              if (ev.statut === 'defaillant' || ev.statut === 'excuse') continue;

              const normDate = normalizeDateStr(ev.date);
              const evalDate = parseDateLocal(normDate);
              if (isNaN(evalDate.getTime())) continue;
              const diffDays = Math.ceil((evalDate - today) / (1000 * 60 * 60 * 24));
              if (diffDays >= 0 && diffDays < minDays) minDays = diffDays;
            }
          }

          /*
           * Faute d'épreuve datée, on retombe sur la fin du semestre. C'est une
           * borne raisonnable — rien ne s'évalue après — mais ce n'est pas une
           * date d'examen, et la traiter comme telle mentait de deux façons :
           * passé la mi-novembre, les dix-neuf matières du semestre auraient
           * toutes annoncé « Examen à venir » le même jour, et le multiplicateur
           * serait monté jusqu'à 3 pour toutes à la fois — une urgence uniforme
           * ne hiérarchise rien.
           *
           * La borne est donc conservée mais marquée `estimee`, et les
           * consommateurs n'en tirent ni urgence ni affirmation.
           */
          let estimee = false;
          if (minDays === Infinity && s.dateFin) {
            const df = parseDateLocal(normalizeDateStr(s.dateFin));
            if (!isNaN(df.getTime())) {
              const diffDays = Math.ceil((df - today) / (1000 * 60 * 60 * 24));
              if (diffDays >= 0) { minDays = diffDays; estimee = true; }
            }
          }

          if (minDays === Infinity) continue;

          let multiplier = 1.0;
          if (!estimee) {
            if (minDays <= 3) multiplier = 3.0;
            else if (minDays <= 7) multiplier = 2.0;
            else if (minDays <= 21) multiplier = 1.5;
            else if (minDays <= 30) multiplier = 1.2;
          }

          const key = subj.nom.toLowerCase().trim();
          map[key] = { multiplier, daysToExam: minDays, estimee };
        }
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// AXE 15 (NOUVEAU) : Time Optimization Map — Détection du chronotype
// ---------------------------------------------------------------------------

/**
 * Analyse l'historique pour déterminer le chronotype de l'utilisateur
 * et les plages horaires optimales pour chaque niveau de charge cognitive.
 *
 * Retourne :
 *   chronotype: 'morning_lark' | 'night_owl' | 'intermediate'
 *   peakHours: { start, end } — plage de performance maximale
 *   optimalWindows: { heavy: [plage], medium: [plage], light: [plage] }
 */
function buildTimeOptimizationMap(historique, cfg = {}) {
  const map = {
    chronotype: 'intermediate',
    peakStart: 10,
    peakEnd: 16,
    optimalWindows: {
      heavy: { start: 8, end: 12 },
      medium: { start: 13, end: 18 },
      light: { start: 18, end: 22 }
    }
  };

  if (!historique || historique.length < 5) return map;

  // Distribution horaire des sessions
  const hourBuckets = new Array(24).fill(0);
  const hourDurations = new Array(24).fill(0);
  let totalSessions = 0;

  historique.forEach(h => {
    if (!h.timestamp) return;
    const hour = new Date(h.timestamp).getHours();
    if (hour >= 0 && hour < 24) {
      hourBuckets[hour]++;
      // `|| 30` faisait valoir une demi-heure à une durée nulle déclarée, et
      // ignorait les réglages de l'étudiant — `cfg` était reçu puis jamais lu.
      hourDurations[hour] += dureeSeanceForecast(h, cfg);
      totalSessions++;
    }
  });

  if (totalSessions === 0) return map;

  // Déterminer le chronotype : moyenne pondérée des heures d'activité
  let weightedHourSum = 0;
  let weightedTotal = 0;
  for (let h = 0; h < 24; h++) {
    weightedHourSum += h * hourDurations[h];
    weightedTotal += hourDurations[h];
  }
  const meanActivityHour = weightedTotal > 0 ? weightedHourSum / weightedTotal : 14;

  if (meanActivityHour < 11) map.chronotype = 'morning_lark';
  else if (meanActivityHour > 17) map.chronotype = 'night_owl';
  else map.chronotype = 'intermediate';

  // Déterminer les heures de pic (top 6 heures consécutives)
  let bestSum = 0;
  let bestStart = 8;
  for (let start = 5; start <= 18; start++) {
    let sum = 0;
    for (let h = start; h < start + 6; h++) {
      sum += hourDurations[h % 24];
    }
    if (sum > bestSum) {
      bestSum = sum;
      bestStart = start;
    }
  }

  map.peakStart = bestStart;
  map.peakEnd = (bestStart + 6) % 24;

  /*
   * Les fenêtres suivent le pic mesuré, et non un gabarit.
   *
   * La fonction calculait honnêtement les six heures les plus chargées de
   * l'étudiant — puis jetait ce résultat. Pour le chronotype « intermédiaire »,
   * qui couvre presque tout le monde, les fenêtres étaient écrites en dur : 8 h
   * pour le travail lourd, 17 h pour le léger. Un étudiant dont le pic réel est
   * 10 h–16 h se voyait donc servir ses matières difficiles à 8 h, une heure où
   * il avait cumulé une heure de travail en un mois, et classées « légères » à
   * 17 h, sa deuxième heure la plus chargée. La mesure existait, elle ne
   * servait à rien : c'est le genre de fonction qui donne l'apparence de
   * s'adapter sans s'adapter.
   *
   * Le chronotype reste publié, comme description ; il ne choisit plus les
   * horaires. L'ordonnanceur compare `currentHour` à des bornes simples
   * (`>= start && < end`) : elles restent donc crois-santes et dans la journée.
   */
  const fenetre = (debut, duree) => {
    const start = Math.max(0, Math.min(23, Math.round(debut)));
    return { start, end: Math.max(start + 1, Math.min(24, start + duree)) };
  };

  map.optimalWindows = {
    heavy:  fenetre(map.peakStart, 3),
    medium: fenetre(map.peakStart + 3, 3),
    light:  fenetre(Math.min(map.peakStart + 6, 20), 4),
  };

  return map;
}

// ---------------------------------------------------------------------------
// AXE 16 (NOUVEAU) : Synergy Map — Chevauchement de concepts & prérequis
// ---------------------------------------------------------------------------

/**
 * Détecte les synergies inter-matières par :
 *   1. Chevauchement de mots-clés dans les titres de CM
 *   2. Chaînes de prérequis (Matière A référencée dans les CM de Matière B)
 *
 * Retourne { [matiereName]: { synergies: [{ matiere, score, reason }] } }
 */
function buildSynergyMap(crs) {
  const map = {};
  if (!crs || !crs.licences) return map;

  // 1. Extraction des mots-clés par matière
  const matiereKeywords = {};   // { matiereName: Set<string> }
  const matiereCMTitles = {};   // { matiereName: string[] }

  const STOP_WORDS = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'en', 'au',
    'aux', 'pour', 'dans', 'sur', 'avec', 'sans', 'est', 'sont', 'cours',
    'chapitre', 'partie', 'introduction', 'the', 'a', 'an', 'of', 'in', 'to',
    'and', 'is', 'are', 'it', 'its', 'this', 'that', 'cm', 'cm1', 'cm2', 'cm3'
  ]);

  for (const l of (crs.licences || [])) {
    if (l.archived) continue;
    for (const s of (l.semestres || [])) {
      if (isSemesterArchived(s)) continue;
      for (const ue of (s.ues || [])) {
        const ueMatiereNames = (ue.matieres || []).map(m => m.nom).filter(Boolean);
        for (const m of (ue.matieres || [])) {
          if (!m.nom) continue;
          const keywords = new Set();
          const titles = [];
          (m.listeCM || []).forEach(cm => {
            if (!cm.titre) return;
            titles.push(cm.titre);
            // Tokenisation simple : mots de 3+ caractères, sans accents simplifiés
            const tokens = cm.titre
              .toLowerCase()
              .replace(/[^a-zàâäéèêëïîôöùûüçœ0-9\s]/g, ' ')
              .split(/\s+/)
              .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
            tokens.forEach(t => keywords.add(t));
          });
          matiereKeywords[m.nom.toLowerCase().trim()] = keywords;
          matiereCMTitles[m.nom.toLowerCase().trim()] = titles;
        }
      }
    }
  }

  // 2. Calcul du score de chevauchement (coefficient de Jaccard)
  const matiereNames = Object.keys(matiereKeywords);

  for (const nameA of matiereNames) {
    const kwA = matiereKeywords[nameA];
    if (kwA.size === 0) continue;

    const synergies = [];

    for (const nameB of matiereNames) {
      if (nameA === nameB) continue;
      const kwB = matiereKeywords[nameB];
      if (kwB.size === 0) continue;

      // Jaccard : |A ∩ B| / |A ∪ B|
      let intersection = 0;
      for (const w of kwA) {
        if (kwB.has(w)) intersection++;
      }
      const union = kwA.size + kwB.size - intersection;
      const jaccard = union > 0 ? intersection / union : 0;

      // Seuil minimal pour considérer une synergie
      if (jaccard >= 0.08) {
        synergies.push({
          matiere: nameB,
          score: parseFloat(jaccard.toFixed(3)),
          reason: `${intersection} concepts partagés sur ${union} uniques (Jaccard: ${jaccard.toFixed(2)})`
        });
      }

      // Détection de prérequis : le nom de la matière A apparaît dans les titres CM de B
      const nameRegex = new RegExp(nameA.replace(/[^a-zàâäéèêëïîôöùûüçœ0-9]/gi, ''), 'i');
      const prereqMentions = (matiereCMTitles[nameB] || []).filter(t => nameRegex.test(t)).length;
      if (prereqMentions > 0) {
        // Ajouter ou renforcer
        const existing = synergies.find(s => s.matiere === nameB);
        if (existing) {
          existing.score = Math.min(1.0, existing.score + 0.15);
          existing.reason += ` + prérequis (${prereqMentions} mentions)`;
        } else {
          synergies.push({
            matiere: nameB,
            score: 0.2,
            reason: `Prérequis détecté (${prereqMentions} mentions dans les CM)`
          });
        }
      }
    }

    if (synergies.length > 0) {
      synergies.sort((a, b) => b.score - a.score);
      map[nameA.toLowerCase().trim()] = synergies;
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// AXE 17 (NOUVEAU) : Workload Forecast — Prévision de charge sur 7 jours
// ---------------------------------------------------------------------------

/**
 * Durée d'une séance pour la prévision, avec le repli propre à son type.
 *
 * `h.dureeMinutes || 30` transformait une durée nulle déclarée en trente
 * minutes, et appliquait le même trente à tous les types. Le paramètre `cfg`
 * était par ailleurs accepté puis ignoré : les réglages de durée de l'étudiant
 * ne servaient nulle part ici, alors que l'orchestrateur s'en sert pour la même
 * mesure. Les deux comptent désormais pareil.
 */
function dureeSeanceForecast(h, cfg = {}) {
  const min = Number(h.dureeMinutes);
  if (Number.isFinite(min) && min >= 0) return min;
  if (h.type === 'ANKI') return cfg.defaultDurationAnki || 30;
  if (h.type === 'CM') return cfg.defaultDurationRevCM || 30;
  if (h.type === 'TD') return cfg.defaultDurationTD || 20;
  if (h.type === 'TP') return cfg.defaultDurationTP_Etape1 || 45;
  if (h.type === 'ANNALE') return cfg.defaultDurationAnnales || 60;
  return 30;
}

/**
 * Prédit la charge de travail quotidienne pour les 7 prochains jours
 * en utilisant un lissage exponentiel (Holt-Winters simplifié).
 *
 * Retourne [{ date, forecastMinutes, ci_lower, ci_upper }] pour J+1 à J+7
 */
function buildWorkloadForecast(historique, cfg = {}) {
  const forecast = [];
  if (!historique || historique.length === 0) return forecast;

  // Agréger l'historique par jour
  const dailyMinutes = {}; // { 'YYYY-MM-DD': totalMinutes }
  historique.forEach(h => {
    if (!h.timestamp) return;
    const d = new Date(h.timestamp);
    d.setHours(d.getHours() - 4);
    const dateStr = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    const mins = dureeSeanceForecast(h, cfg);
    dailyMinutes[dateStr] = (dailyMinutes[dateStr] || 0) + mins;
  });

  const joursTravailles = Object.keys(dailyMinutes).sort();
  if (joursTravailles.length < 3) return forecast;

  /*
   * Les jours sans travail étaient absents de la série.
   *
   * `dailyMinutes` ne contenait que les jours où quelque chose avait été fait,
   * et le lissage tournait sur cette suite tassée — puis son résultat était
   * étiqueté sur des jours de calendrier, J+1 à J+7. Les deux axes ne parlaient
   * pas de la même chose. Qui travaillait trois heures un samedi sur sept se
   * voyait annoncer 180 minutes pour chacun des sept jours suivants : 21 h
   * prévues pour une semaine qui en vaut 3, sept fois trop. Et qui s'arrêtait
   * dix jours après une bonne semaine gardait sa prévision intacte, tirée de
   * données mortes.
   *
   * La série court désormais du premier jour travaillé jusqu'à aujourd'hui,
   * jour par jour, les jours vides valant zéro — puisqu'ils valent zéro.
   */
  const sortedDates = [];
  const curseur = parseDateLocal(joursTravailles[0]);
  const finSerie = new Date();
  finSerie.setHours(finSerie.getHours() - 4);
  finSerie.setHours(0, 0, 0, 0);
  while (curseur <= finSerie && sortedDates.length < 400) {
    const cle = curseur.getFullYear() + '-' +
      String(curseur.getMonth() + 1).padStart(2, '0') + '-' +
      String(curseur.getDate()).padStart(2, '0');
    if (dailyMinutes[cle] === undefined) dailyMinutes[cle] = 0;
    sortedDates.push(cle);
    curseur.setDate(curseur.getDate() + 1);
  }
  if (sortedDates.length < 3) return forecast;

  const values = sortedDates.map(d => dailyMinutes[d]);

  /*
   * Ce que cette fonction estime, et comment.
   *
   * Elle annonçait un niveau plat, issu d'un lissage exponentiel, appliqué tel
   * quel aux sept jours à venir. Une semaine d'étude n'est pourtant pas plate :
   * elle a des jours de cours, des jours creux et un week-end. Sur un rythme de
   * cinq jours à deux heures, la même valeur était annoncée le samedi et le
   * mardi, et le total de la semaine se trompait d'un facteur deux — dans un
   * sens ou dans l'autre selon l'endroit où la série s'arrêtait. L'en-tête
   * promettait pourtant « Holt-Winters », c'est-à-dire une méthode saisonnière :
   * il n'y avait pas de saison.
   *
   * Chaque jour à venir est désormais estimé par la moyenne des mêmes jours de
   * semaine déjà observés — zéros compris, ce sont eux qui portent
   * l'information du week-end. Cette moyenne est pondérée par la fraîcheur, avec
   * la même décroissance que le reste du module : sans quoi dix jours d'arrêt
   * après une bonne semaine continuaient d'annoncer une heure et demie par jour,
   * tirée de données mortes. Faute d'assez d'observations pour un jour donné, on
   * retombe sur la moyenne générale plutôt que d'inventer une habitude.
   *
   * Le lissage exponentiel a été retiré : la pondération par fraîcheur suit déjà
   * la dérive, et lui ajouter une tendance revenait à compter deux fois la même
   * baisse.
   */
  const OBSERVATIONS_MINIMALES = 2;
  const DEMI_VIE_CHARGE_J = 21;

  const parJourSemaine = [[], [], [], [], [], [], []];
  const horodatages = [];
  sortedDates.forEach((cle, i) => {
    const d = parseDateLocal(cle);
    if (!d || Number.isNaN(d.getTime())) return;
    horodatages.push(d.getTime());
    parJourSemaine[d.getDay()].push({ valeur: values[i], t: d.getTime() });
  });

  const moyenneFraiche = (echantillon) => {
    if (!echantillon.length) return null;
    const { mean } = recencyWeightedMean(
      echantillon.map(x => x.valeur),
      echantillon.map(x => x.t),
      DEMI_VIE_CHARGE_J
    );
    return Number.isFinite(mean) ? mean : null;
  };

  const globale = recencyWeightedMean(values, horodatages, DEMI_VIE_CHARGE_J);
  const moyenneGlobale = Number.isFinite(globale.mean) ? globale.mean : 0;
  const dispersionGlobale = sampleStdDev(values);

  // Projection sur 7 jours
  const today = new Date();
  today.setHours(today.getHours() - 4);

  for (let day = 1; day <= 7; day++) {
    const forecastDate = new Date(today);
    forecastDate.setDate(forecastDate.getDate() + day);
    const dateStr = forecastDate.getFullYear() + '-' +
      String(forecastDate.getMonth() + 1).padStart(2, '0') + '-' +
      String(forecastDate.getDate()).padStart(2, '0');

    const observes = parJourSemaine[forecastDate.getDay()];
    const assez = observes.length >= OBSERVATIONS_MINIMALES;
    const propre = assez ? moyenneFraiche(observes) : null;
    const forecastVal = Math.max(0, propre === null ? moyenneGlobale : propre);

    /*
     * Un intervalle de largeur nulle affirmerait une certitude que cette
     * estimation ne possède pas : trois jours identiques suffisaient à annoncer
     * « 60 min, entre 60 et 60 », à 95 %. On plancherise donc la dispersion à un
     * quart de la valeur annoncée, et l'intervalle s'élargit avec l'horizon.
     */
    const dispersion = assez ? sampleStdDev(observes.map(x => x.valeur)) : dispersionGlobale;
    const ecartType = Math.max(dispersion, 0.25 * Math.max(forecastVal, moyenneGlobale));
    const ci = 1.96 * ecartType * Math.sqrt(day);

    forecast.push({
      date: dateStr,
      forecastMinutes: Math.round(forecastVal),
      ci_lower: Math.round(Math.max(0, forecastVal - ci)),
      ci_upper: Math.round(Math.max(0, forecastVal + ci)),
      // De quoi permettre à un écran de refuser d'afficher une estimation trop
      // maigre : jours de calendrier observés, et observations de ce jour-là.
      joursObserves: values.length,
      observationsCeJour: observes.length,
      saisonnier: assez
    });
  }

  return forecast;
}

// ---------------------------------------------------------------------------
// DÉTECTION D'ANOMALIE (Z-Score) — Utilitaire exporté
// ---------------------------------------------------------------------------

function detectAnomalyZScore(values, newValue) {
  if (values.length < 3) return false;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return false;

  const zScore = Math.abs((newValue - mean) / stdDev);
  return zScore > 2.0;
}

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------

module.exports = {
  isSemesterArchived,
  DAYS_OF_WEEK,
  getTodayString,
  getDayOfWeekString,
  getMatiereAverage,
  matiereDefaillante,
  buildCompensationMap,
  buildRemainingWeightMap,
  buildVelocityMap,
  detectBurnoutRisk,
  buildProjectedScoreMap,         // v2 compat : retourne { nom: number }
  buildProjectedScoreDetailMap,   // v3 : retourne { nom: { projected, ci_lower, ci_upper, ... } }
  buildCognitiveLoadMap,
  buildExamUrgencyMap,
  buildTimeOptimizationMap,       // v3 : chronotype + fenêtres optimales
  buildSynergyMap,                // v3 : chevauchement de concepts
  buildWorkloadForecast,          // v3 : prévision de charge J+1..J+7
  detectAnomalyZScore,
  // Helpers mathématiques exportés pour les tests
  linearRegression,
  recencyWeightedMean,
  sampleStdDev,
  normalizeDateStr,
  parseDateLocal
};