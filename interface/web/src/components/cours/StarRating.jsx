/**
 * StarRating — Composant 5 étoiles pour la difficulté.
 * Réutilisable dans MatiereCard et ExerciceRow.
 */
export default function StarRating({ value, onChange, tooltip }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }} title={tooltip || "Difficulté (1 à 5 étoiles)"}>
      {[1, 2, 3, 4, 5].map(v => (
        <span
          key={v}
          onClick={() => onChange(v)}
          style={{
            cursor: 'pointer',
            color: v <= (value || 1) ? '#fbbf24' : 'rgba(255,255,255,0.2)',
            fontSize: '0.9rem',
            userSelect: 'none'
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}
