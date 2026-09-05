import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import MusicSettingsModal from './MusicSettingsModal';

const addToast = vi.fn();
vi.mock('../ToastProvider', () => ({ useToast: () => ({ addToast }) }));

const LISTE = { calm: ['pluie.mp3'], motivational: ['epic.mp3'] };

/** Répond à /music/list, puis à l'appel suivant selon `suite`. */
const brancherServeur = (suite) => {
  global.fetch = vi.fn((url, options) => {
    if (String(url).includes('/music/list')) {
      return Promise.resolve({ ok: true, json: async () => LISTE });
    }
    return suite ? suite(url, options) : Promise.resolve({ ok: true, json: async () => ({}) });
  });
};

const fichier = (nom, type = 'audio/mpeg', taille = 1024) => {
  const f = new File(['x'], nom, { type });
  Object.defineProperty(f, 'size', { value: taille });
  return f;
};

const afficher = async (onClose = vi.fn()) => {
  render(<MusicSettingsModal onClose={onClose} />);
  await screen.findByText('pluie.mp3');
  return onClose;
};

beforeEach(() => {
  vi.clearAllMocks();
  brancherServeur();
});

describe('MusicSettingsModal — affichage', () => {
  it('liste les musiques de chaque ambiance', async () => {
    await afficher();
    expect(screen.getByText('pluie.mp3')).toBeInTheDocument();
    expect(screen.getByText('epic.mp3')).toBeInTheDocument();
  });

  it('s\'annonce comme une boîte de dialogue nommée', async () => {
    await afficher();
    expect(screen.getByRole('dialog', { name: /Bibliothèque Musicale/i })).toBeInTheDocument();
  });

  it('signale un serveur injoignable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    render(<MusicSettingsModal onClose={vi.fn()} />);
    await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.stringMatching(/charger/i), 'error'));
  });
});

describe('MusicSettingsModal — fermeture', () => {
  it('se referme sur Échap', async () => {
    // La modale ne réagissait ni à l'échappement ni au clic extérieur.
    const onClose = await afficher();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('se referme au clic sur le fond', async () => {
    const onClose = await afficher();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalled();
  });

  it('reste ouverte au clic à l\'intérieur', async () => {
    const onClose = await afficher();
    fireEvent.click(screen.getByText('pluie.mp3'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('se referme au bouton dédié', async () => {
    const onClose = await afficher();
    fireEvent.click(screen.getByRole('button', { name: /Fermer/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('MusicSettingsModal — ajout de musiques', () => {
  const champFichier = () => screen.getByLabelText(/Ajouter des musiques calmes/i);

  it('refuse un fichier qui n\'est pas audio', async () => {
    // Rien ne vérifiait le type : le fichier partait au serveur pour rien.
    await afficher();
    fireEvent.change(champFichier(), { target: { files: [fichier('notes.pdf', 'application/pdf')] } });

    await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.stringMatching(/pas un fichier audio/i), 'error'));
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/music/upload'), expect.anything());
  });

  it('refuse un fichier trop lourd', async () => {
    await afficher();
    fireEvent.change(champFichier(), { target: { files: [fichier('long.mp3', 'audio/mpeg', 40 * 1024 * 1024)] } });

    await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.stringMatching(/30 Mo/), 'error'));
  });

  it('envoie un fichier valide', async () => {
    brancherServeur(() => Promise.resolve({ ok: true, json: async () => ({ message: 'Ajouté' }) }));
    await afficher();
    fireEvent.change(champFichier(), { target: { files: [fichier('calme.mp3')] } });

    await waitFor(() => expect(addToast).toHaveBeenCalledWith('Ajouté', 'success'));
  });

  it('relaie le refus du serveur', async () => {
    brancherServeur(() => Promise.resolve({ ok: false, status: 413, json: async () => ({ error: 'Trop volumineux' }) }));
    await afficher();
    fireEvent.change(champFichier(), { target: { files: [fichier('calme.mp3')] } });

    await waitFor(() => expect(addToast).toHaveBeenCalledWith('Trop volumineux', 'error'));
  });

  it('reste lisible quand le serveur ne répond pas en JSON', async () => {
    brancherServeur(() => Promise.resolve({
      ok: false, status: 500, json: async () => { throw new Error('pas du JSON'); },
    }));
    await afficher();
    fireEvent.change(champFichier(), { target: { files: [fichier('calme.mp3')] } });

    await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.stringMatching(/500/), 'error'));
  });
});

describe('MusicSettingsModal — suppression', () => {
  it('nomme le fichier avant de le supprimer', async () => {
    await afficher();
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer pluie.mp3' }));

    const dialogue = await screen.findByRole('alertdialog');
    expect(within(dialogue).getByText(/pluie\.mp3/)).toBeInTheDocument();
  });
});
