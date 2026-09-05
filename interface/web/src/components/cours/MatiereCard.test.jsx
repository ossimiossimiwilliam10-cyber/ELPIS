import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import MatiereCard from './MatiereCard';

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('../../ToastProvider', () => ({ useToast: () => ({ toast }) }));

const matiereType = () => ({
  nom: 'Algèbre',
  listeCM: [{ titre: 'Groupes', repetitions: 2, jActuel: 7, easeFactor: 2.5 }],
  listeTD: [{ titre: 'TD1' }],
  listeTP: [],
  listeAnnales: [{ titre: 'Session 2025', derniereNote: 14 }],
  synergies: [],
});

const afficher = (matiere = matiereType(), extra = {}) => {
  const actions = {
    deleteMatiere: vi.fn(), updateField: vi.fn(),
    addCM: vi.fn(), deleteCM: vi.fn(),
    addTDManuel: vi.fn(), deleteTD: vi.fn(),
    addTPManuel: vi.fn(), deleteTP: vi.fn(),
    addAnnaleManuel: vi.fn(), deleteAnnale: vi.fn(),
    setModalConfig: vi.fn(),
    getNextReviewDate: vi.fn(() => 'Demain'),
    mutateAndSave: vi.fn(),
    ...extra,
  };
  render(
    <MatiereCard
      matiere={matiere}
      allMatiereNames={['Algèbre', 'Analyse', 'Programmation']}
      ankiDecks={['Deck::Maths']}
      lIndex={0} sIndex={0} uIndex={0} mIndex={0}
      actions={actions}
    />
  );
  return actions;
};

/** Section repérée par son intitulé. */
const section = (libelle) => screen.getByRole('heading', { name: new RegExp(libelle) }).closest('section');

beforeEach(() => vi.clearAllMocks());

describe('MatiereCard — structure', () => {
  it('affiche le nom de la matière', () => {
    afficher();
    expect(screen.getByText('Algèbre')).toBeInTheDocument();
  });

  it('présente les quatre familles de contenu', () => {
    afficher();
    ['Cours', 'TD', 'TP', 'Annales'].forEach(libelle => {
      expect(screen.getByRole('heading', { name: new RegExp(libelle) })).toBeInTheDocument();
    });
  });

  it('dénombre chaque famille', () => {
    afficher();
    expect(within(section('Cours')).getByText('1')).toBeInTheDocument();
    expect(within(section('TP')).getByText('0')).toBeInTheDocument();
  });

  it('signale une famille vide', () => {
    afficher();
    expect(within(section('TP')).getByText(/Aucun élément/i)).toBeInTheDocument();
  });

  it('résume l\'état de révision d\'un cours', () => {
    afficher();
    const cours = section('Cours');
    expect(within(cours).getByText(/Revu/)).toBeInTheDocument();
    expect(within(cours).getByText('Demain')).toBeInTheDocument();
  });

  it('affiche la dernière note d\'une annale', () => {
    afficher();
    expect(within(section('Annales')).getByText('14/20')).toBeInTheDocument();
  });

  it('liste les decks Anki disponibles', () => {
    afficher();
    expect(screen.getByRole('option', { name: 'Deck::Maths' })).toBeInTheDocument();
  });
});

describe('MatiereCard — statuts', () => {
  it('bascule la dispense', () => {
    const { updateField } = afficher();
    fireEvent.click(screen.getByRole('button', { name: 'Dispense' }));
    expect(updateField).toHaveBeenCalledWith(
      ['licences', 0, 'semestres', 0, 'ues', 0, 'matieres', 0, 'dispense'], true
    );
  });

  it('bascule la dette', () => {
    const { updateField } = afficher();
    fireEvent.click(screen.getByRole('button', { name: 'Dette' }));
    expect(updateField).toHaveBeenCalledWith(
      ['licences', 0, 'semestres', 0, 'ues', 0, 'matieres', 0, 'dette'], true
    );
  });

  it('masque la dette pour une matière dispensée', () => {
    // Les deux statuts s'excluent : une matière dispensée ne se repasse pas.
    afficher({ ...matiereType(), dispense: true });
    expect(screen.queryByRole('button', { name: /Dette/ })).not.toBeInTheDocument();
  });
});

