import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AICoachSidebar from './AICoachSidebar';
import { ToastProvider } from '../ToastProvider';

// Mock du fetch global
global.fetch = vi.fn();

// Mock scrollIntoView pour jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const renderWithToast = (component) => {
  return render(<ToastProvider>{component}</ToastProvider>);
};

describe('AICoachSidebar Component', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Par défaut, fetch renvoie un tableau vide (historique)
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });

  it('renders the floating action button initially', async () => {
    renderWithToast(<AICoachSidebar />);
    
    // Le bouton doit être présent (avec l'émoji robot)
    const fab = screen.getByTitle('Ouvrir le Coach IA');
    expect(fab).toBeInTheDocument();
    
    // Le panneau ne doit pas être affiché
    expect(screen.queryByText('Coach ELPIS')).not.toBeInTheDocument();
  });

  it('opens the sidebar when FAB is clicked', async () => {
    renderWithToast(<AICoachSidebar />);
    
    const fab = screen.getByTitle('Ouvrir le Coach IA');
    fireEvent.click(fab);
    
    // Attendre que l'animation ou le rendu affiche le panneau
    await waitFor(() => {
      expect(screen.getByText('Coach ELPIS')).toBeInTheDocument();
    });
    
    // Vérifier l'appel à l'historique
    expect(global.fetch).toHaveBeenCalledWith('/api/chat');
  });

  it('can send a message and receive a response', async () => {
    renderWithToast(<AICoachSidebar />);
    
    // Ouvrir le panneau
    fireEvent.click(screen.getByTitle('Ouvrir le Coach IA'));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Posez votre question...')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Posez votre question...');
    const sendButton = screen.getByText('➤');

    // On prépare le mock pour la réponse du POST
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: "Je suis le coach, voici mon conseil !" }),
    });

    // Simuler la saisie d'un message
    fireEvent.change(input, { target: { value: 'Coucou coach' } });
    fireEvent.click(sendButton);

    // Le message de l'utilisateur doit apparaître
    await waitFor(() => {
      expect(screen.getByText('Coucou coach')).toBeInTheDocument();
    });

    // La réponse de l'assistant doit apparaître
    await waitFor(() => {
      expect(screen.getByText('Je suis le coach, voici mon conseil !')).toBeInTheDocument();
    });

    // Vérifier que fetch POST a été appelé
    expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
      method: 'POST',
      body: expect.any(String),
    }));
  });
});
