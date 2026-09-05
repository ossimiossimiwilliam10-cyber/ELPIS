import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EpreuveAnki from './EpreuveAnki';

const onValide = vi.fn();

const afficher = () => render(
  <EpreuveAnki
    deckMatiere="Physique::Électro"
    titreCours="Théorème de Gauss"
    onValide={onValide}
  />
);

/** Répond aux deux appels de l'épreuve dans l'ordre : ouverture puis relevé. */
const repondre = (...reponses) => {
  let appel = 0;
  global.fetch = vi.fn(async () => {
    const { statut = 200, corps } = reponses[Math.min(appel++, reponses.length - 1)];
    return { ok: statut < 400, json: async () => corps };
  });
};

const OUVERTURE = {
  corps: {
    success: true, debut: 1750000000000, requete: 'cid:1,2,3',
    deck: 'Physique::Électro::Théorème de Gauss', precision: 'cours',
    cartes: 20, fragiles: 8, disponibles: 60,
  },
};

beforeEach(() => vi.clearAllMocks());

describe('EpreuveAnki', () => {
  it('n\'offre pas d\'échappatoire à l\'épreuve', () => {
    // L'épreuve est la seule voie de validation d'un cours rattaché : ce qui
    // est refusé, c'est de valider sans avoir été mesuré.
    afficher();
    expect(screen.getByRole('button', { name: /Lancer l'épreuve/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sans vérifier/ })).not.toBeInTheDocument();
    expect(onValide).not.toHaveBeenCalled();
  });

  it('annonce que l\'épreuve fait foi', () => {
    afficher();
    expect(screen.getByText(/C'est cette épreuve qui valide le cours/)).toBeInTheDocument();
  });

  it('annonce le nombre de cartes une fois l\'épreuve ouverte', async () => {
    repondre(OUVERTURE);
    afficher();
    fireEvent.click(screen.getByRole('button', { name: /Lancer l'épreuve/ }));

    expect(await screen.findByText(/Épreuve en cours dans Anki/)).toBeInTheDocument();
    expect(screen.getByText(/20 cartes t'attendent/)).toBeInTheDocument();
  });

  it('signale un ciblage retombé sur la matière entière', async () => {
    repondre({ corps: { ...OUVERTURE.corps, precision: 'matiere' } });
    afficher();
    fireEvent.click(screen.getByRole('button', { name: /Lancer l'épreuve/ }));
    expect(await screen.findByText(/porte sur toute la matière/)).toBeInTheDocument();
  });

  it('explique qu\'Anki est fermé au lieu d\'échouer en silence', async () => {
    repondre({ statut: 503, corps: { success: false, error: "Anki n'est pas lancé." } });
    afficher();
    fireEvent.click(screen.getByRole('button', { name: /Lancer l'épreuve/ }));

    expect(await screen.findByText(/Anki n'est pas lancé/)).toBeInTheDocument();
    // On peut retenter : l'erreur est dite, et le cours reste à valider.
    expect(screen.getByRole('button', { name: /Lancer l'épreuve/ })).toBeInTheDocument();
    expect(onValide).not.toHaveBeenCalled();
  });

  it('transmet la note mesurée après une épreuve réussie', async () => {
    repondre(OUVERTURE, {
      corps: {
        success: true, concluante: true, reussie: true, taux: 90, cartes: 20,
        reussies: 18, note: 3, motif: '18 cartes sur 20 retrouvées, soit 90 %.',
      },
    });
    afficher();
    fireEvent.click(screen.getByRole('button', { name: /Lancer l'épreuve/ }));
    fireEvent.click(await screen.findByRole('button', { name: /J'ai terminé/ }));

    expect(await screen.findByText('90 %')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Valider le cours$/ }));
    await waitFor(() => expect(onValide).toHaveBeenCalledWith(3, expect.objectContaining({ taux: 90 })));
  });

  it('valide quand même après un échec, en le disant', async () => {
    repondre(OUVERTURE, {
      corps: {
        success: true, concluante: true, reussie: false, taux: 55, cartes: 20,
        reussies: 11, note: 1, motif: '55 % de réussite, en deçà des 80 % attendus.',
      },
    });
    afficher();
    fireEvent.click(screen.getByRole('button', { name: /Lancer l'épreuve/ }));
    fireEvent.click(await screen.findByRole('button', { name: /J'ai terminé/ }));

    expect(await screen.findByText(/en deçà des 80 %/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /il reviendra plus tôt/ }));
    await waitFor(() => expect(onValide).toHaveBeenCalledWith(1, expect.anything()));
  });

  it('propose de reprendre une épreuve non concluante', async () => {
    // Une séance interrompue n'est pas un échec : la sanctionner reviendrait à
    // punir un imprévu.
    repondre(OUVERTURE, {
      corps: {
        success: true, concluante: false, reussie: false, taux: 100, cartes: 2,
        reussies: 2, note: null, motif: 'Seulement 2 cartes révisées : il en faut au moins 5.',
      },
    });
    afficher();
    fireEvent.click(screen.getByRole('button', { name: /Lancer l'épreuve/ }));
    fireEvent.click(await screen.findByRole('button', { name: /J'ai terminé/ }));

    expect(await screen.findByText(/au moins 5/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reprendre l'épreuve/ })).toBeInTheDocument();
    expect(onValide).not.toHaveBeenCalled();
  });
});
