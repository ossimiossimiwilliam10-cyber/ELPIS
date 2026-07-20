import { useState, useEffect } from 'react';
import { getNextRevisionDate, isDueTodayOrPast, J_INTERVALS } from '../utils/jMethod';

export const useRevisions = () => {
  const [courses, setCourses] = useState(() => {
    const saved = localStorage.getItem('revision_courses');
    return saved ? JSON.parse(saved) : [];
  });

  // Sauvegarder dans le localStorage à chaque modification
  useEffect(() => {
    localStorage.setItem('revision_courses', JSON.stringify(courses));
  }, [courses]);

  const addCourse = (name, subject) => {
    const newCourse = {
      id: crypto.randomUUID(),
      name,
      subject,
      startDate: new Date().toISOString(),
      currentStepIndex: 0,
      nextRevisionDate: getNextRevisionDate(new Date(), 0).toISOString(),
      completed: false
    };
    setCourses([...courses, newCourse]);
  };

  const markRevisionDone = (courseId) => {
    setCourses(courses.map(course => {
      if (course.id === courseId) {
        const nextIndex = course.currentStepIndex + 1;
        const nextDate = getNextRevisionDate(course.startDate, nextIndex);
        
        return {
          ...course,
          currentStepIndex: nextIndex,
          nextRevisionDate: nextDate ? nextDate.toISOString() : null,
          completed: !nextDate // Si plus de date, la méthode des 6 ans est finie
        };
      }
      return course;
    }));
  };

  const deleteCourse = (courseId) => {
    setCourses(courses.filter(c => c.id !== courseId));
  };

  // Filtrer les cours
  const dueCourses = courses.filter(c => !c.completed && isDueTodayOrPast(c.nextRevisionDate));
  const upcomingCourses = courses.filter(c => !c.completed && !isDueTodayOrPast(c.nextRevisionDate))
                                 .sort((a, b) => new Date(a.nextRevisionDate) - new Date(b.nextRevisionDate));
  const completedCourses = courses.filter(c => c.completed);

  return {
    courses,
    dueCourses,
    upcomingCourses,
    completedCourses,
    addCourse,
    markRevisionDone,
    deleteCourse
  };
};
