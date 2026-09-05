import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import MesVideosPage from './MesVideosPage';

let storeState;

vi.mock('./store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  return { default: useStore };
});

const addToast = vi.fn();
vi.mock('./ToastProvider', () => ({ useToast: () => ({ addToast }) }));

const CURSUS = {
  licences: [{
    semestres: [
      { ues: [{ matieres: [{ nom: 'Analyse' }, { nom: 'Algèbre' }] }] },
      // Même matière au semestre suivant : source de doublons.
      { ues: [{ matieres: [{ nom: 'Algèbre' }] }] },
    ],
  }],
};

const VIDEO = {
  id: 'v1',
  title: 'Théorème de Rolle',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  matiereNom: 'Analyse',
  addedAt: '2026-08-01T10:00:00.000Z',
};

const configAvec = (videos = []) => ({ mesVideos: videos });

beforeEach(() => {
  vi.clearAllMocks();
  storeState = {
    config: configAvec(),
    coursConfig: CURSUS,
    setConfig: vi.fn(),
    setActiveTab: vi.fn(),
  };
});

const remplirFormulaire = ({ titre, lien, matiere }) => {
  if (titre !== undefined) fireEvent.change(screen.getByLabelText(/Titre de la vidéo/i), { target: { value: titre } });
  if (lien !== undefined) fireEvent.change(screen.getByLabelText(/Lien de la vidéo/i), { target: { value: lien } });
  if (matiere !== undefined) fireEvent.change(screen.getByLabelText(/Matière associée/i), { target: { value: matiere } });
};
const soumettre = () => fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

