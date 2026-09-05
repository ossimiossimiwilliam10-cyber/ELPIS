import EditableLabel from './EditableLabel';
import EditableNote from './EditableNote';
import StarRating from './StarRating';
import InfoTooltip from '../InfoTooltip';

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

/** Jeton de couleur du type, pour le liseré et le fond de la ligne. */
const TON = { TD: 'td', TP: 'tp', Annale: 'annale' };

export default function ExerciceRow({
  exercice,
  type,
  onUpdate,
  onDelete,
  onUploadPdf,
  onEditNotes,
}) {
  const allPdfs = [...(exercice.pdfPaths || [])];
  if (exercice.pdfPath && !allPdfs.includes(exercice.pdfPath)) {
    allPdfs.unshift(exercice.pdfPath);
  }

  const toDateInput = (val) => {
    if (!val || typeof val !== 'string') return '';
    if (val.includes('/')) {
      const parts = val.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return val.substring(0, 10);
  };

  const ton = TON[type] || 'td';
  // Une seule date planifiée, quel que soit le type : le champ portait deux noms
  // différents (`dateTP` et `datePrevue`) selon la branche du rendu.
  const champDate = type === 'TP' ? 'dateTP' : 'datePrevue';

  return (
    <div className={`exercice-ligne exercice-ligne--${ton}`}>
      <button
        type="button"
        className="exercice-ligne__action exercice-ligne__action--danger"
        onClick={onDelete}
        title="Supprimer"
        // Sans libellé propre, ce bouton s'annonçait « Supprimer » comme celui
        // de la fenêtre de confirmation, impossible à distinguer à l'oreille.
        aria-label={`Supprimer ${exercice.titre || "l'exercice"}`}
      >
        <span aria-hidden="true">✕</span>
      </button>

      {/* L'état tient compte de tous les documents liés : un exercice n'ayant
          que des `pdfPaths` paraissait dépourvu de document. */}
      <button
        type="button"
        className={`exercice-ligne__action${allPdfs.length > 0 ? ' est-actif' : ''}`}
        onClick={onUploadPdf}
        title={
          allPdfs.length > 1 ? `${allPdfs.length} documents liés — cliquer pour en ajouter un`
          : allPdfs.length === 1 ? 'Document lié — cliquer pour remplacer'
          : 'Lier un PDF ou une image'
        }
        aria-label={allPdfs.length > 0 ? `${allPdfs.length} document(s) lié(s)` : 'Lier un document'}
      >
        <span aria-hidden="true">📄</span>
      </button>

      <div className="exercice-ligne__corps">
        <EditableLabel
          value={exercice.titre}
          onRename={(v) => onUpdate('titre', v)}
          placeholder={type === 'Annale' ? "Nom de l'annale" : "Nom de l'exercice"}
          style={{ fontSize: 'var(--texte-sm)' }}
        />
        <EditableNote
          value={exercice.notes}
          onClick={onEditNotes}
          placeholder="+ Ajouter une note (markdown supporté)"
        />
        <label className="exercice-ligne__date">
          <span>À partir du</span>
          <input
            type="date"
            className="el-champ"
            value={toDateInput(exercice[champDate])}
            onChange={(e) => onUpdate(champDate, e.target.value)}
            aria-label={`Date de début de ${exercice.titre || type}`}
          />
        </label>
      </div>

      <div className="exercice-ligne__difficulte">
        <span className="el-texte--mention">
          <InfoTooltip content="Définit la fréquence d'apparition dans ton planning. Plus il y a d'étoiles, plus le système te le proposera souvent." width={200}>
            Difficulté <span aria-hidden="true">ℹ️</span>
          </InfoTooltip>
        </span>
        <StarRating
          value={exercice.difficulteInitiale || (type === 'Annale' ? 3 : 1)}
          onChange={(v) => onUpdate('difficulteInitiale', v)}
        />
      </div>
    </div>
  );
}
