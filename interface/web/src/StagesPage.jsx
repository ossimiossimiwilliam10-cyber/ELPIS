import { useState, useId } from 'react';
import { motion } from 'framer-motion';
import useStore from './store';
import { useToast } from './ToastProvider';
import ConfirmModal from './components/ConfirmModal';
import {
  Bouton, BoutonIcone, Carte, Champ, EtatVide, Jauge, Pastille, Rang, Selection,
  TitreCarte, TitrePage, Texte,
} from './components/ui';

/**
 * Volumes attendus par régime, tels que fixés par le règlement des études.
 *
 * Le stage volontaire d'approfondissement de la licence de physique tient en
 * 35 heures ; les 616 à 924 heures ne concernent que la formation par
 * apprentissage. La page était calibrée sur ce second cas, si bien qu'un stage
 * de 35 heures s'affichait à 6 % d'avancement une fois terminé.
 */
const REGIMES = {
  'Stage volontaire': { heures: 35, aide: "Stage d'approfondissement, UE supplémentaire de 3 ECTS." },
  'Stage': { heures: 35, aide: 'Stage conventionné hors UE supplémentaire.' },
  'Apprentissage': { heures: 616, aide: 'Formation par apprentissage : 616 à 924 heures par année.' },
};

const REGIME_DEFAUT = 'Stage volontaire';
const HEURES_MIN = REGIMES[REGIME_DEFAUT].heures;
const HEURES_MAX = 924;

