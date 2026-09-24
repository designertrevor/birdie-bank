import { Component } from 'react';

/**
 * Last line of defence: if a screen throws, show a way back instead of a blank page.
 * Data is untouched — everything is already saved in localStorage.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Birdie Bank crashed:', error, info?.componentStack); }
  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="screen active">
        <div className="scroll" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div className="et" style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Something went wrong</div>
          <div className="es" style={{ color: 'var(--mute)', marginBottom: 20 }}>Your scores and rounds are safe. Head back and carry on.</div>
          <pre style={{ fontSize: 11, color: 'var(--mute)', whiteSpace: 'pre-wrap', textAlign: 'left', marginBottom: 20 }}>{String(this.state.error?.message || this.state.error)}</pre>
          <button className="full-btn" onClick={this.reset}>Back to History</button>
        </div>
      </div>
    );
  }
}
