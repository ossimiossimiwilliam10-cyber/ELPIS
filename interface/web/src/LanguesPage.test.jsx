import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import LanguesPage from './LanguesPage';

let storeState;

vi.mock('./store', () => {
  const useStore = (selector) => (selector ? selector(storeState) : storeState);
  useStore.getState = () => storeState;
  return { default: useStore };
});

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
vi.mock('./ToastProvider', () => ({ useToast: () => ({ toast, addToast: vi.fn() }) }));

const ANGLAIS = {
  id: 'lang-1',
  nom: 'Anglais',
  drapeau: '🇬🇧',
  actif: true,
  cadence: 3,
  categorie: '',
  heuresAcquises: 0,
  niveauImpose: '',
  dernieresPratiques: { vocabulaire: '', conversation: '', grammaire: '' },
  vocabulaire: { deckAnki: 'Anglais::Vocabulaire', liens: [], dureeMinutes: 20 },
  conversation: {
    liens: [{ id: 'c1', libelle: 'Discussion quotidienne', url: 'https://gemini.google.test/app/conv' }],
    dureeMinutes: 20,
  },
  grammaire: {
    liens: [
      { id: 'g1', libelle: 'Temps du passé', url: 'https://gemini.google.test/app/gram' },
      { id: 'g2', libelle: 'Conditionnels', url: 'https://gemini.google.test/app/gram2' },
    ],
    livre: 'grammaire.pdf',
    dureeMinutes: 30,
  },
};

/** Niveau tel que l'estime `moteur/niveauLangue.js`. */
const NIVEAU = {
  code: 'B1',
  libelle: 'Seuil',
  impose: false,
  heures: 450,
  heuresRelevees: 50,
  heuresAcquises: 400,
  categorie: 'I',
  facteur: 1,
  seuilAtteint: 400,
  seuilSuivant: 600,
  codeSuivant: 'B2',
  progression: 0.25,
  heuresRestantes: 150,
};

/** État tel que le renvoie `/api/langues/etat`, volet proposé au choix. */
const etatPour = (propose = 'vocabulaire', surcharge = {}) => ({
  niveau: NIVEAU,
  id: 'lang-1',
  nom: 'Anglais',
  actif: true,
  cadence: 3,
  propose,
  dette: 1,
  pratiqueAujourdhui: false,
  configuree: true,
  regularite: { tenu: 4, vise: 13, fenetre: 30 },
  volets: [
    { cle: 'vocabulaire', libelle: 'Vocabulaire', intervalleJours: 4.7, derniere: null, joursDepuis: null, dette: 1, du: true, exploitable: true, dureeMinutes: 20, faitAujourdhui: false },
    { cle: 'conversation', libelle: 'Conversation', intervalleJours: 7, derniere: '2026-08-25', joursDepuis: 1, dette: 0.14, du: false, exploitable: true, dureeMinutes: 20, faitAujourdhui: false },
    { cle: 'grammaire', libelle: 'Grammaire', intervalleJours: 14, derniere: '2026-08-20', joursDepuis: 6, dette: 0.43, du: false, exploitable: true, dureeMinutes: 30, faitAujourdhui: false },
  ],
  ...surcharge,
});

/** Réponses de l'API, indexées par fragment d'URL. */
let reponses;

