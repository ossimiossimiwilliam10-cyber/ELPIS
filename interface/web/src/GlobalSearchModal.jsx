import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from './store';

function GlobalSearchModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { coursConfig, setActiveTab } = useStore();
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    } else {
      setQuery('');
    }
  }, [isOpen]);

  const results = React.useMemo(() => {
    if (!query.trim() || !coursConfig) return [];
    const lowerQ = query.toLowerCase();
    const res = [];
    
    coursConfig.licences?.forEach((l, lIndex) => {
      l.semestres?.forEach((s, sIndex) => {
        s.ues?.forEach((u, uIndex) => {
          u.matieres?.forEach((m, mIndex) => {
            m.listeCM?.forEach((cm, cmIndex) => {
              if (cm.titre.toLowerCase().includes(lowerQ) || (cm.notes && cm.notes.toLowerCase().includes(lowerQ))) {
                res.push({ type: 'CM', titre: cm.titre, matiere: m.nom, lIndex, sIndex, uIndex, mIndex, itemIndex: cmIndex });
              }
            });
            m.listeTD?.forEach((td, tdIndex) => {
              if (td.titre.toLowerCase().includes(lowerQ) || (td.notes && td.notes.toLowerCase().includes(lowerQ))) {
                res.push({ type: 'TD', titre: td.titre, matiere: m.nom, lIndex, sIndex, uIndex, mIndex, itemIndex: tdIndex });
              }
            });
            m.listeTP?.forEach((tp, tpIndex) => {
              if (tp.titre.toLowerCase().includes(lowerQ) || (tp.notes && tp.notes.toLowerCase().includes(lowerQ))) {
                res.push({ type: 'TP', titre: tp.titre, matiere: m.nom, lIndex, sIndex, uIndex, mIndex, itemIndex: tpIndex });
              }
            });
            m.listeAnnales?.forEach((annale, aIndex) => {
              if (annale.titre.toLowerCase().includes(lowerQ) || (annale.notes && annale.notes.toLowerCase().includes(lowerQ))) {
                res.push({ type: 'ANNALE', titre: annale.titre, matiere: m.nom, lIndex, sIndex, uIndex, mIndex, itemIndex: aIndex });
              }
            });
          });
        });
      });
    });
    return res.slice(0, 10);
  }, [query, coursConfig]);

  const handleSelect = (item) => {
    setIsOpen(false);
    setActiveTab('cours');
    // We emit an event so CoursPage can expand the right UI
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('elpisSearchSelect', { detail: item }));
    }, 100);
  };

  return (
    <AnimatePresence>
      {isOpen && (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 2000,
          paddingTop: '15vh'
        }}
        onClick={() => setIsOpen(false)}
      >
        <motion.div 
          initial={{ scale: 0.9, y: -20 }} 
          animate={{ scale: 1, y: 0 }} 
          exit={{ scale: 0.9, y: -20 }}
          style={{
            background: 'var(--bg-secondary)', width: '90%', maxWidth: '600px', 
            borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--bg-tertiary)', overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{display:'flex', alignItems:'center', padding:'1rem', borderBottom:'1px solid var(--bg-tertiary)'}}>
            <span style={{fontSize:'1.2rem', marginRight:'1rem', color:'var(--text-secondary)'}}>🔍</span>
            <input 
              ref={inputRef}
              type="text" 
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher un cours, une note (Ctrl+K)..."
              style={{
                flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', 
                fontSize: '1.2rem', outline: 'none'
              }}
            />
            <button className="btn-secondary" style={{padding:'0.2rem 0.5rem', fontSize:'0.8rem'}} onClick={() => setIsOpen(false)}>ESC</button>
          </div>
          
          {query.trim() && (
            <div style={{maxHeight:'400px', overflowY:'auto', padding:'0.5rem'}}>
              {results.length === 0 ? (
                <div style={{padding:'1rem', textAlign:'center', color:'var(--text-secondary)'}}>Aucun résultat trouvé.</div>
              ) : (
                <div style={{display:'flex', flexDirection:'column', gap:'0.2rem'}}>
                  {results.map((r, i) => (
                    <div 
                      key={i} 
                      onClick={() => handleSelect(r)}
                      className="search-result-item"
                      style={{
                        padding:'0.8rem 1rem', borderRadius:'8px', cursor:'pointer', 
                        display:'flex', alignItems:'center', justifyContent:'space-between',
                        transition:'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div>
                        <div style={{fontWeight:'bold', color:'var(--text-primary)'}}>{r.titre}</div>
                        <div style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}>{r.matiere}</div>
                      </div>
                      <div style={{background:'var(--bg-tertiary)', padding:'0.2rem 0.5rem', borderRadius:'4px', fontSize:'0.75rem'}}>
                        {r.type}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}

export default GlobalSearchModal;
