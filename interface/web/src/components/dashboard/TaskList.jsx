import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { buildTaskKey } from '../../utils/taskKey';
import { couleurType, tonType, Pastille } from '../ui';

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0 } };

/** Moment conseillé dans la journée, selon la chronobiologie du planificateur. */
const MOMENTS = {
  matin: { libelle: 'Matin', icone: '🌅' },
  aprem: { libelle: 'Après-midi', icone: '☀️' },
  soir:  { libelle: 'Soir', icone: '🌙' },
};

/**
 * Liste ordonnée des tâches du jour, réorganisable au glisser-déposer.
 *
 * Chaque ligne porte la couleur de son type d'activité et, quand le
 * planificateur en fournit, les motifs qui l'ont fait remonter dans l'ordre.
 */
export default function TaskList({ orderedTaches, onDragEnd, onTaskComplete, onSuspendCM }) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="taches">
        {(provided) => (
          <motion.div
            className="liste-taches"
            variants={containerVariants}
            initial="hidden" animate="show"
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            <AnimatePresence>
              {orderedTaches?.map((t, index) => {
                // L'identifiant doit rester stable au réordonnancement : y inclure
                // l'index remonte des ids différents après chaque glisser-déposer,
                // ce qui démonte puis remonte les éléments au lieu de les déplacer.
                const dragId = t.id || buildTaskKey(t);
                const moment = MOMENTS[t.moment];
                const motifs = t.explication?.raisons || [];

                return (
                  <Draggable key={dragId} draggableId={dragId} index={index}>
                    {(provided, snapshot) => (
                      <motion.div
                        variants={itemVariants}
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`tache${snapshot.isDragging ? ' est-saisie' : ''}`}
                        style={{ '--liseré': couleurType(t.type), ...provided.draggableProps.style }}
                      >
                        <span className="tache__rang el-mono" aria-hidden="true">{index + 1}</span>

                        <div className="tache__corps">
                          <div className="tache__titre">{t.titre}</div>

                          <div className="tache__meta">
                            <Pastille ton={tonType(t.type)}>{t.type}</Pastille>
                            <span className="tache__matiere">{t.matiere}</span>
                            {moment && (
                              <span className="tache__moment">
                                <span aria-hidden="true">{moment.icone}</span> {moment.libelle}
                              </span>
                            )}
                          </div>

                          {/* Motifs issus du calcul de priorité : ils disent
                              pourquoi cette tâche figure ici, et à ce rang. */}
                          {motifs.length > 0 && (
                            <div className="tache__motifs" title={`Priorité ${t.priorite ?? '—'} sur 100`}>
                              {motifs.join(' · ')}
                            </div>
                          )}
                        </div>

                        <div className="tache__actions">
                          <span className="tache__duree el-mono">~{t.dureeMinutes || 0} min</span>

                          <button
                            type="button"
                            className="el-bouton el-bouton--primaire tache__valider"
                            onClick={() => onTaskComplete(t)}
                          >
                            Fait
                          </button>

                          {t.type === 'CM' && (
                            <button
                              type="button"
                              className="el-bouton el-bouton--secondaire"
                              onClick={() => onSuspendCM(t)}
                              title="Clôturer la séance sans terminer le cours — il reviendra demain"
                            >
                              ⏸️ Suspendre
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </Draggable>
                );
              })}
            </AnimatePresence>
            {provided.placeholder}
          </motion.div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
