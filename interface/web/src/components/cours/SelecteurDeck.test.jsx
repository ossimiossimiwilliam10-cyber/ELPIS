import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SelecteurDeck, { oublierDecks } from './SelecteurDeck';

const DECKS = [
  'L2 Physique - S3',
  'L2 Physique - S3::UE 2::Maths 3',
  'L2 Physique - S3::UE 2::Maths 3::Chapitre 1 - Fondamentaux',
  'L2 Physique - S3::UE 2::Maths 3::Chapitre 1 - Fondamentaux::I - Dérivées',
  'L2 Physique - S3::UE 2::Maths 3::Chapitre 1 - Fondamentaux::II - Primitives',
  'L2 Physique - S3::UE 1::Mecanique 3',
];

const onChanger = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  oublierDecks();
  global.fetch = vi.fn(async () => ({ json: async () => ({ success: true, decks: DECKS }) }));
});

describe('SelecteurDeck', () => {
  it('propose les decks une fois chargés', async () => {
    render(<SelecteurDeck valeur={null} onChanger={onChanger} />);
    const choix = await screen.findByLabelText(/Chapitre Anki/);
    expect([...choix.options].length).toBe(DECKS.length + 1);
  });

  it('permet de ne rattacher aucun deck', async () => {
    render(<SelecteurDeck valeur={null} onChanger={onChanger} />);
    const choix = await screen.findByLabelText(/Chapitre Anki/);
    expect(choix.value).toBe('');
    expect(screen.getByText(/déduction automatique/)).toBeInTheDocument();
  });

  it('restreint les propositions à la branche de la matière', async () => {
    // Sans cela, il faudrait faire défiler tout le cursus pour rattacher un
    // chapitre à son cours.
    render(<SelecteurDeck valeur={null} onChanger={onChanger} portee="L2 Physique - S3::UE 2::Maths 3" />);
    const choix = await screen.findByLabelText(/Chapitre Anki/);
    const valeurs = [...choix.options].map(o => o.value).filter(Boolean);
    expect(valeurs).toHaveLength(4);
    expect(valeurs.every(v => v.includes('Maths 3'))).toBe(true);
  });

  it('propose tout quand la branche est vide', async () => {
    render(<SelecteurDeck valeur={null} onChanger={onChanger} portee="Deck inexistant" />);
    const choix = await screen.findByLabelText(/Chapitre Anki/);
    expect([...choix.options].length).toBe(DECKS.length + 1);
  });

  it('remonte le deck choisi', async () => {
    render(<SelecteurDeck valeur={null} onChanger={onChanger} />);
    const choix = await screen.findByLabelText(/Chapitre Anki/);
    fireEvent.change(choix, { target: { value: DECKS[3] } });
    expect(onChanger).toHaveBeenCalledWith(DECKS[3]);
  });

  it('remonte null quand on détache le cours', async () => {
    render(<SelecteurDeck valeur={DECKS[3]} onChanger={onChanger} />);
    const choix = await screen.findByLabelText(/Chapitre Anki/);
    fireEvent.change(choix, { target: { value: '' } });
    expect(onChanger).toHaveBeenCalledWith(null);
  });

  it('signale un deck disparu d\'Anki', async () => {
    // Un rattachement devenu caduc doit se voir : sinon l'épreuve échoue sans
    // qu'on comprenne pourquoi.
    render(<SelecteurDeck valeur="Deck supprimé" onChanger={onChanger} />);
    expect(await screen.findByText(/n'existe plus dans Anki/)).toBeInTheDocument();
  });

  it('explique qu\'Anki est injoignable au lieu d\'un menu vide', async () => {
    global.fetch = vi.fn(async () => ({ json: async () => ({ success: false, error: 'Anki fermé.' }) }));
    render(<SelecteurDeck valeur={null} onChanger={onChanger} />);
    expect(await screen.findByText(/Anki injoignable/)).toBeInTheDocument();
  });

  it('ne recharge pas les decks pour chaque cours', async () => {
    // Cinquante-cinq decks rechargés par cours produirait autant d'appels.
    render(<SelecteurDeck valeur={null} onChanger={onChanger} />);
    await screen.findByLabelText(/Chapitre Anki/);
    render(<SelecteurDeck valeur={null} onChanger={onChanger} />);
    await waitFor(() => expect(screen.getAllByLabelText(/Chapitre Anki/)).toHaveLength(2));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