/** Identifiant robuste, y compris pour deux créations dans la même milliseconde. */
const nouvelId = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.round(Math.random() * 1e6)}`);

export default function StagesPage() {
  const { config, setConfig } = useStore();
  const { addToast } = useToast();
  const champId = useId();

  const stages = config.stages || [];

  const [confirmAction, setConfirmAction] = useState(null);

  const [newStage, setNewStage] = useState({
    titre: '',
    entreprise: '',
    type: REGIME_DEFAUT,
    objectifHeures: REGIMES[REGIME_DEFAUT].heures
  });

  /**
   * Identifiant du contrat en cours de correction, ou null pour un nouveau.
   *
   * Un contrat était définitif une fois créé : une faute dans le nom de
   * l'entreprise ou un objectif d'heures mal saisi ne se réparait qu'en
   * supprimant tout — et les heures déjà pointées disparaissaient avec. Le
   * formulaire d'ajout sert donc aussi à modifier, et la correction préserve
   * l'avancement.
   */
  const [enEdition, setEnEdition] = useState(null);

  const formulaireVide = () => ({
    titre: '', entreprise: '', type: REGIME_DEFAUT, objectifHeures: REGIMES[REGIME_DEFAUT].heures,
  });

  const annulerEdition = () => {
    setEnEdition(null);
    setNewStage(formulaireVide());
  };

  const modifierStage = (stage) => {
    setNewStage({
      titre: stage.titre || '', entreprise: stage.entreprise || '',
      type: stage.type || REGIME_DEFAUT,
      objectifHeures: stage.objectifHeures ?? REGIMES[REGIME_DEFAUT].heures,
    });
    setEnEdition(stage.id);
  };

  const addStage = (e) => {
    e.preventDefault();
    const titre = newStage.titre.trim();
    const entreprise = newStage.entreprise.trim();
    if (!titre || !entreprise) {
      addToast('Renseigne le titre du poste et l\'entreprise.', 'warning');
      return;
    }

    const objectif = Math.max(1, parseInt(newStage.objectifHeures, 10) || HEURES_MIN);

    if (enEdition) {
      // On ne réécrit que ce que le formulaire porte : les heures pointées et
      // l'état du mémoire appartiennent au suivi, pas à la description.
      setConfig({
        ...config,
        stages: stages.map(s => (s.id === enEdition
          ? { ...s, titre, entreprise, type: newStage.type, objectifHeures: objectif }
          : s)),
      }, { libelle: 'Modification d\'un contrat' });
      addToast('Contrat modifié', 'success');
      annulerEdition();
      return;
    }

    const stage = {
      id: nouvelId(),
      ...newStage,
      titre,
      entreprise,
      objectifHeures: objectif,
      heuresRealisees: 0,
      interrompu: false,
      memoireRendu: false,
      dateCreation: new Date().toISOString()
    };

    setConfig({ ...config, stages: [...stages, stage] }, { libelle: 'Ajout d\'un contrat' });
    setNewStage(formulaireVide());
    addToast('Contrat ajouté.', 'success');
  };

  const deleteStage = (stage) => {
    setConfirmAction({ type: 'delete', id: stage.id, nom: stage.titre, entreprise: stage.entreprise });
  };

  /** Écrit le total d'heures réalisées, borné à un intervalle raisonnable. */
  const setHeures = (id, valeur) => {
    setConfig({
      ...config,
      stages: stages.map(s => (
        // `heuresRealisees` pouvait être absent sur un contrat ancien :
        // l'addition donnait alors NaN, affiché tel quel dans la progression.
        s.id === id ? { ...s, heuresRealisees: Math.max(0, Math.round(valeur) || 0) } : s
      ))
    });
  };

  const addHours = (stage, hours) => {
    const total = (stage.heuresRealisees || 0) + hours;
    setHeures(stage.id, total);
    addToast(hours > 0 ? `+${hours} h ajoutées.` : `${hours} h retirées.`, 'success');
  };

  const toggleInterruption = (stage) => {
    setConfirmAction({
      // Une interruption déclarée par erreur restait définitive : le bouton
      // disparaissait et injectait une tâche obligatoire à chaque planning.
      type: stage.interrompu ? 'reprise' : 'interruption',
      id: stage.id,
      nom: stage.titre,
    });
  };

  const handleConfirm = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'delete') {
      setConfig({ ...config, stages: stages.filter(s => s.id !== confirmAction.id) });
      addToast('Contrat supprimé.', 'info');
    } else if (confirmAction.type === 'interruption' || confirmAction.type === 'reprise') {
      const reprise = confirmAction.type === 'reprise';
      setConfig({
        ...config,
        stages: stages.map(s => (
          s.id === confirmAction.id
            // Reprendre le contrat annule aussi le mémoire de substitution,
            // qui n'a plus lieu d'être.
            ? { ...s, interrompu: !reprise, memoireRendu: reprise ? false : s.memoireRendu }
            : s
        ))
      });
      addToast(
        reprise ? 'Contrat repris : la tâche de mémoire disparaît du planning.'
                : 'Interruption déclarée. Un mémoire de substitution apparaît dans ta Session du Jour.',
        'info'
      );
    }
    setConfirmAction(null);
  };

  const handleCancel = () => {
    setConfirmAction(null);
  };

  const confirmModalProps = getConfirmModalProps(confirmAction);

  const toggleMemoire = (id) => {
    setConfig({
      ...config,
      stages: stages.map(s => {
        if (s.id === id) {
          return { ...s, memoireRendu: !s.memoireRendu };
        }
        return s;
      })
    });
    addToast('Statut du mémoire mis à jour.', 'success');
  };

  return (
    <div className="stage-page">
      <div>
        <TitrePage>Mise en situation professionnelle</TitrePage>
        <Texte doux petit>
          Suivi de tes périodes en milieu professionnel. En Physique fondamentale,
          le stage volontaire d'approfondissement représente {REGIMES['Stage volontaire'].heures} heures
          et vaut une UE supplémentaire de 3 ECTS.
        </Texte>
      </div>

      <Carte>
        <TitreCarte>Nouveau contrat</TitreCarte>
        <form onSubmit={addStage} className="stage-formulaire">
          <Champ
            id={`${champId}-titre`}
            label="Titre du poste"
            type="text"
            value={newStage.titre}
            onChange={e => setNewStage({ ...newStage, titre: e.target.value })}
            placeholder="Ingénieur logiciel"
          />
          <Champ
            id={`${champId}-entreprise`}
            label="Entreprise"
            type="text"
            value={newStage.entreprise}
            onChange={e => setNewStage({ ...newStage, entreprise: e.target.value })}
            placeholder="Nom de l'employeur"
          />
          <div className="est-etroit">
            <Selection
              id={`${champId}-type`}
              label="Type"
              value={newStage.type}
              // Changer de régime réajuste le volume attendu : saisir « stage »
              // puis laisser 616 heures produisait une barre figée à 6 %.
              onChange={e => setNewStage({
                ...newStage,
                type: e.target.value,
                objectifHeures: REGIMES[e.target.value]?.heures ?? newStage.objectifHeures,
              })}
              aide={REGIMES[newStage.type]?.aide}
            >
              {Object.keys(REGIMES).map(regime => (
                <option key={regime} value={regime}>{regime}</option>
              ))}
            </Selection>
          </div>
          <div className="est-etroit">
            <Champ
              id={`${champId}-objectif`}
              label="Objectif (heures)"
              type="number"
              min={1}
              value={newStage.objectifHeures}
              onChange={e => setNewStage({ ...newStage, objectifHeures: parseInt(e.target.value, 10) || HEURES_MIN })}
            />
          </div>
          <Rang>
            <Bouton variante="primaire" type="submit">
              {enEdition ? 'Enregistrer les modifications' : 'Ajouter'}
            </Bouton>
            {enEdition && <Bouton onClick={annulerEdition}>Annuler</Bouton>}
          </Rang>
        </form>
      </Carte>

      <div className="stage-liste">
        {stages.length === 0 ? (
          <Carte>
            <EtatVide
              icone="💼"
              titre="Aucun contrat déclaré"
              texte="Déclare ton stage ou ton contrat d'apprentissage pour suivre les heures effectuées et les comparer au volume réglementaire."
            />
          </Carte>
        ) : stages.map(stage => {
          const heures = stage.heuresRealisees || 0;
          const objectif = Math.max(1, stage.objectifHeures || HEURES_MIN);
          const pourcent = Math.min(100, Math.round((heures / objectif) * 100));
          const atteint = heures >= objectif;

          return (
            <motion.div key={stage.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Carte className="stage-carte">
                <div className="stage-carte__fermer">
                  <BoutonIcone
                    libelle={`Modifier le contrat « ${stage.titre} »`}
                    onClick={() => modifierStage(stage)}
                  >
                    ✏️
                  </BoutonIcone>
                  <BoutonIcone
                    danger
                    libelle={`Supprimer le contrat « ${stage.titre} »`}
                    onClick={() => deleteStage(stage)}
                  >
                    ×
                  </BoutonIcone>
                </div>

                <div className="stage-carte__entete">
                  <div className="stage-carte__identite">
                    <h3 className="stage-carte__titre">{stage.titre}</h3>
                    <div className="stage-carte__employeur">{stage.entreprise}</div>
                  </div>
                  <Pastille ton="attention">{stage.type}</Pastille>
                </div>

                <div className="stage-progression">
                  <div className="stage-progression__chiffres">
                    <span>
                      Progression
                      {atteint && <strong className="stage-progression__atteint">objectif atteint</strong>}
                    </span>
                    <strong>{heures} h / {objectif} h · {pourcent} %</strong>
                  </div>
                  <Jauge
                    valeur={heures}
                    max={objectif}
                    ton={atteint ? 'succes' : 'attention'}
                    libelle={`Heures réalisées pour ${stage.titre}`}
                  />
                </div>

                <div className="stage-actions">
                  {/* Un clic de trop était irrattrapable : ni retrait, ni correction
                      du total. Le compteur est maintenant directement modifiable. */}
                  <div className="stage-compteur">
                    <Bouton onClick={() => addHours(stage, -1)} disabled={heures <= 0} aria-label="Retirer une heure">
                      −1 h
                    </Bouton>
                    <Bouton onClick={() => addHours(stage, 1)} aria-label="Ajouter une heure">
                      +1 h
                    </Bouton>
                    <Bouton onClick={() => addHours(stage, 7)} aria-label="Ajouter une journée de sept heures">
                      +7 h (journée)
                    </Bouton>
                    <input
                      type="number"
                      className="el-champ"
                      min="0"
                      value={heures}
                      onChange={e => setHeures(stage.id, parseInt(e.target.value, 10))}
                      aria-label={`Total d'heures réalisées pour ${stage.titre}`}
                      title="Corriger directement le total"
                    />
                  </div>

                  <div style={{ flex: 1 }} />

                  {stage.interrompu ? (
                    <div className="stage-interruption">
                      <span className="stage-interruption__etat">Contrat interrompu</span>
                      <Bouton
                        variante={stage.memoireRendu ? 'primaire' : 'secondaire'}
                        onClick={() => toggleMemoire(stage.id)}
                      >
                        {stage.memoireRendu ? 'Mémoire rendu' : 'Rendre le mémoire (substitution)'}
                      </Bouton>
                      <Bouton variante="fantome" onClick={() => toggleInterruption(stage)}>
                        Annuler l'interruption
                      </Bouton>
                    </div>
                  ) : (
                    <Bouton onClick={() => toggleInterruption(stage)}>
                      Déclarer une interruption
                    </Bouton>
                  )}
                </div>
              </Carte>
            </motion.div>
          );
        })}
      </div>

      <ConfirmModal
        isOpen={confirmAction !== null}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title={confirmModalProps?.title || 'Confirmer'}
        message={confirmModalProps?.message || 'Confirmer cette action ?'}
        confirmLabel={confirmModalProps?.confirmLabel || 'Confirmer'}
        danger={confirmModalProps?.danger || false}
      />
    </div>
  );
}

function getConfirmModalProps(action) {
  if (!action) return null;
  if (action.type === 'delete') {
    return {
      title: 'Supprimer le contrat',
      message: `Supprimer « ${action.nom} »${action.entreprise ? ` chez ${action.entreprise}` : ''} et son suivi d'heures ?`,
      confirmLabel: 'Supprimer',
      danger: true,
    };
  }
  if (action.type === 'interruption') {
    return {
      title: 'Déclarer une interruption',
      message: `Interrompre « ${action.nom} » ajoutera une tâche obligatoire de mémoire de substitution à chacun de tes plannings, jusqu'à ce qu'elle soit rendue. Continuer ?`,
      confirmLabel: 'Déclarer',
      danger: false,
    };
  }
  if (action.type === 'reprise') {
    return {
      title: "Annuler l'interruption",
      message: `Reprendre « ${action.nom} » ? La tâche de mémoire de substitution disparaîtra du planning et son statut sera réinitialisé.`,
      confirmLabel: 'Reprendre',
      danger: false,
    };
  }
  return null;
}
