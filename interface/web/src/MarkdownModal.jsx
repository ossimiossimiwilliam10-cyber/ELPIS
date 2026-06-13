import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';

function MarkdownModal({ isOpen, onClose, initialValue, onSave, title }) {
  const [val, setVal] = useState(initialValue || "");
  const [mode, setMode] = useState('edit');

  useEffect(() => {
    setVal(initialValue || "");
    setMode('edit');
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }} 
          animate={{ scale: 1, y: 0 }} 
          exit={{ scale: 0.9, y: 20 }}
          style={{
            background: 'var(--bg-secondary)', width: '90%', maxWidth: '800px', 
            borderRadius: '12px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--bg-tertiary)', display: 'flex', flexDirection: 'column', gap: '1rem'
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap: 'wrap', gap:'1rem'}}>
            <h2 style={{margin: 0, flex: 1}}>{title || "Éditer les Notes"}</h2>
            <div style={{display:'flex', gap:'0.5rem'}}>
              <button 
                className={`btn-secondary ${mode === 'edit' ? 'active' : ''}`} 
                onClick={() => setMode('edit')}
                style={{opacity: mode === 'edit' ? 1 : 0.6, padding: '0.4rem 1rem'}}
              >Éditer</button>
              <button 
                className={`btn-secondary ${mode === 'preview' ? 'active' : ''}`} 
                onClick={() => setMode('preview')}
                style={{opacity: mode === 'preview' ? 1 : 0.6, padding: '0.4rem 1rem'}}
              >Aperçu (Markdown)</button>
            </div>
          </div>
          
          <div style={{flex: 1, minHeight: '400px', border: '1px solid var(--bg-tertiary)', borderRadius: '8px', overflow: 'hidden'}}>
            {mode === 'edit' ? (
              <textarea 
                value={val} 
                onChange={e => setVal(e.target.value)}
                style={{
                  width: '100%', height: '400px', padding: '1rem', background: 'rgba(0,0,0,0.2)', 
                  border: 'none', color: 'var(--text-primary)', resize: 'none', fontFamily: 'monospace',
                  fontSize: '0.95rem'
                }}
                placeholder="Utilisez le Markdown (**, #, -, etc.)..."
              />
            ) : (
              <div style={{padding: '1rem', height: '400px', overflowY: 'auto', background: 'rgba(0,0,0,0.1)'}} className="markdown-preview">
                {val ? <ReactMarkdown>{val}</ReactMarkdown> : <span style={{color:'var(--text-secondary)'}}>Aucune note</span>}
              </div>
            )}
          </div>
          
          <div style={{display:'flex', justifyContent:'flex-end', gap:'1rem', marginTop:'1rem'}}>
            <button className="btn-secondary" onClick={onClose}>Annuler</button>
            <button className="btn-primary" onClick={() => { onSave(val); onClose(); }}>Enregistrer</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default MarkdownModal;
