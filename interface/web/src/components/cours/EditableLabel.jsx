import { useToast } from '../../ToastProvider';

export default function EditableLabel({ value, onRename, placeholder, style }) {
  const { toast } = useToast();

  const handleRename = () => {
    const newName = window.prompt("Nouveau nom :", value || '');
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
      >
        ✏️
      </button>
    </div>
  );
}
