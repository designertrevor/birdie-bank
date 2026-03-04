import { Component } from 'react'

/**
 * Catches React errors in the tree below so one broken component
 * doesn't white-screen the app. Renders a fallback and optionally logs.
 */
export class AppErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('AppErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'var(--bg, #0d2818)',
            color: 'var(--text, #f0ece0)',
            fontFamily: 'DM Sans, sans-serif',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 24, marginBottom: 12, color: 'var(--lime, #c8f04a)' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted, #7a9080)', marginBottom: 24 }}>
            Refresh the page to try again. If it keeps happening, the error has been
            logged to the console.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '12px 24px',
              background: 'var(--lime, #c8f04a)',
              color: 'var(--green-dark, #0f4225)',
              border: 'none',
              borderRadius: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
