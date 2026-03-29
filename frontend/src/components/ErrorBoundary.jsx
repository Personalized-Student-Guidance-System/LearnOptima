import React from 'react';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f7f7f5',
          padding: 24,
          fontFamily: 'sans-serif',
        }}>
          <div style={{
            maxWidth: 480,
            padding: 24,
            background: '#fff',
            border: '1px solid #e4e4e0',
            borderRadius: 8,
            color: '#111',
          }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Something went wrong</h2>
            <pre style={{ fontSize: 12, color: '#dc2626', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              {this.state.error?.message || 'Unknown error'}
            </pre>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                marginTop: 16,
                padding: '8px 16px',
                background: '#111',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
