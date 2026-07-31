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
function isSemesterArchived(s) {
  if (s.archived) return true;
  if (s.dateFin) {
    const df = parseDateLocal(normalizeDateStr(s.dateFin));
    const now = new Date();
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

function getMatiereAverage(matiere) {
  if (!matiere || !matiere.evaluations || !Array.isArray(matiere.evaluations)) return null;
  let totalScore = 0;
  let totalCoef = 0;
  matiere.evaluations.forEach(ev => {
    if (ev.note !== null && ev.note !== undefined && !isNaN(ev.note)) {
      const c = ev.coefficient || 1;
      totalScore += ev.note * c;
      totalCoef += c;
    }
  });
  return totalCoef > 0 ? { avg: totalScore / totalCoef, evaluatedCoef: totalCoef } : null;
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
        for (const m of (ue.matieres || [])) {
          const result = getMatiereAverage(m);
          if (result) {
            const coef = m.coefficient || 1;
            ueSumWeight += coef;
            ueSumNotes += result.avg * coef;
          }
        }
        const ueAvg = ueSumWeight > 0 ? ueSumNotes / ueSumWeight : null;
        ueData.push({ ue, ueAvg, ueSumWeight, ueSumNotes });
      }

      let semSumWeight = 0;
      let semSumNotes = 0;
      ueData.forEach(ud => {
        if (ud.ueAvg !== null) {
          semSumWeight += ud.ueSumWeight;
          semSumNotes += ud.ueSumNotes;
        }
      });
      const semAvg = semSumWeight > 0 ? semSumNotes / semSumWeight : null;

      ueData.forEach(ud => {
        for (const m of (ud.ue.matieres || [])) {
          if (ud.ueAvg !== null && semAvg !== null) {
            map[m.nom.toLowerCase().trim()] = {
              compensable: ud.ueAvg < 10 && semAvg >= 10,
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

function buildVelocityMap(crs, historique, cfg = {}) {
  const map = {};
  if (!historique || historique.length === 0) return map;

  const histByMatiere = {};
  historique.forEach(h => {
    if (!h.matiere) return;
    if (!histByMatiere[h.matiere]) histByMatiere[h.matiere] = [];
    histByMatiere[h.matiere].push(h);
  });

  if (!crs || !crs.licences) return map;

  const now = Date.now();

  for (const l of (crs.licences || [])) {
    if (l.archived) continue;
    for (const s of (l.semestres || [])) {
      if (isSemesterArchived(s)) continue;
      for (const ue of (s.ues || [])) {
        for (const m of (ue.matieres || [])) {
          const mHist = histByMatiere[m.nom] || [];
          const cmSessions = mHist
            .filter(h => h.type === 'CM')
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

          // --- EMA pour la durée des sessions ---
          let totalMinutes = 0;
          let emaMinutes = null;
          const alpha = 0.3;

          mHist.forEach(h => {
            let mins = h.dureeMinutes || 30;
            totalMinutes += mins;
          });

          cmSessions.forEach(h => {
            let mins = h.dureeMinutes || 30;
            if (emaMinutes === null) {
              emaMinutes = mins;
            } else {
              emaMinutes = (mins * alpha) + (emaMinutes * (1 - alpha));
            }
          });

          // --- Maîtrise des CM ---
          const masteredCMs = (m.listeCM || [])
            .filter(cm => cm.easeFactor && cm.easeFactor >= 2.5 && (cm.repetitions || 0) > 0).length;
          const totalCMs = (m.listeCM || []).length;

          let avgSessionsToMaster = null;
          if (masteredCMs > 0 && cmSessions.length > 0) {
            avgSessionsToMaster = cmSessions.length / masteredCMs;
          }

          const avgMinutesPerSession = emaMinutes !== null ? emaMinutes : 60;

          // --- COURBE D'EBBINGHAUS : estimation de la stabilité mémoire ---
          // R = e^(-t / S)  où S = stabilité (en jours)
          // On estime S à partir des easeFactors Anki moyens
          let stabilityS = 7; // défaut : 7 jours
          const easeFactors = (m.listeCM || [])
            .map(cm => cm.easeFactor)
            .filter(ef => ef && ef > 0);
          if (easeFactors.length > 0) {
            const avgEF = easeFactors.reduce((a, b) => a + b, 0) / easeFactors.length;
            // Conversion heuristique : EF 2.5 ~ S=7j, EF 3.0 ~ S=21j
            stabilityS = Math.round(7 * Math.exp((avgEF - 2.5) * 1.5));
            stabilityS = Math.max(1, Math.min(365, stabilityS));
          }

          // Rétention estimée depuis la dernière révision
          let lastRevisionTs = 0;
          (m.listeCM || []).forEach(cm => {
            if (cm.derniereRevision) {
              const ts = parseDateLocal(normalizeDateStr(cm.derniereRevision)).getTime();
              if (ts > lastRevisionTs) lastRevisionTs = ts;
            }
          });
          const daysSinceLastRevision = lastRevisionTs > 0
            ? (now - lastRevisionTs) / (1000 * 60 * 60 * 24)
            : 999;
          const estimatedRetention = Math.exp(-daysSinceLastRevision / stabilityS);

          // --- FORECAST : date de maîtrise estimée ---
          const unmasteredCMs = totalCMs - masteredCMs;
          const estimatedRemainingMinutes = unmasteredCMs * (avgSessionsToMaster || 3) * avgMinutesPerSession;
          let forecastMasteryDate = null;
          if (unmasteredCMs > 0 && avgSessionsToMaster && avgMinutesPerSession) {
            // On suppose qu'on peut faire ~1 session CM par jour d'étude
            const dailyStudyCapacity = cfg.maxStudyHoursPerDay
              ? (cfg.maxStudyHoursPerDay * 60 * 0.3) // ~30% du temps dispo pour les CM
              : 120;
            const estimatedDays = Math.ceil(
              (unmasteredCMs * avgSessionsToMaster * avgMinutesPerSession) / dailyStudyCapacity
            );
            const forecastDate = new Date(now + estimatedDays * 24 * 3600 * 1000);
            forecastMasteryDate = forecastDate.toISOString().split('T')[0];
          }

          // --- VELOCITY TREND : accélération ou décélération ? ---
          let velocityTrend = 'stable';
          if (cmSessions.length >= 3) {
            const xs = cmSessions.map((_, i) => i); // index de session
            const ys = cmSessions.map(h => h.dureeMinutes || 30);
            const reg = linearRegression(xs, ys);
            if (reg.slope < -2 && reg.rSquared > 0.3) velocityTrend = 'accelerating';
            else if (reg.slope > 2 && reg.rSquared > 0.3) velocityTrend = 'decelerating';
          }

          // --- LEARNING EFFICIENCY RATIO ---
          const isSlowLearner = avgSessionsToMaster !== null && avgSessionsToMaster > 4;
          const learningEfficiency = totalCMs > 0
            ? masteredCMs / Math.max(1, cmSessions.length)
            : null;

          map[m.nom.toLowerCase().trim()] = {
            avgSessionsToMaster,
            avgMinutesPerSession,
            isSlowLearner,
            masteredCMs,
            totalCMs,
            estimatedRemainingMinutes,
            totalStudyMinutes: totalMinutes,
            // Nouvelles métriques v3
            stabilityDays: stabilityS,
            estimatedRetention: parseFloat(estimatedRetention.toFixed(2)),
            forecastMasteryDate,
            velocityTrend,
            learningEfficiency: learningEfficiency !== null ? parseFloat(learningEfficiency.toFixed(3)) : null
          };
        }
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// AXE 12 : Anti-Burnout Guardian
// ---------------------------------------------------------------------------

function detectBurnoutRisk(cfg, historique) {
  const restDays = cfg.restDays || [];

  const today = new Date();
  today.setHours(today.getHours() - 4);

  let daysWithoutRest = 0;
  for (let i = 0; i < 30; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.getFullYear() + '-' + String(checkDate.getMonth() + 1).padStart(2, '0') + '-' + String(checkDate.getDate()).padStart(2, '0');

    if (restDays.includes(dateStr)) break;

    const workedThatDay = (historique || []).some(h => {
      if (!h.timestamp) return false;
      const hDate = new Date(h.timestamp);
      hDate.setHours(hDate.getHours() - 4);
      return hDate.getFullYear() + '-' + String(hDate.getMonth() + 1).padStart(2, '0') + '-' + String(hDate.getDate()).padStart(2, '0') === dateStr;
    });

    if (!workedThatDay && i > 0) break;

    daysWithoutRest++;
  }

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentHist = (historique || []).filter(h => h.timestamp && new Date(h.timestamp) >= sevenDaysAgo);
  const totalRecentMinutes = recentHist.reduce((acc, h) => {
    let mins = h.dureeMinutes;
    if (mins == null || isNaN(mins)) {
      if (h.type === 'ANKI') mins = cfg.defaultDurationAnki || 30;
      else if (h.type === 'CM') mins = cfg.defaultDurationRevCM || 30;
      else if (h.type === 'TD') mins = cfg.defaultDurationTD || 20;
      else if (h.type === 'TP') mins = cfg.defaultDurationTP_Etape1 || 45;
      else if (h.type === 'ANNALE') mins = cfg.defaultDurationAnnales || 60;
      else mins = 30;
    }
    return acc + mins;
  }, 0);
  const avgDailyMinutes = totalRecentMinutes / 7;

  const bedtimeHour = cfg.bedtime ? parseInt(cfg.bedtime.split(':')[0]) : 23;
  const lateSessionCount = recentHist.filter(h => {
    if (!h.timestamp) return false;
    const hour = new Date(h.timestamp).getHours();
    return hour >= bedtimeHour || hour < 4;
  }).length;

  let riskLevel = 'none';
  let shouldForceRest = false;
  let reason = '';

  if ((daysWithoutRest >= 14 && avgDailyMinutes > 360) || daysWithoutRest >= 21) {
    riskLevel = 'high';
    shouldForceRest = true;
    if (daysWithoutRest >= 21) {
      reason = `${daysWithoutRest} jours consécutifs sans aucun repos. Repos forcé pour éviter l'épuisement.`;
    } else {
      reason = `${daysWithoutRest} jours sans repos et ${Math.round(avgDailyMinutes / 60)}h/jour en moyenne. Repos forcé.`;
    }
  } else if (daysWithoutRest >= 10 || avgDailyMinutes > 480) {
    riskLevel = 'medium';
    reason = `${daysWithoutRest} jours consécutifs. Pense à prendre un Joker bientôt.`;
  } else if (lateSessionCount >= 3) {
    riskLevel = 'low';
    reason = `${lateSessionCount} sessions tardives cette semaine. Ton sommeil est crucial.`;
  }

  return { riskLevel, shouldForceRest, reason, daysWithoutRest, avgDailyMinutes, lateSessionCount };
}

// ---------------------------------------------------------------------------
// AXE 11 : Projected Score Map (compatibilité ascendante — retourne un nombre)
// ---------------------------------------------------------------------------

function buildProjectedScoreMap(crs, velocityMap, ankiStats = null) {
  const detail = buildProjectedScoreDetailMap(crs, velocityMap, ankiStats);
  const map = {};
  for (const [key, val] of Object.entries(detail)) {
    map[key] = val.projected;
  }
  return map;
}

/**
 * AXE 11b : Carte de projection détaillée avec intervalles de confiance,
 * tendance, et détection d'anomalies.
 */
function buildProjectedScoreDetailMap(crs, velocityMap, ankiStats = null) {
  const map = {};
  if (!crs || !crs.licences) return map;

  for (const l of crs.licences) {
    if (l.archived) continue;
    for (const s of (l.semestres || [])) {
      if (isSemesterArchived(s)) continue;
      for (const u of (s.ues || [])) {
        for (const m of (u.matieres || [])) {

          // ---- Collecte des notes horodatées ----
          const gradeSeries = []; // { value, timestamp, source }

          if (m.evaluations) {
            m.evaluations.forEach(e => {
              if (e.note !== undefined && e.note !== null && e.note !== '' && !isNaN(parseFloat(e.note))) {
                const ts = e.date
                  ? parseDateLocal(normalizeDateStr(e.date)).getTime()
                  : Date.now();
                gradeSeries.push({
                  value: parseFloat(e.note),
                  timestamp: isNaN(ts) ? Date.now() : ts,
                  coefficient: e.coefficient || 1,
                  source: 'evaluation'
                });
              }
            });
          }

          if (m.listeAnnales) {
            m.listeAnnales.forEach(a => {
              if (a.nombrePratiques > 0 && a.derniereNote !== undefined && a.derniereNote !== null && a.derniereNote !== '' && !isNaN(parseFloat(a.derniereNote))) {
                const ts = a.dernierePratique
                  ? parseDateLocal(normalizeDateStr(a.dernierePratique)).getTime()
                  : Date.now();
                gradeSeries.push({
                  value: parseFloat(a.derniereNote),
                  timestamp: isNaN(ts) ? Date.now() : ts,
                  coefficient: 1,
                  source: 'annale'
                });
              }
            });
          }

          gradeSeries.sort((a, b) => a.timestamp - b.timestamp);

          // ---- Moyenne pondérée par récence ----
          const values = gradeSeries.map(g => g.value);
          const timestamps = gradeSeries.map(g => g.timestamp);
          const rwResult = recencyWeightedMean(values, timestamps, 60);
          const baseScore = rwResult.mean !== null ? rwResult.mean : 10;

          // ---- Régression linéaire (trend) ----
          let trend = 0;
          let trendSignificant = false;
          const anomalyFlags = [];

          if (gradeSeries.length >= 3) {
            const xs = gradeSeries.map((g, i) => (g.timestamp - gradeSeries[0].timestamp) / (24 * 3600 * 1000));
            const ys = gradeSeries.map(g => g.value);
            const reg = linearRegression(xs, ys);
            trend = reg.slope; // points par jour
            trendSignificant = reg.rSquared > 0.3;

            // Détection d'anomalies : toute note à plus de 2 écarts-types de la régression
            const yPred = xs.map(x => reg.intercept + reg.slope * x);
            const residuals = ys.map((y, i) => y - yPred[i]);
            const residStd = sampleStdDev(residuals);
            if (residStd > 0) {
              gradeSeries.forEach((g, i) => {
                const z = Math.abs(residuals[i]) / residStd;
                if (z > 2.0) {
                  anomalyFlags.push({
                    value: g.value,
                    source: g.source,
                    zScore: parseFloat(z.toFixed(2)),
                    date: new Date(g.timestamp).toISOString().split('T')[0]
                  });
                }
              });
            }
          }

          // ---- Intervalle de confiance (95%) ----
          let confidenceInterval = 0;
          if (gradeSeries.length >= 2) {
            const stdErr = sampleStdDev(values) / Math.sqrt(values.length);
            confidenceInterval = 1.96 * stdErr; // t-distribution approx pour n≥2
          }

          // ---- Modificateurs maîtrise & pratique ----
          const vData = velocityMap ? velocityMap[m.nom.toLowerCase().trim()] : null;
          let masteryRatio = 0.5;
          if (vData && vData.totalCMs > 0) {
            masteryRatio = vData.masteredCMs / vData.totalCMs;
          }

          let practiceCount = 0;
          if (m.listeAnnales) practiceCount += m.listeAnnales.filter(a => (a.nombrePratiques || 0) > 0).length * 5;
          if (m.listeTD) practiceCount += m.listeTD.filter(t => (t.nombrePratiques || 0) > 0).length;

          // ---- Blend Bayésien (Ajusté suite à calibration empirique) ----
          // Prior : baseScore avec précision augmentée
          // Likelihood : masteryRatio * 20 avec précision plus fine
          const priorMean = baseScore;
          const priorPrecision = 1.0 + gradeSeries.length * 0.5; // Adaptatif : plus d'évaluations = plus de précision
          const likelihoodPrecision = 1.5 * masteryRatio + 0.5; // Réduit pour éviter une surestimation de la simple "lecture" des CM
          const posteriorMean = (priorPrecision * priorMean + likelihoodPrecision * (masteryRatio * 20))
            / (priorPrecision + likelihoodPrecision);

          // Projection composite (plus proche du posterior pur)
          let projected = posteriorMean * 0.7 + baseScore * 0.2 + (masteryRatio * 20) * 0.1;

          // Bonus de pratique
          projected += Math.min(2, practiceCount * 0.10); // Ajusté à la baisse pour éviter débordement

          // Intégration de la rétention FSRS d'Anki (Bonus de 40%)
          if (ankiStats && ankiStats.retentionBySubject && ankiStats.retentionBySubject[m.nom] !== undefined) {
              const fsrsRatio = ankiStats.retentionBySubject[m.nom] / 100;
              // Le FSRS remplace 40% de la projection car c'est la véritable trace mémorielle
              projected = (projected * 0.6) + (fsrsRatio * 20) * 0.4;
          }

          // Projection de tendance (sur 30 jours max)

                    const trendWindowDays = 30;
          if (trendSignificant) {

            projected += trend * trendWindowDays * 0.5;
          }

          projected = Math.max(0, Math.min(20, projected));

          map[m.nom.toLowerCase().trim()] = {
            projected: parseFloat(projected.toFixed(1)),
            ci_lower: parseFloat(Math.max(0, projected - confidenceInterval).toFixed(1)),
            ci_upper: parseFloat(Math.min(20, projected + confidenceInterval).toFixed(1)),
            confidenceInterval: parseFloat(confidenceInterval.toFixed(1)),
            trend: parseFloat(trend.toFixed(3)),
            trendSignificant,
            sampleSize: gradeSeries.length,
            baseScore: parseFloat(baseScore.toFixed(1)),
            masteryRatio: parseFloat(masteryRatio.toFixed(2)),
            anomalyFlags: anomalyFlags.length > 0 ? anomalyFlags : undefined
          };
        }
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// AXE 6 : Cognitive Load Map (K-Means 1D)
// ---------------------------------------------------------------------------

function buildCognitiveLoadMap(crs) {
  const map = {};
  if (!crs || !crs.licences) return map;

  const allEF = [];
  const matieresRef = [];

  for (const l of (crs.licences || [])) {
    if (l.archived) continue;
    for (const s of (l.semestres || [])) {
      if (isSemesterArchived(s)) continue;
      for (const ue of (s.ues || [])) {
        for (const m of (ue.matieres || [])) {
          let totalEF = 0;
          let count = 0;
          (m.listeCM || []).forEach(cm => {
            if (cm.easeFactor) {
              totalEF += cm.easeFactor;
              count++;
            }
          });
          const avgEF = count > 0 ? totalEF / count : 2.5;
          allEF.push(avgEF);
          matieresRef.push({ nom: m.nom, avgEF });
        }
      }
    }
  }

  if (allEF.length >= 3) {
    allEF.sort();
    let cHeavy = allEF[0];
    let cMedium = allEF[Math.floor(allEF.length / 2)];
    let cLight = allEF[allEF.length - 1];

    for (let iter = 0; iter < 5; iter++) {
      let sumH = 0, countH = 0;
      let sumM = 0, countM = 0;
      let sumL = 0, countL = 0;

      allEF.forEach(val => {
        const dH = Math.abs(val - cHeavy);
        const dM = Math.abs(val - cMedium);
        const dL = Math.abs(val - cLight);
        const minD = Math.min(dH, dM, dL);

        if (minD === dH) { sumH += val; countH++; }
        else if (minD === dM) { sumM += val; countM++; }
        else { sumL += val; countL++; }
      });

      if (countH > 0) cHeavy = sumH / countH;
      if (countM > 0) cMedium = sumM / countM;
      if (countL > 0) cLight = sumL / countL;
    }

    matieresRef.forEach(m => {
      const dH = Math.abs(m.avgEF - cHeavy);
      const dM = Math.abs(m.avgEF - cMedium);
      const dL = Math.abs(m.avgEF - cLight);
      const minD = Math.min(dH, dM, dL);

      let cognitiveLoad = 'medium';
      if (minD === dH) cognitiveLoad = 'heavy';
      else if (minD === dL) cognitiveLoad = 'light';

      map[m.nom.toLowerCase().trim()] = { cognitiveLoad, avgEaseFactor: m.avgEF };
    });
  } else {
    matieresRef.forEach(m => {
      let cognitiveLoad = 'medium';
      if (m.avgEF < 2.0) cognitiveLoad = 'heavy';
      else if (m.avgEF > 3.0) cognitiveLoad = 'light';
      map[m.nom.toLowerCase().trim()] = { cognitiveLoad, avgEaseFactor: m.avgEF };
    });
  }

  return map;
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
              const normDate = normalizeDateStr(ev.date);
              const evalDate = parseDateLocal(normDate);
              if (isNaN(evalDate.getTime())) continue;
              const diffDays = Math.ceil((evalDate - today) / (1000 * 60 * 60 * 24));
              if (diffDays >= 0 && diffDays < minDays) minDays = diffDays;
            }
          }

          if (minDays === Infinity && s.dateFin) {
            const df = parseDateLocal(normalizeDateStr(s.dateFin));
            if (!isNaN(df.getTime())) {
              const diffDays = Math.ceil((df - today) / (1000 * 60 * 60 * 24));
              if (diffDays >= 0) minDays = diffDays;
            }
          }

          if (minDays === Infinity) continue;

          let multiplier = 1.0;
          if (minDays <= 3) multiplier = 3.0;
          else if (minDays <= 7) multiplier = 2.0;
          else if (minDays <= 21) multiplier = 1.5;
          else if (minDays <= 30) multiplier = 1.2;

          const key = subj.nom.toLowerCase().trim();
          map[key] = { multiplier, daysToExam: minDays };
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
      hourDurations[hour] += h.dureeMinutes || 30;
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

  // Fenêtres optimales selon le chronotype
  if (map.chronotype === 'morning_lark') {
    map.optimalWindows = {
      heavy:  { start: map.peakStart, end: Math.min(map.peakStart + 3, 12) },
      medium: { start: map.peakStart + 3, end: Math.min(map.peakStart + 5, 16) },
      light:  { start: 16, end: 21 }
    };
  } else if (map.chronotype === 'night_owl') {
    map.optimalWindows = {
      heavy:  { start: 14, end: 18 },
      medium: { start: 18, end: 21 },
      light:  { start: 10, end: 14 }
    };
  } else {
    // intermediate : standard
    map.optimalWindows = {
      heavy:  { start: 8, end: 12 },
      medium: { start: 13, end: 17 },
      light:  { start: 17, end: 21 }
    };
  }

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
    const mins = h.dureeMinutes || 30;
    dailyMinutes[dateStr] = (dailyMinutes[dateStr] || 0) + mins;
  });

  const sortedDates = Object.keys(dailyMinutes).sort();
  if (sortedDates.length < 3) return forecast;

  const values = sortedDates.map(d => dailyMinutes[d]);

  // Lissage exponentiel simple (niveau) + tendance
  const alpha = 0.3; // niveau
  const beta = 0.1;  // tendance

  let level = values[0];
  let trend = 0;

  for (let i = 1; i < values.length; i++) {
    const oldLevel = level;
    level = alpha * values[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - oldLevel) + (1 - beta) * trend;
  }

  // Écart-type des résidus pour l'intervalle de confiance
  const fitted = [];
  let l = values[0], t = 0;
  for (let i = 0; i < values.length; i++) {
    if (i > 0) {
      const oldL = l;
      l = alpha * values[i] + (1 - alpha) * (l + t);
      t = beta * (l - oldL) + (1 - beta) * t;
    }
    fitted.push(l);
  }
  const residuals = values.slice(1).map((v, i) => v - fitted[i]);
  const residStd = sampleStdDev(residuals);

  // Projection sur 7 jours
  const today = new Date();
  today.setHours(today.getHours() - 4);

  for (let day = 1; day <= 7; day++) {
    const forecastDate = new Date(today);
    forecastDate.setDate(forecastDate.getDate() + day);
    const dateStr = forecastDate.getFullYear() + '-' +
      String(forecastDate.getMonth() + 1).padStart(2, '0') + '-' +
      String(forecastDate.getDate()).padStart(2, '0');

    const forecastVal = level + trend * day;
    const ci = 1.96 * residStd * Math.sqrt(day); // l'incertitude augmente avec l'horizon

    forecast.push({
      date: dateStr,
      forecastMinutes: Math.round(Math.max(0, forecastVal)),
      ci_lower: Math.round(Math.max(0, forecastVal - ci)),
      ci_upper: Math.round(Math.max(0, forecastVal + ci))
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
  DAYS_OF_WEEK,
  getTodayString,
  getDayOfWeekString,
  getMatiereAverage,
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