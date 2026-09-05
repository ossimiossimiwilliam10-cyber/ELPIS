import { useToast } from '../../ToastProvider';
import useInputModal from '../../hooks/useInputModal';
import InputModal from '../InputModal';

export default function EditableLabel({ value, onRename, placeholder, style }) {
  const { toast } = useToast();
  const { prompt, isOpen, config, handleConfirm, handleCancel } = useInputModal();

  const handleRename = async () => {
    const newName = await prompt("Nouveau nom :", value || '');
    if (newName !== null) {
      if (newName.trim() === '') {
        toast.error("Le nom ne peut pas être vide.");
      } else {
        onRename(newName.trim());
      }
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, ...style }}>
      <span title={value} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {value || <em style={{color:'var(--text-secondary)'}}>{placeholder}</em>}
      </span>
      <button
        onClick={handleRename}
        style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'0.9rem', padding:'0.2rem', flexShrink: 0}}
        title="Renommer"
        // Sans libellé explicite, le bouton s'annonçait « ✏️ » : le contenu prime
        // sur l'attribut `title` dans le calcul du nom accessible.
        aria-label={value ? `Renommer « ${value} »` : 'Renommer'}
      >
        <span aria-hidden="true">✏️</span>
      </button>
      <InputModal
        isOpen={isOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title={config.title}
        defaultValue={config.defaultValue}
        placeholder={config.placeholder}
      />
    </div>
  );
}
