import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modale from './Modale';

const onFermer = vi.fn();

const afficher = (props = {}) => render(
  <Modale ouverte onFermer={onFermer} titre="Déclarer une absence" {...props}>
    <input aria-label="Premier champ" />
    <input aria-label="Second champ" />
    <button type="button">Enregistrer</button>
  </Modale>
);

beforeEach(() => vi.clearAllMocks());

describe('Modale', () => {
  it('reste absente tant qu\'elle n\'est pas ouverte', () => {
    afficher({ ouverte: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('s\'annonce comme fenêtre modale rattachée à son titre', () => {
    afficher();
    const fenetre = screen.getByRole('dialog', { name: 'Déclarer une absence' });
    expect(fenetre).toHaveAttribute('aria-modal', 'true');
  });

  it('donne le focus au premier champ utile', () => {
    afficher();
    expect(screen.getByLabelText('Premier champ')).toHaveFocus();
  });

  it('se ferme avec Échap', () => {
    afficher();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onFermer).toHaveBeenCalled();
  });

  it('se ferme au clic sur le fond, mais pas au clic dans le panneau', () => {
    const { container } = afficher();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onFermer).not.toHaveBeenCalled();

    fireEvent.click(container.querySelector('.el-modale__fond'));
    expect(onFermer).toHaveBeenCalledTimes(1);
  });
});

describe('Modale — piège de focus', () => {
  it('reboucle du dernier au premier élément', () => {
    // Sans cela, la tabulation s'échappait derrière la fenêtre, dans une page
    // que l'utilisateur ne voit plus.
    afficher();
    const bouton = screen.getByRole('button', { name: 'Enregistrer' });
    bouton.focus();

    fireEvent.keyDown(window, { key: 'Tab' });
    expect(screen.getByLabelText('Premier champ')).toHaveFocus();
  });

  it('reboucle du premier au dernier avec Maj+Tab', () => {
    afficher();
    screen.getByLabelText('Premier champ').focus();

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toHaveFocus();
  });

  it('rend le focus à ce qui l\'a ouverte', () => {
    const declencheur = document.createElement('button');
    document.body.appendChild(declencheur);
    declencheur.focus();

    const { rerender } = afficher();
    rerender(<Modale ouverte={false} onFermer={onFermer} titre="Déclarer une absence" />);

    expect(declencheur).toHaveFocus();
    declencheur.remove();
  });
});