describe('MesVideosPage — premier lancement', () => {
  it('explique qu\'il faut d\'abord des matières', () => {
    // Auparavant, l'ajout échouait sur « Veuillez remplir tous les champs »
    // sans dire que le cursus était vide.
    storeState.coursConfig = { licences: [] };
    render(<MesVideosPage />);
    expect(screen.getByText(/Aucune matière à associer/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ajouter' })).not.toBeInTheDocument();
  });

  it('renvoie vers la Bibliothèque', () => {
    storeState.coursConfig = { licences: [] };
    render(<MesVideosPage />);
    fireEvent.click(screen.getByRole('button', { name: /Bibliothèque/i }));
    expect(storeState.setActiveTab).toHaveBeenCalledWith('cours');
  });

  it('annonce une collection vide', () => {
    render(<MesVideosPage />);
    expect(screen.getByText(/Aucune vidéo enregistrée/i)).toBeInTheDocument();
  });
});

describe('MesVideosPage — ajout', () => {
  it('ne propose chaque matière qu\'une fois', () => {
    render(<MesVideosPage />);
    expect(screen.getAllByRole('option', { name: 'Algèbre' })).toHaveLength(1);
  });

  it('enregistre une vidéo complète', () => {
    render(<MesVideosPage />);
    remplirFormulaire({ titre: 'Théorème de Rolle', lien: 'https://youtu.be/dQw4w9WgXcQ', matiere: 'Analyse' });
    soumettre();

    const enregistre = storeState.setConfig.mock.calls[0][0];
    expect(enregistre.mesVideos).toHaveLength(1);
    expect(enregistre.mesVideos[0]).toMatchObject({
      title: 'Théorème de Rolle', url: 'https://youtu.be/dQw4w9WgXcQ', matiereNom: 'Analyse',
    });
    expect(enregistre.mesVideos[0].id).toBeTruthy();
  });

  it('refuse un formulaire incomplet', () => {
    render(<MesVideosPage />);
    remplirFormulaire({ titre: 'Sans lien', matiere: 'Analyse' });
    soumettre();
    expect(storeState.setConfig).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith(expect.stringMatching(/titre, le lien et la matière/i), 'error');
  });

  it('refuse un lien exécutable', () => {
    // Un champ type="url" accepte « javascript: ».
    render(<MesVideosPage />);
    remplirFormulaire({ titre: 'Piège', lien: 'javascript:alert(1)', matiere: 'Analyse' });
    soumettre();
    expect(storeState.setConfig).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith(expect.stringMatching(/http/i), 'error');
  });

  it('refuse un doublon', () => {
    storeState.config = configAvec([VIDEO]);
    render(<MesVideosPage />);
    remplirFormulaire({ titre: 'Autre titre', lien: VIDEO.url, matiere: 'Algèbre' });
    soumettre();
    expect(storeState.setConfig).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith(expect.stringMatching(/déjà/i), 'error');
  });

  it('élague les espaces autour de la saisie', () => {
    render(<MesVideosPage />);
    remplirFormulaire({ titre: '  Rolle  ', lien: '  https://youtu.be/dQw4w9WgXcQ  ', matiere: 'Analyse' });
    soumettre();
    expect(storeState.setConfig.mock.calls[0][0].mesVideos[0].title).toBe('Rolle');
  });
});

describe('MesVideosPage — collection', () => {
  it('regroupe les vidéos par matière', () => {
    storeState.config = configAvec([VIDEO, { ...VIDEO, id: 'v2', title: 'Groupes', url: 'https://youtu.be/aaaaaaaaaaa', matiereNom: 'Algèbre' }]);
    render(<MesVideosPage />);
    expect(screen.getByRole('heading', { name: 'Analyse' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Algèbre' })).toBeInTheDocument();
  });

  it('signale une matière disparue du cursus', () => {
    storeState.config = configAvec([{ ...VIDEO, matiereNom: 'Matière supprimée' }]);
    render(<MesVideosPage />);
    expect(screen.getByText(/absente du cursus/i)).toBeInTheDocument();
  });

  it('affiche la vignette YouTube', () => {
    storeState.config = configAvec([VIDEO]);
    render(<MesVideosPage />);
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
  });

  it('se rabat sur le nom du site hors YouTube', () => {
    storeState.config = configAvec([{ ...VIDEO, url: 'https://vimeo.com/123456' }]);
    render(<MesVideosPage />);
    expect(screen.getByText('vimeo.com')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('ouvre le lien dans un onglet isolé', () => {
    storeState.config = configAvec([VIDEO]);
    render(<MesVideosPage />);
    const lien = screen.getByRole('link', { name: /Ouvrir/i });
    expect(lien).toHaveAttribute('href', VIDEO.url);
    expect(lien).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});

describe('MesVideosPage — modification', () => {
  beforeEach(() => { storeState.config = configAvec([VIDEO]); });

  it('pré-remplit les champs existants', () => {
    render(<MesVideosPage />);
    fireEvent.click(screen.getByRole('button', { name: /Modifier/i }));
    expect(screen.getByLabelText('Modifier le titre')).toHaveValue('Théorème de Rolle');
  });

  it('conserve une matière absente du cursus au lieu de la remplacer', () => {
    // Régression : le menu déroulant retombait sur sa première entrée et
    // écrasait silencieusement la matière au moment d'enregistrer.
    storeState.config = configAvec([{ ...VIDEO, matiereNom: 'Matière supprimée' }]);
    render(<MesVideosPage />);
    fireEvent.click(screen.getByRole('button', { name: /Modifier/i }));

    const select = screen.getByLabelText('Modifier la matière');
    expect(select).toHaveValue('Matière supprimée');
    expect(within(select).getByRole('option', { name: /absente du cursus/i })).toBeInTheDocument();
  });

  it('enregistre les modifications', () => {
    render(<MesVideosPage />);
    fireEvent.click(screen.getByRole('button', { name: /Modifier/i }));
    fireEvent.change(screen.getByLabelText('Modifier le titre'), { target: { value: 'Rolle (revu)' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/i }));

    expect(storeState.setConfig.mock.calls[0][0].mesVideos[0].title).toBe('Rolle (revu)');
  });

  it('abandonne les modifications à l\'annulation', () => {
    render(<MesVideosPage />);
    fireEvent.click(screen.getByRole('button', { name: /Modifier/i }));
    fireEvent.change(screen.getByLabelText('Modifier le titre'), { target: { value: 'Perdu' } });
    fireEvent.click(screen.getByRole('button', { name: /^Annuler$/i }));

    expect(storeState.setConfig).not.toHaveBeenCalled();
    expect(screen.getByText('Théorème de Rolle')).toBeInTheDocument();
  });
});

describe('MesVideosPage — suppression', () => {
  beforeEach(() => { storeState.config = configAvec([VIDEO]); });

  it('nomme la vidéo avant de la supprimer', () => {
    render(<MesVideosPage />);
    fireEvent.click(screen.getByRole('button', { name: /Supprimer «/i }));
    expect(within(screen.getByRole('alertdialog')).getByText(/Théorème de Rolle/)).toBeInTheDocument();
  });

  it('ne supprime rien si l\'utilisateur renonce', () => {
    render(<MesVideosPage />);
    fireEvent.click(screen.getByRole('button', { name: /Supprimer «/i }));
    fireEvent.click(screen.getByRole('button', { name: /Annuler/i }));
    expect(storeState.setConfig).not.toHaveBeenCalled();
  });

  it('supprime la vidéo confirmée', () => {
    render(<MesVideosPage />);
    fireEvent.click(screen.getByRole('button', { name: /Supprimer «/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(storeState.setConfig.mock.calls[0][0].mesVideos).toEqual([]);
  });
});
