/**
 * Routes du module Langues.
 *
 * Le CRUD des langues n'est pas ici : une langue vit dans la configuration,
 * que le frontend enregistre déjà via `POST /api/config`. Dupliquer ce chemin
 * exposerait deux écritures concurrentes sur le même objet, comme cela avait
 * été évité pour `dernierePratiqueAnki`.
 *
 * Ne restent donc que les actions qu'un navigateur ne peut pas accomplir seul :
 * parler à Anki, lire le dossier des documents et ouvrir un fichier local.
 *
 * Aucune ne sort de la machine. ELPIS n'appelle plus aucun modèle : il compose
 * la consigne — c'est là qu'est la valeur, puisqu'elle porte le niveau estimé et
 * les mots déjà connus — et l'étudiant la porte dans la fenêtre de conversation
 * de son choix, puis recolle la réponse. Le filtrage des doublons et l'écriture
 * dans Anki restent locaux, donc fiables.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const { loadConfig } = require('../moteur/config');
const { loadHistorique } = require('../moteur/historique');
const { etatLangues, chargerLangues, regulariteRecente } = require('../moteur/langues');
const { niveauLangue, CATEGORIES, PALIERS } = require('../moteur/niveauLangue');
const {
  extraireCartes, filtrerDoublons, promptVocabulaire, normaliserNombre, texteBrut,
} = require('../moteur/vocabulaire');
const { getTodayString } = require('../moteur/intelligence');
const { invokeAnkiConnect } = require('../moteur/ankiSync');

const DOCUMENTS_DIR = path.resolve(__dirname, '..', '..', '..', 'documents');

/** Extensions acceptées pour un livre numérique rattaché à la grammaire. */
const EXTENSIONS_LIVRE = new Set(['.pdf', '.epub', '.djvu']);

/**
 * Notes lues dans un deck pour établir la liste des mots connus.
 *
 * Un deck ancien peut en compter plusieurs milliers ; toutes les lire à chaque
 * génération ralentirait l'opération sans rien apporter, les entrées les plus
 * récentes étant celles qu'un modèle risque le plus de reproposer.
 */
const PLAFOND_LECTURE_DECK = 1500;

/**
 * Modèles de note à deux champs cherchés dans Anki, par ordre de préférence.
 * Une installation francophone nomme le modèle de base « Basique » ; s'en
 * tenir à « Basic » ferait échouer l'ajout sans que la cause soit lisible.
 */
const MODELES_PREFERES = ['Basic', 'Basique', 'Basic (and reversed card)', 'Basique (et carte inversée)'];

/** Vrai si l'échec vient d'un Anki fermé plutôt que d'un défaut de l'appel. */
const ankiInjoignable = (err) => /lancé|timeout|ECONNREFUSED/i.test(err?.message || '');

/* ----------------------------------------------------------------- État */

// GET état de toutes les langues (dettes, volet proposé, régularité, niveau)
router.get('/etat', (req, res, next) => {
  try {
    const cfg = loadConfig();
    const todayStr = getTodayString();
    const historique = loadHistorique();
    const declarees = chargerLangues(cfg);

    const langues = etatLangues(cfg, todayStr, historique).map(etat => {
      const declaree = declarees.find(l => l.id === etat.id) || { nom: etat.nom };
      return {
        ...etat,
        regularite: regulariteRecente(etat.nom, etat.cadence, historique, todayStr),
        niveau: niveauLangue(declaree, historique),
      };
    });

    res.json({ success: true, date: todayStr, langues });
  } catch (err) {
    next(err);
  }
});

/**
 * GET référentiel de niveau : paliers du CECR et catégories de difficulté.
 * L'interface s'en sert pour proposer les choix des réglages sans recopier la
 * table — une divergence entre les deux rendrait l'estimation incompréhensible.
 */
