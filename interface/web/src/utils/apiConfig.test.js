import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { urlDocument, getServerUrl, getApiUrl, setApiUrl, getRawIp } from './apiConfig';

/**
 * L'application Android est servie depuis `http://localhost` par la WebView.
 * Un chemin relatif y désigne le téléphone, où aucun document n'est stocké :
 * le bouton « Ouvrir le document » n'ouvrait qu'une page vide.
 *
 * Aucun fichier n'a besoin d'être recopié — le PC sert déjà ces documents, et
 * la synchronisation ne transporte que du JSON. Il manquait au téléphone
 * l'adresse à laquelle les demander.
 */
describe('urlDocument', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('laisse un chemin relatif intact quand le bridge sert la page', () => {
    // Sur PC, getServerUrl() est vide : le chemin relatif atteint déjà le bridge.
    expect(getServerUrl()).toBe('');
    expect(urlDocument('/api/documents/chapitre1.pdf')).toBe('/api/documents/chapitre1.pdf');
  });

  it('préfixe par l\u2019adresse du serveur dans l\u2019application Android', () => {
    localStorage.setItem('serverIp', '100.84.12.7');
    expect(urlDocument('/api/documents/chapitre1.pdf'))
      .toBe('http://100.84.12.7:3001/api/documents/chapitre1.pdf');
  });

  it('ajoute la barre oblique manquante', () => {
    localStorage.setItem('serverIp', '100.84.12.7');
    expect(urlDocument('api/documents/x.pdf')).toBe('http://100.84.12.7:3001/api/documents/x.pdf');
  });

  it('respecte une adresse déjà complète', () => {
    localStorage.setItem('serverIp', '100.84.12.7');
    expect(urlDocument('https://exemple.org/cours.pdf')).toBe('https://exemple.org/cours.pdf');
    expect(urlDocument('http://192.168.1.5:3001/api/documents/x.pdf'))
      .toBe('http://192.168.1.5:3001/api/documents/x.pdf');
  });

  it('ne casse pas sur une valeur absente', () => {
    expect(urlDocument(null)).toBe('');
    expect(urlDocument(undefined)).toBe('');
    expect(urlDocument('')).toBe('');
  });

  it('suit la même adresse que l\u2019API', () => {
    // Les deux doivent désigner le même serveur : une divergence rendrait les
    // documents injoignables alors que les données arrivent.
    localStorage.setItem('serverIp', '100.84.12.7');
    expect(getApiUrl()).toBe('http://100.84.12.7:3001/api');
    expect(urlDocument('/api/documents/x.pdf').startsWith(getServerUrl())).toBe(true);
  });
});

describe('adresse du serveur', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('retient l’adresse saisie et la restitue telle quelle', () => {
    setApiUrl('192.168.1.42');
    expect(getRawIp()).toBe('192.168.1.42');
    expect(getApiUrl()).toBe('http://192.168.1.42:3001/api');
  });

  it('rend une chaîne vide quand aucune adresse n’est enregistrée', () => {
    expect(getRawIp()).toBe('');
    expect(getApiUrl()).toBe('/api');
    expect(getServerUrl()).toBe('');
  });

  it('ignore une adresse réduite à des espaces', () => {
    // Sans quoi l'application composerait `http:// :3001/api`.
    setApiUrl('   ');
    expect(getApiUrl()).toBe('/api');
    expect(getServerUrl()).toBe('');
  });
});
