/**
 * StarRating — Composant 5 étoiles pour la difficulté.
 * Réutilisable dans MatiereCard et ExerciceRow.
 *
 * Les étoiles sont de vrais boutons : en `<span>` cliquables, le réglage était
 * inatteignable au clavier et muet pour un lecteur d'écran.
 */
export default function StarRating({ value, onChange, tooltip }) {
  const note = value || 1;

  return (
    <div
      style={{ display: 'flex', gap: '2px' }}
      role="group"
      aria-label={tooltip || "Difficulté (1 à 5 étoiles)"}
    >
      {[1, 2, 3, 4, 5].map(v => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-label={`${v} étoile${v > 1 ? 's' : ''}`}
          aria-pressed={v === note}
          title={tooltip || "Difficulté (1 à 5 étoiles)"}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            lineHeight: 1,
            cursor: 'pointer',
            color: v <= note ? '#fbbf24' : 'rgba(255,255,255,0.2)',
            fontSize: '0.9rem',
            userSelect: 'none'
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}
