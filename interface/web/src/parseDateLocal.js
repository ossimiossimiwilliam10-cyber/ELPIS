/**
 * Parse une date dans l'un des deux formats possibles :
 *   YYYY-MM-DD (format HTML date input) ou DD-MM-YYYY (format legacy français).
 * Retourne un objet Date local à minuit, ou null si invalide.
 */
export function parseDateLocal(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();

  // Format YYYY-MM-DD (ISO-like, sorti par <input type="date">)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3]);
  }

  // Format DD-MM-YYYY (legacy / factory reset)
  const legacyMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (legacyMatch) {
    return new Date(+legacyMatch[3], +legacyMatch[2] - 1, +legacyMatch[1]);
  }

  return null;
}
