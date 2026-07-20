import React, { useState } from 'react';

const AddCourseForm = ({ onAdd }) => {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim() && subject.trim()) {
      onAdd(name, subject);
      setName('');
      setSubject('');
    }
  };

  return (
    <div className="glass-card" style={{ marginBottom: '2rem' }}>
      <h2>Ajouter une révision</h2>
      <form onSubmit={handleSubmit}>
        <input 
          type="text" 
          placeholder="Nom du cours ou de la notion (ex: Mitochondrie)" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          required 
        />
        <input 
          type="text" 
          placeholder="Matière (ex: Biologie)" 
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required 
        />
        <button type="submit">Commencer la méthode des J</button>
      </form>
    </div>
  );
};

export default AddCourseForm;
