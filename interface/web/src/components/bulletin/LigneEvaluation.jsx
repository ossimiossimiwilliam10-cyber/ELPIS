import EditableLabel from '../cours/EditableLabel';

/**
 * Une épreuve dans le bulletin : nom, coefficient, type, date, statut et note.
 *
 * Ce bloc portait à lui seul une trentaine de déclarations de style écrites à la
 * main, dupliquées pour chaque état (verrouillé, hors règle, absent).
 */
export default function LigneEvaluation({
  evaluation,
  verrouillee,
  horsRegle,
  poidsDansUE,
  onRenommer,
  onChangerChamp,
  onChangerNote,
  onSupprimer,
}) {
  const statut = evaluation.statut || 'present';

  return (
    <div className={`evaluation${verrouillee ? ' est-verrouillee' : ''}${horsRegle ? ' est-hors-regle' : ''}`}>
      {horsRegle && (
        <span
          className="evaluation__alerte"
          title={`Cette note pèse ${(poidsDansUE * 100).toFixed(1)} % de l'UE. Le règlement plafonne à 50 %.`}
        >
          ⚠️ &gt; 50 % de l'UE
        </span>
      )}

      {!verrouillee && (
        <button
          type="button"
          className="evaluation__retirer"
          onClick={onSupprimer}
          aria-label={`Supprimer l'épreuve ${evaluation.nom || 'sans nom'}`}
          title="Supprimer l'épreuve"
        >
          ×
        </button>
      )}

      <div className="evaluation__nom">
        {verrouillee ? (
          <strong>{evaluation.nom}</strong>
        ) : (
          <EditableLabel
            value={evaluation.nom}
            onRename={(valeur) => onRenommer(valeur)}
            placeholder="Nom de l'épreuve"
            style={{ fontWeight: 'var(--graisse-forte)' }}
          />
        )}
      </div>

      <div className="evaluation__reglages">
        <span>Coef.</span>
        {verrouillee ? (
          <strong className="el-mono">{evaluation.coefficient}</strong>
        ) : (
          <EditableLabel
            value={String(evaluation.coefficient)}
            onRename={(valeur) => onChangerChamp('coefficient', valeur)}
          />
        )}

        <select
          className="el-champ"
          style={{ width: 'auto', minHeight: '28px', padding: '2px var(--esp-2)', fontSize: 'var(--texte-xs)' }}
          disabled={verrouillee}
          value={evaluation.type || 'SC'}
          aria-label="Type d'épreuve"
          title="AC : avec convocation · SC : sans convocation"
          onChange={(e) => onChangerChamp('type', e.target.value)}
        >
          <option value="SC">SC</option>
          <option value="AC">AC</option>
        </select>
      </div>

      <input
        type="date"
        className="el-champ"
        style={{ minHeight: '28px', padding: '2px var(--esp-2)', fontSize: 'var(--texte-xs)' }}
        disabled={verrouillee}
        value={evaluation.date || ''}
        aria-label="Date de l'épreuve"
        onChange={(e) => onChangerChamp('date', e.target.value || null)}
      />

      <select
        className="el-champ"
        style={{ minHeight: '30px', padding: '2px var(--esp-2)', fontSize: 'var(--texte-xs)' }}
        disabled={verrouillee}
        value={statut}
        aria-label="Statut de présence"
        onChange={(e) => onChangerChamp('statut', e.target.value)}
      >
        <option value="present">Présent (noté)</option>
        <option value="excuse">Absence justifiée</option>
        <option value="defaillant">Défaillant</option>
      </select>

      {statut === 'present' && (
        <input
          type="number"
          className="el-champ evaluation__note"
          disabled={verrouillee}
          step="0.1" min="0" max="20"
          placeholder="— / 20"
          aria-label={`Note de ${evaluation.nom || 'l\'épreuve'}`}
          // `defaultValue` plutôt que `value` : la note ne s'enregistre qu'à la
          // sortie du champ, pour ne pas recalculer toute la moyenne à chaque frappe.
          defaultValue={evaluation.note !== null && evaluation.note !== undefined ? evaluation.note : ''}
          onBlur={(e) => onChangerNote(e.target.value)}
        />
      )}

      {statut === 'excuse' && (
        <div className="evaluation__statut evaluation__statut--excuse">Neutralisée</div>
      )}
      {statut === 'defaillant' && (
        <div className="evaluation__statut evaluation__statut--defaillant">Défaillant</div>
      )}
    </div>
  );
}
