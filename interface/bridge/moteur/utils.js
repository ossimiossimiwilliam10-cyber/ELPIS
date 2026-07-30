// utils.js
// Utilitaires partagés pour l'ensemble du moteur métier

function normalizeDateStr(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  if (parts[0].length === 4) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  } else {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
}

/**
 * Parses a date string into a local Date object at 00:00:00.
 * Handles: "YYYY-MM-DD", "YYYY-MM-DDTHH:MM:SS", "DD-MM-YYYY".
 * Prevents timezone shift bugs (unlike string + 'T00:00:00' which is parsed as UTC).
 */
function parseDateLocal(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date(NaN);
  const trimmed = dateStr.trim();
  // ISO datetime with time component: "2026-09-08T10:30:00"
  const isoDateTimeMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (isoDateTimeMatch) return new Date(+isoDateTimeMatch[1], +isoDateTimeMatch[2] - 1, +isoDateTimeMatch[3]);
  // ISO date only: "2026-09-08"
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3]);
  // Legacy: "08-09-2026"
  const legacyMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (legacyMatch) return new Date(+legacyMatch[3], +legacyMatch[2] - 1, +legacyMatch[1]);
  return new Date(NaN);
}

module.exports = {
  normalizeDateStr,
  parseDateLocal
};
