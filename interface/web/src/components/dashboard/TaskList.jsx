import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { DIFFICULTY_LEVELS } from '../../constants';

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0 } };

/**
 * Liste des tâches du jour avec drag-and-drop.
 */
export default function TaskList({ orderedTaches, onDragEnd, onTaskComplete, onSuspendCM }) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="taches">
        {(provided) => (
          <motion.div
            className="todo-list"
            variants={containerVariants}
            initial="hidden" animate="show"
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{display:'flex', flexDirection:'column', gap:'0.8rem', marginTop:'1rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem'}}
          >
            <AnimatePresence>
              {orderedTaches?.map((t, index) => {
                const dragId = t.matiere + t.titre + index;
                return (
                  <Draggable key={dragId} draggableId={dragId} index={index}>
                    {(provided) => (
                      <motion.div
                        variants={itemVariants}
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="todo-item"
                        style={{ marginLeft: '20px' }}
                      >
                        <div className="timeline-connector"></div>
                        <div className="timeline-dot"></div>
                        <div style={{flex: 1}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--text-primary)'}}>
                            <span style={{
                              background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                              padding: '0.1rem 0.4rem', borderRadius: '6px', fontSize: '0.8rem',
                              fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.05)'
                            }}>#{index + 1}</span>
                            {t.titre}
                          </div>
                          <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                            {t.matiere} • {t.type}
                            {t.moment === 'matin' && <span style={{marginLeft: '0.5rem', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem'}}>🌅 Matin</span>}
                            {t.moment === 'aprem' && <span style={{marginLeft: '0.5rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem'}}>☀️ Après-midi</span>}
                            {t.moment === 'soir' && <span style={{marginLeft: '0.5rem', background: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem'}}>🌙 Soir</span>}
                          </div>
                        </div>
                        <div className="todo-item-actions">
                          <div style={{background:'var(--bg-tertiary)', padding:'0.3rem 0.6rem', borderRadius:'6px', fontSize:'0.8rem'}}>
                            ~{t.dureeMinutes || 0} min
                          </div>
                          <button
                            onClick={() => onTaskComplete(t)}
                            style={{
                              background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success-color)',
                              border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px',
                              cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s',
                              whiteSpace: 'nowrap', flexShrink: 0
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.4)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'}
                          >
                            Fait
                          </button>
                          {t.type !== 'CM' && DIFFICULTY_LEVELS?.map(dl => (
                            <button key={dl.key} onClick={() => onTaskComplete(t, dl.key)}
                              title={dl.title}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '0.1rem', flexShrink: 0, opacity: 0.7, transition: 'opacity 0.2s' }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                            >{dl.label}</button>
                          ))}
                          {t.type === 'CM' && (
                            <button onClick={() => onSuspendCM(t)}
                              style={{
                                background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b',
                                border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.4rem 0.8rem',
                                borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold',
                                transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.8rem'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.3)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)'}
                              title="Clôturer la séance sans terminer le CM — il reviendra demain"
                            >⏸️ Suspendre</button>
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
