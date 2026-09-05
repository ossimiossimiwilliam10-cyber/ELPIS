import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SectionReserve from './SectionReserve';
import { ToastProvider } from '../../ToastProvider';

const rappels = {
  onAjouter: vi.fn(),
  onModifier: vi.fn(),
  onSupprimer: vi.fn(),
  onEnvoyerPdf: vi.fn(),
  onEditerNotes: vi.fn(),
};

const afficher = (props = {}) => render(
  <ToastProvider>
    <SectionReserve
    type="TD"
    intitule="TD en réserve"
    libelleAjout="+ 1 TD"
    exercices={[]}
    enReserve={0}
    cible={7}
    manquants={7}
      {...rappels}
      {...props}
    />
  </ToastProvider>
);

beforeEach(() => vi.clearAllMocks());

describe('SectionReserve', () => {
  it('affiche la réserve rapportée à la cible', () => {
    afficher({ enReserve: 2, manquants: 5 });
    expect(screen.getByText('2/7')).toBeInTheDocument();
    expect(screen.getByText(/5 manquants/)).toBeInTheDocument();
  });

  it('accorde le singulier', () => {
    afficher({ enReserve: 6, manquants: 1 });
    expect(screen.getByText(/1 manquant$/)).toBeInTheDocument();
  });

  it('remplace le bouton d\'ajout par un constat une fois la cible atteinte', () => {
    afficher({ enReserve: 7, manquants: 0 });
    expect(screen.queryByRole('button', { name: '+ 1 TD' })).not.toBeInTheDocument();
    expect(screen.getByText('Réserve complète')).toBeInTheDocument();
  });

  it('propose d\'ajouter tant qu\'il manque des exercices', () => {
    afficher();
    fireEvent.click(screen.getByRole('button', { name: '+ 1 TD' }));
    expect(rappels.onAjouter).toHaveBeenCalled();
  });
});

describe('SectionReserve — contenu de la réserve', () => {
  const exercices = [
    { titre: 'TD1', nombrePratiques: 0 },
    { titre: 'TD2', nombrePratiques: 3 },
    { titre: 'TD3', nombrePratiques: 0 },
  ];

  it('ne montre que les exercices jamais travaillés', () => {
    // La réserve, c'est ce qui reste à faire : un exercice déjà pratiqué n'y
    // compte pas, et n'a rien à faire dans la liste.
    afficher({ exercices, enReserve: 2, manquants: 5 });
    expect(screen.getByText('TD1')).toBeInTheDocument();
    expect(screen.getByText('TD3')).toBeInTheDocument();
    expect(screen.queryByText('TD2')).not.toBeInTheDocument();
  });

  it('rapporte les actions à l\'index réel dans la liste, pas à la place affichée', () => {
    // Régression latente : TD3 est le deuxième affiché mais le troisième de la
    // liste — supprimer par la place affichée aurait effacé le mauvais.
    afficher({ exercices, enReserve: 2, manquants: 5 });
    fireEvent.click(screen.getAllByTitle('Supprimer')[1]);
    expect(rappels.onSupprimer).toHaveBeenCalledWith(2, 'TD3');
  });
});
