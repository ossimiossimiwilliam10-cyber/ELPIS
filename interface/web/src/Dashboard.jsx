import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import useStore, { useChronoStore } from './store';
import { useWorkloadEngine } from './useWorkloadEngine';
import { useToast } from './ToastProvider';
import { useSoundEffects } from './hooks/useSoundEffects';
import { useTaskCompletion } from './hooks/useTaskCompletion';
import { useDashboardStats } from './hooks/useDashboardStats';
import TaskCompletionModal from './components/TaskCompletionModal';
import ConfirmModal from './components/ConfirmModal';
import AuditDashboard from './components/AuditDashboard';
import WelcomeCard from './components/dashboard/WelcomeCard';
import TaskList from './components/dashboard/TaskList';
import CustomTaskModal from './components/dashboard/CustomTaskModal';
import { resumerCursus } from './utils/cursus';
import InsightsPanel from './components/dashboard/InsightsPanel';
import ProjectsWidget from './components/dashboard/ProjectsWidget';
import StatsSection from './components/dashboard/StatsSection';
import BarreActions from './components/dashboard/BarreActions';
import ChargeDuJour from './components/dashboard/ChargeDuJour';
import Progression from './components/dashboard/Progression';
import VitesseExamen from './components/dashboard/VitesseExamen';
import Couverture from './components/dashboard/Couverture';
import { getApiUrl } from './utils/apiConfig';
import { getTodayStr, isFromToday } from './utils/dateUtils';
import { buildTaskKey, isSameTask } from './utils/taskKey';
import { useICalExport } from './hooks/useICalExport';
import { Bouton, Carte, EtatVide, Jauge, Rang, TitreCarte } from './components/ui';

