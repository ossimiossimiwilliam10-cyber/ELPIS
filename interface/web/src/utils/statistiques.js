import { toLogicalDateStr , debutFenetreJours } from './dateUtils';

/**
 * Calculs de la page Statistiques.
 *
 * Tout ce qui suit est volontairement sans React ni DOM : les formules
 * (rétention DSR, régularité, moyennes) sont le cœur analytique de
 * l'application et méritent d'être testées seules, sans passer par un rendu.
 */

const MINUTES_PAR_DEFAUT = 30; // ancien historique, avant l'enregistrement des durées
const TYPES_SUIVIS = ['CM', 'TD', 'TP', 'ANNALE'];

/** Durée d'une entrée d'historique, en minutes. */
export function dureeDe(entree) {
  const d = Number(entree?.dureeMinutes);
  return Number.isFinite(d) && d > 0 ? d : MINUTES_PAR_DEFAUT;
}

/** `90` → `1h30`. Sert aussi bien aux axes des graphiques qu'aux compteurs. */
export function formaterDuree(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/** Bornes d'une période exprimée en jours (`null` = tout l'historique). */
export function filtrerParPeriode(historique, jours, maintenant = Date.now()) {
  const liste = Array.isArray(historique) ? historique : [];
  if (!jours) return liste;
  // Fenêtre alignée sur les journées logiques : « les 30 derniers jours »
  // doit contenir 30 dates distinctes, pas 31.
  const debut = debutFenetreJours(jours, maintenant);
  return liste.filter((h) => {
    const t = new Date(h?.timestamp).getTime();
    return Number.isFinite(t) && t >= debut;
  });
}

/**
 * Minutes par jour et par type d'exercice, sur les `jours` derniers jours.
 *
 * L'ancienne version relançait un `filter` sur tout l'historique pour chacun
 * des 90 jours affichés. On regroupe désormais en un seul passage : la page
 * reste fluide même avec plusieurs milliers de séances.
 */
export function serieParJour(historique, jours, maintenant = Date.now()) {
  const parDate = new Map();
  for (const h of Array.isArray(historique) ? historique : []) {
    const t = new Date(h?.timestamp).getTime();
    if (!Number.isFinite(t)) continue;
    const cle = toLogicalDateStr(t);
    let jour = parDate.get(cle);
    if (!jour) {
      jour = { CM: 0, TD: 0, TP: 0, ANNALE: 0 };
      parDate.set(cle, jour);
    }
    if (TYPES_SUIVIS.includes(h.type)) jour[h.type] += dureeDe(h);
  }

  const points = [];
  for (let i = jours - 1; i >= 0; i--) {
    const d = new Date(maintenant - i * 86400000);
    // `toISOString()` bascule en UTC : les journées se décalaient d'un cran par
    // rapport au reste de l'application, qui compte en journée logique (−4 h).
    const cle = toLogicalDateStr(d.getTime());
    const jour = parDate.get(cle) || { CM: 0, TD: 0, TP: 0, ANNALE: 0 };
    points.push({
      date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      CM: Math.round(jour.CM),
      TD: Math.round(jour.TD),
      TP: Math.round(jour.TP),
      ANNALE: Math.round(jour.ANNALE),
    });
  }
  return points;
}

/**
 * Heures travaillées par matière, les `maxParts` premières détaillées et le
 * reste regroupé. Un camembert tronqué en silence laisse croire que le total
 * affiché est le total réel.
 */
export function repartitionParMatiere(historique, maxParts = 5) {
  const minutes = new Map();
  for (const h of Array.isArray(historique) ? historique : []) {
    if (!h?.matiere) continue;
    minutes.set(h.matiere, (minutes.get(h.matiere) || 0) + dureeDe(h));
  }

  const trie = [...minutes.entries()]
    .map(([name, min]) => ({ name, minutes: min, value: Math.round((min / 60) * 10) / 10 }))
    .sort((a, b) => b.minutes - a.minutes);

  if (trie.length <= maxParts) return trie;

  const tete = trie.slice(0, maxParts);
  const reste = trie.slice(maxParts);
  const minutesReste = reste.reduce((s, m) => s + m.minutes, 0);
  return [
    ...tete,
    {
      name: `${reste.length} autres matières`,
      minutes: minutesReste,
      value: Math.round((minutesReste / 60) * 10) / 10,
      estRegroupement: true,
    },
  ];
}

/**
 * Jours effectivement couverts par l'historique.
 *
 * Régression corrigée : sur « tout l'historique », la moyenne journalière
 * divisait toujours par 90 jours, quelle que soit l'ancienneté des données.
 */
export function joursCouverts(historique, jours, maintenant = Date.now()) {
  if (jours) return jours;
  const horodatages = (Array.isArray(historique) ? historique : [])
    .map((h) => new Date(h?.timestamp).getTime())
    .filter(Number.isFinite);
  if (horodatages.length === 0) return 1;
  return Math.max(1, Math.ceil((maintenant - Math.min(...horodatages)) / 86400000));
}

/** Ensemble des journées logiques où au moins une séance a eu lieu. */
export function joursActifs(historique) {
  const jours = new Set();
  for (const h of Array.isArray(historique) ? historique : []) {
    const t = new Date(h?.timestamp).getTime();
    if (Number.isFinite(t)) jours.add(toLogicalDateStr(t));
  }
  return jours;
}

/**
 * Nombre de journées consécutives travaillées jusqu'à aujourd'hui.
 *
 * Une journée entamée mais pas encore travaillée ne casse pas la série : on
 * repart de la veille si rien n'a été fait aujourd'hui.
 */
export function serieEnCours(historique, maintenant = Date.now()) {
  const actifs = joursActifs(historique);
  if (actifs.size === 0) return 0;

  let compte = 0;
  let curseur = maintenant;
  if (!actifs.has(toLogicalDateStr(curseur))) curseur -= 86400000;

  while (actifs.has(toLogicalDateStr(curseur))) {
    compte++;
    curseur -= 86400000;
  }
  return compte;
}

/**
 * Les quatre chiffres de tête. Le « facteur de facilité SM-2 » qui figurait
 * ici renvoyait « N/A » en permanence depuis le passage à FSRS ; la régularité
 * dit quelque chose de vrai sur le travail fourni.
 */
export function indicateursCles(historique, jours, maintenant = Date.now()) {
  const liste = Array.isArray(historique) ? historique : [];
  const totalMinutes = liste.reduce((s, h) => s + dureeDe(h), 0);
  const couverts = joursCouverts(liste, jours, maintenant);
  const actifs = joursActifs(liste).size;
  const parts = repartitionParMatiere(liste, 1);

  return {
    totalHeures: Math.round((totalMinutes / 60) * 10) / 10,
    moyenneQuotidienne: formaterDuree(totalMinutes / couverts),
    matierePhare: parts.length > 0 && !parts[0].estRegroupement ? parts[0].name : (parts[0]?.name ?? null),
    joursActifs: actifs,
    joursCouverts: couverts,
    regularite: couverts > 0 ? Math.round((actifs / couverts) * 100) : 0,
    serie: serieEnCours(liste, maintenant),
  };
}

/** Rétention prédite par le modèle DSR : R(t) = (1 + t / (9·S))⁻¹. */
export function retentionDSR(joursEcoules, stabilite) {
  const S = Math.max(0.1, Number(stabilite) || 0);
  const t = Math.max(0, Number(joursEcoules) || 0);
  return Math.pow(1 + t / (9 * S), -1);
}

/** Parcourt le cursus et appelle `visiter(matiere, ue, semestre, licence)`. */
function parcourirMatieres(coursConfig, visiter) {
  for (const licence of coursConfig?.licences || []) {
    for (const semestre of licence?.semestres || []) {
      for (const ue of semestre?.ues || []) {
        for (const matiere of ue?.matieres || []) visiter(matiere, ue, semestre, licence);
      }
    }
  }
}

/** Répartition des cartes FSRS par maturité mémoire + rétention moyenne. */
export function metriquesFsrs(coursConfig, maintenant = Date.now()) {
  let total = 0;
  let sommeStabilite = 0;
  let matures = 0;
  let jeunes = 0;
  let apprentissage = 0;
  let sommeRetention = 0;

  parcourirMatieres(coursConfig, (matiere) => {
    for (const cm of matiere?.listeCM || []) {
      const carte = cm?.fsrsCard;
      if (!carte) continue;
      total++;
      const S = Number(carte.stability) || 0;
      sommeStabilite += S;
      if (S >= 21) matures++;
      else if (S >= 3) jeunes++;
      else apprentissage++;

      if (carte.last_review) {
        const derniere = new Date(carte.last_review).getTime();
        const ecoules = Number.isFinite(derniere) ? Math.max(0, (maintenant - derniere) / 86400000) : 0;
        sommeRetention += retentionDSR(ecoules, S);
      } else {
        sommeRetention += 1;
      }
    }
  });

  if (total === 0) return null;

  return {
    total,
    stabiliteMoyenne: Math.round((sommeStabilite / total) * 10) / 10,
    retentionMoyenne: Math.round((sommeRetention / total) * 1000) / 10,
    maturite: [
      { name: 'En apprentissage', value: apprentissage, ton: 'attention', aide: 'moins de 3 jours de stabilité' },
      { name: 'Jeune', value: jeunes, ton: 'info', aide: 'de 3 à 21 jours' },
      { name: 'Mature', value: matures, ton: 'succes', aide: 'plus de 21 jours' },
    ],
  };
}

/**
 * Courbe d'oubli : trois repères théoriques et la courbe réelle de
 * l'utilisateur, pour situer sa mémoire par rapport aux paliers FSRS.
 */
export function courbeOubli(stabiliteMoyenne) {
  const S = Number(stabiliteMoyenne);
  if (!Number.isFinite(S) || S <= 0) return null;

  const reperes = [
    { s: 1, libelle: 'S = 1 j (tout début)', ton: 'danger' },
    { s: 7, libelle: 'S = 7 j', ton: 'attention' },
    { s: 21, libelle: 'S = 21 j (mature)', ton: 'info' },
    { s: S, libelle: `S = ${S} j (toi)`, ton: 'succes', estMien: true },
  ].filter((r) => r.estMien || Math.abs(r.s - S) >= 0.5);

  const horizon = Math.max(60, Math.ceil(S * 2));
  const points = [];
  for (let t = 0; t <= horizon; t++) {
    const point = { jours: t };
    for (const r of reperes) point[r.libelle] = Math.round(retentionDSR(t, r.s) * 1000) / 10;
    points.push(point);
  }
  return { points, reperes };
}

/**
 * Projections de moyenne fournies par l'orchestrateur, agrégées par UE pour le
 * radar et triées par matière. Aucun calcul de note n'est refait ici.
 */
export function projections(intelligence, coursConfig) {
  const carte = intelligence?.projectedScoreMap;
  if (!carte || !coursConfig) return null;
  const entrees = Object.entries(carte);
  if (entrees.length === 0) return null;

  const parUE = [];
  parcourirMatieres(coursConfig, (matiere, ue) => {
    const score = carte[(matiere?.nom || '').toLowerCase().trim()];
    if (typeof score !== 'number') return;
    let cible = parUE.find((u) => u.ue === ue);
    if (!cible) {
      cible = { ue, somme: 0, compte: 0 };
      parUE.push(cible);
    }
    cible.somme += score;
    cible.compte++;
  });

  const radar = parUE
    .filter((u) => u.compte > 0)
    .map((u) => ({
      subject: u.ue.nom.length > 20 ? `${u.ue.nom.slice(0, 20)}…` : u.ue.nom,
      valeur: Math.round((u.somme / u.compte) * 10) / 10,
      fullMark: 20,
    }));

  const matieres = entrees
    .map(([nom, score]) => {
      const vitesse = intelligence.velocityMap?.[nom];
      return {
        matiere: nom,
        score,
        apprentissageLent: Boolean(vitesse?.isSlowLearner),
        cmMaitrises: vitesse?.masteredCMs || 0,
        cmTotal: vitesse?.totalCMs || 0,
      };
    })
    .sort((a, b) => b.score - a.score);

  const moyenne = entrees.reduce((s, [, v]) => s + v, 0) / entrees.length;
  return { moyenne, matieres, radar };
}

/** Ton sémantique d'une note sur 20, partagé par tous les affichages. */
export function tonNote(note) {
  if (!Number.isFinite(note)) return 'neutre';
  if (note >= 14) return 'succes';
  if (note >= 10) return 'attention';
  return 'danger';
}
