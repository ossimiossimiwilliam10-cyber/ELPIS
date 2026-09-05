import { useCallback, useEffect, useState } from 'react';

/**
 * Résout les jetons de couleur pour Recharts.
 *
 * Recharts pose `fill` et `stroke` comme attributs SVG, et un attribut de
 * présentation n'accepte pas `var(--x)` : les graphiques restaient donc câblés
 * sur des hexadécimaux écrits à la main, qui ne suivaient ni le thème horaire
 * ni le mode clair. On lit les jetons une fois, puis à chaque changement de
 * thème (l'application bascule en ajoutant une classe sur `<html>`).
 */

// Replis identiques aux valeurs de `tokens.css` : jsdom ne résout pas les
// variables CSS, et un graphique sans couleur serait invisible en test.
const REPLIS = {
  '--type-cm': '#3B82F6',
  '--type-td': '#34D399',
  '--type-tp': '#FBBF24',
  '--type-annale': '#EF4444',
  '--type-anki': '#A855F7',
  '--type-projet': '#22D3EE',
  '--accent': '#3B82F6',
  '--accent-clair': '#60A5FA',
  '--succes': '#10B981',
  '--attention': '#F59E0B',
  '--danger': '#EF4444',
  '--info': '#60A5FA',
  '--texte-doux': '#94A3B8',
  '--texte-fort': '#F8FAFC',
  '--surface-1': '#0F172A',
  '--surface-2': '#1E293B',
  '--bord-discret': 'rgba(148, 163, 184, 0.14)',
  '--bord-normal': 'rgba(148, 163, 184, 0.26)',
};

const JETONS = Object.keys(REPLIS);

function lireJetons() {
  if (typeof window === 'undefined' || !window.getComputedStyle) return { ...REPLIS };
  const styles = window.getComputedStyle(document.documentElement);
  const resolues = {};
  for (const jeton of JETONS) {
    const valeur = styles.getPropertyValue(jeton).trim();
    resolues[jeton] = valeur || REPLIS[jeton];
  }
  return resolues;
}

export default function useCouleursGraphiques() {
  const [jetons, setJetons] = useState(lireJetons);

  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return undefined;
    const observateur = new MutationObserver(() => setJetons(lireJetons()));
    observateur.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observateur.disconnect();
  }, []);

  /** `couleur('type-cm')` ou `couleur('succes')`. */
  const couleur = useCallback(
    (nom) => jetons[`--${nom}`] || jetons[nom] || REPLIS[`--${nom}`] || 'currentColor',
    [jetons],
  );

  /** Style du panneau d'infobulle, aligné sur les surfaces de l'application. */
  const styleInfobulle = {
    backgroundColor: couleur('surface-2'),
    border: `1px solid ${couleur('bord-normal')}`,
    borderRadius: '8px',
    color: couleur('texte-fort'),
    fontSize: '0.8125rem',
  };

  return { couleur, styleInfobulle, grille: couleur('bord-discret'), axe: couleur('texte-doux') };
}
