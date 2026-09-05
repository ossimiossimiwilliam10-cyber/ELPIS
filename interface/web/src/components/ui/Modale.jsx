import { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/** Éléments capables de recevoir le focus, dans l'ordre du document. */
const FOCUSABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Fenêtre modale accessible.
 *
 * Chaque page avait sa propre boîte flottante : certaines sans rôle ARIA, sans
 * fermeture au clavier, et laissant le focus filer dans la page derrière. Cette
 * brique impose partout : rôle `dialog`, titre lié, Échap, clic sur le fond,
 * focus initial et focus piégé tant que la fenêtre est ouverte.
 */
export default function Modale({ ouverte, onFermer, titre, largeur = 520, children }) {
  const panneauRef = useRef(null);
  const declencheurRef = useRef(null);
  const titreId = useId();

  useEffect(() => {
    if (!ouverte) return undefined;

    // Mémoriser d'où l'on vient : à la fermeture, le focus doit y revenir,
    // sinon il repart au début du document.
    declencheurRef.current = document.activeElement;

    const surTouche = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onFermer();
        return;
      }
      if (e.key !== 'Tab') return;

      const cibles = panneauRef.current?.querySelectorAll(FOCUSABLES);
      if (!cibles?.length) return;
      const premier = cibles[0];
      const dernier = cibles[cibles.length - 1];

      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier.focus();
      }
    };

    // Sur `window` plutôt que `document` : un événement émis sur window ne
    // redescend pas jusqu'à document, alors que l'inverse remonte toujours.
    window.addEventListener('keydown', surTouche);
    // Premier champ utile plutôt que le panneau lui-même.
    panneauRef.current?.querySelector(FOCUSABLES)?.focus();

    return () => {
      window.removeEventListener('keydown', surTouche);
      declencheurRef.current?.focus?.();
    };
  }, [ouverte, onFermer]);

  return (
    <AnimatePresence>
      {ouverte && (
        <motion.div
          className="el-modale__fond"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}
        >
          <motion.div
            ref={panneauRef}
            className="el-modale"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titreId}
            style={{ maxWidth: `${largeur}px` }}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <h2 id={titreId} className="el-modale__titre">{titre}</h2>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
