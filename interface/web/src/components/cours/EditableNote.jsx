export default function EditableNote({ value, onClick, placeholder }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding:'0.3rem', fontSize:'0.75rem',
        background: 'transparent', border: '1px dashed rgba(255,255,255,0.1)',
        color: 'var(--text-secondary)', borderRadius: '4px', cursor: 'pointer',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
      }}
      title="Cliquer pour modifier"
    >
      {value || <em>{placeholder}</em>}
    </div>
  );
}
