/**
 * Génération de fichiers CSV.
 *
 * Les champs étaient concaténés à la main entre guillemets : un titre contenant
 * lui-même un guillemet ou un point-virgule décalait toutes les colonnes du
 * fichier exporté.
 */

/** Échappe une valeur selon la RFC 4180 (guillemets doublés). */
export function echapperCsv(valeur) {
  if (valeur === null || valeur === undefined) return '';
  const texte = String(valeur);
  return `"${texte.replace(/"/g, '""')}"`;
}

/**
 * Construit un CSV complet à partir d'en-têtes et de lignes.
 * @param {string[]} entetes
 * @param {Array<Array<*>>} lignes
 */
export function construireCsv(entetes, lignes) {
  const toutes = [entetes, ...lignes];
  return toutes.map(ligne => ligne.map(echapperCsv).join(',')).join('\r\n');
}

/**
 * Déclenche le téléchargement d'un CSV.
 *
 * Passe par un Blob plutôt que par une URL `data:` encodée : `encodeURI` laisse
 * intacts les `#` et `&`, qui tronquaient le fichier, et les navigateurs bornent
 * la taille des URL de données.
 */
export function telechargerCsv(nomFichier, contenu) {
  // BOM UTF-8 : sans lui, Excel affiche les accents en caractères illisibles.
  const blob = new Blob([`﻿${contenu}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}
