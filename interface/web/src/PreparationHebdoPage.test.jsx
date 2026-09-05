import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PreparationHebdoPage from './PreparationHebdoPage';

let storeState;

vi.mock('./store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  return { default: useStore };
});

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('./ToastProvider', () => ({ useToast: () => ({ toast }) }));

vi.mock('./MarkdownModal', () => ({ default: () => null }));

/** Matière dont la réserve est incomplète (2 TD, aucun TP, aucune annale). */
const matiereIncomplete = () => ({
  nom: 'Algèbre',
  listeTD: [{ titre: 'TD1', nombrePratiques: 0 }, { titre: 'TD2', nombrePratiques: 0 }],
  listeTP: [],
  listeAnnales: [],
});

/** Matière dont la réserve est au complet. */
const matiereComplete = () => ({
  nom: 'Analyse',
  listeTD: Array.from({ length: 7 }, (_, i) => ({ titre: `TD${i + 1}`, nombrePratiques: 0 })),
  listeTP: [{ titre: 'TP1', nombrePratiques: 0 }],
  listeAnnales: [{ titre: 'Session 2025', nombrePratiques: 0 }],
});

const cursusAvec = (...matieres) => ({
  licences: [{ nom: 'L2', semestres: [{ nom: 'S3', ues: [{ nom: 'UE1', matieres }] }] }],
});

beforeEach(() => {
  vi.clearAllMocks();
  storeState = {
    config: {},
    setConfig: vi.fn(),
    coursConfig: cursusAvec(matiereIncomplete()),
    setCoursConfig: vi.fn(),
    setActiveTab: vi.fn(),
  };
});