describe('MatiereCard — synergies', () => {
  it('propose les autres matières, jamais elle-même', () => {
    afficher();
    expect(screen.getByRole('button', { name: 'Analyse' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Programmation' })).toBeInTheDocument();
  });

  it('ajoute une synergie au clic', () => {
    const { updateField } = afficher();
    fireEvent.click(screen.getByRole('button', { name: 'Analyse' }));
    expect(updateField).toHaveBeenCalledWith(
      ['licences', 0, 'semestres', 0, 'ues', 0, 'matieres', 0, 'synergies'], ['Analyse']
    );
  });

  it('retire une synergie déjà posée', () => {
    const { updateField } = afficher({ ...matiereType(), synergies: ['Analyse'] });
    fireEvent.click(screen.getByRole('button', { name: 'Analyse' }));
    expect(updateField).toHaveBeenCalledWith(
      ['licences', 0, 'semestres', 0, 'ues', 0, 'matieres', 0, 'synergies'], []
    );
  });

  it('signale l\'état de chaque lien aux lecteurs d\'écran', () => {
    afficher({ ...matiereType(), synergies: ['Analyse'] });
    expect(screen.getByRole('button', { name: 'Analyse' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Programmation' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('invite à créer d\'autres matières quand elle est seule', () => {
    render(
      <MatiereCard
        matiere={{ nom: 'Seule' }}
        allMatiereNames={['Seule']}
        lIndex={0} sIndex={0} uIndex={0} mIndex={0}
        actions={{
          deleteMatiere: vi.fn(), updateField: vi.fn(), addCM: vi.fn(), deleteCM: vi.fn(),
          addTDManuel: vi.fn(), deleteTD: vi.fn(), addTPManuel: vi.fn(), deleteTP: vi.fn(),
          addAnnaleManuel: vi.fn(), deleteAnnale: vi.fn(), setModalConfig: vi.fn(),
          getNextReviewDate: vi.fn(() => "Aujourd'hui"), mutateAndSave: vi.fn(),
        }}
      />
    );
    expect(screen.getByText(/Ajoute d'autres matières/i)).toBeInTheDocument();
  });
});

describe('MatiereCard — ajouts et suppressions', () => {
  it('délègue l\'ajout d\'un cours', () => {
    const { addCM } = afficher();
    fireEvent.click(screen.getByRole('button', { name: '+ Cours' }));
    expect(addCM).toHaveBeenCalledWith(0, 0, 0, 0);
  });

  it('délègue l\'ajout d\'une annale', () => {
    const { addAnnaleManuel } = afficher();
    fireEvent.click(screen.getByRole('button', { name: '+ Annale' }));
    expect(addAnnaleManuel).toHaveBeenCalledWith(0, 0, 0, 0);
  });

  it('nomme l\'élément que le bouton de suppression vise', () => {
    // Ces boutons s'annonçaient « ✕ » à un lecteur d'écran.
    afficher();
    expect(screen.getByRole('button', { name: /Supprimer Groupes/i })).toBeInTheDocument();
  });

  it('délègue la suppression d\'un cours', () => {
    const { deleteCM } = afficher();
    fireEvent.click(screen.getByRole('button', { name: /Supprimer Groupes/i }));
    expect(deleteCM).toHaveBeenCalledWith(0, 0, 0, 0, 0);
  });

  it('n\'offre le scan de PDF que là où il a un sens', () => {
    afficher();
    expect(within(section('TD')).getByRole('button', { name: /Scanner/i })).toBeInTheDocument();
    expect(within(section('Cours')).queryByRole('button', { name: /Scanner/i })).not.toBeInTheDocument();
  });
});

describe('MatiereCard — intervalle de révision', () => {
  const champIntervalle = () => screen.getByTitle(/Nombre de jours avant la prochaine révision/i);

  it('n\'enregistre qu\'à la sortie du champ', () => {
    // Régression : chaque frappe déclenchait une sauvegarde ; saisir « 15 »
    // écrivait deux fois en base.
    const { mutateAndSave } = afficher();
    fireEvent.change(champIntervalle(), { target: { value: '1' } });
    fireEvent.change(champIntervalle(), { target: { value: '15' } });
    expect(mutateAndSave).not.toHaveBeenCalled();

    fireEvent.blur(champIntervalle());
    expect(mutateAndSave).toHaveBeenCalledTimes(1);
  });

  it('ne fait rien si la valeur n\'a pas changé', () => {
    const { mutateAndSave } = afficher();
    fireEvent.blur(champIntervalle());
    expect(mutateAndSave).not.toHaveBeenCalled();
  });

  it('applique l\'intervalle et réinitialise la date calculée', () => {
    const { mutateAndSave } = afficher();
    fireEvent.change(champIntervalle(), { target: { value: '21' } });
    fireEvent.blur(champIntervalle());

    const brouillon = { licences: [{ semestres: [{ ues: [{ matieres: [{ listeCM: [{ jActuel: 7 }] }] }] }] }] };
    mutateAndSave.mock.calls[0][0](brouillon);

    const cm = brouillon.licences[0].semestres[0].ues[0].matieres[0].listeCM[0];
    expect(cm.jActuel).toBe(21);
    expect(cm.prochaineRevisionDate).toBeNull();
    expect(cm.derniereRevision).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('refuse un intervalle négatif', () => {
    const { mutateAndSave } = afficher();
    fireEvent.change(champIntervalle(), { target: { value: '-5' } });
    fireEvent.blur(champIntervalle());

    const brouillon = { licences: [{ semestres: [{ ues: [{ matieres: [{ listeCM: [{ jActuel: 7 }] }] }] }] }] };
    mutateAndSave.mock.calls[0][0](brouillon);
    expect(brouillon.licences[0].semestres[0].ues[0].matieres[0].listeCM[0].jActuel).toBe(0);
  });
});

describe('MatiereCard — matière vide', () => {
  it('s\'affiche sans planter quand toutes les listes sont absentes', () => {
    expect(() => afficher({ nom: 'Nouvelle matière' })).not.toThrow();
    expect(screen.getAllByText(/Aucun élément/i)).toHaveLength(4);
  });
});
