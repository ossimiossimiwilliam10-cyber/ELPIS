import { describe, it, expect, vi, beforeEach } from 'vitest';
import { echapperCsv, construireCsv, telechargerCsv } from './csv';

describe('echapperCsv', () => {
  it('entoure la valeur de guillemets', () => {
    expect(echapperCsv('Algèbre')).toBe('"Algèbre"');
  });

  it('double les guillemets internes', () => {
    // Régression : un titre contenant un guillemet décalait toutes les colonnes.
    expect(echapperCsv('Exercice "difficile"')).toBe('"Exercice ""difficile"""');
  });

  it('préserve virgules et retours à la ligne', () => {
    expect(echapperCsv('Cours, chapitre 2')).toBe('"Cours, chapitre 2"');
    expect(echapperCsv('Ligne 1\nLigne 2')).toBe('"Ligne 1\nLigne 2"');
  });

  it('rend une chaîne vide pour une valeur absente', () => {
    expect(echapperCsv(null)).toBe('');
    expect(echapperCsv(undefined)).toBe('');
  });

  it('accepte les nombres', () => {
    expect(echapperCsv(42)).toBe('"42"');
  });
});

describe('construireCsv', () => {
  it('assemble en-têtes et lignes', () => {
    const csv = construireCsv(['Date', 'Titre'], [['2026-09-15', 'TD1']]);
    expect(csv).toBe('"Date","Titre"\r\n"2026-09-15","TD1"');
  });

  it('échappe chaque cellule', () => {
    const csv = construireCsv(['Titre'], [['Exercice "1", suite']]);
    expect(csv).toContain('"Exercice ""1"", suite"');
  });

  it('accepte un tableau vide', () => {
    expect(construireCsv(['A'], [])).toBe('"A"');
  });
});

describe('telechargerCsv', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:fictif');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('déclenche le téléchargement du fichier nommé', () => {
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    telechargerCsv('export.csv', 'a,b');

    expect(clic).toHaveBeenCalled();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    clic.mockRestore();
  });

  it('libère l\'objet créé', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    telechargerCsv('export.csv', 'a,b');
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:fictif');
  });

  it('ne laisse aucun lien dans la page', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    telechargerCsv('export.csv', 'a,b');
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });
});