describe('PreparationHebdoPage — état de la réserve', () => {
  it('affiche les matières incomplètes', () => {
    render(<PreparationHebdoPage />);
    expect(screen.getByRole('heading', { name: 'Algèbre' })).toBeInTheDocument();
    expect(screen.getByText('2/7')).toBeInTheDocument();
  });

  it('chiffre ce qui manque pour atteindre la cible', () => {
    // Repris de src/__tests__/PreparationHebdoPage.test.jsx, qui faisait doublon.
    storeState.coursConfig = cursusAvec({ nom: 'Maths', listeTD: [], listeTP: [], listeAnnales: [] });
    render(<PreparationHebdoPage />);
    expect(screen.getByText('Maths')).toBeInTheDocument();
    expect(screen.getByText(/7 manquants/)).toBeInTheDocument();
  });

  it('annonce que tout est prêt quand les réserves sont pleines', () => {
    // Régression : la condition retenait aussi les matières complètes, si bien
    // que cet écran n'était atteignable qu'avec un cursus vide — le message
    // « toutes vos matières ont atteint leur réserve » était donc toujours faux.
    storeState.coursConfig = cursusAvec(matiereComplete());
    render(<PreparationHebdoPage />);
    expect(screen.getByText(/Tout est prêt pour la semaine/i)).toBeInTheDocument();
  });

  it('masque les matières prêtes derrière un dépliant', () => {
    storeState.coursConfig = cursusAvec(matiereIncomplete(), matiereComplete());
    render(<PreparationHebdoPage />);

    expect(screen.getByRole('heading', { name: 'Algèbre' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Analyse' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'afficher' }));
    expect(screen.getByRole('heading', { name: 'Analyse' })).toBeInTheDocument();
  });

  it('dénombre les matières à compléter', () => {
    storeState.coursConfig = cursusAvec(matiereIncomplete(), matiereComplete());
    render(<PreparationHebdoPage />);
    expect(screen.getByText(/1 matière à compléter/i)).toBeInTheDocument();
    expect(screen.getByText(/1 déjà prête/i)).toBeInTheDocument();
  });

  it('renvoie vers la Bibliothèque quand le cursus est vide', () => {
    storeState.coursConfig = { licences: [] };
    render(<PreparationHebdoPage />);
    expect(screen.getByText(/Aucune matière à préparer/i)).toBeInTheDocument();
    expect(screen.queryByText(/Tout est prêt/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Bibliothèque/i }));
    expect(storeState.setActiveTab).toHaveBeenCalledWith('cours');
  });
});

describe('PreparationHebdoPage — ajout d\'exercices', () => {
  it('ajoute un TD à la matière visée', () => {
    render(<PreparationHebdoPage />);
    fireEvent.click(screen.getByRole('button', { name: '+ 1 TD' }));

    const enregistre = storeState.setCoursConfig.mock.calls[0][0];
    expect(enregistre.licences[0].semestres[0].ues[0].matieres[0].listeTD).toHaveLength(3);
  });

  it('crée une annale avec une difficulté de départ plus élevée', () => {
    render(<PreparationHebdoPage />);
    fireEvent.click(screen.getByRole('button', { name: '+ 1 Annale' }));

    const annales = storeState.setCoursConfig.mock.calls[0][0].licences[0].semestres[0].ues[0].matieres[0].listeAnnales;
    expect(annales[0].difficulteInitiale).toBe(3);
  });

  it('n\'enregistre qu\'une fois par ajout', () => {
    // Régression : la sauvegarde partait d'un updater d'état, rejoué par React.
    render(<PreparationHebdoPage />);
    fireEvent.click(screen.getByRole('button', { name: '+ 1 TD' }));
    expect(storeState.setCoursConfig).toHaveBeenCalledTimes(1);
  });
});

describe('PreparationHebdoPage — engagements fixes', () => {
  const avecEngagement = (engagement = { day: 'Lundi', start: '08:00', end: '10:00', matiereLinked: '' }) => {
    // Objet gelé, comme le fait Immer dans le store.
    storeState.config = Object.freeze({ fixedCommitments: Object.freeze([Object.freeze(engagement)]) });
  };

  it('signale l\'absence d\'engagement', () => {
    render(<PreparationHebdoPage />);
    expect(screen.getByText(/Aucun engagement déclaré/i)).toBeInTheDocument();
  });

  it('ajoute un engagement', () => {
    render(<PreparationHebdoPage />);
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un Engagement/i }));
    expect(storeState.setConfig.mock.calls[0][0].fixedCommitments).toHaveLength(1);
  });

  it('modifie un engagement sans muter l\'objet gelé du store', () => {
    // Régression : `copie[idx].day = …` ne copiait que le tableau, pas l'élément.
    // Immer gelant les objets du store, la saisie levait une TypeError.
    avecEngagement();
    render(<PreparationHebdoPage />);

    expect(() =>
      fireEvent.change(screen.getByLabelText(/Jour de l'engagement 1/i), { target: { value: 'Mardi' } })
    ).not.toThrow();

    expect(storeState.setConfig.mock.calls[0][0].fixedCommitments[0].day).toBe('Mardi');
  });

  it('modifie les horaires', () => {
    avecEngagement();
    render(<PreparationHebdoPage />);
    fireEvent.change(screen.getByLabelText(/Heure de fin/i), { target: { value: '12:00' } });
    expect(storeState.setConfig.mock.calls[0][0].fixedCommitments[0].end).toBe('12:00');
  });

  it('affiche la durée retenue par l\'algorithme', () => {
    avecEngagement();
    render(<PreparationHebdoPage />);
    expect(screen.getByText('2 h')).toBeInTheDocument();
  });

  it('alerte sur une durée aberrante', () => {
    // 10:00 → 08:00 est lu comme un passage à minuit, soit 22 h : la journée
    // entière disparaissait des disponibilités sans un mot.
    avecEngagement({ day: 'Lundi', start: '10:00', end: '08:00', matiereLinked: '' });
    render(<PreparationHebdoPage />);
    expect(screen.getByText(/22 h/)).toBeInTheDocument();
    expect(screen.getByTitle(/inversé le début et la fin/i)).toBeInTheDocument();
  });

  it('supprime un engagement', () => {
    avecEngagement();
    render(<PreparationHebdoPage />);
    fireEvent.click(screen.getByRole('button', { name: /Supprimer l'engagement/i }));
    expect(storeState.setConfig.mock.calls[0][0].fixedCommitments).toEqual([]);
  });
});

describe('PreparationHebdoPage — suppression d\'exercice', () => {
  it('nomme l\'exercice avant de le supprimer', () => {
    render(<PreparationHebdoPage />);
    fireEvent.click(screen.getAllByTitle('Supprimer')[0]);
    expect(within(screen.getByRole('alertdialog')).getByText(/TD1/)).toBeInTheDocument();
  });

  it('supprime l\'exercice confirmé', () => {
    render(<PreparationHebdoPage />);
    fireEvent.click(screen.getAllByTitle('Supprimer')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

    const restants = storeState.setCoursConfig.mock.calls[0][0].licences[0].semestres[0].ues[0].matieres[0].listeTD;
    expect(restants.map(t => t.titre)).toEqual(['TD2']);
  });
});
