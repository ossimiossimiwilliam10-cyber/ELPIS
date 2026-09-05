/**
 * Zone de note cliquable ouvrant l'éditeur Markdown.
 *
 * C'est un vrai bouton : en `<div onClick>`, la note était inatteignable au
 * clavier et n'était pas annoncée comme actionnable.
 */
export default function EditableNote({ value, onClick, placeholder }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Cliquer pour modifier"
      style={{
        padding:'0.3rem', width: '100%', textAlign: 'left',
        background: 'transparent', border: '1px dashed rgba(255,255,255,0.1)',
        color: 'var(--text-secondary)', borderRadius: '4px', cursor: 'pointer',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        // `font: inherit` doit précéder la taille, sinon il l'écrase.
        font: 'inherit', fontSize: '0.75rem'
      }}
    >
      {value || <em>{placeholder}</em>}
    </button>
  );
}
