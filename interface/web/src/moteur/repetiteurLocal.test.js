import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  consulterLocal,
  lireConversationLocale,
  ecrireConversationLocale,
  viderConversationLocale,
} from './repetiteurLocal';
import { brancherMoteurLocal, debrancherMoteurLocal } from './sourceLocale';
import useStore from '../store';

/**
 * Le Répétiteur répond sans le PC.
 *
 * Le moteur était embarqué sur l'appareil depuis le projet de synchronisation,
 * mais pas lui : le panneau interrogeait le PC par le réseau, alors qu'il ne
 * lit rien d'autre que les tables déjà présentes sur le téléphone. Câble
 * débranché, chaque question se terminait par « le serveur est-il lancé ? ».
 *
 * Deux choses seulement changent par rapport au PC : le règlement des études,
 * lu sur le disque là-bas, est ici embarqué dans le paquet ; et la
 * conversation, fichier partagé là-bas, vit ici dans le stockage local.
 */

const AUJOURDHUI = new Date();
const formater = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ilYA = (n) => {
  const d = new Date(AUJOURDHUI);
  d.setDate(d.getDate() - n);
  return formater(d);
};
const dans = (n) => ilYA(-n);

const CURSUS = {
  licences: [{
    nom: 'L2 Physique',
    semestres: [{
      nom: 'Semestre 3', dateFin: dans(120),
      ues: [{
        nom: 'UE 1', ects: 12,
        matieres: [{
          nom: 'Mécanique 3', coefficient: 2, evaluations: [],
          listeCM: [
            { titre: 'Ch1', jActuel: 5, derniereRevision: ilYA(9), prochaineRevisionDate: ilYA(4), repetitions: 2 },
            { titre: 'Ch2', jActuel: 0 },
          ],
          listeTD: [], listeTP: [], listeAnnales: [],
        }],
      }],
    }],
  }],
};

const CONFIG = {
  maxStudyHoursPerDay: 5, capaciteQuotidienneH: 5, maxSubjectsPerDay: 3,
  bedtime: '23:00', wakeUpTime: '07:00',
  restDays: [], skippedRestDays: [], studyStartDate: ilYA(30),
  fixedCommitments: [], langues: [], absences: [],
};

beforeEach(() => {
  debrancherMoteurLocal();
  useStore.setState({ config: CONFIG, coursConfig: CURSUS, historique: [], projets: [] });
  localStorage.clear();
});

afterEach(() => {
  debrancherMoteurLocal();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Le Répétiteur sur l’appareil', () => {
  it('refuse de répondre tant que le moteur n’est pas branché', () => {
    // Sans source, il lirait SQLite — absent ici. Une réponse bâtie sur rien
    // serait pire qu'un refus.
    const r = consulterLocal('combien de matières ai-je ?');
    expect(r.compris).toBe(false);
    expect(r.content).toMatch(/pas branché/i);
  });

  it('répond sur les vraies données de l’appareil, sans réseau', () => {
    brancherMoteurLocal();
    const r = consulterLocal('combien de matières ai-je ?');

    expect(r.calculeLocalement).toBe(true);
    expect(r.content).toMatch(/1 matière/);
  });

  it('cite le règlement, embarqué dans le paquet', () => {
    /*
     * `reglement.js` lit `data/reglement_etudes.md` sur le disque : un
     * `require('fs')` en tête de fichier empêchait tout le Répétiteur d'être
     * embarqué. Le texte est désormais fourni au moteur au premier usage.
     */
    brancherMoteurLocal();
    const r = consulterLocal('que dit le règlement sur la compensation ?');

    expect(r.compris).toBe(true);
    expect(r.content.length).toBeGreaterThan(80);
    // La réserve accompagne toute citation : ce n'est pas un avis de scolarité.
    expect(r.content).toMatch(/scolarité fait foi/i);
  });

  it('suit le cursus de l’appareil quand il change', () => {
    brancherMoteurLocal();
    expect(consulterLocal('combien de matières ai-je ?').content).toMatch(/1 matière/);

    useStore.setState({ coursConfig: { licences: [] } });
    expect(consulterLocal('combien de matières ai-je ?').content).not.toMatch(/1 matière/);
  });

  it('rend une réponse plutôt que de laisser remonter une exception', () => {
    brancherMoteurLocal();
    useStore.setState({ coursConfig: { licences: [{ semestres: [{ ues: [{ matieres: null }] }] }] } });

    const r = consulterLocal('où en suis-je ?');
    expect(typeof r.content).toBe('string');
    expect(r.content.length).toBeGreaterThan(0);
  });
});

describe('La conversation gardée sur l’appareil', () => {
  it('part vide et se relit telle qu’elle a été écrite', () => {
    expect(lireConversationLocale()).toEqual([]);

    const echange = [
      { role: 'user', content: 'où en suis-je ?' },
      { role: 'assistant', content: 'Ton cursus compte une matière.' },
    ];
    ecrireConversationLocale(echange);
    expect(lireConversationLocale()).toEqual(echange);
  });

  it('s’efface à la demande', () => {
    ecrireConversationLocale([{ role: 'user', content: 'bonjour' }]);
    viderConversationLocale();
    expect(lireConversationLocale()).toEqual([]);
  });

  it('ne grandit pas sans fin', () => {
    const beaucoup = Array.from({ length: 500 }, (_, i) => ({ role: 'user', content: `question ${i}` }));
    ecrireConversationLocale(beaucoup);

    const relu = lireConversationLocale();
    expect(relu.length).toBeLessThanOrEqual(200);
    // Ce sont les derniers messages qui sont gardés, pas les premiers.
    expect(relu[relu.length - 1].content).toBe('question 499');
  });

  it('survit à un stockage illisible', () => {
    // Navigation privée, contenu corrompu : une conversation perdue n'est pas
    // une panne.
    localStorage.setItem('elpis.repetiteur.conversation', '{ceci n’est pas du JSON');
    expect(lireConversationLocale()).toEqual([]);
  });
});
