import { useState, useEffect, useMemo, useCallback } from 'react';
import { produce } from 'immer';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from './store';
import { useToast } from './ToastProvider';
import MarkdownModal from './MarkdownModal';
import logger from './utils/logger';
import EditableLabel from './components/cours/EditableLabel';
import MatiereCard from './components/cours/MatiereCard';
import { getApiUrl } from './utils/apiConfig';
import ConfirmModal from './components/ConfirmModal';
import ArbreCursus from './components/cours/ArbreCursus';
import CarteMatiere from './components/cours/CarteMatiere';
import { resumerCursus, resumerUE, chercherDansCursus, indexSur } from './utils/cursus';
import { TitrePage, Texte, Bouton, BoutonIcone, EtatVide, Grille, Pastille } from './components/ui';

const genererId = () => (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.round(Math.random() * 1e6)}`);

function CoursPage() {
  const { coursConfig, setCoursConfig } = useStore();
  const { toast } = useToast();
  const [configLocal, setConfigLocal] = useState(coursConfig || { licences: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLicenceIndex, setActiveLicenceIndex] = useState(0);
  const [activeSemestreIndex, setActiveSemestreIndex] = useState(0);
  const [activeUEIndex, setActiveUEIndex] = useState(0);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', initialValue: '', onSave: null });
  const [ankiDecks, setAnkiDecks] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  // Modèle maître-détail : null affiche la grille de l'UE, un index ouvre la fiche.
  const [matiereOuverte, setMatiereOuverte] = useState(null);

  useEffect(() => {
    // Sans annulation, la réponse arrivant après un changement de page écrivait
    // dans un composant démonté.
    const controleur = new AbortController();
    fetch(`${getApiUrl()}/anki/decks`, { signal: controleur.signal })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.decks) setAnkiDecks(data.decks);
      })
      .catch(err => {
        if (err.name !== 'AbortError') logger.error("Erreur chargement decks Anki:", err);
      });
    return () => controleur.abort();
  }, []);

  /**
   * Applique une mutation Immer puis sauvegarde.
   *
   * Le calcul se fait hors de l'updater de `setConfigLocal` : une fonction de
   * mise à jour d'état doit rester pure. React la rejoue en mode strict, ce qui
   * déclenchait deux sauvegardes — donc deux écritures en base — par modification.
   *
   * `libelle` nomme le geste dans la pile d'annulation. Sans lui, « annuler »
   * ne pourrait annoncer que « cursus modifié », ce qui ne permet pas de
   * vérifier qu'on s'apprête à défaire le bon.
   */
  const mutateAndSave = useCallback((recipe, libelle) => {
    const newConf = produce(configLocal, recipe);
    setConfigLocal(newConf);
    setCoursConfig(newConf, { libelle });
    return newConf;
  }, [configLocal, setCoursConfig]);

  // Resynchroniser le state local quand le store change (ex: import backup)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (coursConfig) setConfigLocal(coursConfig);
  }, [coursConfig]);

  // Écouter la recherche globale (Ctrl+K) pour naviguer vers l'élément trouvé
  useEffect(() => {
    const handleSearchSelect = (e) => {
      const item = e.detail;
      if (item.lIndex !== undefined) {
        setActiveLicenceIndex(item.lIndex);
        setActiveSemestreIndex(item.sIndex || 0);
        if (item.uIndex !== undefined) {
          setActiveUEIndex(item.uIndex);
        }
      }
    };
    window.addEventListener('elpisSearchSelect', handleSearchSelect);
    return () => window.removeEventListener('elpisSearchSelect', handleSearchSelect);
  }, []);

  // ---- Recherche ----
  const matchesSearch = (str) => {
    if (!searchTerm.trim()) return true;
    return str?.toLowerCase().includes(searchTerm.toLowerCase());
  };
  const ueMatchesSearch = (ue) => matchesSearch(ue.nom) || ue.matieres?.some(m => matiereMatchesSearch(m));
  const matiereMatchesSearch = (m) => {
    if (matchesSearch(m.nom)) return true;
    if (m.listeCM?.some(cm => matchesSearch(cm.titre) || matchesSearch(cm.notes))) return true;
    if (m.listeTD?.some(td => matchesSearch(td.titre) || matchesSearch(td.notes))) return true;
    if (m.listeTP?.some(tp => matchesSearch(tp.titre) || matchesSearch(tp.notes))) return true;
    if (m.listeAnnales?.some(annale => matchesSearch(annale.titre) || matchesSearch(annale.notes))) return true;
    return false;
  };
  const semestreMatchesSearch = (semestre) => matchesSearch(semestre.nom) || semestre.ues?.some(ue => ueMatchesSearch(ue));
  const licenceMatchesSearch = (licence) => matchesSearch(licence.nom) || licence.semestres?.some(s => semestreMatchesSearch(s));

  // ---- Mutation d'un champ par chemin ----
  const updateField = (path, value) => {
    mutateAndSave(draft => {
      let target = draft;
      for (let i = 0; i < path.length - 1; i++) target = target[path[i]];
      target[path[path.length - 1]] = value;
    });
  };

  // ---- CRUD Licence ----
  const addLicence = () => {
    // L'index vient du nouvel état, pas de l'ancien : deux clics rapprochés
    // laissaient l'onglet actif sur l'avant-dernier élément.
    const newConf = mutateAndSave(draft => {
      if (!draft.licences) draft.licences = [];
      draft.licences.push({ id: genererId(), nom: `Licence ${draft.licences.length + 1}`, semestres: [] });
    });
    setActiveLicenceIndex(newConf.licences.length - 1);
    setActiveSemestreIndex(0);
    setActiveUEIndex(0);
  };

  const deleteLicence = (lIndex) => {
    setDeleteConfirm({ type: 'licence', params: { lIndex } });
  };

  // ---- CRUD Semestre ----
  const addSemestre = (lIndex) => {
    const newConf = mutateAndSave(draft => {
      if (!draft.licences[lIndex].semestres) draft.licences[lIndex].semestres = [];
      draft.licences[lIndex].semestres.push({ id: genererId(), nom: `Semestre ${draft.licences[lIndex].semestres.length + 1}`, ues: [] });
    });
    setActiveSemestreIndex(newConf.licences[lIndex].semestres.length - 1);
    setActiveUEIndex(0);
  };

  const deleteSemestre = (lIndex, sIndex) => {
    setDeleteConfirm({ type: 'semestre', params: { lIndex, sIndex } });
  };

  // ---- CRUD UE ----
  const addUE = (lIndex, sIndex) => {
    const newConf = mutateAndSave(draft => {
      if (!draft.licences[lIndex].semestres[sIndex].ues) draft.licences[lIndex].semestres[sIndex].ues = [];
      draft.licences[lIndex].semestres[sIndex].ues.push({ id: genererId(), nom: "Nouvelle UE", ects: 0, matieres: [] });
    });
    setActiveUEIndex(newConf.licences[lIndex].semestres[sIndex].ues.length - 1);
  };

  const deleteUE = (lIndex, sIndex, uIndex) => {
    setDeleteConfirm({ type: 'ue', params: { lIndex, sIndex, uIndex } });
  };

  // ---- CRUD Matiere ----
  const addMatiere = (lIndex, sIndex, uIndex) => {
    mutateAndSave(draft => {
      const ue = draft.licences[lIndex].semestres[sIndex].ues[uIndex];
      if (!ue.matieres) ue.matieres = [];
      ue.matieres.push({ id: genererId(), nom: "Nouvelle Matière", listeCM: [], listeTD: [], listeTP: [], listeAnnales: [] });
    });
  };

  const deleteMatiere = (lIndex, sIndex, uIndex, mIndex) => {
    setDeleteConfirm({ type: 'matiere', params: { lIndex, sIndex, uIndex, mIndex } });
  };

  // ---- CRUD CM ----
  const addCM = (lIndex, sIndex, uIndex, mIndex) => {
    mutateAndSave(draft => {
      const mat = draft.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex];
      if (!mat.listeCM) mat.listeCM = [];
      mat.listeCM.push({ id: genererId(), titre: "Nouveau CM", jActuel: 0, derniereRevision: "", easeFactor: 2.5, repetitions: 0 });
    });
  };

  const deleteCM = (lIndex, sIndex, uIndex, mIndex, cmIndex) => {
    setDeleteConfirm({ type: 'cm', params: { lIndex, sIndex, uIndex, mIndex, itemIndex: cmIndex } });
  };

  // ---- CRUD TD ----
  const addTDManuel = (lIndex, sIndex, uIndex, mIndex) => {
    mutateAndSave(draft => {
      const m = draft.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex];
      if (!m.listeTD) m.listeTD = [];
      m.listeTD.push({ id: genererId(), titre: "Nouvel Exercice de TD", dernierePratique: "", nombrePratiques: 0, notes: "", dateAjout: new Date().toISOString() });
    });
  };

  const deleteTD = (lIndex, sIndex, uIndex, mIndex, tdIndex) => {
    setDeleteConfirm({ type: 'td', params: { lIndex, sIndex, uIndex, mIndex, itemIndex: tdIndex } });
  };

  // ---- CRUD TP ----
  const addTPManuel = (lIndex, sIndex, uIndex, mIndex) => {
    mutateAndSave(draft => {
      const m = draft.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex];
      if (!m.listeTP) m.listeTP = [];
      m.listeTP.push({ id: genererId(), titre: "Nouvel Exercice de TP", dernierePratique: "", nombrePratiques: 0, notes: "", dateAjout: new Date().toISOString() });
    });
  };

  const deleteTP = (lIndex, sIndex, uIndex, mIndex, tpIndex) => {
    setDeleteConfirm({ type: 'tp', params: { lIndex, sIndex, uIndex, mIndex, itemIndex: tpIndex } });
  };

  // ---- CRUD Annales ----
  const addAnnaleManuel = (lIndex, sIndex, uIndex, mIndex) => {
    mutateAndSave(draft => {
      const m = draft.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex];
      if (!m.listeAnnales) m.listeAnnales = [];
      m.listeAnnales.push({ id: genererId(), titre: "Nouvelle Annale", dernierePratique: "", nombrePratiques: 0, notes: "", dateAjout: new Date().toISOString() });
    });
  };

  const deleteAnnale = (lIndex, sIndex, uIndex, mIndex, annaleIndex) => {
    setDeleteConfirm({ type: 'annale', params: { lIndex, sIndex, uIndex, mIndex, itemIndex: annaleIndex } });
  };

  const getNextReviewDate = (cm) => {
    // Priorité au champ prochaineRevisionDate calculé par FSRS
    if (cm.prochaineRevisionDate) {
      const target = new Date(cm.prochaineRevisionDate + 'T00:00:00');
      if (!isNaN(target.getTime())) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return "Aujourd'hui";
        if (diffDays === 1) return "Demain";
        return target.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      }
    }
    // Fallback : ancienne logique (derniereRevision + jActuel)
    if (!cm.derniereRevision) return "Aujourd'hui";
    if (cm.jActuel === 0) return "Aujourd'hui";
    const date = new Date(cm.derniereRevision + 'T00:00:00');
    if (isNaN(date.getTime())) return "Aujourd'hui";
    date.setDate(date.getDate() + cm.jActuel);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return "Aujourd'hui";
    if (diffDays === 1) return "Demain";
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  // Mémoïsée : cette liste est passée à chaque carte de matière, et une
  // nouvelle référence de tableau à chaque rendu les ferait toutes redessiner.
  const getAllMatiereNames = () => {
    const names = [];
    configLocal.licences?.forEach(l => {
      l.semestres?.forEach(s => {
        s.ues?.forEach(u => {
          u.matieres?.forEach(m => {
            if (m.nom && m.nom.trim() !== '') names.push(m.nom.trim());
          });
        });
      });
    });
    return Array.from(new Set(names));
  };
  const allMatiereNames = useMemo(getAllMatiereNames, [configLocal]);

  // ---------- Suppression confirmée ----------

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;
    const { type, params } = deleteConfirm;
    const { lIndex, sIndex, uIndex, mIndex, itemIndex } = params;

    const chemin = (draft) => draft.licences[lIndex].semestres[sIndex].ues[uIndex].matieres[mIndex];

    const nomsGestes = {
      licence: 'Suppression de la licence', semestre: 'Suppression du semestre',
      ue: "Suppression de l'UE", matiere: 'Suppression de la matière',
      cm: 'Suppression du CM', td: 'Suppression du TD',
      tp: 'Suppression du TP', annale: "Suppression de l'annale",
    };

    const apres = mutateAndSave(draft => {
      switch (type) {
        case 'licence': draft.licences.splice(lIndex, 1); break;
        case 'semestre': draft.licences[lIndex].semestres.splice(sIndex, 1); break;
        case 'ue': draft.licences[lIndex].semestres[sIndex].ues.splice(uIndex, 1); break;
        case 'matiere': draft.licences[lIndex].semestres[sIndex].ues[uIndex].matieres.splice(mIndex, 1); break;
        case 'cm': chemin(draft).listeCM.splice(itemIndex, 1); break;
        case 'td': chemin(draft).listeTD.splice(itemIndex, 1); break;
        case 'tp': chemin(draft).listeTP.splice(itemIndex, 1); break;
        case 'annale': chemin(draft).listeAnnales.splice(itemIndex, 1); break;
        default: break;
      }
    }, nomsGestes[type]);

    // La fiche ouverte peut viser l'élément qu'on vient d'effacer.
    if (type === 'matiere') setMatiereOuverte(null);

    /*
     * La sélection courante peut désigner un élément qui n'existe plus, ou un
     * rang désormais hors des bornes : supprimer le dernier semestre laissait
     * `activeSemestreIndex` pointer au-delà du tableau, et la page n'affichait
     * plus rien sans dire pourquoi. On la ramène sur l'élément qui prend la
     * place du supprimé, ou sur le dernier restant.
     */
    const borner = (indice, longueur) => Math.max(0, Math.min(indice, longueur - 1));

    if (type === 'licence') {
      const nouvelIndex = borner(lIndex, apres.licences.length);
      setActiveLicenceIndex(nouvelIndex);
      setActiveSemestreIndex(0);
      setActiveUEIndex(0);
    } else if (type === 'semestre') {
      const semestres = apres.licences[lIndex]?.semestres || [];
      setActiveSemestreIndex(borner(sIndex, semestres.length));
      setActiveUEIndex(0);
    } else if (type === 'ue') {
      const ues = apres.licences[lIndex]?.semestres[sIndex]?.ues || [];
      setActiveUEIndex(borner(uIndex, ues.length));
    }

    /*
     * On propose la réparation là où l'erreur se constate.
     * La confirmation demandée avant la suppression ne protège que de
     * l'inattention ; elle ne protège pas d'avoir visé le mauvais élément, ce
     * qu'on ne découvre qu'après coup, en voyant ce qui a disparu.
     */
    toast.success(`${nomsGestes[type]} effectuée.`, 0, {
      libelle: 'Annuler',
      onAction: () => {
        const libelle = useStore.getState().annulerDernierGeste();
        if (libelle) toast.info('Suppression annulée.');
      },
    });

    setDeleteConfirm(null);
  };

  /**
   * Message de confirmation nommant précisément l'élément visé.
   * « Supprimer cette matière ? » ne permettait pas de vérifier qu'on s'apprête
   * bien à effacer la bonne — pour une action irréversible, c'est insuffisant.
   */
  const getDeleteMessage = () => {
    if (!deleteConfirm) return '';
    const { type, params } = deleteConfirm;
    const { lIndex, sIndex, uIndex, mIndex, itemIndex } = params;

    const lic = configLocal.licences?.[lIndex];
    const sem = lic?.semestres?.[sIndex];
    const uni = sem?.ues?.[uIndex];
    const mat = uni?.matieres?.[mIndex];
    const nommer = (v, defaut) => `« ${v || defaut} »`;

    switch (type) {
      case 'licence': {
        const n = lic?.semestres?.length || 0;
        return `Supprimer la licence ${nommer(lic?.nom, 'sans nom')}${n > 0 ? ` et ses ${n} semestre${n > 1 ? 's' : ''}` : ''} ?`;
      }
      case 'semestre': {
        const n = sem?.ues?.length || 0;
        return `Supprimer le semestre ${nommer(sem?.nom, 'sans nom')}${n > 0 ? ` et ses ${n} UE` : ''} ?`;
      }
      case 'ue': {
        const n = uni?.matieres?.length || 0;
        return `Supprimer l'UE ${nommer(uni?.nom, 'sans nom')}${n > 0 ? ` et ses ${n} matière${n > 1 ? 's' : ''}` : ''} ?`;
      }
      case 'matiere': {
        const n = (mat?.listeCM?.length || 0) + (mat?.listeTD?.length || 0)
          + (mat?.listeTP?.length || 0) + (mat?.listeAnnales?.length || 0);
        return `Supprimer la matière ${nommer(mat?.nom, 'sans nom')}${n > 0 ? ` et ses ${n} élément${n > 1 ? 's' : ''}` : ''} ?`;
      }
      case 'cm': return `Supprimer le CM ${nommer(mat?.listeCM?.[itemIndex]?.titre, 'sans titre')} ?`;
      case 'td': return `Supprimer le TD ${nommer(mat?.listeTD?.[itemIndex]?.titre, 'sans titre')} ?`;
      case 'tp': return `Supprimer le TP ${nommer(mat?.listeTP?.[itemIndex]?.titre, 'sans titre')} ?`;
      case 'annale': return `Supprimer l'annale ${nommer(mat?.listeAnnales?.[itemIndex]?.titre, 'sans titre')} ?`;
      default: return '';
    }
  };

  // ------------------------------------------------------------------ Rendu

  const licences = configLocal.licences || [];

  // Les index sont ramenés dans les bornes : supprimer un élément ailleurs
  // laissait la sélection pointer dans le vide et vidait l'écran sans un mot.
  const lIdx = indexSur(activeLicenceIndex, licences);
  const semestres = licences[lIdx]?.semestres || [];
  const sIdx = indexSur(activeSemestreIndex, semestres);
  const ues = semestres[sIdx]?.ues || [];
  const uIdx = indexSur(activeUEIndex, ues);

  const licence = licences[lIdx];
  const semestre = semestres[sIdx];
  const ue = ues[uIdx];
  const matieres = ue?.matieres || [];

  const bilanCursus = useMemo(() => resumerCursus(configLocal), [configLocal]);
  const bilanUE = useMemo(() => (ue ? resumerUE(ue) : null), [ue]);

  // La recherche traverse tout le cursus, pas seulement la licence affichée.
  const resultats = useMemo(
    () => chercherDansCursus(configLocal, searchTerm),
    [configLocal, searchTerm]
  );
  const enRecherche = searchTerm.trim().length > 0;

  const allerA = (chemin) => {
    setActiveLicenceIndex(chemin.lIndex);
    setActiveSemestreIndex(chemin.sIndex);
    setActiveUEIndex(chemin.uIndex);
    setMatiereOuverte(chemin.mIndex);
    setSearchTerm('');
  };

  const selectionner = (l, s, u) => {
    setActiveLicenceIndex(l);
    setActiveSemestreIndex(s);
    setActiveUEIndex(u);
    setMatiereOuverte(null);
  };

  const matiereDetail = matiereOuverte !== null ? matieres[matiereOuverte] : null;

  return (
    <div className="cours-page">
      {/* ---------- En-tête ---------- */}
      <header className="el-rang el-rang--entre" style={{ marginBottom: 'var(--esp-6)', alignItems: 'flex-start' }}>
        <div>
          <TitrePage>Bibliothèque</TitrePage>
          <Texte doux petit style={{ marginTop: 'var(--esp-2)' }}>
            {bilanCursus.nbMatieres} matière{bilanCursus.nbMatieres > 1 ? 's' : ''}
            {' · '}{bilanCursus.nbCours} cours
            {' · '}{bilanCursus.nbExercices} exercice{bilanCursus.nbExercices > 1 ? 's' : ''}
          </Texte>
        </div>
        <input
          type="search"
          className="el-champ"
          style={{ maxWidth: '280px' }}
          placeholder="Rechercher dans tout le cursus…"
          aria-label="Rechercher une matière, un cours ou un exercice"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </header>

      {/* ---------- Résultats de recherche ---------- */}
      {enRecherche && (
        <div style={{ marginBottom: 'var(--esp-6)' }}>
          <div className="el-surtitre" style={{ marginBottom: 'var(--esp-3)' }}>
            {resultats.length} résultat{resultats.length > 1 ? 's' : ''} pour « {searchTerm} »
          </div>
          {resultats.length === 0 ? (
            <EtatVide
              icone="🔍"
              titre="Aucune correspondance"
              texte="Vérifie l'orthographe, ou cherche le nom de la matière plutôt que celui de l'exercice."
              actions={<Bouton onClick={() => setSearchTerm('')}>Effacer la recherche</Bouton>}
            />
          ) : (
            <div className="recherche-resultats">
              {resultats.map((r, i) => (
                <button
                  key={`res-${i}`}
                  type="button"
                  className="recherche-resultat"
                  onClick={() => allerA(r.chemin)}
                >
                  <Pastille ton={r.type === 'MATIERE' ? 'accent' : r.type.toLowerCase()}>
                    {r.type === 'MATIERE' ? 'Matière' : r.type}
                  </Pastille>
                  <span className="recherche-resultat__titre">{r.titre}</span>
                  <span className="recherche-resultat__chemin">
                    {r.matiere.nom} · {r.ue.nom}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------- Cursus vide ---------- */}
      {!enRecherche && licences.length === 0 && (
        <EtatVide
          icone="🎓"
          titre="Ta bibliothèque est vide"
          texte="Commence par créer ta licence. Tu y ajouteras ensuite tes semestres, tes UE, puis tes matières avec leurs cours et exercices — c'est à partir d'eux que le planificateur construit tes journées."
          actions={<Bouton variante="primaire" grand onClick={addLicence}>Créer ma première licence</Bouton>}
        />
      )}

      {/* ---------- Fiche détaillée d'une matière ---------- */}
      {!enRecherche && matiereDetail && (
        <div>
          <div className="el-rang" style={{ marginBottom: 'var(--esp-4)' }}>
            <Bouton onClick={() => setMatiereOuverte(null)}>← Retour à {ue?.nom || "l'UE"}</Bouton>
            <span className="el-texte--mention">
              {licence?.nom} · {semestre?.nom} · {ue?.nom}
            </span>
          </div>
          <MatiereCard
            matiere={matiereDetail}
            allMatiereNames={allMatiereNames}
            ankiDecks={ankiDecks}
            lIndex={lIdx} sIndex={sIdx} uIndex={uIdx} mIndex={matiereOuverte}
            actions={{
              deleteMatiere: (...args) => { setMatiereOuverte(null); deleteMatiere(...args); },
              updateField, addCM, deleteCM,
              addTDManuel, deleteTD, addTPManuel, deleteTP,
              addAnnaleManuel, deleteAnnale,
              setModalConfig, getNextReviewDate, mutateAndSave
            }}
          />
        </div>
      )}

      {/* ---------- Arborescence + grille de matières ---------- */}
      {!enRecherche && !matiereDetail && licences.length > 0 && (
        <div className="bibliotheque">
          <ArbreCursus
            licences={licences}
            lIndex={lIdx} sIndex={sIdx} uIndex={uIdx}
            onSelection={selectionner}
            onAjouterLicence={addLicence}
            onAjouterSemestre={addSemestre}
            onAjouterUE={addUE}
            onRenommerLicence={(l, nom) => updateField(['licences', l, 'nom'], nom)}
            onRenommerSemestre={(l, s, nom) => updateField(['licences', l, 'semestres', s, 'nom'], nom)}
            onRenommerUE={(l, s, u, nom) => updateField(['licences', l, 'semestres', s, 'ues', u, 'nom'], nom)}
            onSupprimerLicence={deleteLicence}
            onSupprimerSemestre={deleteSemestre}
            onSupprimerUE={deleteUE}
          />

          <main>
            {!semestre ? (
              <EtatVide
                icone="📆"
                titre="Cette licence n'a pas encore de semestre"
                texte="Ajoute un semestre à cette licence pour commencer à y ranger tes UE."
                actions={<Bouton variante="primaire" onClick={() => addSemestre(lIdx)}>+ Semestre</Bouton>}
              />
            ) : !ue ? (
              <EtatVide
                icone="📚"
                titre="Ce semestre n'a pas encore d'UE"
                texte="Les UE regroupent tes matières et portent les crédits ECTS."
                actions={<Bouton variante="primaire" onClick={() => addUE(lIdx, sIdx)}>+ UE</Bouton>}
              />
            ) : (
              <>
                <div className="ue-entete">
                  <div className="ue-entete__titre">
                    <div className="ue-entete__chemin">{licence?.nom} · {semestre?.nom}</div>
                    <EditableLabel
                      value={ue.nom}
                      onRename={(v) => updateField(['licences', lIdx, 'semestres', sIdx, 'ues', uIdx, 'nom'], v)}
                      placeholder="Nom de l'UE"
                      style={{ fontSize: 'var(--texte-xl)', fontWeight: 'var(--graisse-forte)' }}
                    />
                    <div className="el-rang el-rang--serre" style={{ marginTop: 'var(--esp-2)' }}>
                      <label className="el-texte--mention" style={{ display: 'flex', alignItems: 'center', gap: 'var(--esp-1)' }}>
                        ECTS
                        <input
                          type="number" min="0" max="60"
                          className="el-champ"
                          style={{ width: '56px', minHeight: '28px', padding: '2px 6px', textAlign: 'center' }}
                          value={ue.ects || 0}
                          onChange={(e) => updateField(['licences', lIdx, 'semestres', sIdx, 'ues', uIdx, 'ects'], Math.min(60, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                        />
                      </label>
                      {ue.acquise && <Pastille ton="succes">Acquise</Pastille>}
                      {ue.dispense && <Pastille ton="attention">Dispense</Pastille>}
                    </div>
                  </div>

                  {bilanUE && (
                    <div className="ue-entete__mesures">
                      <div className="ue-entete__mesure">
                        <b>{bilanUE.nbMatieres}</b>
                        <span>matière{bilanUE.nbMatieres > 1 ? 's' : ''}</span>
                      </div>
                      <div className="ue-entete__mesure">
                        <b>{bilanUE.avancement !== null ? `${bilanUE.avancement}%` : '—'}</b>
                        <span>travaillé</span>
                      </div>
                    </div>
                  )}

                  <div className="el-rang el-rang--serre">
                    <Bouton variante="primaire" onClick={() => addMatiere(lIdx, sIdx, uIdx)}>+ Matière</Bouton>
                    <BoutonIcone libelle={`Supprimer l'UE ${ue.nom || 'sans nom'}`} danger onClick={() => deleteUE(lIdx, sIdx, uIdx)}>🗑️</BoutonIcone>
                  </div>
                </div>

                {matieres.length === 0 ? (
                  <EtatVide
                    icone="✏️"
                    titre="Aucune matière dans cette UE"
                    texte="Ajoute tes matières : ce sont elles qui portent les cours, les TD et les annales."
                    actions={<Bouton variante="primaire" onClick={() => addMatiere(lIdx, sIdx, uIdx)}>+ Matière</Bouton>}
                  />
                ) : (
                  <Grille>
                    {matieres.map((matiere, mIndex) => (
                      <CarteMatiere
                        key={`mat-${mIndex}`}
                        matiere={matiere}
                        onOuvrir={() => setMatiereOuverte(mIndex)}
                      />
                    ))}
                  </Grille>
                )}
              </>
            )}
          </main>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="Confirmer la suppression"
        message={getDeleteMessage()}
        confirmLabel="Supprimer"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      <MarkdownModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        initialValue={modalConfig.initialValue}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        onSave={modalConfig.onSave}
      />
    </div>
  );
}

export default CoursPage;
