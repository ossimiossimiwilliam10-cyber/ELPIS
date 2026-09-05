import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ArbreCursus from './ArbreCursus';

const CURSUS = [{
  nom: 'Licence 1',
  semestres: [{
    nom: 'Semestre 1',
    ues: [
      { nom: 'UE Maths', matieres: [{ nom: 'Analyse' }, { nom: 'Algèbre' }] },
      { nom: 'UE Physique', matieres: [{ nom: 'Mécanique' }] },
    ],
  }],
}, {
  nom: 'Licence 2',
  semestres: [],
}];

let props;

beforeEach(() => {
  vi.clearAllMocks();
  props = {
    licences: CURSUS,
    lIndex: 0, sIndex: 0, uIndex: 0,
    onSelection: vi.fn(),
    onAjouterLicence: vi.fn(),
    onAjouterSemestre: vi.fn(),
    onAjouterUE: vi.fn(),
    onRenommerLicence: vi.fn(),
    onRenommerSemestre: vi.fn(),
    onRenommerUE: vi.fn(),
    onSupprimerLicence: vi.fn(),
    onSupprimerSemestre: vi.fn(),
    onSupprimerUE: vi.fn(),
  };
});

const afficher = (surcharge = {}) => render(<ArbreCursus {...props} {...surcharge} />);

describe('ArbreCursus — actions manquantes', () => {
  it('offre de supprimer une licence', async () => {
    // Régression : l'arbre ne proposait que « + Licence ». Une licence ajoutée
    // par erreur ne pouvait plus jamais être retirée, alors même que la page
    // savait le faire — la fonction n'était reliée à aucun bouton.
    afficher();
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Licence 2' }));
    expect(props.onSupprimerLicence).toHaveBeenCalledWith(1);
  });

  it('offre de supprimer un semestre', async () => {
    afficher();
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Semestre 1' }));
    expect(props.onSupprimerSemestre).toHaveBeenCalledWith(0, 0);
  });

  it('offre de supprimer une UE, avec ses coordonnées complètes', async () => {
    afficher();
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer UE Physique' }));
    expect(props.onSupprimerUE).toHaveBeenCalledWith(0, 0, 1);
  });

  it('nomme précisément ce que chaque bouton supprime', () => {
    // « Supprimer » seul ne permet pas de vérifier ce qu'on s'apprête à effacer,
    // et un lecteur d'écran annoncerait autant de boutons identiques.
    afficher();
    expect(screen.getByRole('button', { name: 'Supprimer Licence 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Supprimer UE Maths' })).toBeInTheDocument();
  });
});

describe('ArbreCursus — renommage', () => {
  const renommerVia = async (nomBouton, saisie) => {
    fireEvent.click(screen.getByRole('button', { name: nomBouton }));
    const champ = await screen.findByRole('textbox');
    fireEvent.change(champ, { target: { value: saisie } });
    fireEvent.keyDown(window, { key: 'Enter' });
  };

  it('renomme une licence', async () => {
    afficher();
    await renommerVia('Renommer Licence 1', 'Licence de physique');
    await waitFor(() => expect(props.onRenommerLicence).toHaveBeenCalledWith(0, 'Licence de physique'));
  });

  it('renomme un semestre', async () => {
    afficher();
    await renommerVia('Renommer Semestre 1', 'S1 2026');
    await waitFor(() => expect(props.onRenommerSemestre).toHaveBeenCalledWith(0, 0, 'S1 2026'));
  });

  it('renomme une UE', async () => {
    afficher();
    await renommerVia('Renommer UE Maths', 'Mathématiques');
    await waitFor(() => expect(props.onRenommerUE).toHaveBeenCalledWith(0, 0, 0, 'Mathématiques'));
  });

  it('ignore un nom vide plutôt que d’effacer le libellé', async () => {
    afficher();
    await renommerVia('Renommer Licence 1', '   ');
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
    expect(props.onRenommerLicence).not.toHaveBeenCalled();
  });

  it('n’applique rien si le renommage est annulé', async () => {
    afficher();
    fireEvent.click(screen.getByRole('button', { name: 'Renommer Licence 1' }));
    await screen.findByRole('textbox');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
    expect(props.onRenommerLicence).not.toHaveBeenCalled();
  });
});

describe('ArbreCursus — navigation préservée', () => {
  it('sélectionner un nœud reste l’action principale', () => {
    afficher();
    // Le nom accessible du nœud englobe son compteur : on vise le libellé.
    fireEvent.click(screen.getByText('Licence 2').closest('button'));
    expect(props.onSelection).toHaveBeenCalledWith(1, 0, 0);
  });

  it('les ajouts fonctionnent toujours', () => {
    afficher();
    fireEvent.click(screen.getByRole('button', { name: '+ Licence' }));
    expect(props.onAjouterLicence).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '+ UE' }));
    expect(props.onAjouterUE).toHaveBeenCalledWith(0, 0);
  });

  it('les UE ne s’affichent que sous le semestre ouvert', () => {
    afficher({ sIndex: 0 });
    expect(screen.getByText('UE Maths').closest('button')).toHaveClass('arbre__noeud--ue');
  });

  it('une licence sans semestre le dit', () => {
    afficher({ lIndex: 1 });
    expect(screen.getByText('Aucun semestre')).toBeInTheDocument();
  });

  it('survit à des gestionnaires absents', () => {
    // Le composant est monté par plusieurs pages : un appelant qui ne fournit
    // pas encore les actions ne doit pas faire tomber l'arbre.
    render(<ArbreCursus {...props} onSupprimerLicence={undefined} />);
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Supprimer Licence 1' }))).not.toThrow();
  });
});
