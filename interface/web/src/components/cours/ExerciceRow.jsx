import EditableLabel from './EditableLabel';
import EditableNote from './EditableNote';
import StarRating from './StarRating';

/**
 * ExerciceRow — Ligne d'exercice éditable (titre, PDF, notes Markdown, difficulté).
 * Utilisé dans MatiereCard (Bibliothèque) et PreparationHebdoPage (Préparation Hebdo).
 *
 * @param {Object}   exercice    - L'objet exercice (doit avoir titre, pdfPath?, notes?, difficulteInitiale?, dateTP?)
 * @param {string}   type        - 'TD' | 'TP' | 'Annale'
 * @param {Function} onUpdate    - (fieldName, value) => void
 * @param {Function} onDelete    - () => void
 * @param {Function} onUploadPdf - () => void (déclenche l'upload et appelle onUpdate('pdfPath', url))
 * @param {Function} onEditNotes - () => void (ouvre MarkdownModal)
 */
export default function ExerciceRow({
  exercice,
  type,
  onUpdate,
  onDelete,
  onUploadPdf,
  onEditNotes,
}) {
  const palette = {
    TD:     { border: 'rgba(52,211,153,0.3)',  bg: 'rgba(52,211,153,0.05)' },
    TP:     { border: 'rgba(251,191,36,0.3)',  bg: 'rgba(251,191,36,0.05)' },
    Annale: { border: 'rgba(239,68,68,0.3)',   bg: 'rgba(239,68,68,0.05)' },
  };
  const colors = palette[type] || palette.TD;

  return (
    <div style={{
      display: 'flex', gap: '0.5rem', alignItems: 'center',
      background: colors.bg, padding: '0.4rem 0.5rem', borderRadius: '4px',
      border: `1px solid ${colors.border}`, marginTop: '0.4rem', minWidth: 0
    }}>
      {/* Bouton supprimer */}
      <button
        onClick={onDelete}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--danger-color)', padding: 0, flexShrink: 0 }}
        title="Supprimer"
      >
        ❌
      </button>

      {/* Bouton PDF */}
      <button
        onClick={onUploadPdf}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', opacity: exercice.pdfPath ? 1 : 0.4, padding: 0, flexShrink: 0 }}
        title={exercice.pdfPath ? "Document lié — cliquer pour remplacer" : "Lier un PDF ou une image"}
      >
        📄
      </button>

      {/* Contenu éditable */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
        <EditableLabel
          value={exercice.titre}
          onRename={(v) => onUpdate('titre', v)}
          placeholder={type === 'Annale' ? "Nom de l'annale" : "Nom de l'exercice"}
          style={{ fontSize: '0.85rem' }}
        />
        <EditableNote
          value={exercice.notes}
          onClick={onEditNotes}
          placeholder="+ Ajouter une note (markdown supporté)"
        />
        {type === 'TP' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.1rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>📅 Date du TP :</span>
            <input
              type="date"
              value={exercice.dateTP || ''}
              onChange={(e) => onUpdate('dateTP', e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
                color: 'var(--text-primary)', borderRadius: '4px', padding: '0.1rem 0.3rem', fontSize: '0.7rem'
              }}
            />
          </div>
        )}
      </div>

      {/* Difficulté */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem', flexShrink: 0 }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Difficulté</span>
        <StarRating
          value={exercice.difficulteInitiale || (type === 'Annale' ? 3 : 1)}
          onChange={(v) => onUpdate('difficulteInitiale', v)}
        />
      </div>
    </div>
  );
}
