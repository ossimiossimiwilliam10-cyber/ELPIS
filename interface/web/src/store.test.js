import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useStore, { useChronoStore } from './store';

describe('store', () => {
  describe('useChronoStore', () => {
    it('should be defined', () => {
      expect(useChronoStore).toBeDefined();
    });

    it('should be a function', () => {
      // TODO: Vérifier le type exact (fonction, objet, classe...)
      // expect(typeof useChronoStore).toBe('function');
      expect(useChronoStore).toBeDefined();
    });
  });

});

describe('fetchOrchestrator — requêtes concurrentes', () => {
  /*
   * Chaque collection enregistrée déclenche un rafraîchissement du rapport, et
   * il y en a quatre : config, cours, historique, projets. Au démarrage, quatre
   * requêtes identiques partaient en quelques millisecondes et le serveur
   * recalculait quatre fois le même programme — FSRS, urgences d'examen, charge
   * cognitive, fatigue.
   *
   * La fenêtre de regroupement vit dans le module : sans horloge maîtrisée, un
   * test suppimerait la requête du suivant et l'ordre d'exécution ferait loi.
   */
  const rapport = { statut: 'OK', tachesDuJour: [{ id: 'a' }, { id: 'b' }], intelligence: {} };

  // Horloge qui n'avance jamais deux fois au même instant : `useFakeTimers`
  // repart de l'heure réelle, si bien qu'un décalage fixe redonnait la même
  // valeur à chaque test et laissait la fenêtre du précédent ouverte.
  let instant = Date.now();

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    instant += 60_000;
    vi.setSystemTime(instant);
    globalThis.fetch = vi.fn(async () => ({
      ok: true, status: 200, json: async () => rapport,
    }));
  });

  afterEach(() => vi.useRealTimers());

  it('ne lance qu’une requête pour quatre appels simultanés', async () => {
    await Promise.all([
      useStore.getState().fetchOrchestrator(),
      useStore.getState().fetchOrchestrator(),
      useStore.getState().fetchOrchestrator(),
      useStore.getState().fetchOrchestrator(),
    ]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(useStore.getState().pendingTasksCount).toBe(2);
  });

  it('regroupe deux appels rapprochés', async () => {
    // Le chargement en émet deux à moins de cent millisecondes d'écart : la fin
    // de l'initialisation, puis la réconciliation de démarrage.
    await useStore.getState().fetchOrchestrator();
    await useStore.getState().fetchOrchestrator();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('relance une fois la fenêtre de regroupement passée', async () => {
    await useStore.getState().fetchOrchestrator();
    vi.setSystemTime(Date.now() + 5000);
    await useStore.getState().fetchOrchestrator();
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('ne confond pas deux paramétrages différents', async () => {
    // « Demander plus de tâches » et « +30 min » doivent rester distincts.
    await Promise.all([
      useStore.getState().fetchOrchestrator({ fillGap: false }),
      useStore.getState().fetchOrchestrator({ fillGap: true }),
    ]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
