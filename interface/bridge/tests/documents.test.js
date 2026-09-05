import { describe, test, expect } from 'vitest';
import path from 'path';
const { cheminDocumentSur, DOCUMENTS_DIR } = require('../routes/system');

/**
 * La route qui sert les documents construisait son chemin par simple
 * concaténation. Express décode les paramètres avant de les livrer : un `%2F`
 * encodé arrivait sous forme de séparateur et permettait de remonter hors du
 * dossier. `GET /api/documents/..%2F..%2Fdata%2Felpis.sqlite` servait la base
 * de données entière à qui atteint le bridge — le téléphone, mais aussi tout
 * ce qui partage le réseau ou le tailnet.
 */
describe('confinement des documents servis', () => {
  const racine = path.resolve(DOCUMENTS_DIR);

  test('accepte un nom de fichier ordinaire', () => {
    expect(cheminDocumentSur('doc-1234-567.pdf')).toBe(path.join(racine, 'doc-1234-567.pdf'));
  });

  test('refuse une remontée de dossier', () => {
    expect(cheminDocumentSur('../../data/elpis.sqlite')).toBeNull();
    expect(cheminDocumentSur('../.env')).toBeNull();
    expect(cheminDocumentSur('..')).toBeNull();
  });

  test('refuse un chemin absolu', () => {
    const antislash = String.fromCharCode(92);
    expect(cheminDocumentSur('/etc/passwd')).toBeNull();
    expect(cheminDocumentSur(`C:${antislash}Windows${antislash}win.ini`)).toBeNull();
    expect(cheminDocumentSur(`${antislash}${antislash}serveur${antislash}partage`)).toBeNull();
  });

  test('refuse une valeur vide ou non textuelle', () => {
    expect(cheminDocumentSur('')).toBeNull();
    expect(cheminDocumentSur('   ')).toBeNull();
    expect(cheminDocumentSur(null)).toBeNull();
    expect(cheminDocumentSur(undefined)).toBeNull();
  });

  test('laisse passer un sous-dossier légitime', () => {
    // Rien n'en crée aujourd'hui, mais la règle est le confinement, pas
    // l'interdiction de toute arborescence.
    expect(cheminDocumentSur('sous/doc.pdf')).toBe(path.join(racine, 'sous', 'doc.pdf'));
  });
});
