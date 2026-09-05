import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTaskCompletion } from './useTaskCompletion';

let storeState;

vi.mock('../store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  return { default: useStore };
});

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const cursus = () => ({
  licences: [{
    nom: 'L2',
    semestres: [{
      nom: 'S3',
      ues: [{
        nom: 'UE1',
        matieres: [{
          nom: 'Algèbre',
          listeCM: [{ titre: 'Groupes' }],
          listeTD: [{ titre: 'TD1' }],
          listeTP: [{ titre: 'TP1', nombrePratiques: 1 }],
          listeAnnales: [{ titre: 'Session 2025' }],
        }],
      }],
    }],
  }],
});

/** Retourne l'exercice tel qu'enregistré après validation. */
const exoEnregistre = (liste, index = 0) =>
  storeState.setCoursConfig.mock.calls[0][0].licences[0].semestres[0].ues[0].matieres[0][liste][index];

beforeEach(() => {
  vi.clearAllMocks();
  storeState = {
    coursConfig: cursus(),
    config: {},
    intelligence: null,
    addHistoriqueEntry: vi.fn(),
    setConfig: vi.fn(),
    setCoursConfig: vi.fn(),
  };
});

describe('useTaskCompletion — complétion', () => {
  it('signale une tâche introuvable', () => {
    const { result } = renderHook(() => useTaskCompletion());
    const ok = result.current.completeTask({ type: 'TD', matiere: 'Inconnue', titre: 'TD9' }, { minutes: 20 });
    expect(ok).toBe(false);
    expect(storeState.addHistoriqueEntry).not.toHaveBeenCalled();
  });

  it('marque un TD comme pratiqué et affine son temps moyen', () => {
    // Régression : TD, TP et annales ne mettaient à jour ni `tempsMoyen` ni
    // `nombreRevisionsTemps`, si bien que l'estimation de durée de
    // l'orchestrateur ne s'améliorait jamais depuis l'accueil.
    const { result } = renderHook(() => useTaskCompletion());
    result.current.completeTask({ type: 'TD', matiere: 'Algèbre', titre: 'TD1' }, { minutes: 25 });

    const td = exoEnregistre('listeTD');
    expect(td.nombrePratiques).toBe(1);
    expect(td.tempsMoyen).toBe(25);
    expect(td.nombreRevisionsTemps).toBe(1);
  });

  it('enregistre le temps d\'un TP sur l\'étape en cours', () => {
    const { result } = renderHook(() => useTaskCompletion());
    result.current.completeTask({ type: 'TP', matiere: 'Algèbre', titre: 'TP1' }, { minutes: 200 });

    const tp = exoEnregistre('listeTP');
    expect(tp.nombreRevisionsEtapes).toEqual([0, 1]);
    expect(tp.tempsMoyenEtapes[1]).toBe(200);
  });

  it('conserve la note d\'une annale et en déduit la difficulté', () => {
    // Régression : la note pilote la règle URGENCE_NOTE de l'orchestrateur ;
    // la perdre revenait à désactiver la règle pour toute validation faite ici.
    const { result } = renderHook(() => useTaskCompletion());
    result.current.completeTask({ type: 'ANNALE', matiere: 'Algèbre', titre: 'Session 2025' }, { minutes: 60, note: 7 });

    const annale = exoEnregistre('listeAnnales');
    expect(annale.derniereNote).toBe(7);
    expect(annale.difficulte).toBe('difficile');
    expect(storeState.addHistoriqueEntry.mock.calls[0][0].action).toBe('Terminé (Note: 7/20)');
  });

  it('applique les règles FSRS à un cours', () => {
    const { result } = renderHook(() => useTaskCompletion());
    result.current.completeTask({ type: 'CM', matiere: 'Algèbre', titre: 'Groupes' }, { minutes: 90, sm2Score: 3 });

    const cm = exoEnregistre('listeCM');
    expect(cm.fsrsCard).toBeDefined();
    expect(cm.jActuel).toBeGreaterThanOrEqual(1);
    expect(cm.prochaineRevisionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(cm.tempsMoyen).toBe(90);
  });

  it('comptabilise une durée par défaut quand aucun temps n\'est saisi', () => {
    // Régression : `dureeMinutes: 0` dans l'historique laissait le temps de
    // travail du jour à zéro malgré une tâche validée.
    const { result } = renderHook(() => useTaskCompletion());
    result.current.completeTask({ type: 'TD', matiere: 'Algèbre', titre: 'TD1' }, { minutes: 0 });

    expect(storeState.addHistoriqueEntry.mock.calls[0][0].dureeMinutes).toBe(20);
  });

  it('pondère le temps moyen sur les dernières mesures', () => {
    // Une moyenne arithmétique classique fige l'estimation après quelques dizaines
    // de révisions ; le poids est plafonné pour qu'elle reste réactive.
    storeState.coursConfig.licences[0].semestres[0].ues[0].matieres[0].listeTD[0] = {
      titre: 'TD1', tempsMoyen: 20, nombreRevisionsTemps: 50,
    };
    const { result } = renderHook(() => useTaskCompletion());
    result.current.completeTask({ type: 'TD', matiere: 'Algèbre', titre: 'TD1' }, { minutes: 70 });

    expect(exoEnregistre('listeTD').tempsMoyen).toBe(30); // (20*4 + 70) / 5
  });

  it('valide une tâche libre sans toucher au cursus', () => {
    const { result } = renderHook(() => useTaskCompletion());
    const ok = result.current.completeTask({ type: 'PERSO', titre: 'Lecture', matiere: 'Divers', isCustom: true }, { minutes: 40 });

    expect(ok).toBe(true);
    expect(storeState.setCoursConfig).not.toHaveBeenCalled();
    expect(storeState.addHistoriqueEntry.mock.calls[0][0].dureeMinutes).toBe(40);
  });

  it('valide une séance de langue et met à jour le relevé de la langue', () => {
    // Une langue ne figure pas dans l'arbre des cours : la chercher là-dedans
    // faisait répondre « tâche introuvable » et la séance n'était pas comptée.
    storeState.config = {
      langues: [{ id: 'l1', nom: 'Anglais', dernieresPratiques: { vocabulaire: '' } }],
    };
    const { result } = renderHook(() => useTaskCompletion());
    const ok = result.current.completeTask(
      { type: 'LANGUE', matiere: 'Anglais', titre: 'Vocabulaire', volet: 'vocabulaire', langueId: 'l1' },
      { minutes: 20 }
    );

    expect(ok).toBe(true);
    expect(storeState.setCoursConfig).not.toHaveBeenCalled();

    const [{ langues }] = storeState.setConfig.mock.calls[0];
    expect(langues[0].dernieresPratiques.vocabulaire).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(storeState.addHistoriqueEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: 'LANGUE', matiere: 'Anglais', titre: 'Vocabulaire', dureeMinutes: 20,
    }));
  });

  it('valide une séance de langue même si la langue a été retirée entre-temps', () => {
    storeState.config = { langues: [] };
    const { result } = renderHook(() => useTaskCompletion());
    const ok = result.current.completeTask(
      { type: 'LANGUE', matiere: 'Anglais', titre: 'Vocabulaire', volet: 'vocabulaire', langueId: 'l1' },
      { minutes: 20 }
    );

    expect(ok).toBe(true);
    expect(storeState.setConfig).not.toHaveBeenCalled();
    expect(storeState.addHistoriqueEntry).toHaveBeenCalled();
  });

  it('appelle le rappel de succès', () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useTaskCompletion());
    result.current.completeTask({ type: 'TD', matiere: 'Algèbre', titre: 'TD1' }, { minutes: 20 }, onSuccess);
    expect(onSuccess).toHaveBeenCalled();
  });
});

