import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);

/**
 * Garde-fou : les suites de tests vident les tables dans leurs hooks. Sans
 * aiguillage automatique vers une base jetable, un simple `npm test` détruisait
 * les données réelles de l'utilisateur — ce qui est arrivé.
 */
describe('Aiguillage de la base de données en test', () => {
  test('n\'ouvre jamais la base de production sous Vitest', () => {
    const { db } = require('../db/setup');
    const chemin = db.name; // better-sqlite3 expose le fichier ouvert

    expect(chemin).not.toMatch(/[\\/]elpis\.sqlite$/);
    expect(path.basename(chemin)).toMatch(/^elpis\.test\./);
  });

  test('isole chaque worker dans son propre fichier', () => {
    // Vitest exécute les fichiers en parallèle : une base partagée ferait
    // apparaître les fixtures d'une suite dans les résultats d'une autre.
    const { db } = require('../db/setup');
    const worker = process.env.VITEST_WORKER_ID || '0';
    expect(path.basename(db.name)).toBe(`elpis.test.${worker}.sqlite`);
  });

  test('la variable d\'environnement de test est bien détectée', () => {
    expect(Boolean(process.env.VITEST || process.env.NODE_ENV === 'test')).toBe(true);
  });

  test('les tables du cursus existent', () => {
    const { db } = require('../db/setup');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);

    ['licences', 'semestres', 'ues', 'matieres', 'cours_cm', 'exercices', 'historique', 'config']
      .forEach(nom => expect(tables).toContain(nom));
  });
});
