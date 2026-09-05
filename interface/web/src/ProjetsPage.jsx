import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import useStore, { useChronoStore } from './store';

import useInputModal from './hooks/useInputModal';
import InputModal from './components/InputModal';
import ConfirmModal from './components/ConfirmModal';
import { useToast } from './ToastProvider';
import {
  Bouton, BoutonIcone, Carte, EtatVide, Jauge, TitreCarte, TitrePage, Texte,
} from './components/ui';

/** Identifiant robuste, y compris pour deux créations dans la même milliseconde. */
const nouvelId = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.round(Math.random() * 1e6)}`);

function ProjetsPage() {
  const { projets, setProjets, pendingTasksCount, historique, addHistoriqueEntry, setActiveTab } = useStore();
  const { toast } = useToast();
  const { globalChrono, startGlobalChrono, toggleGlobalChrono, resetGlobalChrono } = useChronoStore();
  const { prompt, isOpen, config, handleConfirm, handleCancel } = useInputModal();
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDateFin, setNewProjectDateFin] = useState('');
  const [newPhaseName, setNewPhaseName] = useState('');
  const [activeProjectForPhase, setActiveProjectForPhase] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // --- Stats des projets ---
  const projectTimeTotal = useMemo(() => {
    // `h.duree` couvre les entrées créées avant l'alignement des formats.
    return (historique || [])
      .filter(h => h.type === 'PROJET')
      .reduce((sum, h) => sum + (h.dureeMinutes || h.duree || 0), 0);
  }, [historique]);

  // Verrouillage de la page : les études passent avant les projets personnels.
  if (pendingTasksCount > 0) {
    return (
      <Carte>
        <EtatVide
          icone="🔒"
          titre="Espace verrouillé"
          texte={`Il te reste ${pendingTasksCount} tâche${pendingTasksCount > 1 ? 's' : ''} universitaire${pendingTasksCount > 1 ? 's' : ''} aujourd'hui. Termine-les pour ouvrir tes projets personnels.`}
          actions={
            // Sans issue, cet écran obligeait à repasser par le menu.
            <Bouton variante="primaire" grand onClick={() => setActiveTab('entrainement')}>
              Aller à ma Session du Jour
            </Bouton>
          }
        />
      </Carte>
    );
  }

  // --- Actions ---
  const handleAddProject = () => {
    if (!newProjectTitle.trim()) return;
    const newProject = {
      id: nouvelId(),
      titre: newProjectTitle.trim(),
      dateFin: newProjectDateFin || null,
      phases: []
    };
    setProjets([...projets, newProject]);
    setNewProjectTitle('');
    setNewProjectDateFin('');
  };

  const handleLogTime = async (projet) => {
    let finalMinutes = 0;
    if (globalChrono.exoId === projet.id && globalChrono.elapsedSeconds > 0) {
      finalMinutes = Math.max(1, Math.ceil(globalChrono.elapsedSeconds / 60));
    }

    const defaultInput = finalMinutes > 0 ? finalMinutes.toString() : "";
    const minStr = await prompt("Combien de minutes as-tu travaillé sur ce projet ?", defaultInput);
    if (minStr === null) return;

    const min = parseInt(minStr, 10);
    if (isNaN(min) || min <= 0) {
      toast.error("Indique une durée en minutes.");
      return;
    }

    if (globalChrono.exoId === projet.id) {
      resetGlobalChrono();
    }

    // Le temps passait par un POST direct puis un `setState` brut : l'entrée
    // n'atteignait pas la base locale, ne mettait pas la série à jour, et son
    // format (`date`/`duree`) différait de celui du reste de l'application
    // (`timestamp`/`dureeMinutes`) — ce temps n'apparaissait donc dans aucune
    // statistique.
    addHistoriqueEntry({
      type: 'PROJET',
      titre: projet.titre,
      matiere: 'Projets personnels',
      action: 'Temps investi',
      dureeMinutes: min,
      projetId: projet.id,
    });
    toast.success(`${min} min ajoutées à « ${projet.titre} ».`);
  };

  const handleDeleteProject = (projet) => {
    setDeleteConfirm({ type: 'project', id: projet.id, nom: projet.titre, nbPhases: (projet.phases || []).length });
  };

  /**
   * Renomme un projet.
   *
   * Seule l'échéance pouvait être corrigée après coup : un titre mal saisi
   * obligeait à supprimer le projet — donc ses phases et son avancement —
   * pour le recréer.
   */
  const renommerProjet = async (projet) => {
    const saisi = await prompt('Nom du projet :', projet.titre || '');
    if (saisi === null) return;
    const nom = saisi.trim();
    if (!nom) return toast.error('Le nom ne peut pas être vide.');
    setProjets(projets.map(p => (p.id === projet.id ? { ...p, titre: nom } : p)),
      { libelle: 'Renommage d’un projet' });
  };

  const renommerPhase = async (projectId, phase) => {
    const saisi = await prompt('Nom de l’étape :', phase.nom || '');
    if (saisi === null) return;
    const nom = saisi.trim();
    if (!nom) return toast.error('Le nom ne peut pas être vide.');
    setProjets(projets.map(p => (p.id !== projectId ? p : {
      ...p,
      phases: (p.phases || []).map(ph => (ph.id === phase.id ? { ...ph, nom } : ph)),
    })), { libelle: 'Renommage d’une étape' });
  };

  const handleUpdateDateFin = (id, newDate) => {
    setProjets(projets.map(p => p.id === id ? { ...p, dateFin: newDate } : p));
  };

  const handleDeletePhase = (projectId, phase) => {
    setDeleteConfirm({ type: 'phase', id: projectId, phaseId: phase.id, nom: phase.nom });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'project') {
      setProjets(projets.filter(p => p.id !== deleteConfirm.id));
      if (globalChrono.exoId === deleteConfirm.id) resetGlobalChrono();
    } else if (deleteConfirm.type === 'phase') {
      setProjets(projets.map(p => {
        if (p.id === deleteConfirm.id) {
          return { ...p, phases: p.phases.filter(ph => ph.id !== deleteConfirm.phaseId) };
        }
        return p;
      }));
    }
    setDeleteConfirm(null);
  };

  const handleAddPhase = (projectId) => {
    if (!newPhaseName.trim()) return;
    const updated = projets.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          phases: [...(p.phases || []), { id: nouvelId(), nom: newPhaseName.trim(), complete: false }]
        };
      }
      return p;
    });
    setProjets(updated);
    setNewPhaseName('');
    setActiveProjectForPhase(null);
  };

  /**
   * Coche ou décoche une phase, en préservant l'ordre des étapes.
   *
   * Cocher exige que la précédente le soit ; décocher entraîne les suivantes,
   * faute de quoi on obtenait une phase 2 terminée alors que la phase 1 ne
   * l'était plus — un état que la règle séquentielle interdit pourtant.
   */
  const handleTogglePhase = (projectId, phaseId) => {
    const projet = projets.find(p => p.id === projectId);
    const phases = projet?.phases || [];
    const index = phases.findIndex(ph => ph.id === phaseId);
    if (index === -1) return;

    const phase = phases[index];

    if (!phase.complete && index > 0 && !phases[index - 1].complete) {
      toast.error("Termine d'abord la phase précédente.");
      return;
    }

    const nouvellesPhases = phases.map((ph, idx) => {
      if (idx === index) return { ...ph, complete: !ph.complete };
      // On décoche : les phases suivantes ne peuvent rester terminées.
      if (phase.complete && idx > index) return { ...ph, complete: false };
      return ph;
    });

    setProjets(projets.map(p => (p.id === projectId ? { ...p, phases: nouvellesPhases } : p)));
  };

  return (
    <motion.div
      className="proj-page page-transition"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="proj-entete">
        <div>
          <TitrePage>Projets personnels</TitrePage>
          <Texte doux petit>Tes propres idées, maintenant que les cours du jour sont réglés.</Texte>
        </div>
        <div className="proj-total">
          <div className="proj-total__valeur">{Math.round(projectTimeTotal)} min</div>
          <div className="proj-total__libelle">temps investi au total</div>
        </div>
      </div>

      <Carte>
        <TitreCarte>Nouveau projet</TitreCarte>
        <div className="proj-creation">
          <input
            type="text"
            className="el-champ proj-creation__nom"
            placeholder="Nom du projet…"
            aria-label="Nom du projet"
            value={newProjectTitle}
            onChange={e => setNewProjectTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddProject()}
          />
          <input
            type="date"
            className="el-champ proj-creation__date"
            aria-label="Échéance du projet"
            value={newProjectDateFin}
            onChange={e => setNewProjectDateFin(e.target.value)}
          />
          <Bouton variante="primaire" onClick={handleAddProject}>Créer</Bouton>
        </div>
      </Carte>

      {(!projets || projets.length === 0) ? (
        <Carte>
          <EtatVide
            icone="💡"
            titre="Aucun projet pour le moment"
            texte="Découpe une idée en phases : chacune se coche dans l'ordre, et le temps que tu y passes rejoint tes statistiques."
          />
        </Carte>
      ) : (
        <div className="proj-grille">
          {projets.map(projet => {
            const phases = projet.phases || [];
            const faites = phases.filter(p => p.complete).length;
            const progression = phases.length > 0 ? Math.round((faites / phases.length) * 100) : 0;
            const chronoActif = globalChrono.exoId === projet.id && globalChrono.isRunning;

            return (
              <motion.div key={projet.id} layout>
                <Carte>
                  <div className="proj-carte__entete">
                    <div className="proj-carte__identite">
                      <div className="proj-carte__ligne-titre">
                        <h2 className="proj-carte__titre">{projet.titre}</h2>
                        <BoutonIcone
                          libelle={`Renommer « ${projet.titre} »`}
                          onClick={() => renommerProjet(projet)}
                        >
                          ✏️
                        </BoutonIcone>
                      </div>
                      <label className="proj-carte__echeance">
                        <span>Échéance</span>
                        <input
                          type="date"
                          className="el-champ"
                          value={projet.dateFin || ''}
                          onChange={(e) => handleUpdateDateFin(projet.id, e.target.value)}
                          aria-label={`Échéance de « ${projet.titre} »`}
                        />
                      </label>
                    </div>

                    <div className="el-rang el-rang--serre">
                      <BoutonIcone
                        libelle={chronoActif ? 'Mettre le chronomètre en pause' : 'Démarrer le chronomètre'}
                        onClick={() => {
                          if (globalChrono.exoId === projet.id) {
                            toggleGlobalChrono();
                          } else {
                            startGlobalChrono({ id: projet.id, titre: projet.titre, matiereNom: 'Projet' });
                          }
                        }}
                      >
                        {chronoActif ? '⏸' : '▶'}
                      </BoutonIcone>
                      <Bouton onClick={() => handleLogTime(projet)} title="Enregistrer du temps de travail">
                        + Temps
                      </Bouton>
                    </div>
                  </div>

                  <div className="proj-carte__avancement">
                    <Jauge
                      valeur={progression}
                      ton={progression === 100 ? 'succes' : undefined}
                      libelle={`Avancement de « ${projet.titre} »`}
                    />
                    <span className="proj-carte__pourcent">{progression} %</span>
                  </div>

                  <div className="proj-phases">
                    {phases.map((phase, idx) => {
                      const bloquee = idx > 0 && !phases[idx - 1].complete && !phase.complete;
                      return (
                        <div
                          key={phase.id}
                          className={`proj-phase${phase.complete ? ' est-faite' : ''}${bloquee ? ' est-bloquee' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={phase.complete}
                            onChange={() => handleTogglePhase(projet.id, phase.id)}
                            aria-label={`Phase ${idx + 1} : ${phase.nom}`}
                          />
                          <span className="proj-phase__nom">{idx + 1}. {phase.nom}</span>
                          <BoutonIcone
                            libelle={`Renommer la phase « ${phase.nom} »`}
                            onClick={() => renommerPhase(projet.id, phase)}
                          >
                            ✏️
                          </BoutonIcone>
                          <BoutonIcone
                            danger
                            libelle={`Supprimer la phase « ${phase.nom} »`}
                            onClick={() => handleDeletePhase(projet.id, phase)}
                          >
                            ×
                          </BoutonIcone>
                        </div>
                      );
                    })}
                  </div>

                  <div className="proj-carte__actions">
                    {activeProjectForPhase === projet.id ? (
                      <div className="proj-ajout-phase">
                        <input
                          type="text"
                          className="el-champ"
                          placeholder="Nom de la phase…"
                          aria-label="Nom de la nouvelle phase"
                          value={newPhaseName}
                          onChange={e => setNewPhaseName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddPhase(projet.id)}
                          autoFocus
                        />
                        <Bouton variante="primaire" onClick={() => handleAddPhase(projet.id)}>Ajouter</Bouton>
                        <Bouton variante="fantome" onClick={() => setActiveProjectForPhase(null)}>Annuler</Bouton>
                      </div>
                    ) : (
                      <Bouton
                        pleineLargeur
                        onClick={() => {
                          setActiveProjectForPhase(projet.id);
                          setNewPhaseName('');
                        }}
                      >
                        + Ajouter une phase
                      </Bouton>
                    )}

                    <Bouton variante="danger" pleineLargeur onClick={() => handleDeleteProject(projet)}>
                      Supprimer le projet
                    </Bouton>
                  </div>
                </Carte>
              </motion.div>
            );
          })}
        </div>
      )}

      <InputModal
        isOpen={isOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title={config.title}
        defaultValue={config.defaultValue}
        placeholder={config.placeholder}
      />
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm(null)}
        title="Confirmer la suppression"
        message={
          deleteConfirm?.type === 'project'
            ? `Supprimer le projet « ${deleteConfirm.nom} »${deleteConfirm.nbPhases > 0 ? ` et ses ${deleteConfirm.nbPhases} phase${deleteConfirm.nbPhases > 1 ? 's' : ''}` : ''} ?`
            : `Supprimer la phase « ${deleteConfirm?.nom} » ?`
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        danger
      />
    </motion.div>
  );
}

export default ProjetsPage;
