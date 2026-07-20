import React from 'react';
import { formatDate, J_INTERVALS } from '../utils/jMethod';

const CourseCard = ({ course, onDone, onDelete, isDue }) => {
  const { name, subject, nextRevisionDate, currentStepIndex } = course;
  
  const currentJ = J_INTERVALS[currentStepIndex];
  
  return (
    <div className="glass-card course-item">
      <div className="course-info">
        <h3>{name}</h3>
        <p>{subject}</p>
        <div>
          {isDue ? (
            <span className="status-badge status-today">
              Révision J{currentJ} Aujourd'hui
            </span>
          ) : (
            <span className="status-badge status-future">
              Prochaine (J{currentJ}) : {formatDate(nextRevisionDate)}
            </span>
          )}
        </div>
      </div>
      
      <div className="actions">
        {isDue && (
          <button 
            className="btn-icon btn-done" 
            onClick={() => onDone(course.id)}
            title="Marquer comme révisé"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
        )}
        <button 
          className="btn-icon" 
          onClick={() => onDelete(course.id)}
          title="Supprimer"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default CourseCard;
