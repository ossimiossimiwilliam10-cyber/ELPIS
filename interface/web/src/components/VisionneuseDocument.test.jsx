import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import VisionneuseDocument from './VisionneuseDocument';

/**
 * Le lecteur existe parce que le WebView Android ne sait pas afficher un PDF :
 * ouvrir le fichier renvoyait vers le navigateur du téléphone, donc vers le
 * réseau, donc vers un PC allumé. On ne teste pas ici le rendu de pdf.js —
 * chargé à la demande, hors de portée de jsdom — mais ce dont dépend l'usage :
 * l'image s'affiche, et l'absence de document s'explique au lieu de laisser un
 * écran vide.
 */

const blobDocument = vi.fn();
vi.mock('../utils/documentsHorsLigne', () => ({
  blobDocument: (...args) => blobDocument(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:faux');
  globalThis.URL.revokeObjectURL = vi.fn();
});

afterEach(() => vi.restoreAllMocks());

describe('VisionneuseDocument', () => {
  it('affiche une image rattachée à un cours', async () => {
    blobDocument.mockResolvedValue({ type: 'image/png', size: 10 });
    render(<VisionneuseDocument chemin="/api/documents/doc-1.png" titre="Chapitre 3" onClose={vi.fn()} />);

    const image = await screen.findByAltText('Chapitre 3');
    expect(image).toHaveAttribute('src', 'blob:faux');
  });

  it('explique quoi faire quand le document est introuvable', async () => {
    // Ni copie locale, ni PC joignable : le pire cas, et le seul où l'utilisateur
    // a besoin qu'on lui dise comment s'en sortir.
    blobDocument.mockResolvedValue(null);
    render(<VisionneuseDocument chemin="/api/documents/doc-1.pdf" titre="Chapitre 3" onClose={vi.fn()} />);

    expect(await screen.findByText(/Document indisponible/i)).toBeInTheDocument();
    expect(screen.getByText(/Télécharge\s+tes documents depuis les Réglages/i)).toBeInTheDocument();
  });

  it('annonce le document au lecteur d’écran', async () => {
    blobDocument.mockResolvedValue({ type: 'image/png', size: 10 });
    render(<VisionneuseDocument chemin="/api/documents/doc-1.png" titre="Chapitre 3" onClose={vi.fn()} />);

    const dialogue = await screen.findByRole('dialog');
    expect(dialogue).toHaveAttribute('aria-modal', 'true');
    expect(dialogue).toHaveAccessibleName('Document : Chapitre 3');
  });

  it('se ferme sur Échap', async () => {
    const onClose = vi.fn();
    blobDocument.mockResolvedValue({ type: 'image/png', size: 10 });
    render(<VisionneuseDocument chemin="/api/documents/doc-1.png" titre="Ch3" onClose={onClose} />);

    await screen.findByRole('dialog');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('libère l’adresse de l’image en se démontant', async () => {
    // Sans cela, ouvrir vingt documents dans la journée fuit vingt blobs.
    blobDocument.mockResolvedValue({ type: 'image/png', size: 10 });
    const { unmount } = render(
      <VisionneuseDocument chemin="/api/documents/doc-1.png" titre="Ch3" onClose={vi.fn()} />
    );
    await screen.findByAltText('Ch3');
    unmount();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:faux');
  });
});
