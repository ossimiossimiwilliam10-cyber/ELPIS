import { useEffect, useRef, useState } from 'react';
import { Bouton } from '../ui';

/**
 * Actions transverses de la journée : activité libre, jour de repos, export.
 *
 * Le menu d'export se referme au clic extérieur et à Échap — sans quoi il
 * restait ouvert par-dessus le contenu jusqu'au prochain clic sur son bouton.
 */
export default function BarreActions({
  onActiviteLibre,
  onJourRepos,
  reposDisponible,
  reposUtilises,
  onExportPdf,
  onExportIcal,
}) {
  const [menuOuvert, setMenuOuvert] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOuvert) return undefined;
    const auClic = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOuvert(false);
    };
    const auClavier = (e) => {
      if (e.key === 'Escape') setMenuOuvert(false);
    };
    document.addEventListener('mousedown', auClic);
    document.addEventListener('keydown', auClavier);
    return () => {
      document.removeEventListener('mousedown', auClic);
      document.removeEventListener('keydown', auClavier);
    };
  }, [menuOuvert]);

  const choisir = (action) => () => {
    action();
    setMenuOuvert(false);
  };

  return (
    <div className="tdb-actions">
      <Bouton variante="primaire" onClick={onActiviteLibre} title="Lancer le chronomètre sur une activité de ton choix">
        Activité libre
      </Bouton>

      {reposDisponible && (
        <Bouton
          onClick={onJourRepos}
          disabled={reposUtilises >= 1}
          title={reposUtilises >= 1 ? 'Quota de repos atteint (1 par semaine)' : "Suspendre le programme pour aujourd'hui"}
        >
          Jour de repos ({reposUtilises}/1)
        </Bouton>
      )}

      <div className="tdb-menu" ref={menuRef}>
        <Bouton
          onClick={() => setMenuOuvert(!menuOuvert)}
          aria-haspopup="menu"
          aria-expanded={menuOuvert}
        >
          Exporter
        </Bouton>
        {menuOuvert && (
          <div role="menu" className="tdb-menu__panneau">
            <button type="button" role="menuitem" className="tdb-menu__item" onClick={choisir(onExportPdf)}>
              Imprimer en PDF
            </button>
            <button type="button" role="menuitem" className="tdb-menu__item" onClick={choisir(onExportIcal)}>
              Ajouter à mon agenda (iCal)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
