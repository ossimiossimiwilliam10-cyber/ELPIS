import React, { useState } from 'react';
import { useRevisions } from './hooks/useRevisions';
import AddCourseForm from './components/AddCourseForm';
import CourseCard from './components/CourseCard';

function App() {
  const { 
    dueCourses, 
    upcomingCourses, 
    addCourse, 
    markRevisionDone, 
    deleteCourse 
  } = useRevisions();

  const [activeTab, setActiveTab] = useState('today'); // 'today' or 'upcoming'

  return (
    <>
      <div className="dashboard-header">
        <h1>Méthode des J</h1>
        <p>Maîtrisez vos connaissances sur le long terme.</p>
      </div>

      <AddCourseForm onAdd={addCourse} />

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'today' ? 'active' : ''}`}
          onClick={() => setActiveTab('today')}
        >
          À faire aujourd'hui ({dueCourses.length})
        </button>
        <button 
          className={`tab ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          À venir ({upcomingCourses.length})
        </button>
      </div>

      <div className="course-list">
        {activeTab === 'today' && (
          dueCourses.length > 0 ? (
            dueCourses.map(course => (
              <CourseCard 
                key={course.id} 
                course={course} 
                onDone={markRevisionDone} 
                onDelete={deleteCourse}
                isDue={true}
              />
            ))
          ) : (
            <div className="glass-card empty-state">
              <h3>Tout est à jour ! 🎉</h3>
              <p>Vous n'avez aucune révision prévue pour aujourd'hui.</p>
            </div>
          )
        )}

        {activeTab === 'upcoming' && (
          upcomingCourses.length > 0 ? (
            upcomingCourses.map(course => (
              <CourseCard 
                key={course.id} 
                course={course} 
                onDone={markRevisionDone} 
                onDelete={deleteCourse}
                isDue={false}
              />
            ))
          ) : (
            <div className="glass-card empty-state">
              <h3>Aucune révision à venir</h3>
              <p>Ajoutez un nouveau cours pour commencer la méthode des J.</p>
            </div>
          )
        )}
      </div>
    </>
  );
}

export default App;