const repondre = (url) => {
  const cle = Object.keys(reponses).find(k => String(url).includes(k));
  const corps = cle ? reponses[cle] : {};
  return Promise.resolve({
    ok: corps.__statut ? corps.__statut < 400 : true,
    status: corps.__statut || 200,
    json: () => Promise.resolve(corps),
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  reponses = {
    '/langues/etat': { success: true, langues: [etatPour()] },
    '/langues/livres': { success: true, livres: ['grammaire.pdf'] },
  };
  global.fetch = vi.fn((url) => repondre(url));
  window.open = vi.fn();

  storeState = {
    config: { langues: [ANGLAIS] },
    setConfig: vi.fn(),
    addHistoriqueEntry: vi.fn(),
    fetchOrchestrator: vi.fn(),
  };
});

describe('LanguesPage — premier lancement', () => {
  it('invite à déclarer une première langue plutôt que d’en proposer une', async () => {
    // Aucune langue n'est fournie d'office : c'est à l'utilisateur de dire
    // lesquelles il apprend.
    storeState.config = { langues: [] };
    render(<LanguesPage />);

    expect(screen.getByText(/Aucune langue déclarée/i)).toBeInTheDocument();
    expect(screen.queryByText('Anglais')).not.toBeInTheDocument();
  });

  it('ouvre la fenêtre de réglages sur une langue vierge', async () => {
    storeState.config = { langues: [] };
    render(<LanguesPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une langue' }));

    // On ne retient pas la référence renvoyée par findBy* : le mock partagé de
    // framer-motion fabrique un composant neuf à chaque accès, si bien que le
    // premier rendu suivant détache l'élément déjà capturé.
    await screen.findByText('Nouvelle langue');
    expect(screen.getByLabelText('Langue')).toHaveValue('');
  });

  it('refuse d’enregistrer une langue sans nom', async () => {
    storeState.config = { langues: [] };
    render(<LanguesPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une langue' }));
    await screen.findByText('Nouvelle langue');
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  });

  it('enregistre la langue saisie dans la configuration', async () => {
    storeState.config = { langues: [] };
    render(<LanguesPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une langue' }));
    await screen.findByText('Nouvelle langue');
    fireEvent.change(screen.getByLabelText('Langue'), { target: { value: '  Japonais  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(storeState.setConfig).toHaveBeenCalledTimes(1);
    const [{ langues }] = storeState.setConfig.mock.calls[0];
    expect(langues).toHaveLength(1);
    expect(langues[0].nom).toBe('Japonais'); // espaces retirés
    expect(langues[0].cadence).toBe(3);
  });
});

describe('LanguesPage — état affiché', () => {
  it('met en avant le volet retenu pour aujourd’hui', async () => {
    render(<LanguesPage />);
    expect(await screen.findByText(/À faire : Vocabulaire/i)).toBeInTheDocument();
  });

  it('annonce « à jour » quand aucun volet n’est dû', async () => {
    reponses['/langues/etat'] = { success: true, langues: [etatPour(null)] };
    render(<LanguesPage />);
    expect(await screen.findByText('À jour')).toBeInTheDocument();
  });

  it('signale une langue dont aucun volet n’est exploitable', async () => {
    reponses['/langues/etat'] = { success: true, langues: [etatPour(null, { configuree: false })] };
    render(<LanguesPage />);
    expect(await screen.findByText('À configurer')).toBeInTheDocument();
  });

  it('affiche la régularité tenue sur trente jours', async () => {
    render(<LanguesPage />);
    expect(await screen.findByText('4 / 13')).toBeInTheDocument();
  });

  it('affiche le repère de niveau et ce qui reste avant le palier suivant', async () => {
    render(<LanguesPage />);
    expect(await screen.findByText('B1')).toBeInTheDocument();
    expect(screen.getByText(/450 h · 150 h avant B2/)).toBeInTheDocument();
  });

  it('n’affiche pas de palier suivant au sommet de l’échelle', async () => {
    reponses['/langues/etat'] = {
      success: true,
      langues: [etatPour('vocabulaire', {
        niveau: { ...NIVEAU, code: 'C2', codeSuivant: null, heuresRestantes: 0, progression: 1 },
      })],
    };
    render(<LanguesPage />);
    expect(await screen.findByText('C2')).toBeInTheDocument();
    expect(screen.queryByText(/avant/)).not.toBeInTheDocument();
  });
});

describe('LanguesPage — ouverture des ressources', () => {
  it('ouvre le fil de conversation dans un onglet, sans passer par le serveur', async () => {
    render(<LanguesPage />);
    await screen.findByText(/À faire/i);

    fireEvent.click(screen.getByRole('button', { name: /Discussion quotidienne/i }));
    expect(window.open).toHaveBeenCalledWith(
      'https://gemini.google.test/app/conv',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('propose un bouton par fil déclaré, nommé comme l’utilisateur l’a nommé', async () => {
    // Un fil tire sa valeur de son historique : celui des temps du passé n'est
    // pas celui où l'on bavarde, et seul l'utilisateur sait les distinguer.
    render(<LanguesPage />);
    await screen.findByText(/À faire/i);

    fireEvent.click(screen.getByRole('button', { name: /Conditionnels/i }));
    expect(window.open).toHaveBeenCalledWith(
      'https://gemini.google.test/app/gram2', '_blank', 'noopener,noreferrer'
    );

    // Nom exact : « Livre + Temps du passé » porte le même libellé en partie.
    fireEvent.click(screen.getByRole('button', { name: 'Temps du passé' }));
    expect(window.open).toHaveBeenCalledWith(
      'https://gemini.google.test/app/gram', '_blank', 'noopener,noreferrer'
    );
  });

  it('reprend le lien unique d’une langue déclarée avant les listes', async () => {
    // Ces langues ne doivent pas devenir muettes après la mise à jour.
    storeState.config = {
      langues: [{
        ...ANGLAIS,
        conversation: { lienIA: 'https://gemini.google.test/app/ancien', dureeMinutes: 20 },
      }],
    };
    render(<LanguesPage />);
    await screen.findByText(/À faire/i);

    fireEvent.click(screen.getByRole('button', { name: /Ma conversation/i }));
    expect(window.open).toHaveBeenCalledWith(
      'https://gemini.google.test/app/ancien', '_blank', 'noopener,noreferrer'
    );
  });

  it('refuse une adresse qui n’est pas en http(s)', async () => {
    storeState.config = {
      langues: [{
        ...ANGLAIS,
        conversation: { liens: [{ id: 'x', libelle: 'Piège', url: 'javascript:alert(1)' }], dureeMinutes: 20 },
      }],
    };
    render(<LanguesPage />);
    await screen.findByText(/À faire/i);

    expect(screen.queryByRole('button', { name: /Piège/i })).not.toBeInTheDocument();
    expect(window.open).not.toHaveBeenCalled();
  });

  it('ouvre le livre par le serveur, le navigateur n’ayant pas accès au disque', async () => {
    reponses['/langues/livre/ouvrir'] = { success: true, message: 'Ouverture de grammaire.pdf.' };
    render(<LanguesPage />);
    await screen.findByText(/À faire/i);

    fireEvent.click(screen.getByRole('button', { name: /Ouvrir le livre/i }));

    await waitFor(() => {
      const appel = global.fetch.mock.calls.find(([url]) => String(url).includes('/langues/livre/ouvrir'));
      expect(appel).toBeTruthy();
      expect(JSON.parse(appel[1].body)).toEqual({ fichier: 'grammaire.pdf' });
    });
  });

  it('propose livre et conversation ensemble quand les deux sont réglés', async () => {
    reponses['/langues/livre/ouvrir'] = { success: true, message: 'ok' };
    render(<LanguesPage />);
    await screen.findByText(/À faire/i);

    // Le bouton combiné porte le nom du premier fil déclaré.
    fireEvent.click(screen.getByRole('button', { name: /Livre \+ Temps du passé/i }));

    expect(window.open).toHaveBeenCalledWith(
      'https://gemini.google.test/app/gram', '_blank', 'noopener,noreferrer'
    );
    await waitFor(() => {
      expect(global.fetch.mock.calls.some(([url]) => String(url).includes('/langues/livre/ouvrir'))).toBe(true);
    });
  });

  it('lance Anki lui-même quand il ne répond pas, plutôt que de renvoyer une erreur sèche', async () => {
    reponses['/langues/anki/reviser'] = { __statut: 503, error: "Anki n'est pas lancé.", ankiFerme: true };
    reponses['/open/anki'] = { success: true };
    render(<LanguesPage />);
    await screen.findByText(/À faire/i);

    fireEvent.click(screen.getByRole('button', { name: /Réviser dans Anki/i }));

    await waitFor(() => {
      expect(global.fetch.mock.calls.some(([url]) => String(url).endsWith('/open/anki'))).toBe(true);
    });
    expect(toast.info).toHaveBeenCalled();
  });
});

describe('LanguesPage — enregistrement d’une séance', () => {
  it('inscrit la séance dans la configuration et dans l’historique', async () => {
    render(<LanguesPage />);
    await screen.findByText(/À faire/i);

    const volets = screen.getAllByRole('button', { name: /J’ai pratiqué/i });
    fireEvent.click(volets[0]);

    const [{ langues }] = storeState.setConfig.mock.calls[0];
    expect(langues[0].dernieresPratiques.vocabulaire).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(storeState.addHistoriqueEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: 'LANGUE',
      titre: 'Vocabulaire',
      matiere: 'Anglais',
      dureeMinutes: 20,
    }));
  });

  it('grise le volet une fois la séance du jour faite', async () => {
    reponses['/langues/etat'] = {
      success: true,
      langues: [etatPour(null, {
        pratiqueAujourdhui: true,
        volets: etatPour().volets.map(v => (v.cle === 'vocabulaire'
          ? { ...v, faitAujourdhui: true, dette: 0, du: false }
          : v)),
      })],
    };
    render(<LanguesPage />);
    expect(await screen.findByRole('button', { name: /Fait aujourd’hui/i })).toBeDisabled();
  });
});

/*
 * ELPIS n'appelle plus de modèle : il prépare la consigne, l'étudiant la porte
 * dans la fenêtre de conversation de son choix, et recolle la réponse. Ce qui
 * fait la valeur du module — la consigne calée sur le niveau et le déjà-su, le
 * filtrage des doublons, l'écriture dans Anki — est resté local. Ces tests
 * couvrent ce trajet, et vérifient qu'aucun appel sortant ne subsiste.
 */
describe('LanguesPage — préparation du vocabulaire', () => {
  const CONSIGNE = {
    success: true,
    texte: 'Langue étudiée : Anglais.\nNiveau visé : B1…',
    niveau: NIVEAU,
    deck: 'Anglais::Vocabulaire',
    motsConnus: 812,
    exclusions: { transmises: 400, connues: 812, tronquee: true },
    ankiFerme: false,
  };

  /** Ouvre la fenêtre ; la consigne s'y prépare d'elle-même. */
  const ouvrirConsigne = async () => {
    render(<LanguesPage />);
    await screen.findByText(/À faire/i);
    fireEvent.click(screen.getByRole('button', { name: /Ajouter des mots/i }));
    return screen.findByRole('dialog');
  };

  const coller = async (texte = '[{"recto":"to thrive","verso":"prospérer"}]') => {
    const zone = await screen.findByLabelText('Réponse de ta conversation');
    fireEvent.change(zone, { target: { value: texte } });
    fireEvent.click(screen.getByRole('button', { name: /Envoyer dans Anki/i }));
  };

  it('prépare la consigne dès l’ouverture, sans second clic', async () => {
    // La consigne n'est plus une porte de secours : c'est le chemin.
    reponses['/langues/vocabulaire/prompt'] = CONSIGNE;
    await ouvrirConsigne();

    expect(await screen.findByLabelText('Consigne de génération')).toHaveValue(CONSIGNE.texte);
    expect(screen.getByText(/400 mots déjà connus exclus/)).toBeInTheDocument();
  });

  it('n’appelle aucun service de génération', async () => {
    // La garantie qui justifie la refonte : rien ne sort de la machine.
    reponses['/langues/vocabulaire/prompt'] = CONSIGNE;
    await ouvrirConsigne();
    await screen.findByLabelText('Consigne de génération');

    const sortant = global.fetch.mock.calls.filter(([url]) => String(url).includes('/vocabulaire/generer'));
    expect(sortant).toHaveLength(0);
  });

  it('signale qu’Anki fermé prive la consigne des mots connus', async () => {
    reponses['/langues/vocabulaire/prompt'] = { ...CONSIGNE, ankiFerme: true, exclusions: { transmises: 0, connues: 0, tronquee: false } };
    await ouvrirConsigne();

    expect(await screen.findByText(/Anki étant fermé/)).toBeInTheDocument();
  });

  it('renvoie dans Anki la réponse collée et en montre le résultat', async () => {
    reponses['/langues/vocabulaire/prompt'] = CONSIGNE;
    reponses['/langues/anki/ajouter'] = {
      success: true, deck: 'Anglais::Vocabulaire', ajoutees: 2, deja: 0, refusees: 0,
      cartes: [{ recto: 'to thrive', verso: 'prospérer' }, { recto: 'cumbersome', verso: 'encombrant' }],
    };
    await ouvrirConsigne();
    await coller();

    await waitFor(() => {
      const appel = global.fetch.mock.calls.find(([url]) => String(url).includes('/anki/ajouter'));
      expect(appel).toBeTruthy();
      expect(JSON.parse(appel[1].body)).toMatchObject({ deck: 'Anglais::Vocabulaire' });
    });
    expect(await screen.findByText('to thrive')).toBeInTheDocument();
    expect(screen.getByText('encombrant')).toBeInTheDocument();
  });

  it('annonce les doublons écartés sans les compter comme des ajouts', async () => {
    reponses['/langues/vocabulaire/prompt'] = CONSIGNE;
    reponses['/langues/anki/ajouter'] = {
      success: true, deck: 'Anglais::Vocabulaire',
      ajoutees: 7, deja: 3, refusees: 0,
      cartes: [{ recto: 'to thrive', verso: 'prospérer' }],
    };
    await ouvrirConsigne();
    await coller();

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(toast.success.mock.calls[0][0]).toMatch(/7 cartes ajoutées, 3 déjà connus/);
  });

  it('ne prétend rien avoir ajouté quand tout était déjà connu', async () => {
    reponses['/langues/vocabulaire/prompt'] = CONSIGNE;
    reponses['/langues/anki/ajouter'] = {
      success: true, deck: 'Anglais::Vocabulaire', ajoutees: 0, deja: 10, refusees: 0, cartes: [],
      message: 'Toutes ces entrées figurent déjà dans le paquet.',
    };
    await ouvrirConsigne();
    await coller();

    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('remonte l’erreur du serveur sans prétendre avoir ajouté des cartes', async () => {
    reponses['/langues/vocabulaire/prompt'] = CONSIGNE;
    reponses['/langues/anki/ajouter'] = { __statut: 503, error: "Anki n'est pas lancé.", ankiFerme: true };
    await ouvrirConsigne();
    await coller();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Anki n'est pas lancé."));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('n’envoie rien tant que la zone de collage est vide', async () => {
    reponses['/langues/vocabulaire/prompt'] = CONSIGNE;
    await ouvrirConsigne();

    expect(await screen.findByRole('button', { name: /Envoyer dans Anki/i })).toBeDisabled();
  });
});
