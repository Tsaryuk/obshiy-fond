import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0d0f14', color: '#e2e8f0',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 24, fontFamily: "'DM Sans', sans-serif",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Что-то пошло не так</div>
          <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', maxWidth: 320, lineHeight: 1.5, marginBottom: 20 }}>
            Произошла ошибка в приложении. Попробуйте обновить страницу.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#6366f1', color: '#fff', border: 'none', borderRadius: 12,
              padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Обновить страницу
          </button>
          {this.state.error && (
            <div style={{
              marginTop: 20, padding: '10px 14px', background: '#1e2330',
              borderRadius: 10, fontSize: 11, color: '#f87171', maxWidth: 400,
              overflow: 'auto', fontFamily: 'monospace',
            }}>
              {this.state.error.toString()}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
