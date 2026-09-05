import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SelecteurDrapeau from './SelecteurDrapeau';

/**
 * Choisir un drapeau sans savoir taper un émoji.
 *
 * Le symbole d'une langue se saisissait dans une case de texte de quatre
 * caractères. Sur téléphone le clavier propose les émoji ; sur ordinateur il
 * faut connaître un raccourci système, et le champ restait donc au globe.
 */

describe('Le choix du drapeau', () => {
  it('propose des drapeaux nommés, et non des caractères à deviner', () => {
    render(<SelecteurDrapeau id="essai" valeur="🌍" onChoisir={() => {}} />);

    // Chaque choix porte le nom de sa langue : c'est ce que lit un lecteur
    // d'écran, et ce qu'affiche l'infobulle.
    expect(screen.getByRole('radio', { name: 'Japonais' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Espagnol' })).toBeInTheDocument();
  });

  it('rend le drapeau choisi', () => {
    const choisi = vi.fn();
    render(<SelecteurDrapeau id="essai" valeur="🌍" onChoisir={choisi} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Japonais' }));

    expect(choisi).toHaveBeenCalledWith('🇯🇵');
  });

  it('montre lequel est retenu', () => {
    render(<SelecteurDrapeau id="essai" valeur="🇩🇪" onChoisir={() => {}} />);

    expect(screen.getByRole('radio', { name: 'Allemand' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Italien' })).toHaveAttribute('aria-checked', 'false');
  });

  it('garde un symbole enregistré qui ne figure pas dans la liste', () => {
    /*
     * Un symbole saisi à l'époque du champ libre, ou venu du téléphone, doit
     * rester sélectionnable : sans cela, ouvrir les réglages d'une langue
     * suffirait à le perdre au premier clic.
     */
    render(<SelecteurDrapeau id="essai" valeur="🏴‍☠️" onChoisir={() => {}} />);

    const conserve = screen.getByRole('radio', { name: 'Symbole enregistré' });
    expect(conserve).toBeInTheDocument();
    expect(conserve).toHaveAttribute('aria-checked', 'true');
  });

  it('ne double pas un symbole déjà présent dans la liste', () => {
    render(<SelecteurDrapeau id="essai" valeur="🇬🇧" onChoisir={() => {}} />);

    expect(screen.queryByRole('radio', { name: 'Symbole enregistré' })).toBeNull();
    expect(screen.getAllByRole('radio', { name: 'Anglais' })).toHaveLength(1);
  });

  it('supporte une langue sans symbole', () => {
    render(<SelecteurDrapeau id="essai" valeur="" onChoisir={() => {}} />);

    expect(screen.queryByRole('radio', { name: 'Symbole enregistré' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Autre' })).toBeInTheDocument();
  });
});