router.get('/referentiel', (req, res, next) => {
  try {
    res.json({
      success: true,
      paliers: PALIERS.map(p => ({ code: p.code, libelle: p.libelle, heures: p.heures })),
      categories: Object.entries(CATEGORIES).map(([code, c]) => ({
        code, libelle: c.libelle, heures: c.heures, exemples: c.exemples,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------- Documents */

// GET livres numériques disponibles dans le dossier documents/
router.get('/livres', (req, res, next) => {
  try {
    if (!fs.existsSync(DOCUMENTS_DIR)) return res.json({ success: true, livres: [] });

    const livres = fs.readdirSync(DOCUMENTS_DIR)
      .filter(f => EXTENSIONS_LIVRE.has(path.extname(f).toLowerCase()))
      .sort();

    res.json({ success: true, livres });
  } catch (err) {
    next(err);
  }
});

// POST ouvrir un livre numérique dans le lecteur du système
router.post('/livre/ouvrir', (req, res, next) => {
  try {
    if (process.env.ADMIN_PASSWORD) {
      return res.status(403).json({ error: "L'ouverture de fichiers locaux est désactivée en mode sécurisé/production." });
    }

    const fichier = req.body?.fichier;
    if (!fichier || typeof fichier !== 'string') {
      return res.status(400).json({ error: "Nom du fichier manquant." });
    }

    // On ne retient que le nom de base : un chemin relatif remontant le dossier
    // (« ../../.env ») serait sinon résolu comme n'importe quel autre.
    const nom = path.basename(fichier);
    const chemin = path.join(DOCUMENTS_DIR, nom);

    if (path.dirname(path.resolve(chemin)) !== DOCUMENTS_DIR) {
      return res.status(403).json({ error: "Accès refusé : le fichier est hors du dossier autorisé." });
    }
    if (!fs.existsSync(chemin)) {
      return res.status(404).json({ error: `Fichier introuvable : ${nom}` });
    }

    const enfant = process.platform === 'win32'
      ? spawn('cmd.exe', ['/c', 'start', '""', chemin], { detached: true, windowsHide: true, stdio: 'ignore' })
      : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [chemin], { detached: true, stdio: 'ignore' });

    enfant.on('error', err => console.error("Erreur ouverture livre:", err.message));
    enfant.unref();

    res.json({ success: true, message: `Ouverture de ${nom}.` });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ Anki */

/**
 * Ouvre Anki sur un deck donné.
 *
 * Le calendrier d'Anki fait autorité ici, contrairement à l'épreuve de
 * validation d'un cours : le vocabulaire *est* une répétition espacée, il n'y
 * a aucune raison de la doubler d'une seconde.
 */
router.post('/anki/reviser', async (req, res, next) => {
  try {
    const deck = String(req.body?.deck || '').trim();
    if (!deck) return res.status(400).json({ error: "Nom du deck manquant." });

    await invokeAnkiConnect('guiDeckReview', { name: deck });
    res.json({ success: true, message: `Anki ouvert sur « ${deck} ».` });
  } catch (err) {
    // Anki fermé n'est pas une erreur serveur : l'interface propose de le lancer.
    if (ankiInjoignable(err)) {
      return res.status(503).json({ error: err.message, ankiFerme: true });
    }
    next(err);
  }
});

/**
 * Modèle de note à deux champs utilisable, et le nom de ses deux champs.
 * On interroge Anki plutôt que de supposer : les noms de champs varient avec
 * la langue de l'installation et avec les modèles importés.
 */
async function resoudreModele() {
  const modeles = await invokeAnkiConnect('modelNames');
  const disponibles = Array.isArray(modeles) ? modeles : [];

  const candidats = [
    ...MODELES_PREFERES.filter(m => disponibles.includes(m)),
    ...disponibles,
  ];

  for (const modele of candidats) {
    const champs = await invokeAnkiConnect('modelFieldNames', { modelName: modele });
    if (Array.isArray(champs) && champs.length >= 2) {
      return { modele, recto: champs[0], verso: champs[1] };
    }
  }

  throw new Error("Aucun modèle de note à deux champs trouvé dans Anki.");
}

/**
 * Recto des notes déjà présentes dans un deck.
 *
 * Les identifiants de note d'Anki sont les horodatages de création : les trier
 * par ordre décroissant donne les entrées les plus récentes, celles qu'il est
 * le plus utile de citer au modèle quand le deck dépasse le plafond de lecture.
 */
async function motsDuDeck(deck) {
  const requete = `deck:"${String(deck).replace(/["\\]/g, '\\$&')}"`;
  const ids = await invokeAnkiConnect('findNotes', { query: requete });
  const liste = (Array.isArray(ids) ? ids : []).map(Number).filter(Number.isFinite);

  const retenus = liste.sort((a, b) => b - a).slice(0, PLAFOND_LECTURE_DECK);
  if (retenus.length === 0) return { mots: [], total: liste.length };

  const infos = await invokeAnkiConnect('notesInfo', { notes: retenus });
  const mots = [];

  for (const note of infos || []) {
    const champs = note?.fields;
    if (!champs) continue;
    // `notesInfo` indique l'ordre des champs : le recto est celui de rang 0,
    // quel que soit son nom dans l'installation.
    const entree = Object.values(champs).find(c => c?.order === 0) || Object.values(champs)[0];
    const mot = texteBrut(entree?.value);
    if (mot) mots.push(mot);
  }

  return { mots, total: liste.length };
}

/** Mots du deck, ou liste vide si Anki ne répond pas — sans faire échouer l'appel. */
async function motsDuDeckTolerant(deck) {
  if (!deck) return { mots: [], total: 0, ankiFerme: false };
  try {
    return { ...(await motsDuDeck(deck)), ankiFerme: false };
  } catch (err) {
    if (ankiInjoignable(err)) return { mots: [], total: 0, ankiFerme: true };
    throw err;
  }
}

/**
 * Ajoute des cartes dans un deck. Crée le deck s'il n'existe pas.
 * Retourne le détail des ajouts : `addNotes` renvoie `null` pour un doublon,
 * ce qui n'est pas un échec mais mérite d'être annoncé.
 */
async function ajouterCartes(deck, cartes) {
  const { modele, recto, verso } = await resoudreModele();
  await invokeAnkiConnect('createDeck', { deck });

  const notes = cartes.map(c => ({
    deckName: deck,
    modelName: modele,
    fields: { [recto]: c.recto, [verso]: c.verso },
    options: { allowDuplicate: false, duplicateScope: 'deck' },
    tags: ['elpis', 'langue'],
  }));

  const ids = await invokeAnkiConnect('addNotes', { notes });
  const liste = Array.isArray(ids) ? ids : [];

  return {
    modele,
    ajoutees: liste.filter(Boolean).length,
    refusees: liste.filter(id => !id).length,
  };
}

/**
 * POST ajout de cartes, rédigées à la main ou collées depuis une conversation.
 *
 * C'est la porte de sortie quand la génération automatique n'est pas
 * disponible — pas de clé d'API — ou quand on préfère la réponse de sa propre
 * fenêtre de conversation. Le filtrage des doublons s'y applique aussi : il n'y
 * a pas de raison qu'un chemin soit plus soigneux que l'autre.
 */
router.post('/anki/ajouter', async (req, res, next) => {
  try {
    const deck = String(req.body?.deck || '').trim();
    if (!deck) return res.status(400).json({ error: "Nom du deck manquant." });

    const brutes = Array.isArray(req.body?.cartes)
      ? req.body.cartes
      : extraireCartes(req.body?.texte);

    const valides = brutes
      .map(c => ({ recto: texteBrut(c?.recto), verso: texteBrut(c?.verso) }))
      .filter(c => c.recto && c.verso);

    if (valides.length === 0) {
      return res.status(400).json({
        error: "Aucune carte exploitable. Attendu : un tableau JSON d'objets { recto, verso }.",
      });
    }

    const connus = await motsDuDeckTolerant(deck);
    const { retenues, ecartees } = filtrerDoublons(valides, connus.mots);

    if (retenues.length === 0) {
      return res.json({
        success: true, deck, ajoutees: 0, refusees: 0,
        deja: ecartees.length, cartes: [], ecartees,
        message: "Toutes ces entrées figurent déjà dans le paquet.",
      });
    }

    const bilan = await ajouterCartes(deck, retenues);
    res.json({ success: true, deck, cartes: retenues, ecartees, deja: ecartees.length, ...bilan });
  } catch (err) {
    if (ankiInjoignable(err)) {
      return res.status(503).json({ error: err.message, ankiFerme: true });
    }
    next(err);
  }
});

/* ----------------------------------------------------------- Génération */

/** Rassemble tout ce dont la consigne a besoin pour une langue donnée. */
async function contexteGeneration(corps) {
  const cfg = loadConfig();
  const langue = chargerLangues(cfg).find(l => l.id === String(corps?.langueId || ''));
  if (!langue) return { erreur: { statut: 404, message: "Langue inconnue." } };

  const niveau = niveauLangue(langue, loadHistorique());
  const deck = langue.vocabulaire.deckAnki;
  const connus = await motsDuDeckTolerant(deck);

  return {
    langue,
    niveau,
    deck,
    connus,
    nombre: normaliserNombre(corps?.nombre),
    theme: String(corps?.theme || '').trim().slice(0, 120),
  };
}

/**
 * POST la consigne elle-même, sans rien générer.
 *
 * Le même texte sert à l'appel automatique et au collage dans sa propre fenêtre
 * de conversation. L'exposer permet de travailler avec le modèle de son choix
 * sans perdre l'adaptation au niveau ni la liste des mots déjà connus — c'est
 * précisément ce qui manquait à un simple lien.
 */
router.post('/vocabulaire/prompt', async (req, res, next) => {
  try {
    const ctx = await contexteGeneration(req.body);
    if (ctx.erreur) return res.status(ctx.erreur.statut).json({ error: ctx.erreur.message });

    const prompt = promptVocabulaire({
      langue: ctx.langue.nom,
      niveau: ctx.niveau,
      nombre: ctx.nombre,
      theme: ctx.theme,
      motsConnus: ctx.connus.mots,
      autonome: true,
    });

    res.json({
      success: true,
      texte: prompt.complet,
      niveau: ctx.niveau,
      deck: ctx.deck,
      motsConnus: ctx.connus.total,
      exclusions: prompt.exclusions,
      ankiFerme: ctx.connus.ankiFerme,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
