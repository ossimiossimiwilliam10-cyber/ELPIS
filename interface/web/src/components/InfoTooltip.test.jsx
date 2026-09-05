import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InfoTooltip from './InfoTooltip';

const afficher = () => render(
  <InfoTooltip content="L'algorithme FSRS calcule ce délai.">
    <span>Intervalle</span>
  </InfoTooltip>
);

describe('InfoTooltip', () => {
  it('affiche son contenu déclencheur', () => {
    afficher();
    expect(screen.getByText('Intervalle')).toBeInTheDocument();
  });

  it('garde l\'explication masquée au repos', () => {
    afficher();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('révèle l\'explication au survol', () => {
    afficher();
    fireEvent.mouseEnter(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('FSRS');
  });

  it('la masque quand la souris repart', () => {
    afficher();
    const cible = screen.getByRole('button');
    fireEvent.mouseEnter(cible);
    fireEvent.mouseLeave(cible);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('la révèle aussi au clavier', () => {
    // Régression : l'explication n'existait qu'au survol souris.
    afficher();
    fireEvent.focus(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('est atteignable par tabulation', () => {
    afficher();
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '0');
  });

  it('bascule à la touche Entrée', () => {
    afficher();
    const cible = screen.getByRole('button');
    fireEvent.keyDown(cible, { key: 'Enter' });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.keyDown(cible, { key: 'Enter' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('se referme sur Échap', () => {
    afficher();
    fireEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('rattache l\'explication à son déclencheur', () => {
    afficher();
    const cible = screen.getByRole('button');
    fireEvent.click(cible);
    expect(cible).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
  });
});
