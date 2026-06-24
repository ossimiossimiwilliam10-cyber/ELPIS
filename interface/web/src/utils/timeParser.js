/**
 * Parses various time input formats into a float value representing minutes.
 * 
 * Supported formats:
 * - "35" -> 35
 * - "35.5" -> 35.5
 * - "35,5" -> 35.5
 * - "35:44" -> 35 + 44/60 (approx 35.73)
 * - "35m44s" -> 35.73
 * - "35m 44s" -> 35.73
 * - "35 minutes et 44 secondes" -> 35.73
 * 
 * @param {string} input - The time string input from the user
 * @returns {number|null} - The parsed time in minutes, or null if invalid
 */
export function parseTimeInput(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return input >= 0 ? input : null;
  if (typeof input !== 'string') return null;

  const trimmed = input.trim().toLowerCase();
  if (trimmed === '') return null;

  // Pattern 1: MM:SS
  const colonMatch = trimmed.match(/^(\d+):(\d+)$/);
  if (colonMatch) {
    const min = parseInt(colonMatch[1], 10);
    const sec = parseInt(colonMatch[2], 10);
    return min + (sec / 60);
  }

  // Pattern 2: Natural language with minutes and seconds
  // Handles: "35m44s", "35m 44", "35 minutes 44 secondes", "35 min et 44 sec", "35 minutes et 44 secondes"
  const naturalMatch = trimmed.match(/^(\d+)\s*(?:m|min|minutes?)\s*(?:et\s+)?(\d+)\s*(?:s|sec|secondes?)?$/);
  if (naturalMatch) {
    const min = parseInt(naturalMatch[1], 10);
    const sec = parseInt(naturalMatch[2], 10);
    return min + (sec / 60);
  }

  // Pattern 3: Simple float/int
  // Replace comma with dot for French locales
  const floatVal = parseFloat(trimmed.replace(',', '.'));
  if (!isNaN(floatVal) && floatVal >= 0) {
    return floatVal;
  }

  return null;
}
