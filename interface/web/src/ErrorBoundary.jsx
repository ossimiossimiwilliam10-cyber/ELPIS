import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ELPIS ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--bg-primary, #0f172a)',
          color: 'var(--text-primary, #f1f5f9)',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '2rem',
          gap: '1rem'
        }}>
          <div style={{ fontSize: '4rem' }}>⚠️</div>
          <h1 style={{ margin: 0 }}>Quelque chose s'est mal passé</h1>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', maxWidth: '500px' }}>
            Une erreur inattendue est survenue. Tes données sont sauvegardées automatiquement, tu peux recharger la page en toute sécurité.
          </p>
          {this.state.error && (
            <details style={{ maxWidth: '600px', textAlign: 'left', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>Détails techniques</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '0.5rem' }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleRetry}
            style={{
              background: 'var(--accent-primary, #3b82f6)',
              color: 'white',
              border: 'none',
              padding: '0.8rem 2rem',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginTop: '1rem'
            }}
          >
            Recharger ELPIS
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