describe('useTaskCompletion — suspension', () => {
  it('reporte le cours à demain sans altérer son état FSRS', () => {
    const { result } = renderHook(() => useTaskCompletion());
    result.current.suspendCM({ matiere: 'Algèbre', titre: 'Groupes' }, 30);

    const cm = exoEnregistre('listeCM');
    expect(cm.derniereRevision).toBeUndefined();
    expect(cm.fsrsCard).toBeUndefined();
    expect(cm.jActuel).toBeUndefined();
    expect(cm.prochaineRevisionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(storeState.addHistoriqueEntry.mock.calls[0][0].action).toBe('Suspendu (séance partielle)');
  });
});

describe('useTaskCompletion — robustesse et séances suspendues', () => {
  /** Le CM tel qu'enregistré après le dernier appel à setCoursConfig. */
  const cmEnregistre = () => {
    const appels = storeState.setCoursConfig.mock.calls;
    return appels[appels.length - 1][0].licences[0].semestres[0].ues[0].matieres[0].listeCM[0];
  };

  it("survit à une date de révision située dans le futur", () => {
    /*
     * La bibliothèque FSRS lève `Invalid delta_t` quand la dernière révision est
     * postérieure à maintenant, et la validation cassait sans rien enregistrer :
     * une séance travaillée était perdue. Le cas n'a rien de théorique avec deux
     * appareils synchronisés — il suffit que l'horloge du téléphone avance sur
     * celle du PC.
     */
    const demain = new Date();
    demain.setDate(demain.getDate() + 3);
    storeState.coursConfig.licences[0].semestres[0].ues[0].matieres[0].listeCM[0] = {
      titre: 'Groupes', jActuel: 6, repetitions: 3,
      derniereRevision: demain.toISOString().split('T')[0],
      fsrsCard: { due: demain.toISOString(), last_review: demain.toISOString(), stability: 6, difficulty: 5, reps: 3, lapses: 0, state: 2, elapsed_days: 0, scheduled_days: 6 },
    };

    const { result } = renderHook(() => useTaskCompletion());
    let ok;
    expect(() => {
      ok = result.current.completeTask({ type: 'CM', matiere: 'Algèbre', titre: 'Groupes' }, { minutes: 30, sm2Score: 3 });
    }).not.toThrow();

    expect(ok).toBe(true);
    expect(storeState.addHistoriqueEntry).toHaveBeenCalled();
    expect(cmEnregistre().jActuel).toBeGreaterThan(0);
  });

  it("ne prend pas une séance suspendue pour une mesure de durée", () => {
    /*
     * Suspendre après vingt minutes un chapitre qui en demande quatre-vingt-dix
     * enregistrait vingt minutes comme temps que ce chapitre coûte. ELPIS
     * sous-évaluait ensuite son budget à chaque planification.
     */
    const { result } = renderHook(() => useTaskCompletion());
    result.current.suspendCM({ type: 'CM', matiere: 'Algèbre', titre: 'Groupes' }, 20);

    const cm = cmEnregistre();
    expect(cm.tempsMoyen).toBeUndefined();
    expect(cm.nombreRevisionsTemps).toBeUndefined();
    expect(cm.tempsPartielMin).toBe(20);
  });

  it("rend les minutes suspendues au coût du chapitre lors de sa validation", () => {
    storeState.coursConfig.licences[0].semestres[0].ues[0].matieres[0].listeCM[0] = {
      titre: 'Groupes', tempsPartielMin: 20,
    };

    const { result } = renderHook(() => useTaskCompletion());
    result.current.completeTask({ type: 'CM', matiere: 'Algèbre', titre: 'Groupes' }, { minutes: 40, sm2Score: 3 });

    const cm = cmEnregistre();
    // Le chapitre a coûté 60 minutes en tout, même si la journée n'en compte que 40.
    expect(cm.tempsMoyen).toBe(60);
    expect(cm.tempsPartielMin).toBe(0);
    expect(storeState.addHistoriqueEntry).toHaveBeenCalledWith(
      expect.objectContaining({ dureeMinutes: 40 })
    );
  });
});
