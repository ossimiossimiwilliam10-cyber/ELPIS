const express = require('express');
const router = express.Router();
const { loadCours, saveCours } = require('../moteur/cours');
const { syncAnkiRetention, extractSubjectNames, fetchDeckNames } = require('../moteur/ankiSync');
const { preparerEpreuve, ouvrirEpreuve, releverEpreuve, rendreCartes, rapatrierCartesOubliees,
  chercherCartes, revisionsDepuis, diagnostiquerEchecs, ankiDisponible } = require('../moteur/epreuveAnki');


// GET Anki decks
router.get('/decks', async (req, res, next) => {
  try {
    const decks = await fetchDeckNames();
    res.json({ success: true, decks });
  } catch (err) {
    next(err);
  }
});

// POST Anki sync
router.post('/sync', async (req, res, next) => {
  try {
    const coursData = loadCours();
    
    // Extraction des matières et leurs mappings
    const subjects = extractSubjectNames(coursData);
    
    // Lancement de la synchronisation avancée
    const ankiStats = await syncAnkiRetention(subjects, 365);
    
    if (ankiStats.success) {
       coursData._globalAnkiStats = ankiStats;
       saveCours(coursData);

       res.json({ success: true, message: `Synchronisation réussie (${Object.keys(ankiStats.retentionBySubject || {}).length} matières mises à jour)` });
    } else {
       res.status(500).json({ error: ankiStats.message || ankiStats.error });
    }
  } catch (err) {
    next(err);
  }
});

// GET Anki Stats for Today
router.get('/today-stats', async (req, res, next) => {
  try {
    const coursData = loadCours();
    const subjects = extractSubjectNames(coursData);
    const ankiStats = await syncAnkiRetention(subjects, 1);
    res.json(ankiStats);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Épreuve de validation
// ---------------------------------------------------------------------------

/**
 * Ouvre une épreuve sur les cartes d'un cours.
 *
 * Renvoie l'horodatage de départ : c'est lui qui permettra, au relevé, de ne
 * compter que les révisions faites pendant l'épreuve — sans quoi une session
 * Anki de la veille suffirait à valider le cours.
 */
router.post('/epreuve/ouvrir', async (req, res, next) => {
  try {
    const { deckMatiere, titreCours, taille, deckExplicite } = req.body || {};

    if (!await ankiDisponible()) {
      return res.status(503).json({
        success: false,
        error: "Anki n'est pas lancé, ou l'extension AnkiConnect est absente.",
      });
    }

    const preparation = await preparerEpreuve(deckMatiere, titreCours, { taille, deckExplicite });
    if (preparation.cartes.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Aucune carte trouvée pour ce cours.',
        deck: preparation.deck,
      });
    }

    // L'heure est relevée avant l'ouverture : une carte révisée dans la seconde
    // qui suit doit compter.
    // Une séance précédente interrompue aurait laissé des cartes dans le deck
    // d'accueil : on les rend avant d'en emprunter de nouvelles.
    await rapatrierCartesOubliees().catch(() => {});

    const debut = Date.now();
    const seance = await ouvrirEpreuve(preparation.cartes, { nouvelles: preparation.nouvelles });

    res.json({
      success: true,
      debut,
      origines: seance.origines,
      requete: preparation.requete,
      nouvelles: preparation.nouvelles,
      population: preparation.population,
      aApprendre: preparation.aApprendre,
      deck: preparation.deck,
      precision: preparation.precision,
      cartes: preparation.cartes.length,
      fragiles: preparation.fragiles,
      disponibles: preparation.disponibles,
    });
  } catch (err) {
    next(err);
  }
});

/** Relève le résultat d'une épreuve ouverte, et le juge. */
router.post('/epreuve/relever', async (req, res, next) => {
  try {
    const { requete, debut, seuil, origines, nouvelles, population } = req.body || {};
    if (!requete || !Number.isFinite(Number(debut))) {
      return res.status(400).json({ success: false, error: 'Épreuve inconnue.' });
    }

    const verdict = await releverEpreuve(requete, Number(debut), { seuil, nouvelles, population });

    // Un taux dit qu'il faut retravailler ; il ne dit pas quoi. Les cartes
    // échouées, elles, nomment les notions à reprendre.
    let lacunes = { notions: [], total: 0, affichees: 0 };
    if (verdict.concluante && !verdict.reussie) {
      const cartes = await chercherCartes(requete);
      const revisions = await revisionsDepuis(cartes, Number(debut));
      lacunes = await diagnostiquerEchecs(revisions).catch(() => lacunes);
    }

    // Les cartes retournent à leur deck quoi qu'il arrive : un relevé raté ne
    // doit pas les abandonner dans le deck d'épreuve.
    const rendues = await rendreCartes(origines).catch(() => 0);

    res.json({ success: true, ...verdict, lacunes, rendues });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
