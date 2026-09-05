/**
 * Écran affiché après l'extinction du serveur ELPIS.
 *
 * Rendu au niveau de l'application : c'est un état global, pas une responsabilité de
 * la barre latérale (qui le peignait auparavant en position fixe par-dessus tout).
 */
export default function ShutdownScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontFamily: 'inherit',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        zIndex: 99999,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>ELPIS est éteint.</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Tu peux fermer cet onglet.</p>
      </div>
    </div>
  );
}
