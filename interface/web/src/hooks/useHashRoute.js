import { useEffect } from 'react';
import { TAB_IDS, DEFAULT_TAB, getTabLabel } from '../navigation';

/**
 * Synchronise l'onglet actif avec le fragment d'URL (`#/bulletin`).
 *
 * Sans cela, l'application n'a qu'un seul état d'historique : le bouton Retour du
 * navigateur sort de l'app, aucune page ne peut être mise en favori ou rouverte, et
 * sur Android (Capacitor) le bouton Retour matériel ferme l'application.
 *
 * Le sens URL → état et le sens état → URL coexistent sans boucle : le second effet
 * ne réécrit le fragment que s'il diffère déjà de l'onglet courant.
 *
 * @param {string} activeTab
 * @param {(tab: string) => void} setActiveTab
 */
export function useHashRoute(activeTab, setActiveTab) {
  // URL → état (chargement initial, bouton Retour, lien collé)
  useEffect(() => {
    const readHash = () => {
      const tab = window.location.hash.replace(/^#\/?/, '');
      if (TAB_IDS.includes(tab)) {
        setActiveTab(tab);
      } else if (window.location.hash) {
        // Fragment inconnu : on retombe sur l'accueil plutôt que sur un écran vide.
        setActiveTab(DEFAULT_TAB);
      }
    };

    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, [setActiveTab]);

  // état → URL (navigation par la barre latérale)
  useEffect(() => {
    const target = `#/${activeTab}`;
    if (window.location.hash !== target) {
      window.location.hash = target;
    }

    const label = getTabLabel(activeTab);
    document.title = label ? `ELPIS — ${label}` : 'ELPIS';
  }, [activeTab]);
}