function Dashboard() {
  const {
    config, coursConfig, loading: storeLoading, historique, projets,
    orchestratorData, fetchOrchestrator, intelligence, pendingTasksCount,
    dailyFillGap, setDailyFillGap, setConfig, addHistoriqueEntry,
    activateRestDay, activateExtendedRestDay, declineExtendedRestDay, setActiveTab
  } = useStore();

  const { completeTask, suspendCM } = useTaskCompletion();
  const { stats, globalPercent, allMatieres, restDaysUsed, todayStr, isRestDayToday, tempsTravailleToday } = useDashboardStats();
  const charge = useWorkloadEngine();
  const { toast } = useToast();
  const { playTaskComplete } = useSoundEffects();
  const { exportToICal } = useICalExport(orchestratorData);

  const [orderedTaches, setOrderedTaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [extraTime, setExtraTime] = useState(0);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [pendingTask, setPendingTask] = useState(null);
  const taskModalLockRef = useRef(false);
  const [customTaskModalOpen, setCustomTaskModalOpen] = useState(false);
  const [customTaskParams, setCustomTaskParams] = useState({ titre: '', type: 'PERSO', matiere: '' });
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [acceptedRest, setAcceptedRest] = useState(false);
  const [restDayConfirmOpen, setRestDayConfirmOpen] = useState(false);

  // ---- Orchestrator fetch ----
  useEffect(() => {
    const doFetch = async () => {
      try {
        await fetchOrchestrator({ extraTime, fillGap: dailyFillGap });
      } catch (err) {
        toast.error("Impossible de charger le planning. Vérifie que le serveur est lancé.");
      } finally {
        setLoading(false);
      }
    };
    doFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraTime, dailyFillGap, fetchOrchestrator]);

  // Mémorisé dans une ref plutôt que dans un state : ce marqueur sert à détecter un
  // nouveau rapport, il n'a pas à provoquer de rendu supplémentaire.
  const prevOrchestratorData = useRef(null);
  useEffect(() => {
    if (orchestratorData && orchestratorData !== prevOrchestratorData.current) {
      prevOrchestratorData.current = orchestratorData;
      if (orchestratorData?.tachesDuJour) {
        // L'historique ne porte pas d'identifiant de tâche : on reconstruit la même
        // clé stable que l'orchestrateur (type::matiere::titre) pour écarter ce qui
        // a déjà été validé aujourd'hui.
        const alreadyDoneIds = new Set(
          (historique || [])
            .filter(h => isFromToday(h, todayStr))
            .map(h => buildTaskKey(h))
        );

        const filtered = orchestratorData.tachesDuJour.filter(t => {
          if (t.type === 'ANKI' && config?.dernierePratiqueAnki === todayStr) return false;
          if (alreadyDoneIds.has(t.id || buildTaskKey(t))) return false;
          return true;
        });

        const savedOrderStr = sessionStorage.getItem(`elpis_task_order_${todayStr}`);
        if (savedOrderStr) {
          try {
            const savedOrder = JSON.parse(savedOrderStr);
            filtered.sort((a, b) => {
              const idxA = savedOrder.indexOf(a.id || buildTaskKey(a));
              const idxB = savedOrder.indexOf(b.id || buildTaskKey(b));
              if (idxA !== -1 && idxB !== -1) return idxA - idxB;
              if (idxA !== -1) return -1;
              if (idxB !== -1) return 1;
              return 0;
            });
          } catch {
            // Ordre sauvegardé illisible : on garde celui calculé par l'orchestrateur.
          }
        }

        setOrderedTaches(filtered);
      }
    }
  }, [orchestratorData, config?.dernierePratiqueAnki, todayStr, historique]);

  // ---- Actions ----
  const handleAddExtraTime = () => setExtraTime(prev => prev + 30);

  const handleSkipRest = async () => {
    try {
      const apiBase = getApiUrl();
      const res = await fetch(`${apiBase}/config/skip-rest`, { method: 'POST' });
      if (res.ok) {
        toast.success("Jour de repos ignoré ! Reprise du travail.");
        await fetchOrchestrator({ fillGap: dailyFillGap, extraTime });
      } else {
        toast.error("Erreur lors de l'annulation du repos.");
      }
    } catch { toast.error("Erreur serveur."); }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(orderedTaches);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setOrderedTaches(items);
    sessionStorage.setItem(
      `elpis_task_order_${todayStr}`,
      JSON.stringify(items.map(t => t.id || buildTaskKey(t)))
    );
  };

  const handleCustomTaskSubmit = () => {
    if (!customTaskParams.titre.trim()) { toast.error("Veuillez entrer un titre."); return; }
    if (!customTaskParams.matiere) { toast.error("Veuillez sélectionner une matière."); return; }
    const newTask = { id: 'custom-' + Date.now(), titre: customTaskParams.titre, type: customTaskParams.type, matiereNom: customTaskParams.matiere, isCustom: true, dureeMinutes: 30 };
    useChronoStore.getState().startGlobalChrono(newTask);
    setCustomTaskModalOpen(false);
    toast.info("Chronomètre lancé pour l'activité libre !");
  };

  // ---- Task completion flow ----
  const handleTaskComplete = (tache, difficulteKey) => {
    if (tache.type === 'ANKI') {
      const today = getTodayStr();
      setConfig({ ...config, dernierePratiqueAnki: today });
      setOrderedTaches(prev => prev.filter(t => !isSameTask(t, tache)));
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#818CF8', '#34D399', '#FBBF24'] });
      playTaskComplete();
      addHistoriqueEntry({ type: 'ANKI', titre: tache.titre, matiere: tache.matiere, action: 'Terminé', dureeMinutes: tache.dureeMinutes || config?.defaultDurationAnki || 30 });
      useStore.getState().notifyTaskCompleted?.();
      return;
    }

    if (taskModalLockRef.current) {
      toast.info("Termine d'abord l'activité en cours avant d'en commencer une autre.");
      return;
    }
    taskModalLockRef.current = true;
    setPendingTask({ ...tache, difficulteKey });
    setTaskModalOpen(true);
  };

  const handleTaskSubmit = useCallback(({ minutes, sm2Score, difficulte, note }) => {
    if (!pendingTask) return;
    const tache = pendingTask;
    const finalDifficulte = difficulte || tache.difficulteKey;

    const success = completeTask(tache, { minutes, sm2Score, difficulte: finalDifficulte, note }, () => {
      setOrderedTaches(prev => prev.filter(t => !isSameTask(t, tache)));
      playTaskComplete();
    });

    if (!success) toast.error(`Tâche "${tache.titre}" introuvable.`);

    setPendingTask(null);
    setTaskModalOpen(false);
    taskModalLockRef.current = false;
  }, [pendingTask, completeTask, playTaskComplete, toast]);

  const handleSuspendCM = useCallback((tache) => {
    suspendCM(tache, config?.defaultDurationRevCM || 30);
    setOrderedTaches(prev => prev.filter(t => !isSameTask(t, tache)));
    toast.success(`Séance suspendue — « ${tache.titre} » reviendra demain.`);
  }, [suspendCM, config, toast]);

  // ---- Dynamic greeting ----
  const hour = new Date().getHours();
  let greeting = 'Bonsoir';
  if (hour >= 5 && hour < 12) greeting = 'Bonjour';
  else if (hour >= 12 && hour < 18) greeting = 'Bon après-midi';

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="tdb-squelette" role="status" aria-label="Chargement de ta journée">
        <div className="skeleton skeleton-text" style={{ height: '28px', width: '40%' }} />
        <div className="tdb-squelette__ligne">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="tdb-squelette__mesure">
              <div className="skeleton skeleton-circle" style={{ width: '36px', height: '36px' }} />
              <div className="skeleton skeleton-text" style={{ width: '48px', height: '12px' }} />
            </div>
          ))}
        </div>
        <div className="skeleton skeleton-card" style={{ height: '200px' }} />
        <div className="skeleton skeleton-card" style={{ height: '140px', width: '65%' }} />
      </div>
    );
  }

  if (!orchestratorData || orchestratorData.error) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Carte>
          <EtatVide
            icone="🌱"
            titre={`${greeting} ! Bienvenue sur ELPIS`}
            texte="Configure tes objectifs et tes cours pour activer le Planificateur : il construira ensuite ta session de travail chaque matin."
            actions={
              <Bouton variante="primaire" grand onClick={() => useStore.getState().setActiveTab('cours')}>
                Ouvrir la Bibliothèque
              </Bouton>
            }
          />
        </Carte>
      </motion.div>
    );
  }

  const { statut, tempsDispoMin, tempsRequisMin, tempsEnSouffranceMin, nbEnSouffrance, retardMaxJours } = orchestratorData;
  const surcharge = statut === "SURCHARGE";
  const enRepos = statut === "REPOS" || statut === "REPOS_OPTIONNEL";
  /*
   * Deux chiffres pour la même journée coexistaient sur cet écran : la tuile
   * « Travaillé » de la carte d'accueil sommait les seules durées enregistrées,
   * quand cette barre lisait un total où le moteur avait glissé des replis par
   * type. Une journée de cinq séances dont quatre sans durée affichait 0,8 h à
   * quelques centimètres de 3 h 05. Les deux se lisent désormais sur la mesure ;
   * l'estimation est dite à part, pour ce qu'elle est.
   */
  const travailleMin = orchestratorData.tempsDejaTravailleMin || 0;
  const estimeMin = orchestratorData.tempsEstimeSansDureeMin || 0;
  const seancesSansDuree = orchestratorData.seancesSansDuree || 0;

  /*
   * « Tout est terminé » et « rien n'a encore été saisi » se ressemblent à
   * l'écran — zéro tâche dans les deux cas — et se confondaient. Le jour de la
   * rentrée, l'application félicitait donc d'avoir accompli une journée qui
   * n'avait jamais existé.
   */
  const { nbCours, nbExercices } = resumerCursus(coursConfig);
  const cursusSansContenu = (nbCours + nbExercices) === 0;

  // ---- Render ----
  return (
    <motion.div className="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {config && !config.inscriptionPedagogiqueDone && (
        <motion.div className="tdb-rappel" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <div className="tdb-rappel__texte">
            <strong>Inscription pédagogique à finaliser.</strong> Elle se fait sur le site de l'université
            et conditionne l'accès aux examens.
          </div>
          <Bouton onClick={() => setConfig({ ...config, inscriptionPedagogiqueDone: true })}>
            C'est fait
          </Bouton>
        </motion.div>
      )}

      <WelcomeCard
        greeting={greeting}
        orderedTaches={orderedTaches}
        recommendedDailyHours={charge.capacite}
        tempsRequisMin={tempsRequisMin}
        globalPercent={globalPercent}
        config={config}
        tempsTravailleToday={tempsTravailleToday}
        cursusSansContenu={cursusSansContenu}
      />

      {/* Un programme qui déborde ne doit pas allonger les journées : c'est le
          périmètre qu'il faut revoir, et c'est une décision, pas un automatisme. */}
      {!charge.tientDansLeTemps && (
        <div className="tdb-rappel">
          <div className="tdb-rappel__texte">
            <strong>Le programme ne tient pas dans le temps que tu t'es donné.</strong>{' '}
            Il resterait environ {Math.round(charge.restantes)} h à couvrir en{' '}
            {charge.joursRestants} jours, soit {charge.parJourNecessaire.toFixed(1)} h par jour
            contre {charge.capacite} h déclarées. Augmente ta capacité dans les Réglages,
            ou accepte de resserrer le périmètre.
          </div>
          <Bouton onClick={() => setActiveTab('config')}>Ajuster</Bouton>
        </div>
      )}

      <BarreActions
        onActiviteLibre={() => {
          setCustomTaskParams({ titre: '', type: 'PERSO', matiere: allMatieres[0] || '' });
          setCustomTaskModalOpen(true);
        }}
        onJourRepos={() => setRestDayConfirmOpen(true)}
        reposDisponible={statut !== 'REPOS' && !isRestDayToday}
        reposUtilises={restDaysUsed}
        onExportPdf={() => window.print()}
        onExportIcal={exportToICal}
      />

      <div className="dashboard-grid">
        {/* Programme de la journée */}
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
          <Carte>
            <TitreCarte>Objectifs du jour</TitreCarte>

            {tempsDispoMin > 0 && !enRepos && (
              <div className="tdb-progression">
                <div className="tdb-progression__chiffres">
                  <span>
                    <strong>{Math.floor(travailleMin / 60)}h{String(travailleMin % 60).padStart(2, '0')}</strong> travaillées
                  </span>
                  <span>
                    objectif <strong>{Math.floor(tempsDispoMin / 60)}h{String(tempsDispoMin % 60).padStart(2, '0')}</strong>
                  </span>
                </div>
                <Jauge
                  valeur={travailleMin}
                  max={tempsDispoMin}
                  ton={travailleMin >= tempsDispoMin ? 'succes' : undefined}
                  libelle="Progression de la journée"
                />
                {seancesSansDuree > 0 && (
                  <p className="tdb-progression__note">
                    {seancesSansDuree} séance{seancesSansDuree > 1 ? 's' : ''} sans durée enregistrée,
                    estimée{seancesSansDuree > 1 ? 's' : ''} à {Math.floor(estimeMin / 60)}h{String(estimeMin % 60).padStart(2, '0')}
                    {' '}d’après tes réglages — comptées dans le budget, pas dans la mesure.
                  </p>
                )}
              </div>
            )}

            {enRepos ? (
              <EtatVide
                icone="☕"
                titre="Journée de repos"
                texte={orchestratorData.message}
                actions={
                  <Rang serre>
                    {/* La condition exigeait `surcharge && statut === 'REPOS'`,
                        soit le statut égal à deux valeurs à la fois : elle était
                        toujours fausse et ce bouton n'apparaissait jamais. */}
                    {statut === 'REPOS' && (
                      <Bouton variante="primaire" onClick={handleAddExtraTime}>
                        J'ai encore de l'énergie (+30 min)
                      </Bouton>
                    )}
                    {statut === 'REPOS_OPTIONNEL' && !acceptedRest && (
                      <>
                        <Bouton variante="primaire" onClick={handleSkipRest}>
                          Je préfère travailler
                        </Bouton>
                        <Bouton onClick={() => { setAcceptedRest(true); toast.success('Bon repos !'); }}>
                          Me reposer
                        </Bouton>
                      </>
                    )}
                  </Rang>
                }
              />
            ) : orderedTaches.length === 0 && cursusSansContenu ? (
              <EtatVide
                icone="📚"
                titre="Ton programme attend son contenu"
                texte="Tes matières sont en place, mais aucun cours ni exercice n'y figure encore. Ajoute tes premiers chapitres dans la Bibliothèque : le planificateur construira ta journée dès qu'il aura de quoi travailler."
                actions={
                  <Rang serre>
                    <Bouton variante="primaire" onClick={() => setActiveTab('cours')}>
                      Ouvrir la Bibliothèque
                    </Bouton>
                  </Rang>
                }
              />
            ) : orderedTaches.length === 0 ? (
              <EtatVide
                icone="✨"
                titre="Tout est terminé !"
                texte="Tu as accompli toutes tes tâches pour aujourd'hui. Le temps qui reste t'appartient."
                actions={
                  <Rang serre>
                    {surcharge && (
                      <Bouton variante="primaire" onClick={handleAddExtraTime}>
                        J'ai encore de l'énergie (+30 min)
                      </Bouton>
                    )}
                    {!dailyFillGap && (
                      <Bouton
                        variante={surcharge ? 'secondaire' : 'primaire'}
                        onClick={() => { setDailyFillGap(true); toast.info('Recherche de tâches supplémentaires…'); }}
                      >
                        Demander plus de tâches
                      </Bouton>
                    )}
                  </Rang>
                }
              />
            ) : (
              <TaskList orderedTaches={orderedTaches} onDragEnd={onDragEnd} onTaskComplete={handleTaskComplete} onSuspendCM={handleSuspendCM} />
            )}
          </Carte>
        </motion.div>

        <ChargeDuJour
          tempsRequisMin={tempsRequisMin}
          tempsDispoMin={tempsDispoMin}
          surcharge={surcharge}
          arriereMin={tempsEnSouffranceMin}
          nbEnSouffrance={nbEnSouffrance}
          retardMaxJours={retardMaxJours}
        />
      </div>

      <Progression objectifs={orchestratorData.objectifs} />
      <Couverture couverture={orchestratorData.couverture} />
      <VitesseExamen vitesse={orchestratorData.vitesse} />
      <InsightsPanel intelligence={intelligence} />
      <ProjectsWidget projets={projets} pendingTasksCount={pendingTasksCount} />
      <StatsSection stats={stats} globalPercent={globalPercent} />

      <div className="tdb-pied">
        <button type="button" onClick={() => setAuditModalOpen(true)} title="Voir le rapport de santé du code">
          Santé du code
        </button>
      </div>

      {/* Modals */}
      <TaskCompletionModal isOpen={taskModalOpen} onClose={() => { setTaskModalOpen(false); setPendingTask(null); taskModalLockRef.current = false; }}
        onSubmit={handleTaskSubmit} taskTitle={pendingTask?.titre || ''}
        defaultMinutes={pendingTask?.dureeMinutes || (config?.defaultDurationRevCM || 30)} taskType={pendingTask?.type || 'CM'} />

      <CustomTaskModal
        isOpen={customTaskModalOpen}
        onClose={() => setCustomTaskModalOpen(false)}
        params={customTaskParams}
        setParams={setCustomTaskParams}
        onSubmit={handleCustomTaskSubmit}
        allMatieres={allMatieres}
      />

      <AuditDashboard isOpen={auditModalOpen} onClose={() => setAuditModalOpen(false)} />

      {/* Jour de repos : même modale accessible que partout ailleurs (Échap, focus piégé) */}
      <ConfirmModal
        isOpen={restDayConfirmOpen}
        onConfirm={() => {
          activateRestDay();
          setRestDayConfirmOpen(false);
          toast.success('Jour de repos activé. Bon repos !');
        }}
        onCancel={() => setRestDayConfirmOpen(false)}
        title="Activer un jour de repos ?"
        message={`Il te reste ${1 - restDaysUsed} jour${1 - restDaysUsed > 1 ? 's' : ''} de repos pour cette semaine.\nTa série ne sera pas brisée.`}
        confirmLabel="Confirmer"
      />
    </motion.div>
  );
}

export default Dashboard;
