/**
 * SQLite n'existe pas sur le téléphone — et c'est très bien ainsi.
 *
 * Les modules du moteur importent `db/setup` en tête de fichier, avant de
 * savoir quelle source les alimentera. Sur le PC c'est le bon comportement ;
 * dans le bundle du navigateur, cela ferait entrer `better-sqlite3`, un module
 * natif C++ qui n'a rien à y faire et que la compilation refuserait.
 *
 * Vite remplace donc `db/setup` par ce fichier (voir `resolve.alias` dans
 * `vite.config.js`). L'objet rendu a la forme attendue, si bien que l'import
 * réussit ; mais toute tentative de s'en servir lève une erreur explicite.
 *
 * Ce n'est pas une fausse base : c'est un détecteur. Si ce message apparaît un
 * jour dans la console du téléphone, cela veut dire qu'un chemin du moteur a
 * échappé au registre de source et cherche à lire SQLite. Mieux vaut le voir
 * tout de suite qu'obtenir une réponse plausible tirée de nulle part.
 */

const refuser = () => {
  throw new Error(
    "Ce chemin du moteur tente d'ouvrir SQLite, indisponible sur cet appareil. " +
    "La lecture doit passer par la source déclarée dans moteur/stockage.js."
  );
};

/* Chaque accès est piégé : `db.prepare(...)`, `db.exec(...)`, `db.transaction(...)` */
export const db = new Proxy({}, {
  get: (_, propriete) => {
    if (propriete === 'name') return ':indisponible:';
    // Les vérifications de présence (`healthDb?.db`) ne doivent pas exploser.
    if (propriete === 'then' || typeof propriete === 'symbol') return undefined;
    return refuser;
  },
});

export const DB_PATH = ':indisponible:';

export default { db, DB_PATH };
