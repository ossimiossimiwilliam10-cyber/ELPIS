/**
 * Versions de collection — empêcher un appareil d'écraser ce qu'il n'a pas vu.
 *
 * La fusion à trois branches vit côté client : c'est lui qui détient à la fois
 * son état, le socle du dernier accord et l'état du serveur. Elle suffit tant
 * que rien ne bouge entre le moment où il lit et celui où il écrit — or c'est
 * exactement ce qui arrive avec deux appareils :
 *
 *     téléphone : GET   (voit la version 7)
 *     PC        : POST  (le serveur passe en version 8)
 *     téléphone : POST  (fusion faite à partir de la 7 — la 8 est perdue)
 *
 * Chaque collection porte donc un compteur. Une écriture annonce la version sur
 * laquelle elle s'appuie ; si le serveur a bougé depuis, il refuse et renvoie
 * son état courant, à charge pour le client de refusionner. C'est le seul
 * moment où le serveur arbitre : il ne fusionne pas, il interdit d'écrire à
 * l'aveugle.
 *
 * Une écriture sans version annoncée est acceptée. Le navigateur du PC écrit
 * ainsi depuis toujours, et refuser ces écritures reviendrait à casser
 * l'application existante pour se prémunir d'une course qui, à un seul
 * appareil, ne peut pas se produire.
 */

const { db } = require('../db/setup');

/** En-tête portant la version, à la lecture comme à l'écriture. */
const ENTETE_VERSION = 'x-elpis-version';

/** Collections soumises au contrôle de version. */
const COLLECTIONS = ['config', 'cours', 'historique', 'projets'];

function assurerTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS versions (
      collection TEXT PRIMARY KEY,
      version INTEGER NOT NULL DEFAULT 0,
      maj TEXT
    );
  `);
}
assurerTable();

/** Version courante d'une collection. Une collection jamais écrite vaut 0. */
function versionDe(collection) {
  try {
    const ligne = db.prepare('SELECT version FROM versions WHERE collection = ?').get(collection);
    return ligne ? Number(ligne.version) || 0 : 0;
  } catch (err) {
    console.error('Lecture de version impossible:', err.message);
    return 0;
  }
}

/** Incrémente la version d'une collection et rend la nouvelle valeur. */
function incrementerVersion(collection) {
  try {
    const suivante = versionDe(collection) + 1;
    db.prepare(
      `INSERT INTO versions (collection, version, maj) VALUES (?, ?, ?)
       ON CONFLICT(collection) DO UPDATE SET version = excluded.version, maj = excluded.maj`
    ).run(collection, suivante, new Date().toISOString());
    return suivante;
  } catch (err) {
    console.error('Écriture de version impossible:', err.message);
    return 0;
  }
}

/** Toutes les versions, pour qu'un client sache d'un coup ce qui a bougé. */
function toutesLesVersions() {
  const versions = {};
  for (const collection of COLLECTIONS) versions[collection] = versionDe(collection);
  return versions;
}

/**
 * Middleware de contrôle : annonce la version en lecture, la vérifie en
 * écriture.
 *
 * `chargerEtat` sert à renvoyer l'état courant avec le refus : sans lui, le
 * client devrait relire dans une seconde requête, en laissant à nouveau la
 * place à une écriture concurrente.
 */
function controleVersion(collection, chargerEtat) {
  return (req, res, next) => {
    res.set('X-Elpis-Version', String(versionDe(collection)));
    res.set('Access-Control-Expose-Headers', 'X-Elpis-Version');

    if (req.method !== 'POST') return next();

    const annoncee = req.get(ENTETE_VERSION);
    // Écriture sans version annoncée : acceptée, voir l'en-tête du module.
    if (annoncee === undefined || annoncee === null || annoncee === '') return next();

    const attendue = versionDe(collection);
    if (Number(annoncee) === attendue) return next();

    return res.status(409).json({
      error: "Le serveur a changé depuis ta dernière lecture. Refusionne avant d'écrire.",
      conflitDeVersion: true,
      collection,
      versionAttendue: attendue,
      versionAnnoncee: Number(annoncee),
      etat: typeof chargerEtat === 'function' ? chargerEtat() : undefined,
    });
  };
}

module.exports = {
  ENTETE_VERSION,
  COLLECTIONS,
  versionDe,
  incrementerVersion,
  toutesLesVersions,
  controleVersion,
};
