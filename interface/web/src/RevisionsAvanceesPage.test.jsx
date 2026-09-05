import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RevisionsAvanceesPage from './RevisionsAvanceesPage';

let storeState;

vi.mock('./store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  return { default: useStore };
});

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('./ToastProvider', () => ({ useToast: () => ({ toast }) }));

const CURSUS = {
  licences: [{
    semestres: [
      {
        ues: [{
          matieres: [{ nom: 'Analyse' }, { nom: 'Algèbre' }],
        }],
      },
      {
        // Même matière au semestre suivant : source de doublons dans la liste.
        ues: [{ matieres: [{ nom: 'Algèbre' }] }],
      },
    ],
  }],
};

const repondre = (status, body) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  storeState = {
    coursConfig: CURSUS,
    pendingTasksCount: 0,
    setForcedTask: vi.fn(),
    setActiveTab: vi.fn(),
  };
  repondre(200, { task: { titre: 'TD1', matiere: 'Algèbre', type: 'TD' } });
});

describe('RevisionsAvanceesPage — verrou', () => {
  it('bloque l\'accès tant que la session du jour n\'est pas finie', () => {
    storeState.pendingTasksCount = 3;
    render(<RevisionsAvanceesPage />);
    expect(screen.getByText(/Section verrouillée/i)).toBeInTheDocument();
    expect(screen.getByText(/3 tâches/)).toBeInTheDocument();
  });

  it('offre une issue vers la session du jour', () => {
    // Régression : l'écran verrouillé était un cul-de-sac.
    storeState.pendingTasksCount = 1;
    render(<RevisionsAvanceesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Session du Jour/i }));
    expect(storeState.setActiveTab).toHaveBeenCalledWith('entrainement');
  });

  it('accorde le décompte au singulier', () => {
    storeState.pendingTasksCount = 1;
    render(<RevisionsAvanceesPage />);
    expect(screen.getByText(/1 tâche dans ta session/)).toBeInTheDocument();
  });

  it('ouvre l\'accès une fois la session terminée', () => {
    render(<RevisionsAvanceesPage />);
    expect(screen.queryByText(/Section verrouillée/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Ciblage manuel/i)).toBeInTheDocument();
  });
});

describe('RevisionsAvanceesPage — premier lancement', () => {
  it('renvoie vers la Bibliothèque quand aucune matière n\'existe', () => {
    storeState.coursConfig = { licences: [] };
    render(<RevisionsAvanceesPage />);
    expect(screen.getByText(/Rien à cibler/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Trouver un exercice/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Bibliothèque/i }));
    expect(storeState.setActiveTab).toHaveBeenCalledWith('cours');
  });
});

describe('RevisionsAvanceesPage — liste des matières', () => {
  it('ne propose chaque matière qu\'une fois', () => {
    // Régression : une matière suivie sur deux semestres apparaissait en double,
    // avec la même clé React.
    render(<RevisionsAvanceesPage />);
    expect(screen.getAllByRole('option', { name: 'Algèbre' })).toHaveLength(1);
  });

  it('classe les matières par ordre alphabétique', () => {
    render(<RevisionsAvanceesPage />);
    const options = screen.getAllByRole('option').map(o => o.textContent);
    expect(options.indexOf('Algèbre')).toBeLessThan(options.indexOf('Analyse'));
  });
});

describe('RevisionsAvanceesPage — ciblage', () => {
  const cibler = () => fireEvent.click(screen.getByRole('button', { name: /Trouver un exercice/i }));
  const corpsEnvoye = () => JSON.parse(global.fetch.mock.calls[0][1].body);

  it('emmène vers l\'entraînement avec la tâche trouvée', async () => {
    render(<RevisionsAvanceesPage />);
    cibler();

    await waitFor(() => expect(storeState.setForcedTask).toHaveBeenCalled());
    expect(storeState.setForcedTask.mock.calls[0][0]).toMatchObject({ titre: 'TD1' });
    expect(storeState.setActiveTab).toHaveBeenCalledWith('entrainement');
  });

  it('rattache une demande Anki à la routine, quelle que soit la matière', async () => {
    // Régression : « Anki » combiné à une matière donnait une requête sans résultat.
    render(<RevisionsAvanceesPage />);
    fireEvent.change(screen.getByLabelText('Matière'), { target: { value: 'Algèbre' } });
    fireEvent.change(screen.getByLabelText(/Type d'exercice/i), { target: { value: 'ANKI' } });
    cibler();

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(corpsEnvoye()).toMatchObject({ matiere: 'Routine', type: 'ANKI' });
  });

  it('explique qu\'aucun exercice ne correspond plutôt que d\'échouer', async () => {
    repondre(404, { error: 'Aucune tâche trouvée pour ces critères' });
    render(<RevisionsAvanceesPage />);
    cibler();

    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    expect(storeState.setActiveTab).not.toHaveBeenCalled();
  });

  it('ne reste pas muet devant une réponse sans tâche', async () => {
    // Régression : un 200 sans `task` ne produisait aucun retour visible.
    repondre(200, {});
    render(<RevisionsAvanceesPage />);
    cibler();

    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    expect(storeState.setForcedTask).not.toHaveBeenCalled();
  });

  it('signale un serveur injoignable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    render(<RevisionsAvanceesPage />);
    cibler();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/joindre/i)));
  });

  it('n\'envoie jamais une durée hors bornes', async () => {
    // Les attributs min/max du champ ne contraignent que la saisie assistée.
    render(<RevisionsAvanceesPage />);
    fireEvent.change(screen.getByLabelText(/Durée souhaitée/i), { target: { value: '9999' } });
    cibler();

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(corpsEnvoye().dureeMin).toBe(480);
  });

  it('relève une durée trop courte', async () => {
    render(<RevisionsAvanceesPage />);
    fireEvent.change(screen.getByLabelText(/Durée souhaitée/i), { target: { value: '1' } });
    cibler();

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(corpsEnvoye().dureeMin).toBe(5);
  });

  it('neutralise le type quand la routine Anki est visée', () => {
    render(<RevisionsAvanceesPage />);
    fireEvent.change(screen.getByLabelText('Matière'), { target: { value: 'ANKI' } });
    expect(screen.getByLabelText(/Type d'exercice/i)).toBeDisabled();
  });
});
